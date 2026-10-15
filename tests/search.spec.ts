import { expect, test, type Page, type Route } from "@playwright/test";
import plantRecords from "../public/datasets/plants.json";
import type { Plant } from "../types/Plant";

type Suggestion = Pick<Plant, "PLANT_ID" | "NAME" | "COMMON_NAME" | "FAMILY">;

const suggestions: Suggestion[] = [
  { PLANT_ID: "search-test-ohia", NAME: "Metrosideros polymorpha", COMMON_NAME: "ʻŌhiʻa lehua", FAMILY: "Myrtaceae" },
  { PLANT_ID: "search-test-naupaka", NAME: "Scaevola taccada", COMMON_NAME: "Naupaka kahakai", FAMILY: "Goodeniaceae" },
];

async function mockPlantApi(page: Page, searchHandler?: (route: Route, query: string) => Promise<void>) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/plants/search") {
      if (searchHandler) await searchHandler(route, url.searchParams.get("q") ?? "");
      else await route.fulfill({ json: suggestions });
    } else if (url.pathname === "/api/plants") {
      const plants: Plant[] = [{ ...suggestions[0], PHOTOS_FLAT: null }];
      await route.fulfill({
        json: url.searchParams.has("offset")
          ? { plants, total: plants.length, nextOffset: null }
          : plants,
      });
    } else if (url.pathname === "/api/plant") {
      const plant = suggestions.find((record) => record.PLANT_ID === url.searchParams.get("plantId"));
      await route.fulfill({ json: { ...plant, PHOTOS_FLAT: null, GENERAL_INFORMATION: "Search navigation test plant." } });
    } else {
      await route.fulfill({ status: 501, json: { message: "Unexpected API request in search test" } });
    }
  });
}

test("the search API finds plants beyond the loaded catalog and returns lightweight accent-insensitive suggestions", async ({ request }) => {
  const latePlant = plantRecords.at(-1)!;
  const response = await request.get("/api/plants/search", { params: { q: latePlant.NAME! } });
  expect(response.status()).toBe(200);
  const matches: Suggestion[] = await response.json();
  expect(matches.length).toBeGreaterThan(0);
  expect(matches.length).toBeLessThanOrEqual(6);
  expect(matches.some((record) => record.PLANT_ID === latePlant.PLANT_ID)).toBe(true);
  for (const record of matches) {
    expect(Object.keys(record).sort()).toEqual(["COMMON_NAME", "FAMILY", "NAME", "PLANT_ID"]);
  }

  const ohia = await request.get("/api/plants/search", { params: { q: "ohia" } });
  const uppercase = await request.get("/api/plants/search", { params: { q: "OHIA" } });
  expect(ohia.status()).toBe(200);
  expect(uppercase.status()).toBe(200);
  const ohiaMatches: Suggestion[] = await ohia.json();
  expect(ohiaMatches.length).toBeLessThanOrEqual(6);
  expect(ohiaMatches.some((record) => record.PLANT_ID === "540")).toBe(true);
  expect(await uppercase.json()).toEqual(ohiaMatches);
});

test("the search API handles short queries and rejects excessively long queries", async ({ request }) => {
  for (const q of ["", "a", " a "]) {
    const response = await request.get("/api/plants/search", { params: { q } });
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual([]);
  }
  expect((await request.get("/api/plants/search", { params: { q: "x".repeat(101) } })).status()).toBe(400);
});

test("search waits for two trimmed characters and debounces changes into one request", async ({ page }) => {
  await page.clock.install();
  const queries: string[] = [];
  await mockPlantApi(page, async (route, query) => {
    queries.push(query);
    await route.fulfill({ json: suggestions });
  });
  await page.goto("/");
  const search = page.getByRole("combobox", { name: "Search plants", exact: true });
  await expect(search).toHaveAttribute("placeholder", "Search plants…");
  await search.fill(" m ");
  await page.clock.runFor(500);
  expect(queries).toEqual([]);
  await search.fill("me");
  await page.clock.runFor(150);
  await search.fill("  met  ");
  await page.clock.runFor(249);
  expect(queries).toEqual([]);
  await page.clock.runFor(1);
  await expect(page.getByRole("listbox", { name: "Plant suggestions" }).getByRole("option")).toHaveCount(2);
  expect(queries).toEqual(["met"]);
});

test("search suggestions show both names and support keyboard selection", async ({ page }) => {
  await mockPlantApi(page);
  await page.goto("/");
  const search = page.getByRole("combobox", { name: "Search plants", exact: true });
  await search.fill("met");
  const options = page.getByRole("listbox", { name: "Plant suggestions" }).getByRole("option");
  await expect(options).toHaveCount(2);
  await expect(options.nth(0)).toContainText("Metrosideros polymorpha");
  await expect(options.nth(0)).toContainText("ʻŌhiʻa lehua");

  await expect(search).toHaveAttribute("aria-activedescendant", await options.nth(0).getAttribute("id") ?? "");
  await search.press("ArrowDown");
  await expect(search).toHaveAttribute("aria-activedescendant", await options.nth(1).getAttribute("id") ?? "");
  await search.press("ArrowUp");
  await expect(search).toHaveAttribute("aria-activedescendant", await options.nth(0).getAttribute("id") ?? "");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/plant\/search-test-ohia$/);
  await expect(page.getByRole("heading", { name: "Metrosideros polymorpha", exact: true })).toBeVisible();
  await expect(page.getByRole("listbox", { name: "Plant suggestions" })).toHaveCount(0);
});

test("Enter opens the first suggestion as soon as search results arrive", async ({ page }) => {
  await mockPlantApi(page);
  await page.goto("/");
  const search = page.getByRole("combobox", { name: "Search plants", exact: true });
  await search.fill("met");
  const firstOption = page.getByRole("option").first();
  await expect(firstOption).toBeVisible();
  await expect(search).toHaveAttribute("aria-activedescendant", await firstOption.getAttribute("id") ?? "");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/plant\/search-test-ohia$/);
  await expect(page.getByRole("heading", { name: "Metrosideros polymorpha", exact: true })).toBeVisible();
});

test("search explains empty results and retries a failed query", async ({ page }) => {
  const queries: string[] = [];
  let failures = 0;
  await mockPlantApi(page, async (route, query) => {
    queries.push(query);
    if (query === "no-match") await route.fulfill({ json: [] });
    else if (failures++ === 0) await route.fulfill({ status: 500, json: { message: "Search unavailable" } });
    else await route.fulfill({ json: suggestions });
  });
  await page.goto("/");
  const search = page.getByRole("combobox", { name: "Search plants", exact: true });
  await search.fill("no-match");
  await expect(page.getByText("No plants found.", { exact: true })).toBeVisible();
  await expect(page.getByRole("option")).toHaveCount(0);
  await search.fill("met");
  await expect(page.getByText("Search couldn’t load. Please try again.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Retry search", exact: true }).click();
  await expect(page.getByRole("option")).toHaveCount(2);
  await expect(page.getByText("Search couldn’t load. Please try again.", { exact: true })).toHaveCount(0);
  expect(queries).toEqual(["no-match", "met", "met"]);
});

test("changed queries ignore late responses and clearing the input hides suggestions", async ({ page }) => {
  // Keep the first request alive so the stale-response guard is tested even without transport cancellation.
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      return originalFetch(input, url.includes("/api/plants/search?") ? { ...init, signal: undefined } : init);
    };
  });
  let releaseResponse!: () => void;
  const pendingResponse = new Promise<void>((resolve) => { releaseResponse = resolve; });
  let signalRequestStarted!: () => void;
  const requestStarted = new Promise<void>((resolve) => { signalRequestStarted = resolve; });
  await mockPlantApi(page, async (route, query) => {
    if (query === "met") {
      signalRequestStarted();
      await pendingResponse;
      await route.fulfill({ json: [suggestions[0]] });
    } else {
      await route.fulfill({ json: [suggestions[1]] });
    }
  });
  await page.goto("/");
  const search = page.getByRole("combobox", { name: "Search plants", exact: true });
  await search.fill("met");
  await expect(page.getByText("Searching plants…", { exact: true })).toBeVisible();
  await requestStarted;
  await search.fill("nau");
  await expect(page.getByRole("option")).toHaveCount(1);
  await expect(page.getByRole("option")).toContainText("Scaevola taccada");
  const lateResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/api/plants/search" && url.searchParams.get("q") === "met";
  });
  releaseResponse();
  await lateResponse;
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  await expect(page.getByRole("option")).toHaveCount(1);
  await expect(page.getByRole("option")).toContainText("Scaevola taccada");
  await page.getByLabel("Clear search", { exact: true }).click();
  await expect(page.getByRole("listbox", { name: "Plant suggestions" })).toHaveCount(0);
  await expect(search).toHaveAttribute("aria-expanded", "false");
});

test("clearing the input aborts a pending search and keeps the suggestions closed", async ({ page }) => {
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("/api/plants/search?")) {
        init?.signal?.addEventListener("abort", () => {
          document.documentElement.setAttribute("data-search-request-aborted", "true");
        }, { once: true });
      }
      return originalFetch(input, init);
    };
  });
  let releaseResponse!: () => void;
  const pendingResponse = new Promise<void>((resolve) => { releaseResponse = resolve; });
  let signalRequestStarted!: () => void;
  const requestStarted = new Promise<void>((resolve) => { signalRequestStarted = resolve; });
  await mockPlantApi(page, async (route) => {
    signalRequestStarted();
    await pendingResponse;
    if (!route.request().failure()) await route.fulfill({ json: suggestions });
  });
  await page.goto("/");
  const search = page.getByRole("combobox", { name: "Search plants", exact: true });
  await search.fill("met");
  await expect(page.getByText("Searching plants…", { exact: true })).toBeVisible();
  await requestStarted;
  await page.getByLabel("Clear search", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-search-request-aborted", "true");
  releaseResponse();
  await expect(page.getByRole("listbox", { name: "Plant suggestions" })).toHaveCount(0);
  await expect(page.getByText("Searching plants…", { exact: true })).toHaveCount(0);
  await expect(search).toHaveAttribute("aria-expanded", "false");
});

test("Escape, focus leaving the search, and outside clicks dismiss suggestions", async ({ page }) => {
  await mockPlantApi(page);
  await page.goto("/");
  const search = page.getByRole("combobox", { name: "Search plants", exact: true });
  const listbox = page.getByRole("listbox", { name: "Plant suggestions" });
  await search.fill("met");
  await expect(listbox).toBeVisible();
  await search.press("Escape");
  await expect(listbox).toHaveCount(0);
  await expect(search).toHaveValue("met");

  await search.fill("nau");
  await expect(listbox).toBeVisible();
  await page.locator('nav[aria-label="Main navigation"] a[href="/map"]').focus();
  await expect(listbox).toHaveCount(0);

  await search.fill("ohia");
  await expect(listbox).toBeVisible();
  await page.locator("main").click({ position: { x: 8, y: 8 } });
  await expect(listbox).toHaveCount(0);
});

test("search fits phone, tablet, and desktop layouts, works from saved plants, and opens clicked suggestions", async ({ page }, testInfo) => {
  await mockPlantApi(page);
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/plant_list");
    const search = page.getByRole("combobox", { name: "Search plants", exact: true });
    await expect(search).toBeVisible();
    await search.fill("met");
    const listbox = page.getByRole("listbox", { name: "Plant suggestions" });
    await expect(listbox).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    for (const element of [search, listbox]) {
      const box = await element.boundingBox();
      expect(box).not.toBeNull();
      if (!box) throw new Error("Search needs a visible layout box");
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    }
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await testInfo.attach(`search-suggestions-${width}px`, {
      body: await page.screenshot({ animations: "disabled" }),
      contentType: "image/png",
    });
    await listbox.getByRole("option").nth(1).click();
    await expect(page).toHaveURL(/\/plant\/search-test-naupaka$/);
    await expect(page.getByRole("heading", { name: "Scaevola taccada", exact: true })).toBeVisible();
    await expect(search).toBeVisible();
    await page.goto("/map");
    await expect(search).toBeVisible();
  }
});
