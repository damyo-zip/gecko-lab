import { expect, test } from "@playwright/test";

test("trial screen appears before starting without creating the game", async ({ page }) => {
  await page.goto("/fullscreen-play");
  await expect(page.getByTestId("fullscreen-play-entry")).toBeVisible();
  await expect(page.getByTestId("fullscreen-start")).toBeVisible();
  await expect(page.getByTestId("install-help-toggle")).toBeVisible();
  await expect(page.getByRole("heading", { name: "게임 시작" })).toBeVisible();
  await expect(page.getByText("카카오톡과 설치 앱의 저장 데이터는 공유되지 않을 수 있습니다.")).toBeVisible();
  await expect(page.getByTestId("normal-start")).toHaveCount(0);
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

test("failed fullscreen request offers install instructions without navigating", async ({ page }) => {
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
  await page.getByTestId("install-help-toggle").click();
  await expect(page.getByTestId("install-help-guide")).toBeVisible();
  await expect(page.locator(".game-tab-content")).toHaveCount(0);
  expect(page.url()).toBe(before);
});

test("unsupported fullscreen API offers app installation guidance", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, "requestFullscreen", { configurable: true, value: undefined });
  });
  await page.goto("/fullscreen-play");
  await page.getByTestId("fullscreen-start").click();
  await expect(page.getByTestId("fullscreen-play-entry").getByRole("alert")).toContainText(/전체화면을 지원하지 않(?:아|습니다)/);
  await page.getByTestId("install-help-toggle").click();
  await expect(page.getByTestId("install-help-guide")).toBeVisible();
  await expect(page.locator(".game-tab-content")).toHaveCount(0);
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

test("KakaoTalk Android instructions and install link stay on the current page", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 KAKAOTALK 11.0",
    });
  });
  await page.goto("/fullscreen-play");
  const originalUrl = page.url();
  const button = page.getByTestId("install-help-toggle");
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("install-help-guide")).toContainText("다른 브라우저로 열기");
  await expect(page.getByTestId("install-help-guide")).toContainText("Chrome");
  await expect(page.getByTestId("copy-install-url")).toBeVisible();
  await expect(page.locator(".game-tab-content")).toHaveCount(0);
  await page.getByRole("button", { name: "설치 안내 닫기" }).click();
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByTestId("install-help-guide")).toHaveCount(0);
  expect(page.url()).toBe(originalUrl);
});

test("KakaoTalk iOS shows Safari home screen installation instructions", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 KAKAOTALK 11.0",
    });
  });
  await page.goto("/fullscreen-play");
  await page.getByTestId("install-help-toggle").click();
  await expect(page.getByTestId("install-help-guide")).toContainText("Safari");
  await expect(page.getByTestId("install-help-guide")).toContainText("홈 화면에 추가");
});

test("Android Chrome launches a supplied native PWA install prompt directly", async ({ page }) => {
  await page.goto("/fullscreen-play");
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
      prompt(): Promise<void>;
      userChoice: Promise<{outcome: "accepted" | "dismissed"}>;
    };
    event.prompt = () => { (window as Window & { __installCalled?: boolean }).__installCalled = true; return Promise.resolve(); };
    event.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(event);
  });
  await page.getByTestId("install-help-toggle").click();
  await expect(page.getByText("설치를 진행합니다. 홈 화면에서 실행하세요.")).toBeVisible();
  expect(await page.evaluate(() => (window as Window & { __installCalled?: boolean }).__installCalled)).toBe(true);
  await expect(page.getByTestId("install-help-guide")).toHaveCount(0);
});

test("Chrome without install event shows concise manual fallback", async ({ page }) => {
  await page.goto("/fullscreen-play");
  await page.getByTestId("install-help-toggle").click();
  await expect(page.getByTestId("install-help-guide")).toContainText("Chrome 또는 Edge");
  await expect(page.getByTestId("copy-install-url")).toBeVisible();
});

test("dismissed installation opens fallback instructions", async ({ page }) => {
  await page.goto("/fullscreen-play");
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
      prompt(): Promise<void>;
      userChoice: Promise<{outcome: "accepted" | "dismissed"}>;
    };
    event.prompt = () => Promise.resolve();
    event.userChoice = Promise.resolve({ outcome: "dismissed" });
    window.dispatchEvent(event);
  });
  await page.getByTestId("install-help-toggle").click();
  await expect(page.getByText("설치가 취소되었습니다.")).toBeVisible();
  await expect(page.getByTestId("install-help-guide")).toBeVisible();
});

test("KakaoTalk never invokes native PWA prompt", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "userAgent", { configurable: true, value: "Mozilla/5.0 (Linux; Android 13) KAKAOTALK 11.0" }));
  await page.goto("/fullscreen-play");
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
      prompt(): Promise<void>;
      userChoice: Promise<{outcome: "accepted" | "dismissed"}>;
    };
    event.prompt = () => { (window as Window & { __installCalled?: boolean }).__installCalled = true; return Promise.resolve(); };
    event.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(event);
  });
  await page.getByTestId("install-help-toggle").click();
  await expect(page.getByTestId("install-help-guide")).toContainText("다른 브라우저로 열기");
  expect(await page.evaluate(() => (window as Window & { __installCalled?: boolean }).__installCalled ?? false)).toBe(false);
});

test("appinstalled event removes install action", async ({ page }) => {
  await page.goto("/fullscreen-play");
  await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
  await expect(page.getByTestId("install-help-toggle")).toHaveCount(0);
  await expect(page.getByText("설치 완료. 홈 화면에서 실행하세요.")).toBeVisible();
});

test("standalone PWA redirects to game without entry screen", async ({ page }) => {
  await page.addInitScript(() => {
    const native = window.matchMedia.bind(window);
    window.matchMedia = query => query === "(display-mode: standalone)"
      ? { matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } }
      : native(query);
  });
  await page.goto("/fullscreen-play");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: /^보유 개체/ })).toBeVisible();
});
