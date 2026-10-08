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
  saved?: Plant[];
  override?: (route: Route) => Promise<boolean>;
};

async function mockApi(page: Page, { catalog = [plant], saved = [], override }: ApiOptions = {}) {
  await page.route("**/api/**", async (route) => {
    if (override && await override(route)) return;
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET" && url.pathname === "/api/plants") {
      await route.fulfill({ json: catalog });
    } else if (request.method() === "GET" && url.pathname === "/api/plant") {
      await route.fulfill({ json: plant });
    } else if (request.method() === "GET" && url.pathname === "/api/plantList") {
      await route.fulfill({ json: saved });
    } else if (url.pathname === "/api/plantList" && ["POST", "DELETE"].includes(request.method())) {
      await route.fulfill({ json: { success: true } });
    } else {
      await route.fulfill({ status: 501, json: { message: "Unexpected API request in browser test" } });
    }
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
      await route.fulfill({ json: [{ ...plant, PHOTOS_FLAT: missingPhoto }] });
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
        : { json: [plant] });
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
  let mutations = 0;
  await mockApi(page, {
    override: async (route) => {
      if (route.request().method() !== "POST") return false;
      mutations += 1;
      if (mutations === 1) {
        await pendingResponse;
        await route.fulfill({ status: 500, json: { message: "Save failed" } });
      } else {
        await route.fulfill({ status: 201, json: { success: true } });
      }
      return true;
    },
  });
  await page.goto(`/plant/${plant.PLANT_ID}`);
  await page.getByRole("button", { name: "Add to my plant list", exact: true }).dblclick();
  await expect(page.getByRole("button", { name: "Saving…", exact: true })).toBeDisabled();
  await expect.poll(() => mutations).toBe(1);
  releaseResponse();
  await expect(page.getByText("This plant couldn’t be saved. Please try again.", { exact: true })).toBeVisible();
  const retryButton = page.getByRole("button", { name: "Add to my plant list", exact: true });
  await expect(retryButton).toBeEnabled();
  await retryButton.click();
  await expect(page.getByRole("button", { name: "Added to your list", exact: true })).toBeDisabled();
  expect(mutations).toBe(2);
});

test("failed removal retains the saved card and retries successfully with one pending request", async ({ page }) => {
  let releaseResponse!: () => void;
  const pendingResponse = new Promise<void>((resolve) => { releaseResponse = resolve; });
  let mutations = 0;
  await mockApi(page, {
    saved: [plant],
    override: async (route) => {
      if (route.request().method() !== "DELETE") return false;
      mutations += 1;
      if (mutations === 1) {
        await pendingResponse;
        await route.fulfill({ status: 500, json: { message: "Remove failed" } });
      } else {
        await route.fulfill({ json: { success: true } });
      }
      return true;
    },
  });
  await page.goto("/plant_list");
  const removeButton = page.getByRole("button", { name: `Remove ${plant.NAME} from your plant list`, exact: true });
  await removeButton.dblclick();
  await expect(removeButton).toBeDisabled();
  await expect.poll(() => mutations).toBe(1);
  releaseResponse();
  await expect(page.getByText("This plant couldn’t be removed. Please try again.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: `View ${plant.NAME}`, exact: true })).toBeVisible();
  await expect(removeButton).toBeEnabled();
  await removeButton.click();
  await expect(page.getByRole("heading", { name: "No saved plants yet" })).toBeVisible();
  expect(mutations).toBe(2);
});
