import { expect, test, type Page } from "@playwright/test";
import type { Plant } from "../types/Plant";

const firstPlant: Plant = {
  PLANT_ID: "range-test-first",
  NAME: "Range test plant",
  COMMON_NAME: "First range species",
  PHOTOS_FLAT: "/plant-placeholder.svg",
  SHAPEFILE_PATH: "datasets/geojson/range-test-first.geojson",
  GENERAL_INFORMATION: "The rest of the plant detail stays available when its map cannot load.",
};
const secondPlant: Plant = {
  ...firstPlant,
  PLANT_ID: "range-test-second",
  NAME: "Second range plant",
  SHAPEFILE_PATH: "datasets/geojson/range-test-second.geojson",
};
const firstRangePath = `/${firstPlant.SHAPEFILE_PATH}`;
const secondRangePath = `/${secondPlant.SHAPEFILE_PATH}`;

function rangeFixture(longitude = -158.1, latitude = 21.4) {
  return {
    type: "FeatureCollection",
    features: [1, 2, 0].map((gridcode, index) => ({
      type: "Feature",
      properties: { GRIDCODE: gridcode },
      geometry: {
        type: "Polygon",
        coordinates: [[
          [longitude + index * 0.02, latitude],
          [longitude + index * 0.02 + 0.01, latitude],
          [longitude + index * 0.02 + 0.01, latitude + 0.01],
          [longitude + index * 0.02, latitude + 0.01],
          [longitude + index * 0.02, latitude],
        ]],
      },
    })),
  };
}

async function mockPlants(page: Page, plants: Plant[] = [firstPlant, secondPlant]) {
  await page.route("**/api/plant?**", async (route) => {
    const id = new URL(route.request().url()).searchParams.get("plantId");
    const plant = plants.find((record) => record.PLANT_ID === id);
    await route.fulfill(plant
      ? { json: plant }
      : { status: 404, json: { message: "Plant not found" } });
  });
  await page.route("**/api/plants?**", async (route) => {
    await route.fulfill({ json: { plants, total: plants.length, nextOffset: null } });
  });
}

async function disableWebGL(page: Page) {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId, ...args) {
      if (contextId === "webgl" || contextId === "webgl2" || contextId === "experimental-webgl") return null;
      return getContext.apply(this, [contextId, ...args] as Parameters<typeof getContext>);
    } as typeof getContext;
  });
}

async function stubMapbox(page: Page) {
  // A local style keeps these checks independent of Mapbox billing, tiles, and availability.
  await page.route("https://api.mapbox.com/**", async (route) => {
    if (new URL(route.request().url()).pathname.startsWith("/styles/v1/")) {
      await route.fulfill({
        json: {
          version: 8,
          sources: {},
          layers: [{ id: "background", type: "background", paint: { "background-color": "#e8ecdf" } }],
        },
      });
    } else {
      await route.fulfill({ status: 204 });
    }
  });
  await page.route("https://events.mapbox.com/**", (route) => route.fulfill({ status: 204 }));
}

function rangeMap(page: Page, plant = firstPlant) {
  return page.getByRole("region", { name: `Range map for ${plant.NAME}`, exact: true });
}

test("a missing range keeps plant details usable and the map section fits phone and desktop", async ({ page }) => {
  const plant = { ...firstPlant, SHAPEFILE_PATH: "" };
  const rangeRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/datasets/geojson/")) rangeRequests.push(request.url());
  });
  await mockPlants(page, [plant]);
  await page.goto(`/plant/${plant.PLANT_ID}`);
  await expect(page.getByRole("heading", { name: plant.NAME!, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Plant range", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Range not available", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add to my plant list", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "General information", exact: true })).toBeVisible();
  await expect(page.locator("main")).toContainText(plant.GENERAL_INFORMATION!);

  const frame = rangeMap(page, plant);
  for (const [width, height] of [[390, 280], [1440, 400]]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect.poll(() => frame.evaluate((element) => element.getBoundingClientRect().height)).toBe(height);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  }
  const photo = await page.locator("figure").boundingBox();
  const map = await frame.boundingBox();
  const about = await page.getByRole("heading", { name: "About this plant", exact: true }).boundingBox();
  expect(photo).not.toBeNull();
  expect(map).not.toBeNull();
  expect(about).not.toBeNull();
  if (!photo || !map || !about) throw new Error("The detail sections must have layout boxes");
  expect(map.y).toBeGreaterThanOrEqual(photo.y + photo.height);
  expect(about.y).toBeGreaterThanOrEqual(map.y + map.height);
  expect(rangeRequests).toEqual([]);
});

test("an unsupported browser contains the map failure and never downloads the range", async ({ page }) => {
  const rangeRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/datasets/geojson/")) rangeRequests.push(request.url());
  });
  await disableWebGL(page);
  await mockPlants(page);
  await page.goto(`/plant/${firstPlant.PLANT_ID}`);
  await expect(rangeMap(page).getByRole("heading", { name: "Map unavailable", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: firstPlant.NAME!, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "General information", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add to my plant list", exact: true })).toBeEnabled();
  await expect(rangeMap(page).locator("canvas")).toHaveCount(0);
  expect(rangeRequests).toEqual([]);
});

test("a missing public token keeps the map unavailable without affecting the plant detail", async ({ page }) => {
  test.skip(process.env.MAPBOX_MISSING_TOKEN_TESTS !== "1", "Run against a build with an empty NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN.");
  const rangeRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/datasets/geojson/")) rangeRequests.push(request.url());
  });
  await mockPlants(page);
  await page.goto(`/plant/${firstPlant.PLANT_ID}`);
  await expect(rangeMap(page).getByRole("heading", { name: "Map unavailable", exact: true })).toBeVisible();
  await expect(rangeMap(page).locator("canvas")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: firstPlant.NAME!, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "General information", exact: true })).toBeVisible();
  expect(rangeRequests).toEqual([]);
});

test.describe("configured range maps", () => {
  test.skip(process.env.MAPBOX_BROWSER_TESTS !== "1", "Requires a public token in the production build and a WebGL-capable browser.");

  test.beforeEach(async ({ page }) => {
    await mockPlants(page);
    await stubMapbox(page);
  });

  test("loads only the selected range and provides zoom, scale, and reset controls", async ({ page }) => {
    const requests: string[] = [];
    await page.route("**/datasets/geojson/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      requests.push(path);
      await route.fulfill({ json: rangeFixture() });
    });
    await page.goto(`/plant/${firstPlant.PLANT_ID}`);
    const frame = rangeMap(page);
    await expect(frame.locator(".mapboxgl-canvas")).toBeVisible();
    await expect(frame.getByRole("button", { name: "Reset view", exact: true })).toBeEnabled();
    await expect(frame.getByRole("button", { name: "Zoom in", exact: true })).toBeVisible();
    await expect(frame.getByRole("button", { name: "Zoom out", exact: true })).toBeVisible();
    const scale = frame.locator(".mapboxgl-ctrl-scale");
    await expect(scale).toHaveText(/\d/);
    const originalScale = await scale.innerText();
    await frame.getByRole("button", { name: "Zoom in", exact: true }).click();
    await expect(scale).not.toHaveText(originalScale);
    await frame.getByRole("button", { name: "Reset view", exact: true }).click();
    await expect(scale).toHaveText(originalScale);
    expect(requests).toEqual([firstRangePath]);
  });

  test("a failed range request retries in place while the detail remains available", async ({ page }) => {
    let requests = 0;
    await page.route(`**${firstRangePath}`, async (route) => {
      requests += 1;
      await route.fulfill(requests === 1
        ? { status: 503, body: "Temporarily unavailable" }
        : { json: rangeFixture() });
    });
    await page.goto(`/plant/${firstPlant.PLANT_ID}`);
    const frame = rangeMap(page);
    await expect(frame.getByRole("button", { name: "Try again", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: firstPlant.NAME!, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "General information", exact: true })).toBeVisible();
    await frame.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(frame.locator(".mapboxgl-canvas")).toBeVisible();
    await expect(frame.getByRole("button", { name: "Reset view", exact: true })).toBeEnabled();
    await expect(frame.getByRole("button", { name: "Try again", exact: true })).toHaveCount(0);
    expect(requests).toBe(2);
  });

  test("an empty presence range has an empty state and no map canvas", async ({ page }) => {
    const fixture = rangeFixture();
    await page.route(`**${firstRangePath}`, (route) => route.fulfill({
      json: { ...fixture, features: fixture.features.filter((feature) => feature.properties.GRIDCODE === 0) },
    }));
    await page.goto(`/plant/${firstPlant.PLANT_ID}`);
    await expect(rangeMap(page).getByRole("heading", { name: "Range not available", exact: true })).toBeVisible();
    await expect(rangeMap(page).locator("canvas")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: firstPlant.NAME!, exact: true })).toBeVisible();
  });

  test("navigating away from a pending range does not leak its state into another plant", async ({ page }) => {
    const requests: string[] = [];
    let releaseFirst!: () => void;
    const pendingRange = new Promise<void>((resolve) => { releaseFirst = resolve; });
    await page.route("**/datasets/geojson/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      requests.push(path);
      if (path === firstRangePath) await pendingRange;
      await route.fulfill({ json: path === firstRangePath ? rangeFixture() : rangeFixture(-156.5, 20.8) });
    });
    await page.goto(`/plant/${firstPlant.PLANT_ID}`);
    await expect.poll(() => requests).toEqual([firstRangePath]);
    await expect(rangeMap(page).getByRole("status", { name: "Loading plant range", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Back to plants", exact: true }).click();
    await page.getByRole("link", { name: `View ${secondPlant.NAME}`, exact: true }).click();
    await expect(page.getByRole("heading", { name: secondPlant.NAME!, exact: true })).toBeVisible();
    const secondFrame = rangeMap(page, secondPlant);
    await expect(secondFrame.getByRole("button", { name: "Reset view", exact: true })).toBeEnabled();
    releaseFirst();
    await expect(rangeMap(page)).toHaveCount(0);
    await expect(secondFrame.locator(".mapboxgl-canvas")).toBeVisible();
    await expect(secondFrame.getByRole("button", { name: "Try again", exact: true })).toHaveCount(0);
    expect(requests).toEqual([firstRangePath, secondRangePath]);
  });
});
