import { expect, test } from "@playwright/test";

test("trial screen appears before starting without creating the game", async ({ page }) => {
  await page.goto("/fullscreen-play");
  await expect(page.getByTestId("fullscreen-play-entry")).toBeVisible();
  await expect(page.getByTestId("fullscreen-start")).toBeVisible();
  await expect(page.getByTestId("normal-start")).toBeVisible();
  await expect(page.locator(".game-tab-content")).toHaveCount(0);
});

test("fullscreen starts the game without a navigation and reuses the same local save", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("game-day")).toBeVisible();
  const originalTurn = await page.getByTestId("game-day").textContent();
  await page.addInitScript(() => {
    let entered = false;
    Object.defineProperty(Document.prototype, "fullscreenElement", {
      configurable: true,
      get() { return entered ? document.documentElement : null; },
    });
    Object.defineProperty(Element.prototype, "requestFullscreen", {
      configurable: true,
      value: function () { entered = true; document.dispatchEvent(new Event("fullscreenchange")); return Promise.resolve(); },
    });
    Object.defineProperty(Document.prototype, "exitFullscreen", {
      configurable: true,
      value: function () { entered = false; document.dispatchEvent(new Event("fullscreenchange")); return Promise.resolve(); },
    });
  });
  await page.goto("/fullscreen-play");
  const before = page.url();
  await page.getByTestId("fullscreen-start").click();
  await expect(page.getByRole("heading", { name: /^보유 개체/ })).toBeVisible();
  await expect(page.getByTestId("game-day")).toHaveText(originalTurn ?? "");
  expect(page.url()).toBe(before);
  await expect(page.getByTestId("fullscreen-exited")).toHaveCount(0);
  await page.evaluate(() => document.exitFullscreen());
  await expect(page.getByTestId("fullscreen-reenter")).toBeVisible();
  await page.getByTestId("fullscreen-reenter").click();
  await expect(page.getByTestId("fullscreen-exited")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /^보유 개체/ })).toBeVisible();
  expect(page.url()).toBe(before);
});

test("failed fullscreen request shows a fallback without changing the URL", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, "requestFullscreen", {
      configurable: true,
      value: () => Promise.reject(new DOMException("Not allowed by host", "NotAllowedError")),
    });
  });
  await page.goto("/fullscreen-play");
  const before = page.url();
  await page.getByTestId("fullscreen-start").click();
  await expect(page.getByTestId("fullscreen-play-entry").getByRole("alert")).toContainText("Not allowed by host");
  await expect(page.getByTestId("fullscreen-play-entry")).toBeVisible();
  await page.getByTestId("normal-start").click();
  await expect(page.getByRole("heading", { name: /^보유 개체/ })).toBeVisible();
  expect(page.url()).toBe(before);
});

test("unsupported fullscreen API still lets players launch the game", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, "requestFullscreen", { configurable: true, value: undefined });
  });
  await page.goto("/fullscreen-play");
  await page.getByTestId("fullscreen-start").click();
  await expect(page.getByTestId("fullscreen-play-entry").getByRole("alert")).toContainText("지원하지 않아");
  await page.getByTestId("normal-start").click();
  await expect(page.getByTestId("game-day")).toBeVisible();
});


test("dark fullscreen tint is applied on enter and restored on exit", async ({ page }) => {
  await page.addInitScript(() => {
    let entered = false;
    Object.defineProperty(Document.prototype, "fullscreenElement", {
      configurable: true,
      get() { return entered ? document.documentElement : null; },
    });
    Object.defineProperty(Element.prototype, "requestFullscreen", {
      configurable: true,
      value: () => { entered = true; document.dispatchEvent(new Event("fullscreenchange")); return Promise.resolve(); },
    });
    Object.defineProperty(Document.prototype, "exitFullscreen", {
      configurable: true,
      value: () => { entered = false; document.dispatchEvent(new Event("fullscreenchange")); return Promise.resolve(); },
    });
  });
  await page.goto("/fullscreen-play");
  const initialTheme = await page.locator('meta[name="theme-color"]').getAttribute("content");
  await page.getByTestId("fullscreen-start").click();
  await expect(page.getByRole("heading", { name: /^보유 개체/ })).toBeVisible();
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#0b141d");
  expect(await page.evaluate(() => document.documentElement.style.backgroundColor)).toBe("rgb(11, 20, 29)");
  expect(await page.evaluate(() => document.documentElement.classList.contains("kakao-fullscreen-inset"))).toBe(true);
  await page.evaluate(() => document.exitFullscreen());
  await expect(page.getByTestId("fullscreen-reenter")).toBeVisible();
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", initialTheme ?? "#0c1420");
  expect(await page.evaluate(() => document.documentElement.classList.contains("kakao-fullscreen-inset"))).toBe(false);
});
