import { expect, test, type Page } from "@playwright/test";
import plantRecords from "../public/datasets/plants.json";
import type { Plant } from "../types/Plant";

const catalog: Plant[] = plantRecords;

function normalized(value: string) {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z]/g, "");
}

function matchingPlants(plants: Plant[], letter = "", island = ""): Plant[] {
  return plants.filter((plant) => {
    const name = plant.NAME?.trim() || plant.COMMON_NAME?.trim() || "Unnamed plant";
    if (letter && !normalized(name).startsWith(normalized(letter))) return false;
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
    PLANT_ID: catalog[index].PLANT_ID, NAME: `Alpha plant ${index + 1}`,
    COMMON_NAME: "Beta common name", NATURAL_RANGE: "Kauaʻi, Oʻahu", PHOTOS_FLAT: null,
  })),
  ...Array.from({ length: 3 }, (_, index) => ({
    PLANT_ID: catalog[index + 30].PLANT_ID, NAME: `Beta plant ${index + 1}`,
    COMMON_NAME: "Alpha common name", NATURAL_RANGE: "Hawaiʻi", PHOTOS_FLAT: null,
  })),
  { PLANT_ID: catalog[33].PLANT_ID, NAME: null, COMMON_NAME: "ʻĀkea", NATURAL_RANGE: "Kauaʻi", PHOTOS_FLAT: null },
];

async function mockBrowseCatalog(page: Page) {
  const requests: string[] = [];
  await page.route("**/datasets/plants.json", async (route) => {
    requests.push(route.request().url());
    await route.fulfill({ json: browseCatalog });
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

test("real island browsing matches recorded range tokens and preserves catalog order", async ({ page }) => {
  await page.addInitScript(() => { Reflect.deleteProperty(window, "IntersectionObserver"); });
  await page.goto("/");
  const islandSelect = browseControls(page).getByLabel("Browse by island", { exact: true });
  for (const [island, total] of [["hawaii", 129], ["kauai", 133], ["unrecorded", 644], ["northwestern-islands", 22]] as const) {
    await islandSelect.selectOption(island);
    const expected = matchingPlants(catalog, "", island);
    expect(expected).toHaveLength(total);
    await assertCardOrder(page, expected.slice(0, 24));
    await expect(page.getByText(`Showing ${Math.min(24, total)} of ${total} plants.`, { exact: true })).toBeVisible();
  }
});

test("real letter browsing uses displayed names and combines with islands", async ({ page }) => {
  await page.addInitScript(() => { Reflect.deleteProperty(window, "IntersectionObserver"); });
  await page.goto("/");
  const controls = browseControls(page);
  await controls.getByLabel("Browse by letter", { exact: true }).selectOption("A");
  await assertCardOrder(page, matchingPlants(catalog, "A").slice(0, 24));
  await expect(page.getByText("Showing 24 of 57 plants.", { exact: true })).toBeVisible();
  await controls.getByLabel("Browse by island", { exact: true }).selectOption("kauai");
  await assertCardOrder(page, matchingPlants(catalog, "A", "kauai"));
  await expect(page.getByText("Showing 11 of 11 plants.", { exact: true })).toBeVisible();
  await controls.getByLabel("Browse by island", { exact: true }).selectOption("");
  await controls.getByLabel("Browse by letter", { exact: true }).selectOption("K");
  await assertCardOrder(page, matchingPlants(catalog, "K"));
  await expect(page.getByText("Showing 12 of 12 plants.", { exact: true })).toBeVisible();
  await expect(page.locator('main a[href="/plant/5"]')).toHaveCount(0); // Acacia koa is displayed under A.
});

test("browse controls combine filters, explain empty results, and clear to all plants", async ({ page }) => {
  const requests = await mockBrowseCatalog(page);
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
  expect(requests).toHaveLength(1);
});

test("filtered pagination includes normalized fallback names and changing filters resets pages", async ({ page }) => {
  await page.addInitScript(() => { Reflect.deleteProperty(window, "IntersectionObserver"); });
  const requests = await mockBrowseCatalog(page);
  await page.goto("/");
  const controls = browseControls(page);
  await controls.getByLabel("Browse by letter", { exact: true }).selectOption("A");
  await controls.getByLabel("Browse by island", { exact: true }).selectOption("kauai");
  await expect(page.getByText("Showing 24 of 31 plants.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Load more plants", exact: true }).click();
  await assertCardOrder(page, matchingPlants(browseCatalog, "A", "kauai"));
  await expect(page.getByText("Showing 31 of 31 plants.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "View ʻĀkea", exact: true })).toBeVisible();

  await controls.getByLabel("Browse by letter", { exact: true }).selectOption("B");
  await controls.getByLabel("Browse by island", { exact: true }).selectOption("hawaii");
  await assertCardOrder(page, browseCatalog.slice(30, 33));
  await expect(page.getByText("Showing 3 of 3 plants.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Load more plants", exact: true })).toHaveCount(0);
  expect(requests).toHaveLength(1);
});

test("global search finds plants outside active browse filters using the shared catalog", async ({ page }) => {
  const requests = await mockBrowseCatalog(page);
  await page.goto("/");
  const controls = browseControls(page);
  await controls.getByLabel("Browse by letter", { exact: true }).selectOption("A");
  await controls.getByLabel("Browse by island", { exact: true }).selectOption("kauai");
  await expect(page.getByText("Showing 24 of 31 plants.", { exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Search plants", exact: true }).fill("Beta plant 1");
  const option = page.getByRole("listbox", { name: "Plant suggestions" }).getByRole("option");
  await expect(option).toHaveCount(1);
  await expect(option).toContainText("Beta plant 1");
  await option.click();
  await expect(page).toHaveURL(new RegExp(`/plant/${browseCatalog[30].PLANT_ID}$`));
  await expect(page.getByRole("heading", { name: "Beta plant 1", exact: true })).toBeVisible();
  expect(requests).toHaveLength(1);
});

test("browse controls fit phone, tablet, and desktop layouts", async ({ page }, testInfo) => {
  await mockBrowseCatalog(page);
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
      body: await page.screenshot({ animations: "disabled" }), contentType: "image/png",
    });
  }
});
