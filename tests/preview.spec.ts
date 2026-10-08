import { expect, test, type Page, type TestInfo } from "@playwright/test";

async function forbidApiCalls(page: Page) {
  const calls: string[] = [];
  await page.route("**/api/**", async (route) => {
    calls.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
    await route.abort();
  });
  return calls;
}

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.locator("main img").evaluateAll((images) =>
    Promise.all(images.map((element) => {
      const image = element as HTMLImageElement;
      image.loading = "eager";
      if (image.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      });
    })),
  );
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true, animations: "disabled" }),
    contentType: "image/png",
  });
}

function visibleNavigation(page: Page) {
  return page.locator("nav:visible");
}

test("preview collection adapts to phone, tablet, and desktop without API requests", async ({ page }, testInfo) => {
  const apiCalls = await forbidApiCalls(page);
  await page.goto("/");
  await expect(page.getByText("Sample data", { exact: true })).toBeVisible();
  const cards = page.locator('main a[href^="/plant/"]');
  await expect(cards.nth(2)).toBeVisible();

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
    await attachScreenshot(page, testInfo, `collection-${width}px`);
  }

  expect(apiCalls).toEqual([]);
});

test("preview detail preserves gallery attribution and keyboard accordion controls", async ({ page }, testInfo) => {
  const apiCalls = await forbidApiCalls(page);
  await page.goto("/");
  await page.locator('main a[href^="/plant/"]').first().click();
  await page.waitForURL(/\/plant\//);
  await expect(page.getByRole("button", { name: "Add to my plant list", exact: true })).toBeVisible();

  const image = page.locator("figure img");
  const attribution = page.locator("figcaption > span").first();
  const counter = page.locator("figcaption > span").last();
  await expect(attribution).toContainText("Photo:");
  await expect(counter).toHaveText("1 / 2");
  const initialSource = await image.getAttribute("src");
  const initialCaption = await attribution.innerText();
  expect(initialSource).not.toBeNull();
  await page.getByRole("button", { name: "Next plant photograph" }).click();
  await expect(image).not.toHaveAttribute("src", initialSource!);
  await expect(attribution).not.toHaveText(initialCaption);
  await expect(attribution).toContainText("CC BY 3.0");
  await expect(counter).toHaveText("2 / 2");
  await expect(page.getByRole("button", { name: /^View photograph 2 of/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Previous plant photograph" }).click();
  await expect(image).toHaveAttribute("src", initialSource!);
  await expect(attribution).toHaveText(initialCaption);
  await expect(counter).toHaveText("1 / 2");

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
    await attachScreenshot(page, testInfo, `detail-${width}px`);
  }
  expect(apiCalls).toEqual([]);
});

test("preview saved plants survive navigation and reload, then removal persists to an empty list", async ({ page }, testInfo) => {
  const apiCalls = await forbidApiCalls(page);
  await page.goto("/");
  await page.locator('main a[href^="/plant/"]').first().click();
  await page.waitForURL(/\/plant\//);
  await expect(page.getByRole("button", { name: "Add to my plant list", exact: true })).toBeVisible();
  const plantName = await page.getByRole("heading", { level: 1 }).innerText();
  await page.getByRole("button", { name: "Add to my plant list", exact: true }).click();
  await expect(page.getByRole("button", { name: "Added to your list", exact: true })).toBeDisabled();
  await visibleNavigation(page).getByRole("link", { name: "My Plant List", exact: true }).click();
  await expect(page.getByRole("link", { name: `View ${plantName}`, exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: `View ${plantName}`, exact: true })).toBeVisible();
  await attachScreenshot(page, testInfo, "saved-plants-desktop");

  const removeButtons = page.getByRole("button", { name: /^Remove .* from your plant list$/ });
  while (await removeButtons.count()) {
    const count = await removeButtons.count();
    await removeButtons.first().click();
    await expect(removeButtons).toHaveCount(count - 1);
  }
  await expect(page.getByRole("heading", { name: "No saved plants yet" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "No saved plants yet" })).toBeVisible();
  expect(apiCalls).toEqual([]);
});

test("preview map has a useful missing-configuration state and working navigation", async ({ page }, testInfo) => {
  const apiCalls = await forbidApiCalls(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await visibleNavigation(page).getByRole("link", { name: "Map", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Map unavailable" })).toBeVisible();
  await expect(visibleNavigation(page).getByRole("link", { name: "Map", exact: true })).toHaveAttribute("aria-current", "page");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await attachScreenshot(page, testInfo, "map-unavailable-mobile");
  await page.getByRole("link", { name: "Explore plants", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Explore native plants" })).toBeVisible();
  expect(apiCalls).toEqual([]);
});
