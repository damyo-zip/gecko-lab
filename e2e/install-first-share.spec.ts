import { test, expect } from "@playwright/test";

test("share entrance prioritizes installation without loading the game", async ({ page }) => {
  await page.goto("/start");
  await expect(page.getByTestId("install-landing")).toBeVisible();
  await expect(page.getByRole("heading", { name: "앱으로 설치하고 시작하기" })).toBeVisible();
  await expect(page.getByTestId("install-action")).toBeVisible();
  await expect(page.getByTestId("play-in-browser")).toHaveAttribute("href", "/");
  await expect(page.locator("[data-view]")).toHaveCount(0);
  await page.getByTestId("install-action").click();
  await expect(page.getByTestId("install-guide")).toBeVisible();
  await page.getByTestId("play-in-browser").click();
  await expect(page.getByRole("heading", { name: /^보유 개체/ })).toBeVisible();
});

test.describe("KakaoTalk shared link", () => {
  test.use({ userAgent: "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 KAKAOTALK 11.0" });

  test("provides external-browser steps and keeps web play available", async ({ page }) => {
    await page.goto("/start");
    await expect(page.getByText("카카오톡으로 접속했어.")).toBeVisible();
    await page.getByTestId("install-action").click();
    await expect(page.getByTestId("install-guide")).toContainText("다른 브라우저로 열기");
    await expect(page.getByTestId("install-guide")).toContainText("Chrome");
    await expect(page.getByTestId("play-in-browser")).toBeVisible();
  });
});

test("installed standalone entrance skips to the existing game", async ({ page }) => {
  await page.addInitScript(() => {
    const originalMatchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query) => query === "(display-mode: standalone)"
      ? { matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } }
      : originalMatchMedia(query);
  });
  await page.goto("/start");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: /^보유 개체/ })).toBeVisible();
});
