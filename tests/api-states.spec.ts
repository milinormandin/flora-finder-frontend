import { expect, test, type Page, type Route } from "@playwright/test";
import type { Plant } from "../types/Plant";

const plant: Plant = {
  PLANT_ID: "browser-test-plant",
  NAME: "ʻŌhiʻa lehua",
  COMMON_NAME: "Metrosideros polymorpha",
  FAMILY: "Myrtaceae",
  CONSERVATION_STATUS: "Least concern",
  NATIVE_STATUS: "Endemic",
  NATURAL_RANGE: "Hawaiian Islands",
  PHOTOS_FLAT: "/plant-placeholder.svg",
  PHOTOS_ATTRIBUTION_FLAT: "Browser test image",
  GENERAL_INFORMATION: "A plant record used to verify the field guide interface.",
};

type ApiOptions = {
  catalog?: Plant[];
  savedIds?: string[];
  override?: (route: Route) => Promise<boolean>;
};

const savedStorageKey = "flora-finder:saved-plant-ids:v1";

function catalogResponse(route: Route, catalog: Plant[]) {
  const params = new URL(route.request().url()).searchParams;
  if (!params.has("offset") && !params.has("limit")) return catalog;
  const offset = Number(params.get("offset") ?? 0);
  const limit = Number(params.get("limit") ?? 24);
  const plants = catalog.slice(offset, offset + limit);
  return {
    plants,
    total: catalog.length,
    nextOffset: offset + plants.length < catalog.length ? offset + plants.length : null,
  };
}

function testCatalog(count: number): Plant[] {
  return Array.from({ length: count }, (_, index) => ({
    ...plant,
    PLANT_ID: `browser-test-plant-${index + 1}`,
    NAME: `Test plant ${index + 1}`,
  }));
}

async function scrollCollection(page: Page, bottom: boolean) {
  await page.evaluate(async (bottom) => {
    window.scrollTo(0, bottom ? document.documentElement.scrollHeight : 0);
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }, bottom);
}

async function mockApi(page: Page, { catalog = [plant], savedIds = [], override }: ApiOptions = {}) {
  await page.addInitScript(({ key, ids }) => {
    window.localStorage.setItem(key, JSON.stringify(ids));
  }, { key: savedStorageKey, ids: savedIds });
  await page.route("**/api/**", async (route) => {
    if (override && await override(route)) return;
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET" && url.pathname === "/api/plants") {
      await route.fulfill({ json: catalogResponse(route, catalog) });
    } else if (request.method() === "GET" && url.pathname === "/api/plant") {
      await route.fulfill({ json: plant });
    } else {
      await route.fulfill({ status: 501, json: { message: "Unexpected API request in browser test" } });
    }
  });
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

test("normal collection renders API data including incomplete records", async ({ page }) => {
  await mockApi(page, {
    catalog: [plant, {
      PLANT_ID: "browser-test-missing-fields",
      NAME: null,
      COMMON_NAME: "A plant with incomplete information",
      FAMILY: null,
      CONSERVATION_STATUS: null,
      PHOTOS_FLAT: null,
    }],
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: plant.NAME!, exact: true })).toBeVisible();
  await expect(page.locator('main a[href^="/plant/"]')).toHaveCount(2);
  await expect(page.locator('main a[href="/plant/browser-test-missing-fields"]').getByRole("img", { name: /Photograph unavailable/ })).toBeVisible();
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
  await mockApi(page, {
    override: async (route) => {
      if (new URL(route.request().url()).pathname !== "/api/plants") return false;
      await pendingResponse;
      await route.fulfill({ json: catalogResponse(route, [{ ...plant, PHOTOS_FLAT: missingPhoto }]) });
      return true;
    },
  });
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

test("an empty collection keeps the app shell and explains the empty state", async ({ page }) => {
  await mockApi(page, { catalog: [] });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "No plants to show yet" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Explore native plants" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  await expect(page.locator('main a[href^="/plant/"]')).toHaveCount(0);
});

test("a collection error can retry and recover without leaving the page", async ({ page }) => {
  let requests = 0;
  await mockApi(page, {
    override: async (route) => {
      if (new URL(route.request().url()).pathname !== "/api/plants") return false;
      requests += 1;
      await route.fulfill(requests === 1
        ? { status: 500, json: { message: "Collection temporarily unavailable" } }
        : { json: catalogResponse(route, [plant]) });
      return true;
    },
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "The collection couldn’t load" })).toBeVisible();
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("link", { name: `View ${plant.NAME}`, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "The collection couldn’t load" })).toHaveCount(0);
  expect(requests).toBe(2);
});

test("collection loads pages on scroll, prevents duplicate pending requests, and stops after the final partial page", async ({ page }) => {
  const catalog = testCatalog(53);
  const requests: { offset: number; limit: number }[] = [];
  let releaseResponse!: () => void;
  const pendingResponse = new Promise<void>((resolve) => { releaseResponse = resolve; });
  await mockApi(page, {
    catalog,
    override: async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname !== "/api/plants") return false;
      const offset = Number(url.searchParams.get("offset"));
      requests.push({ offset, limit: Number(url.searchParams.get("limit")) });
      if (offset === 24) await pendingResponse;
      await route.fulfill({ json: catalogResponse(route, catalog) });
      return true;
    },
  });

  await page.goto("/");
  const cards = page.locator('main a[href^="/plant/"]');
  await expect(cards).toHaveCount(24);
  await expect(page.getByText("Showing 24 of 53 plants.", { exact: true })).toBeVisible();
  expect(requests).toEqual([{ offset: 0, limit: 24 }]);

  await scrollCollection(page, true);
  await expect(page.getByRole("button", { name: "Loading more plants…", exact: true })).toBeDisabled();
  await expect(cards).toHaveCount(24);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await scrollCollection(page, false);
    await scrollCollection(page, true);
  }
  expect(requests).toEqual([{ offset: 0, limit: 24 }, { offset: 24, limit: 24 }]);

  releaseResponse();
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
  expect(requests).toEqual([{ offset: 0, limit: 24 }, { offset: 24, limit: 24 }, { offset: 48, limit: 24 }]);
});

test("a later collection failure retains loaded cards and retries the same page only when requested", async ({ page }) => {
  const catalog = testCatalog(30);
  const offsets: number[] = [];
  let laterRequests = 0;
  await mockApi(page, {
    catalog,
    override: async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname !== "/api/plants") return false;
      const offset = Number(url.searchParams.get("offset"));
      offsets.push(offset);
      if (offset === 24 && laterRequests++ === 0) {
        await route.fulfill({ status: 500, json: { message: "More plants temporarily unavailable" } });
        return true;
      }
      return false;
    },
  });

  await page.goto("/");
  const cards = page.locator('main a[href^="/plant/"]');
  await expect(cards).toHaveCount(24);
  await scrollCollection(page, true);
  await expect(page.getByText("More plants couldn’t load. Please try again.", { exact: true })).toBeVisible();
  await expect(cards).toHaveCount(24);
  await expect(page.getByRole("heading", { name: "The collection couldn’t load" })).toHaveCount(0);
  await scrollCollection(page, false);
  await scrollCollection(page, true);
  expect(offsets).toEqual([0, 24]);

  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(cards).toHaveCount(30);
  await expect(page.getByText("Showing 30 of 30 plants.", { exact: true })).toBeVisible();
  await expect(page.getByText("More plants couldn’t load. Please try again.", { exact: true })).toHaveCount(0);
  expect(await cards.evaluateAll((elements) => elements.map((element) => element.getAttribute("href"))))
    .toEqual(catalog.map((record) => `/plant/${record.PLANT_ID}`));
  expect(offsets).toEqual([0, 24, 24]);
});

test("the load-more button works when IntersectionObserver is unavailable", async ({ page }) => {
  await page.addInitScript(() => { Reflect.deleteProperty(window, "IntersectionObserver"); });
  const catalog = testCatalog(26);
  const offsets: number[] = [];
  await mockApi(page, {
    catalog,
    override: async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/api/plants") offsets.push(Number(url.searchParams.get("offset")));
      return false;
    },
  });

  await page.goto("/");
  const cards = page.locator('main a[href^="/plant/"]');
  await expect(cards).toHaveCount(24);
  await scrollCollection(page, true);
  expect(offsets).toEqual([0]);
  await page.getByRole("button", { name: "Load more plants", exact: true }).click();
  await expect(cards).toHaveCount(26);
  await expect(page.getByText("Showing 26 of 26 plants.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Load more plants", exact: true })).toHaveCount(0);
  expect(offsets).toEqual([0, 24]);
});

test("a missing detail record shows a 404 state with a way back to the collection", async ({ page }) => {
  await mockApi(page, {
    override: async (route) => {
      if (new URL(route.request().url()).pathname !== "/api/plant") return false;
      await route.fulfill({ status: 404, json: { message: "Plant not found" } });
      return true;
    },
  });
  await page.goto("/plant/missing-plant");
  await expect(page.getByRole("heading", { name: "Plant not found", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add to my plant list", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Explore plants", exact: true }).click();
  await expect(page.getByRole("link", { name: `View ${plant.NAME}`, exact: true })).toBeVisible();
});

test("saving prevents duplicate requests while pending and allows retry after failure", async ({ page }) => {
  let releaseResponse!: () => void;
  const pendingResponse = new Promise<void>((resolve) => { releaseResponse = resolve; });
  let detailRequests = 0;
  await mockApi(page, {
    override: async (route) => {
      if (route.request().method() !== "GET" || new URL(route.request().url()).pathname !== "/api/plant") return false;
      detailRequests += 1;
      if (detailRequests === 2) {
        await pendingResponse;
        await route.fulfill({ status: 500, json: { message: "Save failed" } });
      } else {
        await route.fulfill({ json: plant });
      }
      return true;
    },
  });
  await page.goto(`/plant/${plant.PLANT_ID}`);
  await page.getByRole("button", { name: "Add to my plant list", exact: true }).dblclick();
  await expect(page.getByRole("button", { name: "Saving…", exact: true })).toBeDisabled();
  await expect.poll(() => detailRequests).toBe(2);
  releaseResponse();
  await expect(page.getByText("This plant couldn’t be saved. Please try again.", { exact: true })).toBeVisible();
  const retryButton = page.getByRole("button", { name: "Add to my plant list", exact: true });
  await expect(retryButton).toBeEnabled();
  await retryButton.click();
  await expect(page.getByRole("button", { name: "Added to your list", exact: true })).toBeDisabled();
  expect(detailRequests).toBe(3);
  expect(await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)!), savedStorageKey)).toEqual([plant.PLANT_ID]);
});

test("failed removal retains the saved card and retries successfully when storage recovers", async ({ page }) => {
  await mockApi(page, { savedIds: [plant.PLANT_ID] });
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
  await mockApi(page, { savedIds: [plant.PLANT_ID] });
  await failSavedStorage(page, "read", true);
  await page.goto("/plant_list");
  await expect(page.getByRole("heading", { name: "Your plant list couldn’t load" })).toBeVisible();
  await restoreSavedStorage(page);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("link", { name: `View ${plant.NAME}`, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your plant list couldn’t load" })).toHaveCount(0);
});

test("a failed saved-list write keeps saving available and can retry", async ({ page }) => {
  await mockApi(page);
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
