import { expect, test, type Page, type Route } from "@playwright/test";
import type { Plant } from "../types/Plant";

// Detail fixtures use IDs that have pages in the static export.
const plant: Plant = {
  PLANT_ID: "1", NAME: "ʻŌhiʻa lehua", COMMON_NAME: "Metrosideros polymorpha",
  FAMILY: "Myrtaceae", CONSERVATION_STATUS: "Least concern", NATIVE_STATUS: "Endemic",
  NATURAL_RANGE: "Hawaiian Islands", PHOTOS_FLAT: "/plant-placeholder.svg",
  PHOTOS_ATTRIBUTION_FLAT: "Browser test image",
  GENERAL_INFORMATION: "A plant record used to verify the field guide interface.",
};
const savedStorageKey = "flora-finder:saved-plant-ids:v1";

async function mockCatalog(page: Page, {
  catalog = [plant], savedIds = [], respond,
}: { catalog?: Plant[]; savedIds?: string[]; respond?: (route: Route) => Promise<void> } = {}) {
  await page.addInitScript(({ key, ids }) => {
    window.localStorage.setItem(key, JSON.stringify(ids));
  }, { key: savedStorageKey, ids: savedIds });
  await page.route("**/datasets/plants.json", respond ?? ((route) => route.fulfill({ json: catalog })));
}

function testCatalog(count: number): Plant[] {
  return Array.from({ length: count }, (_, index) => ({
    ...plant, PLANT_ID: String(index + 1), NAME: `Test plant ${index + 1}`,
  }));
}

async function scrollCollection(page: Page, bottom: boolean) {
  await page.evaluate(async (bottom) => {
    window.scrollTo(0, bottom ? document.documentElement.scrollHeight : 0);
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }, bottom);
}

async function failSavedStorage(page: Page, operation: "read" | "write", beforeNavigation = false) {
  const injectFailure = ({ key, operation }: { key: string; operation: "read" | "write" }) => {
    let blocked = true;
    window.addEventListener("flora-finder:test-storage-failure", (event) => {
      blocked = (event as CustomEvent<boolean>).detail;
    });
    const getItem = Storage.prototype.getItem;
    const setItem = Storage.prototype.setItem;
    Storage.prototype.getItem = function (storageKey: string) {
      if (blocked && operation === "read" && this === window.localStorage && storageKey === key) {
        throw new DOMException("Storage access denied", "SecurityError");
      }
      return getItem.call(this, storageKey);
    };
    Storage.prototype.setItem = function (storageKey: string, value: string) {
      if (blocked && operation === "write" && this === window.localStorage && storageKey === key) {
        throw new DOMException("Storage write denied", "QuotaExceededError");
      }
      return setItem.call(this, storageKey, value);
    };
  };
  const options = { key: savedStorageKey, operation };
  if (beforeNavigation) await page.addInitScript(injectFailure, options);
  else await page.evaluate(injectFailure, options);
}

async function restoreSavedStorage(page: Page) {
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("flora-finder:test-storage-failure", { detail: false }));
  });
}

test.afterEach(async ({ page }) => {
  await expect(page.getByText("Sample data", { exact: true })).toHaveCount(0);
});

test("the static catalog renders incomplete records without raw null or undefined values", async ({ page }) => {
  await mockCatalog(page, { catalog: [plant, {
    PLANT_ID: "2", NAME: null, COMMON_NAME: "A plant with incomplete information",
    FAMILY: null, CONSERVATION_STATUS: null, PHOTOS_FLAT: null,
  }] });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: plant.NAME!, exact: true })).toBeVisible();
  await expect(page.locator('main a[href^="/plant/"]')).toHaveCount(2);
  await expect(page.locator('main a[href="/plant/2"]').getByRole("img", { name: /Photograph unavailable/ })).toBeVisible();
  await expect(page.locator("main")).not.toContainText("undefined");
  await expect(page.locator("main")).not.toContainText("null");
});

test("loading keeps the collection shell visible and a broken remote photograph falls back", async ({ page }) => {
  let releaseResponse!: () => void;
  const pendingResponse = new Promise<void>((resolve) => { releaseResponse = resolve; });
  const missingPhoto = "https://example.test/missing.jpg";
  let brokenPhotoRequests = 0;
  await page.route(missingPhoto, async (route) => {
    brokenPhotoRequests += 1;
    await route.fulfill({ status: 404, contentType: "text/plain", body: "Photograph unavailable" });
  });
  await mockCatalog(page, { respond: async (route) => {
    await pendingResponse;
    await route.fulfill({ json: [{ ...plant, PHOTOS_FLAT: missingPhoto }] });
  } });
  await page.goto("/");
  await expect(page.getByRole("status", { name: "Loading plants", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Explore native plants" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  await expect(page.locator('main a[href^="/plant/"]')).toHaveCount(0);
  releaseResponse();
  const card = page.getByRole("link", { name: `View ${plant.NAME}`, exact: true });
  await expect(card).toBeVisible();
  await expect(page.getByRole("status", { name: "Loading plants", exact: true })).toHaveCount(0);
  const fallback = card.getByRole("img", { name: /Photograph unavailable/ });
  await expect(fallback).toBeVisible();
  await expect(fallback).toHaveAttribute("src", /\/plant-placeholder\.svg$/);
  await expect.poll(() => fallback.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  expect(brokenPhotoRequests).toBe(1);
});

test("an empty static catalog keeps the app shell and explains the empty state", async ({ page }) => {
  await mockCatalog(page, { catalog: [] });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "No plants to show yet" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Explore native plants" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  await expect(page.locator('main a[href^="/plant/"]')).toHaveCount(0);
});

for (const failure of ["server error", "malformed JSON"] as const) {
  test(`a ${failure} on the initial catalog request can retry in place`, async ({ page }) => {
    let requests = 0;
    await mockCatalog(page, { respond: async (route) => {
      requests += 1;
      await route.fulfill(requests > 1 ? { json: [plant] } : failure === "server error"
        ? { status: 503, body: "Collection temporarily unavailable" }
        : { contentType: "application/json", body: "{invalid" });
    } });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "The collection couldn’t load" })).toBeVisible();
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page.getByRole("link", { name: `View ${plant.NAME}`, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "The collection couldn’t load" })).toHaveCount(0);
    expect(requests).toBe(2);
  });
}

test("collection scroll pagination preserves order and stops after the final partial page", async ({ page }) => {
  const catalog = testCatalog(53);
  let requests = 0;
  await mockCatalog(page, { respond: async (route) => {
    requests += 1;
    await route.fulfill({ json: catalog });
  } });
  await page.goto("/");
  const cards = page.locator('main a[href^="/plant/"]');
  await expect(cards).toHaveCount(24);
  await expect(page.getByText("Showing 24 of 53 plants.", { exact: true })).toBeVisible();
  await scrollCollection(page, true);
  await expect(cards).toHaveCount(48);
  await expect(page.getByText("Showing 48 of 53 plants.", { exact: true })).toBeVisible();
  await scrollCollection(page, true);
  await expect(cards).toHaveCount(53);
  await expect(page.getByText("Showing 53 of 53 plants.", { exact: true })).toBeVisible();
  expect(await cards.evaluateAll((elements) => elements.map((element) => element.getAttribute("href"))))
    .toEqual(catalog.map((record) => `/plant/${record.PLANT_ID}`));
  await expect(page.getByRole("button", { name: "Load more plants", exact: true })).toHaveCount(0);
  await scrollCollection(page, false);
  await scrollCollection(page, true);
  expect(requests).toBe(1);
});

test("the load-more button works when IntersectionObserver is unavailable", async ({ page }) => {
  await page.addInitScript(() => { Reflect.deleteProperty(window, "IntersectionObserver"); });
  await mockCatalog(page, { catalog: testCatalog(26) });
  await page.goto("/");
  const cards = page.locator('main a[href^="/plant/"]');
  await expect(cards).toHaveCount(24);
  await scrollCollection(page, true);
  await expect(cards).toHaveCount(24);
  await page.getByRole("button", { name: "Load more plants", exact: true }).click();
  await expect(cards).toHaveCount(26);
  await expect(page.getByText("Showing 26 of 26 plants.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Load more plants", exact: true })).toHaveCount(0);
});

test("a known exported page whose record is missing shows a way back to the collection", async ({ page }) => {
  await mockCatalog(page, { catalog: [{ ...plant, PLANT_ID: "2" }] });
  await page.goto(`/plant/${plant.PLANT_ID}`);
  await expect(page.getByRole("heading", { name: "Plant not found", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add to my plant list", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Explore plants", exact: true }).click();
  await expect(page.getByRole("link", { name: `View ${plant.NAME}`, exact: true })).toBeVisible();
});

test("a temporarily missing catalog shows a retryable detail load error", async ({ page }) => {
  let requests = 0;
  await mockCatalog(page, { respond: async (route) => {
    requests += 1;
    await route.fulfill(requests === 1 ? { status: 404 } : { json: [plant] });
  } });
  await page.goto(`/plant/${plant.PLANT_ID}`);
  await expect(page.getByRole("heading", { name: "This plant couldn’t load", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("heading", { name: plant.NAME!, exact: true })).toBeVisible();
  expect(requests).toBe(2);
});

test("failed removal retains the saved card and retries successfully when storage recovers", async ({ page }) => {
  await mockCatalog(page, { savedIds: [plant.PLANT_ID] });
  await page.goto("/plant_list");
  const removeButton = page.getByRole("button", { name: `Remove ${plant.NAME} from your plant list`, exact: true });
  await expect(removeButton).toBeVisible();
  await failSavedStorage(page, "write");
  await removeButton.click();
  await expect(page.getByText("This plant couldn’t be removed. Please try again.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: `View ${plant.NAME}`, exact: true })).toBeVisible();
  await expect(removeButton).toBeEnabled();
  expect(await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)!), savedStorageKey)).toEqual([plant.PLANT_ID]);
  await restoreSavedStorage(page);
  await removeButton.click();
  await expect(page.getByRole("heading", { name: "No saved plants yet" })).toBeVisible();
  expect(await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)!), savedStorageKey)).toEqual([]);
});

test("an unavailable saved-list store shows an error and recovers on retry", async ({ page }) => {
  await mockCatalog(page, { savedIds: [plant.PLANT_ID] });
  await failSavedStorage(page, "read", true);
  await page.goto("/plant_list");
  await expect(page.getByRole("heading", { name: "Your plant list couldn’t load" })).toBeVisible();
  await restoreSavedStorage(page);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("link", { name: `View ${plant.NAME}`, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your plant list couldn’t load" })).toHaveCount(0);
});

test("a failed saved-list write keeps saving available and can retry", async ({ page }) => {
  await mockCatalog(page);
  await page.goto(`/plant/${plant.PLANT_ID}`);
  const saveButton = page.getByRole("button", { name: "Add to my plant list", exact: true });
  await expect(saveButton).toBeVisible();
  await failSavedStorage(page, "write");
  await saveButton.click();
  await expect(page.getByText("This plant couldn’t be saved. Please try again.", { exact: true })).toBeVisible();
  await expect(saveButton).toBeEnabled();
  expect(await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)!), savedStorageKey)).toEqual([]);
  await restoreSavedStorage(page);
  await saveButton.click();
  await expect(page.getByRole("button", { name: "Added to your list", exact: true })).toBeDisabled();
  expect(await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)!), savedStorageKey)).toEqual([plant.PLANT_ID]);
});
