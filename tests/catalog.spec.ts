import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import plantRecords from "../public/datasets/plants.json";
import type { Plant } from "../types/Plant";

const catalog: Plant[] = plantRecords;
const storageKey = "flora-finder:saved-plant-ids:v1";
const firstPlant = catalog[0];
const firstPlantName = firstPlant.NAME!.trim();
const placeholder = readFileSync(join(process.cwd(), "public/plant-placeholder.svg"));

async function stubRemotePhotos(page: Page) {
  await page.route(/^https?:\/\/(?:inaturalist-open-data\.s3\.amazonaws\.com|static\.inaturalist\.org)\//, async (route) => {
    await route.fulfill({ contentType: "image/svg+xml", body: placeholder });
  });
}

async function attachViewport(page: Page, testInfo: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await testInfo.attach(name, {
    body: await page.screenshot({ animations: "disabled" }),
    contentType: "image/png",
  });
}

function visibleNavigation(page: Page) {
  return page.locator("nav:visible");
}

test.beforeEach(async ({ page }) => {
  await stubRemotePhotos(page);
});

test.afterEach(async ({ page }) => {
  if (page.url() === "about:blank") return;
  await expect(page.getByText("Sample data", { exact: true })).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText("UI preview fixture");
});

test("catalog and detail APIs return the complete JSON dataset using plant IDs", async ({ request }) => {
  const response = await request.get("/api/plants");
  expect(response.status()).toBe(200);
  const plants: Plant[] = await response.json();
  expect(plants).toHaveLength(845);
  expect(plants).toEqual(catalog);
  expect(new Set(plants.map((plant) => plant.PLANT_ID)).size).toBe(catalog.length);

  const afterGap = catalog.find((plant, index) => plant.PLANT_ID !== String(index + 1));
  expect(afterGap).toBeDefined();
  for (const plant of [firstPlant, afterGap!, catalog.at(-1)!]) {
    const detail = await request.get("/api/plant", { params: { plantId: plant.PLANT_ID } });
    expect(detail.status()).toBe(200);
    expect(await detail.json()).toEqual(plant);
  }

  const missingId = String(Number(afterGap!.PLANT_ID) - 1);
  expect(catalog.some((plant) => plant.PLANT_ID === missingId)).toBe(false);
  expect((await request.get("/api/plant")).status()).toBe(400);
  expect((await request.get("/api/plant", { params: { plantId: missingId } })).status()).toBe(404);
  expect((await request.get("/api/plant", { params: { plantId: "unknown-plant" } })).status()).toBe(404);
});

test("the real collection preserves dataset order and adapts to phone, tablet, and desktop", async ({ page }, testInfo) => {
  await page.goto("/");
  const cards = page.locator('main a[href^="/plant/"]');
  await expect(cards).toHaveCount(catalog.length);
  expect(await cards.evaluateAll((elements) => elements.map((element) => element.getAttribute("href"))))
    .toEqual(catalog.map((plant) => `/plant/${encodeURIComponent(plant.PLANT_ID)}`));

  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    const first = await cards.nth(0).boundingBox();
    const second = await cards.nth(1).boundingBox();
    const third = await cards.nth(2).boundingBox();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(third).not.toBeNull();
    if (!first || !second || !third) throw new Error("Plant cards need visible layout boxes");

    if (width === 390) {
      expect(second.y).toBeGreaterThan(first.y);
      await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
    } else {
      expect(Math.abs(second.y - first.y)).toBeLessThanOrEqual(1);
      expect(second.x).toBeGreaterThan(first.x);
      await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
      if (width === 768) expect(third.y).toBeGreaterThan(first.y);
      else expect(Math.abs(third.y - first.y)).toBeLessThanOrEqual(1);
    }

    await expect(visibleNavigation(page).getByRole("link", { name: "Explore", exact: true })).toHaveAttribute("aria-current", "page");
    await attachViewport(page, testInfo, `collection-${width}px`);
  }
});

test("real detail gallery and information use the dataset photos, credits, and text", async ({ page }, testInfo) => {
  const photos = firstPlant.PHOTOS_FLAT!.split("*");
  const credits = firstPlant.PHOTOS_ATTRIBUTION_FLAT!.split("*");
  await page.goto(`/plant/${firstPlant.PLANT_ID}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(firstPlantName);
  const image = page.locator("figure img");
  const attribution = page.locator("figcaption > span").first();
  const counter = page.locator("figcaption > span").last();

  await expect(image).toHaveAttribute("src", photos[0]);
  await expect(attribution).toHaveText(`Photo: ${credits[0].trim()}`);
  await expect(counter).toHaveText(`1 / ${photos.length}`);
  await page.getByRole("button", { name: "Next plant photograph" }).click();
  await expect(image).toHaveAttribute("src", photos[1]);
  await expect(attribution).toHaveText(`Photo: ${credits[1].trim()}`);
  await expect(counter).toHaveText(`2 / ${photos.length}`);
  await expect(page.getByRole("button", { name: `View photograph 2 of ${photos.length}`, exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Previous plant photograph" }).click();
  await expect(image).toHaveAttribute("src", photos[0]);
  await expect(counter).toHaveText(`1 / ${photos.length}`);

  await expect(page.locator("main")).toContainText(firstPlant.GENERAL_INFORMATION!);
  const generalInformation = page.getByRole("button", { name: "General information", exact: true });
  await expect(generalInformation).toHaveAttribute("aria-expanded", "true");
  await generalInformation.focus();
  await page.keyboard.press("Enter");
  await expect(generalInformation).toHaveAttribute("aria-expanded", "false");
  await page.keyboard.press("Enter");
  await expect(generalInformation).toHaveAttribute("aria-expanded", "true");

  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await attachViewport(page, testInfo, `detail-${width}px`);
  }
});

test("saved plants start empty, persist in browser storage, deduplicate, and remain removed after reload", async ({ page }) => {
  const unexpectedListRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/plantList") unexpectedListRequests.push(request.method());
  });
  await page.goto("/plant_list");
  await expect(page.getByRole("heading", { name: "No saved plants yet" })).toBeVisible();

  await page.goto(`/plant/${firstPlant.PLANT_ID}`);
  await page.getByRole("button", { name: "Add to my plant list", exact: true }).click();
  await expect(page.getByRole("button", { name: "Added to your list", exact: true })).toBeDisabled();
  await page.reload();
  await page.getByRole("button", { name: "Add to my plant list", exact: true }).click();
  await expect(page.getByRole("button", { name: "Added to your list", exact: true })).toBeDisabled();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey)).toEqual([firstPlant.PLANT_ID]);

  await visibleNavigation(page).getByRole("link", { name: "My Plant List", exact: true }).click();
  const savedCard = page.getByRole("link", { name: `View ${firstPlantName}`, exact: true });
  await expect(savedCard).toBeVisible();
  await page.reload();
  await expect(savedCard).toBeVisible();
  await expect(page.locator('main a[href^="/plant/"]')).toHaveCount(1);
  await page.getByRole("button", { name: `Remove ${firstPlantName} from your plant list`, exact: true }).click();
  await expect(page.getByRole("heading", { name: "No saved plants yet" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "No saved plants yet" })).toBeVisible();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey)).toEqual([]);
  expect(unexpectedListRequests).toEqual([]);
});

test("malformed saved storage is empty and stale or duplicate IDs never create extra cards", async ({ page }) => {
  await page.goto("/plant_list");
  await expect(page.getByRole("heading", { name: "No saved plants yet" })).toBeVisible();

  for (const stored of ["{invalid", JSON.stringify({ plantId: firstPlant.PLANT_ID }), JSON.stringify([firstPlant.PLANT_ID, 7])]) {
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: storageKey, value: stored });
    await page.reload();
    await expect(page.getByRole("heading", { name: "No saved plants yet" })).toBeVisible();
  }

  await page.evaluate(({ key, id }) => localStorage.setItem(key, JSON.stringify(["stale-id", id, id])), { key: storageKey, id: firstPlant.PLANT_ID });
  await page.reload();
  await expect(page.locator('main a[href^="/plant/"]')).toHaveCount(1);
  await expect(page.getByRole("link", { name: `View ${firstPlantName}`, exact: true })).toBeVisible();

  await page.evaluate((key) => localStorage.setItem(key, JSON.stringify(["stale-id"])), storageKey);
  await page.reload();
  await expect(page.getByRole("heading", { name: "No saved plants yet" })).toBeVisible();
});

test("map retains its useful missing-configuration state and working navigation", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/map");
  await expect(page.getByRole("heading", { name: "Map unavailable" })).toBeVisible();
  await expect(visibleNavigation(page).getByRole("link", { name: "Map", exact: true })).toHaveAttribute("aria-current", "page");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await attachViewport(page, testInfo, "map-unavailable-mobile");
  await page.getByRole("link", { name: "Explore plants", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Explore native plants" })).toBeVisible();
  await expect(page.locator('main a[href^="/plant/"]')).toHaveCount(catalog.length);
});
