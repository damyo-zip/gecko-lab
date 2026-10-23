import { expect, test } from "@playwright/test";

test("fullscreen probe opens without touching the game save or demanding installation", async ({ page }) => {
  await page.goto("/fullscreen-test");
  await expect(page.getByTestId("fullscreen-test")).toBeVisible();
  await expect(page.getByRole("heading", { name: "카톡 전체화면 시험" })).toBeVisible();
  await expect(page.getByTestId("height-before")).toContainText("px");
  await expect(page.getByTestId("request-fullscreen")).toBeVisible();
  await expect(page.getByRole("link", { name: /설치 안내로 돌아가기/ })).toHaveAttribute("href", "/start");
  await expect(page.getByTestId("fullscreen-test").locator("[data-view]")).toHaveCount(0);
});

test("fullscreen API unavailable displays a useful result", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, "requestFullscreen", { configurable: true, value: undefined });
  });
  await page.goto("/fullscreen-test");
  await page.getByTestId("request-fullscreen").click();
  await expect(page.getByTestId("fullscreen-result")).toContainText("전체화면 API 미지원");
  await expect(page.getByTestId("fullscreen-detail")).toContainText("requestFullscreen API가 없습니다");
  await expect(page.getByTestId("height-delta")).toContainText("0");
});

test("fullscreen request failures are displayed rather than crashing", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, "requestFullscreen", {
      configurable: true,
      value: () => Promise.reject(new DOMException("Blocked by WebView", "NotAllowedError")),
    });
  });
  await page.goto("/fullscreen-test");
  await page.getByTestId("request-fullscreen").click();
  await expect(page.getByTestId("fullscreen-result")).toContainText("전체화면 요청 차단");
  await expect(page.getByTestId("fullscreen-detail")).toContainText("NotAllowedError");
  await expect(page.getByTestId("height-before")).toContainText("px");
});

test("KakaoTalk detection remains readable on Android UA", async ({ page }) => {
  await page.setExtraHTTPHeaders({ "Accept-Language": "ko-KR" });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36 KAKAOTALK 11.0",
    });
  });
  await page.goto("/fullscreen-test");
  await expect(page.getByText("카카오톡 내장 브라우저 · Android")).toBeVisible();
});
