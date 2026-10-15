import { expect, test, type Page } from "@playwright/test";
import plantRecords from "../public/datasets/plants.json";
import type { Plant } from "../types/Plant";

const searchCatalog: Plant[] = [
  { PLANT_ID: "1", NAME: "Metrosideros polymorpha", COMMON_NAME: "ʻŌhiʻa lehua", FAMILY: "Myrtaceae", PHOTOS_FLAT: null },
  { PLANT_ID: "2", NAME: "Scaevola taccada", COMMON_NAME: "Naupaka kahakai, Metrosideros companion", FAMILY: "Goodeniaceae", PHOTOS_FLAT: null },
];

async function mockCatalog(page: Page) {
  let requests = 0;
  await page.route("**/datasets/plants.json", async (route) => {
    requests += 1;
    await route.fulfill({ json: searchCatalog });
  });
  return () => requests;
}

test("real browser search finds plants beyond the visible page and normalizes accents and case", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('main a[href^="/plant/"]')).toHaveCount(24);
  const search = page.getByRole("combobox", { name: "Search plants", exact: true });
  const options = page.getByRole("listbox", { name: "Plant suggestions" }).getByRole("option");
  const latePlant = plantRecords.at(-1)!;
  await search.fill(latePlant.NAME!);
  await expect(options.filter({ hasText: latePlant.NAME! })).toHaveCount(1);
  expect(await options.count()).toBeLessThanOrEqual(6);

  const ohia = plantRecords.find((plant) => plant.PLANT_ID === "540")!;
  await search.fill("ohia");
  await expect(options.filter({ hasText: ohia.NAME! })).toHaveCount(1);
  const lowercaseResults = await options.allTextContents();
  expect(lowercaseResults.length).toBeLessThanOrEqual(6);
  await search.fill("OHIA");
  await expect(options).toHaveText(lowercaseResults);
  await search.fill("ʻŌhiʻa");
  await expect(options).toHaveText(lowercaseResults);
});

test("search waits for two trimmed characters and debounces changes", async ({ page }) => {
  const requests = await mockCatalog(page);
  await page.goto("/");
  await expect(page.locator('main a[href^="/plant/"]')).toHaveCount(2);
  await page.clock.install();
  await page.clock.pauseAt(Date.now() + 1_000);
  const search = page.getByRole("combobox", { name: "Search plants", exact: true });
  const options = page.getByRole("listbox", { name: "Plant suggestions" }).getByRole("option");
  await expect(search).toHaveAttribute("placeholder", "Search plants…");
  await expect(search).toHaveAttribute("maxlength", "100");
  await search.fill(" m ");
  await page.clock.runFor(500);
  await expect(options).toHaveCount(0);
  await expect(search).toHaveAttribute("aria-expanded", "false");
  await search.fill("me");
  await page.clock.runFor(150);
  await search.fill("  met  ");
  await page.clock.runFor(249);
  await expect(options).toHaveCount(0);
  await page.clock.runFor(1);
  await expect(options).toHaveCount(2);
  expect(requests()).toBe(1);
});

test("search suggestions show both names and support keyboard selection", async ({ page }) => {
  const requests = await mockCatalog(page);
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
  await expect(page).toHaveURL(/\/plant\/1$/);
  await expect(page.getByRole("heading", { name: "Metrosideros polymorpha", exact: true })).toBeVisible();
  await expect(page.getByRole("listbox", { name: "Plant suggestions" })).toHaveCount(0);
  expect(requests()).toBe(1);
});

test("Enter opens the first suggestion when search results arrive", async ({ page }) => {
  await mockCatalog(page);
  await page.goto("/");
  const search = page.getByRole("combobox", { name: "Search plants", exact: true });
  await search.fill("met");
  const firstOption = page.getByRole("option").first();
  await expect(firstOption).toBeVisible();
  await expect(search).toHaveAttribute("aria-activedescendant", await firstOption.getAttribute("id") ?? "");
  await search.press("Enter");
  await expect(page).toHaveURL(/\/plant\/1$/);
  await expect(page.getByRole("heading", { name: "Metrosideros polymorpha", exact: true })).toBeVisible();
});

test("search can retry a failed initial dataset request and explains empty results", async ({ page }) => {
  let requests = 0;
  await page.route("**/datasets/plants.json", async (route) => {
    requests += 1;
    await route.fulfill(requests === 1 ? { status: 503 } : { json: searchCatalog });
  });
  // An empty saved list does not need the catalog until the user searches.
  await page.goto("/plant_list");
  await expect(page.getByRole("heading", { name: "No saved plants yet" })).toBeVisible();
  const search = page.getByRole("combobox", { name: "Search plants", exact: true });
  await search.fill("met");
  await expect(page.getByText("Search couldn’t load. Please try again.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Retry search", exact: true }).click();
  await expect(page.getByRole("option")).toHaveCount(2);
  await expect(page.getByText("Search couldn’t load. Please try again.", { exact: true })).toHaveCount(0);
  await search.fill("no-match");
  await expect(page.getByText("No plants found.", { exact: true })).toBeVisible();
  await expect(page.getByRole("option")).toHaveCount(0);
  expect(requests).toBe(2);
});

test("changing a search while the shared dataset is pending displays only the latest query", async ({ page }) => {
  let releaseResponse!: () => void;
  const pendingResponse = new Promise<void>((resolve) => { releaseResponse = resolve; });
  let requests = 0;
  await page.route("**/datasets/plants.json", async (route) => {
    requests += 1;
    await pendingResponse;
    await route.fulfill({ json: searchCatalog });
  });
  await page.goto("/");
  await expect(page.getByRole("status", { name: "Loading plants", exact: true })).toBeVisible();
  const search = page.getByRole("combobox", { name: "Search plants", exact: true });
  await search.fill("met");
  await expect(page.getByText("Searching plants…", { exact: true })).toBeVisible();
  await search.fill("sca");
  releaseResponse();
  await expect(page.getByRole("option")).toHaveCount(1);
  await expect(page.getByRole("option")).toContainText("Scaevola taccada");
  await expect(page.locator('main a[href^="/plant/"]')).toHaveCount(2);
  expect(requests).toBe(1);
});

test("clearing a pending search leaves the collection download active and suggestions closed", async ({ page }) => {
  let releaseResponse!: () => void;
  const pendingResponse = new Promise<void>((resolve) => { releaseResponse = resolve; });
  let requests = 0;
  await page.route("**/datasets/plants.json", async (route) => {
    requests += 1;
    await pendingResponse;
    await route.fulfill({ json: searchCatalog });
  });
  await page.goto("/");
  await page.clock.install();
  const search = page.getByRole("combobox", { name: "Search plants", exact: true });
  await search.fill("met");
  await page.clock.runFor(250);
  await expect(page.getByText("Searching plants…", { exact: true })).toBeVisible();
  await page.getByLabel("Clear search", { exact: true }).click();
  releaseResponse();
  await expect(page.locator('main a[href^="/plant/"]')).toHaveCount(2);
  await expect(page.getByRole("listbox", { name: "Plant suggestions" })).toHaveCount(0);
  await expect(page.getByText("Searching plants…", { exact: true })).toHaveCount(0);
  await expect(search).toHaveAttribute("aria-expanded", "false");
  expect(requests).toBe(1);
});

test("Escape, focus leaving the search, and outside clicks dismiss suggestions", async ({ page }) => {
  await mockCatalog(page);
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
  await page.locator('nav[aria-label="Main navigation"] a[href="/plant_list"]').focus();
  await expect(listbox).toHaveCount(0);
  await search.fill("ohia");
  await expect(listbox).toBeVisible();
  await page.locator("main").click({ position: { x: 8, y: 8 } });
  await expect(listbox).toHaveCount(0);
});

test("search fits phone, tablet, and desktop, works from saved plants, and opens clicked suggestions", async ({ page }, testInfo) => {
  await mockCatalog(page);
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
      body: await page.screenshot({ animations: "disabled" }), contentType: "image/png",
    });
    await listbox.getByRole("option").nth(1).click();
    await expect(page).toHaveURL(/\/plant\/2$/);
    await expect(page.getByRole("heading", { name: "Scaevola taccada", exact: true })).toBeVisible();
    await expect(search).toBeVisible();
    await page.goto("/map");
    await expect(search).toBeVisible();
  }
});
