import { expect, test, type Page } from "@playwright/test";
import plantRecords from "../public/datasets/plants.json";

test.use({ serviceWorkers: "allow" });

const firstPlant = plantRecords[0];
const firstPlantName = firstPlant.NAME!.trim();
const unvisitedPlant = plantRecords.at(-1)!;
const storageKey = "flora-finder:saved-plant-ids:v1";

async function openInstalledApp(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator('main a[href^="/plant/"]')).toHaveCount(24);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
}

async function cachedURLs(page: Page) {
  return page.evaluate(async () => {
    const names = (await caches.keys()).filter((name) => name.startsWith("flora-finder-pwa-"));
    const requests = await Promise.all(names.map(async (name) => (await caches.open(name)).keys()));
    return requests.flat().map((request) => request.url);
  });
}

async function expectCachedDocument(page: Page, pathname: string) {
  await expect.poll(async () => (await cachedURLs(page)).some((url) => new URL(url).pathname === pathname)).toBe(true);
}

test("the production app exposes install metadata, real icons, and a scoped worker with a small offline shell", async ({ page, request, baseURL }) => {
  await openInstalledApp(page);
  const manifestPath = await page.locator('link[rel="manifest"]').getAttribute("href");
  expect(manifestPath).toBeTruthy();
  const manifestResponse = await request.get(new URL(manifestPath!, baseURL!).href);
  expect(manifestResponse.ok()).toBe(true);
  const manifest = await manifestResponse.json();
  expect(manifest.name).toBe("Flora Finder");
  expect(manifest.short_name).toBe("Flora Finder");
  expect(manifest.start_url).toBe("/");
  expect(manifest.scope).toBe("/");
  expect(manifest.display).toBe("standalone");
  expect(manifest.theme_color).toMatch(/^#[\da-f]{6}$/i);
  expect(manifest.background_color).toMatch(/^#[\da-f]{6}$/i);

  const icons = manifest.icons as Array<{ src: string; sizes: string; type: string; purpose?: string }>;
  for (const size of [192, 512]) {
    const icon = icons.find((candidate) => candidate.sizes === `${size}x${size}` && (candidate.purpose ?? "any").split(" ").includes("any"));
    expect(icon).toBeDefined();
    expect(icon!.type).toBe("image/png");
    const imageResponse = await request.get(icon!.src);
    expect(imageResponse.ok()).toBe(true);
    const png = await imageResponse.body();
    expect(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true);
    expect(png.readUInt32BE(16)).toBe(size);
    expect(png.readUInt32BE(20)).toBe(size);
  }
  expect(icons.some((icon) => icon.sizes === "512x512" && icon.purpose?.split(" ").includes("maskable"))).toBe(true);
  const appleIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
  expect(appleIcon).toBeTruthy();
  expect((await request.get(appleIcon!)).ok()).toBe(true);

  const registration = await page.evaluate(async () => {
    const worker = await navigator.serviceWorker.ready;
    return { scope: worker.scope, script: worker.active?.scriptURL, controlled: Boolean(navigator.serviceWorker.controller) };
  });
  expect(registration).toEqual({ scope: new URL("/", baseURL!).href, script: new URL("/sw.js", baseURL!).href, controlled: true });
  const urls = await cachedURLs(page);
  const paths = urls.map((url) => new URL(url).pathname);
  expect(paths).toEqual(expect.arrayContaining(["/", "/plant_list", "/offline", "/datasets/plants.json", manifestPath]));
  expect(paths.some((path) => path.startsWith("/_next/static/"))).toBe(true);
  expect(paths.filter((path) => /^\/plant\/[^/.]+(?:\.html)?$/.test(path))).toEqual([]);
  const cachedPlantIds = paths.map((path) => path.match(/^\/plant\/([^/.]+)/)?.[1]).filter(Boolean);
  expect(new Set(cachedPlantIds).size).toBeLessThanOrEqual(24);
  expect(cachedPlantIds).not.toContain(unvisitedPlant.PLANT_ID);
  expect(paths.filter((path) => path.startsWith("/datasets/geojson/"))).toEqual([]);
  expect(urls.every((url) => new URL(url).origin === new URL(baseURL!).origin)).toBe(true);
});

test("the install button opens the browser-provided prompt and responds to installation", async ({ page }) => {
  await openInstalledApp(page);
  // Headless Chromium does not present OS install UI; supply its event contract.
  const promptWasDeferred = await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, {
      prompt: async () => { sessionStorage.setItem("pwa-test-prompted", "yes"); },
      userChoice: Promise.resolve({ outcome: "dismissed", platform: "web" }),
    });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(promptWasDeferred).toBe(true);
  await page.getByRole("button", { name: "Install app", exact: true }).click();
  expect(await page.evaluate(() => sessionStorage.getItem("pwa-test-prompted"))).toBe("yes");
  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
  await expect(page.getByRole("button", { name: "Install app", exact: true })).toHaveCount(0);
});

test("offline reloads preserve browsing, search, visited details, and the saved plant list", async ({ page, context }) => {
  await openInstalledApp(page);
  await page.getByRole("link", { name: `View ${firstPlantName}`, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/plant/${firstPlant.PLANT_ID}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(firstPlantName);
  await page.getByRole("button", { name: "Add to my plant list", exact: true }).click();
  await expect(page.getByRole("button", { name: "Added to your list", exact: true })).toBeDisabled();
  await expectCachedDocument(page, `/plant/${firstPlant.PLANT_ID}`);

  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(firstPlantName);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator('main a[href^="/plant/"]')).toHaveCount(24);
  await page.getByRole("region", { name: "Browse plants", exact: true }).getByLabel("Browse by letter", { exact: true }).selectOption("A");
  await expect(page.getByText("Showing 24 of 57 plants.", { exact: true })).toBeVisible();

  const search = page.getByRole("combobox", { name: "Search plants", exact: true });
  await search.fill(unvisitedPlant.NAME!);
  await expect(page.getByRole("option").filter({ hasText: unvisitedPlant.NAME! })).toHaveCount(1);
  await search.fill(firstPlantName);
  await page.getByRole("option").filter({ hasText: firstPlantName }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(firstPlantName);

  await page.goto("/plant_list", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("link", { name: `View ${firstPlantName}`, exact: true })).toBeVisible();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator('main a[href^="/plant/"]')).toHaveCount(1);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey)).toEqual([firstPlant.PLANT_ID]);
  await page.getByRole("button", { name: `Remove ${firstPlantName} from your plant list`, exact: true }).click();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "No saved plants yet", exact: true })).toBeVisible();
});

test("uncached offline routes show an honest fallback and never substitute HTML for RSC payloads", async ({ page, context, baseURL }) => {
  await openInstalledApp(page);
  const missingPath = "/missing-pwa-test.txt";
  expect(await page.evaluate(async (path) => (await fetch(path)).status, missingPath)).toBe(404);
  // This is the same server on a different origin, producing an opaque response.
  await page.evaluate(async () => { await fetch("http://127.0.0.1:3131/favicon.ico", { mode: "no-cors" }); });
  const beforeOffline = await cachedURLs(page);
  expect(beforeOffline.some((url) => new URL(url).pathname === missingPath)).toBe(false);
  expect(beforeOffline.every((url) => new URL(url).origin === new URL(baseURL!).origin)).toBe(true);
  const cachedResponsesAreSuccessful = await page.evaluate(async () => {
    for (const name of await caches.keys()) {
      if (!name.startsWith("flora-finder-pwa-")) continue;
      const cache = await caches.open(name);
      for (const request of await cache.keys()) if (!(await cache.match(request))?.ok) return false;
    }
    return true;
  });
  expect(cachedResponsesAreSuccessful).toBe(true);

  await context.setOffline(true);
  for (const path of [
    `/plant/${unvisitedPlant.PLANT_ID}.txt?_rsc=pwa-offline-test`,
    `/plant/${unvisitedPlant.PLANT_ID}/__next._full.txt`,
    `/plant/${unvisitedPlant.PLANT_ID}?_rsc=pwa-offline-test`,
  ]) {
    const result = await page.evaluate(async (url) => {
      try {
        const response = await fetch(url, { headers: { RSC: "1" } });
        return { status: response.status, type: response.headers.get("content-type") ?? "", text: await response.text() };
      } catch { return null; }
    }, path);
    if (result) {
      expect(result.status).toBe(503);
      expect(result.type).not.toContain("text/html");
      expect(result.text).not.toMatch(/<!doctype html|<html/i);
    }
  }

  const response = await page.goto(`/plant/${unvisitedPlant.PLANT_ID}`, { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/offline/i);
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText(unvisitedPlant.NAME!.trim());
  await page.getByRole("link", { name: "Explore cached plants", exact: true }).click();
  await expect(page.locator('main a[href^="/plant/"]')).toHaveCount(24);
});

test("a worker update waits for the user, refreshes open tabs, and preserves saved plants", async ({ page, context }) => {
  await openInstalledApp(page);
  await page.evaluate(({ key, id }) => localStorage.setItem(key, JSON.stringify([id])), { key: storageKey, id: firstPlant.PLANT_ID });
  const savedTab = await context.newPage();
  await savedTab.goto("/plant_list", { waitUntil: "domcontentloaded" });
  await expect(savedTab.getByRole("link", { name: `View ${firstPlantName}`, exact: true })).toBeVisible();
  let savedTabReloads = 0;
  savedTab.on("framenavigated", (frame) => { if (frame === savedTab.mainFrame()) savedTabReloads += 1; });
  const originalController = await page.evaluate(() => navigator.serviceWorker.controller!.scriptURL);
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js?pwa-update-test=1", { scope: "/" });
  });
  await page.waitForFunction(async () => Boolean((await navigator.serviceWorker.getRegistration("/"))?.waiting));
  expect(await page.evaluate(() => navigator.serviceWorker.controller!.scriptURL)).toBe(originalController);
  await page.getByRole("button", { name: "Update app", exact: true }).click();
  await page.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL.includes("pwa-update-test=1"));
  await savedTab.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL.includes("pwa-update-test=1"));
  await expect.poll(() => savedTabReloads).toBeGreaterThanOrEqual(1);
  await expect(savedTab.getByRole("link", { name: `View ${firstPlantName}`, exact: true })).toBeVisible();
  await expect(page.locator('main a[href^="/plant/"]')).toHaveCount(24);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey)).toEqual([firstPlant.PLANT_ID]);
  await page.goto("/plant_list", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("link", { name: `View ${firstPlantName}`, exact: true })).toBeVisible();
});
