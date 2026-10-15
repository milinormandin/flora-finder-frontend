import { expect, test, type Page, type Route } from "@playwright/test";
import plantRecords from "../public/datasets/plants.json";
import type { Plant } from "../types/Plant";
import type { PlantPage } from "../types/PlantPage";

const catalog: Plant[] = plantRecords;

function normalized(value: string) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z]/g, "");
}

function matchingPlants(plants: Plant[], params: URLSearchParams): Plant[] {
  const letter = normalized(params.get("letter") ?? "");
  const island = params.get("island");
  return plants.filter((plant) => {
    const name = plant.NAME?.trim() || plant.COMMON_NAME?.trim() || "Unnamed plant";
    if (letter && !normalized(name).startsWith(letter)) return false;
    if (!island) return true;
    if (island === "unrecorded") return !plant.NATURAL_RANGE?.trim();
    const tokens = (plant.NATURAL_RANGE ?? "").split(",").map(normalized);
    return island === "northwestern-islands"
      ? tokens.some((token) => ["northwestislands", "northwesternislands"].includes(token))
      : tokens.includes(normalized(island));
  });
}

const browseCatalog: Plant[] = [
  ...Array.from({ length: 30 }, (_, index) => ({
    PLANT_ID: `browse-a-${index + 1}`,
    NAME: `Alpha plant ${index + 1}`,
    COMMON_NAME: "Beta common name",
    NATURAL_RANGE: "Kauaʻi, Oʻahu",
    PHOTOS_FLAT: null,
  })),
  ...Array.from({ length: 3 }, (_, index) => ({
    PLANT_ID: `browse-b-${index + 1}`,
    NAME: `Beta plant ${index + 1}`,
    COMMON_NAME: "Alpha common name",
    NATURAL_RANGE: "Hawaiʻi",
    PHOTOS_FLAT: null,
  })),
  { PLANT_ID: "browse-fallback", NAME: null, COMMON_NAME: "ʻĀkea", NATURAL_RANGE: "Kauaʻi", PHOTOS_FLAT: null },
];

async function mockBrowseApi(page: Page, override?: (route: Route, url: URL) => Promise<boolean>) {
  const requests: URL[] = [];
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/plants") {
      requests.push(url);
      if (override && await override(route, url)) return;
      const matches = matchingPlants(browseCatalog, url.searchParams);
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? 24);
      const plants = matches.slice(offset, offset + limit);
      await route.fulfill({ json: {
        plants,
        total: matches.length,
        nextOffset: offset + plants.length < matches.length ? offset + plants.length : null,
      } });
    } else if (url.pathname === "/api/plants/search") {
      await route.fulfill({ json: browseCatalog.filter((plant) => plant.PLANT_ID === "browse-b-1").map(({ PLANT_ID, NAME, COMMON_NAME, FAMILY }) => ({ PLANT_ID, NAME, COMMON_NAME, FAMILY })) });
    } else if (url.pathname === "/api/plant") {
      await route.fulfill({ json: browseCatalog.find((plant) => plant.PLANT_ID === url.searchParams.get("plantId")) });
    } else {
      await route.fulfill({ status: 501, json: { message: "Unexpected API request in browse test" } });
    }
  });
  return requests;
}

function browseControls(page: Page) {
  return page.getByRole("region", { name: "Browse plants", exact: true });
}

function plantCards(page: Page) {
  return page.locator('main a[href^="/plant/"]');
}

async function assertCardOrder(page: Page, plants: Plant[]) {
  await expect(plantCards(page)).toHaveCount(plants.length);
  expect(await plantCards(page).evaluateAll((elements) => elements.map((element) => element.getAttribute("href"))))
    .toEqual(plants.map((plant) => `/plant/${encodeURIComponent(plant.PLANT_ID)}`));
}

test("island browsing matches recorded range tokens and preserves catalog order", async ({ request }) => {
  for (const [island, total] of [["hawaii", 129], ["kauai", 133], ["unrecorded", 644], ["northwestern-islands", 22]] as const) {
    const response = await request.get("/api/plants", { params: { island } });
    expect(response.status()).toBe(200);
    const expected = matchingPlants(catalog, new URLSearchParams({ island }));
    expect(expected).toHaveLength(total);
    expect(await response.json()).toEqual({
      plants: expected.slice(0, 24),
      total,
      nextOffset: total > 24 ? 24 : null,
    });
  }
});

test("letter browsing uses the displayed name and combines with island filters", async ({ request }) => {
  for (const letter of ["A", "Ā", "ʻA"]) {
    const response = await request.get("/api/plants", { params: { letter } });
    expect(response.status()).toBe(200);
    const expected = matchingPlants(catalog, new URLSearchParams({ letter: "A" }));
    expect(expected).toHaveLength(57);
    expect(await response.json()).toEqual({ plants: expected.slice(0, 24), total: 57, nextOffset: 24 });
  }
  const combined = await request.get("/api/plants", { params: { letter: "A", island: "kauai" } });
  expect(combined.status()).toBe(200);
  const expected = matchingPlants(catalog, new URLSearchParams({ letter: "A", island: "kauai" }));
  expect(expected).toHaveLength(11);
  expect(await combined.json()).toEqual({ plants: expected, total: 11, nextOffset: null });

  const kResponse = await request.get("/api/plants", { params: { letter: "K" } });
  expect(kResponse.status()).toBe(200);
  const kPlants: PlantPage = await kResponse.json();
  expect(kPlants.plants.some((plant) => plant.PLANT_ID === "5")).toBe(false); // Acacia koa is displayed under A.
  expect(kPlants.total).toBe(12);
});

test("filtered pagination applies the offset within matching plants", async ({ request }) => {
  const expected = matchingPlants(catalog, new URLSearchParams({ island: "kauai" }));
  for (const [offset, limit] of [[24, 10], [132, 24], [133, 24]]) {
    const response = await request.get("/api/plants", { params: { island: "kauai", offset, limit } });
    expect(response.status()).toBe(200);
    const plants = expected.slice(offset, offset + limit);
    expect(await response.json()).toEqual({
      plants,
      total: 133,
      nextOffset: offset + plants.length < 133 ? offset + plants.length : null,
    });
  }
});

test("browse API rejects invalid filters and supports an empty all-letters filter", async ({ request }) => {
  for (const letter of ["AA", "1", "not-a-letter"]) {
    expect((await request.get("/api/plants", { params: { letter } })).status()).toBe(400);
  }
  for (const island of ["", "atlantis", "all-islands"]) {
    expect((await request.get("/api/plants", { params: { island } })).status()).toBe(400);
  }
  const response = await request.get("/api/plants", { params: { letter: "" } });
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ plants: catalog.slice(0, 24), total: catalog.length, nextOffset: 24 });
});

test("browse controls combine filters, explain empty results, and clear back to all plants", async ({ page }) => {
  const requests = await mockBrowseApi(page);
  await page.goto("/");
  const controls = browseControls(page);
  const letter = controls.getByLabel("Browse by letter", { exact: true });
  const island = controls.getByLabel("Browse by island", { exact: true });
  await expect(letter).toHaveValue("");
  await letter.selectOption("A");
  await island.selectOption("kauai");
  await expect(page.getByText("Showing 24 of 31 plants.", { exact: true })).toBeVisible();
  await expect(letter).toHaveValue("A");
  await expect(island).toHaveValue("kauai");

  await island.selectOption("hawaii");
  await expect(page.getByRole("heading", { name: "No plants match these filters", exact: true })).toBeVisible();
  await expect(plantCards(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Clear filters", exact: true }).first().click();
  await assertCardOrder(page, browseCatalog.slice(0, 24));
  await expect(page.getByText("Showing 24 of 34 plants.", { exact: true })).toBeVisible();
  await expect(letter).toHaveValue("");
  await expect(letter).toBeFocused();
  await expect(island).toHaveValue("");
  expect(requests.at(-1)!.searchParams.has("letter")).toBe(false);
  expect(requests.at(-1)!.searchParams.has("island")).toBe(false);
});

test("filtered load-more retries retain both filters and changing filters resets pagination", async ({ page }) => {
  await page.addInitScript(() => { Reflect.deleteProperty(window, "IntersectionObserver"); });
  let laterRequests = 0;
  const requests = await mockBrowseApi(page, async (route, url) => {
    if (url.searchParams.get("letter") === "A" && url.searchParams.get("island") === "kauai" && url.searchParams.get("offset") === "24" && laterRequests++ === 0) {
      await route.fulfill({ status: 500, json: { message: "Filtered page unavailable" } });
      return true;
    }
    return false;
  });
  await page.goto("/");
  const controls = browseControls(page);
  await controls.getByLabel("Browse by letter", { exact: true }).selectOption("A");
  await controls.getByLabel("Browse by island", { exact: true }).selectOption("kauai");
  await expect(page.getByText("Showing 24 of 31 plants.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Load more plants", exact: true }).click();
  await expect(page.getByText("More plants couldn’t load. Please try again.", { exact: true })).toBeVisible();
  await expect(plantCards(page)).toHaveCount(24);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  const expected = matchingPlants(browseCatalog, new URLSearchParams({ letter: "A", island: "kauai" }));
  await assertCardOrder(page, expected);
  await expect(page.getByText("Showing 31 of 31 plants.", { exact: true })).toBeVisible();
  const later = requests.filter((url) => url.searchParams.get("offset") === "24");
  expect(later).toHaveLength(2);
  for (const url of later) {
    expect(url.searchParams.get("letter")).toBe("A");
    expect(url.searchParams.get("island")).toBe("kauai");
  }

  await controls.getByLabel("Browse by letter", { exact: true }).selectOption("B");
  await controls.getByLabel("Browse by island", { exact: true }).selectOption("hawaii");
  await assertCardOrder(page, browseCatalog.filter((plant) => plant.PLANT_ID.startsWith("browse-b-")));
  await expect(page.getByText("Showing 3 of 3 plants.", { exact: true })).toBeVisible();
  expect(requests.at(-1)!.searchParams.get("offset")).toBe("0");
  expect(requests.at(-1)!.searchParams.get("letter")).toBe("B");
  expect(requests.at(-1)!.searchParams.get("island")).toBe("hawaii");
});

test("switching filters ignores a late load-more response from the previous collection", async ({ page }) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, "IntersectionObserver");
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      return originalFetch(input, url.startsWith("/api/plants?") ? { ...init, signal: undefined } : init);
    };
  });
  let releaseResponse!: () => void;
  const pendingResponse = new Promise<void>((resolve) => { releaseResponse = resolve; });
  let signalRequestStarted!: () => void;
  const requestStarted = new Promise<void>((resolve) => { signalRequestStarted = resolve; });
  await mockBrowseApi(page, async (route, url) => {
    if (url.searchParams.get("letter") !== "A" || url.searchParams.get("island") !== "kauai" || url.searchParams.get("offset") !== "24") return false;
    signalRequestStarted();
    await pendingResponse;
    const matches = matchingPlants(browseCatalog, url.searchParams);
    await route.fulfill({ json: { plants: matches.slice(24), total: matches.length, nextOffset: null } });
    return true;
  });
  await page.goto("/");
  const controls = browseControls(page);
  await controls.getByLabel("Browse by letter", { exact: true }).selectOption("A");
  await controls.getByLabel("Browse by island", { exact: true }).selectOption("kauai");
  await expect(page.getByText("Showing 24 of 31 plants.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Load more plants", exact: true }).click();
  await requestStarted;
  await expect(page.getByRole("button", { name: "Loading more plants…", exact: true })).toBeDisabled();
  await controls.getByLabel("Browse by letter", { exact: true }).selectOption("B");
  await controls.getByLabel("Browse by island", { exact: true }).selectOption("hawaii");
  const expected = browseCatalog.filter((plant) => plant.PLANT_ID.startsWith("browse-b-"));
  await assertCardOrder(page, expected);
  const lateResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/api/plants" && url.searchParams.get("letter") === "A" && url.searchParams.get("island") === "kauai" && url.searchParams.get("offset") === "24";
  });
  releaseResponse();
  await lateResponse;
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  await assertCardOrder(page, expected);
  await expect(page.getByText("Showing 3 of 3 plants.", { exact: true })).toBeVisible();
  await expect(controls.getByLabel("Browse by letter", { exact: true })).toHaveValue("B");
});

test("global search still finds plants outside the active browse filters", async ({ page }) => {
  await mockBrowseApi(page);
  await page.goto("/");
  const controls = browseControls(page);
  await controls.getByLabel("Browse by letter", { exact: true }).selectOption("A");
  await controls.getByLabel("Browse by island", { exact: true }).selectOption("kauai");
  await expect(page.getByText("Showing 24 of 31 plants.", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Search plants", exact: true }).fill("Beta");
  const option = page.getByRole("listbox", { name: "Plant suggestions" }).getByRole("option");
  await expect(option).toContainText("Beta plant 1");
  await option.click();
  await expect(page).toHaveURL(/\/plant\/browse-b-1$/);
  await expect(page.getByRole("heading", { name: "Beta plant 1", exact: true })).toBeVisible();
});

test("browse controls fit phone, tablet, and desktop layouts", async ({ page }, testInfo) => {
  await mockBrowseApi(page);
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    const controls = browseControls(page);
    const letter = controls.getByLabel("Browse by letter", { exact: true });
    await letter.selectOption("A");
    await controls.getByLabel("Browse by island", { exact: true }).selectOption("kauai");
    await expect(page.getByText("Showing 24 of 31 plants.", { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await expect(letter).toBeVisible();
    await expect(letter.locator("option")).toHaveText(["All letters", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")]);
    for (const element of [controls, letter, controls.getByLabel("Browse by island", { exact: true })]) {
      const box = await element.boundingBox();
      expect(box).not.toBeNull();
      if (!box) throw new Error("Browse controls need a visible layout box");
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    }
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await testInfo.attach(`browse-controls-${width}px`, {
      body: await page.screenshot({ animations: "disabled" }),
      contentType: "image/png",
    });
  }
});
