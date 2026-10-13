import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { MORPH_PRESETS, specimenFromPreset } from "../src/engine/presets";
import { renderSprite } from "../src/engine/render";

test.beforeEach(async ({ page }) => {
  await page.goto("/lab");
  await expect.poll(() => page.getByTestId("hero-sprite").evaluate((node) => {
    const canvas = node as HTMLCanvasElement;
    return canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data.some((v) => v > 0);
  })).toBe(true);
});

test("six distinct presets, Korean UI, and no viewport overflow", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await expect(page).toHaveTitle(/GECKO LAB/);
  await expect(page.locator("html")).toHaveAttribute("lang", "ko");
  const hashes = [];
  for (const preset of MORPH_PRESETS) {
    await expect(page.getByTestId("preset-" + preset.id)).toBeVisible();
    await expect.poll(() => page.getByTestId("gallery-" + preset.id).evaluate((node) => {
      const canvas = node as HTMLCanvasElement;
      return canvas.getContext("2d")!.getImageData(0,0,96,96).data.some((v) => v > 0);
    })).toBe(true);
    hashes.push(await page.getByTestId("gallery-" + preset.id).evaluate((node) => (node as HTMLCanvasElement).toDataURL()));
  }
  expect(new Set(hashes).size).toBe(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("sprite-lab.png"), fullPage: true, scale: "css" });
  await page.screenshot({ path: testInfo.outputPath("mobile-viewport.png"), scale: "css" });
  await page.locator(".gallery-section").screenshot({ path: testInfo.outputPath("morph-gallery.png"), scale: "css" });
});

test("3× and 4× Canvas pixels exactly match logical RGBA with smoothing disabled", async ({ page }) => {
  const expected = Array.from(renderSprite(specimenFromPreset(MORPH_PRESETS[0])).pixels);
  for (const scale of [3,4] as const) {
    await page.getByRole("button", { name: scale + "×", exact: true }).click();
    await expect(page.getByTestId("hero-sprite")).toHaveAttribute("width", String(96 * scale));
    const result = await page.getByTestId("hero-sprite").evaluate((node, input) => {
      const canvas = node as HTMLCanvasElement, context = canvas.getContext("2d")!;
      const pixels = context.getImageData(0,0,canvas.width,canvas.height).data;
      let mismatches = 0;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        const logical = (Math.floor(y/input.scale) * 96 + Math.floor(x/input.scale)) * 4;
        const actual = (y*canvas.width+x) * 4;
        for (let c = 0; c < 4; c++) if (pixels[actual+c] !== input.expected[logical+c]) mismatches++;
      }
      return { mismatches, smoothing: context.imageSmoothingEnabled };
    }, { expected, scale });
    expect(result).toEqual({ mismatches: 0, smoothing: false });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test("preset, color, pattern, seed and fire controls update reproducibly", async ({ page }) => {
  const image = () => page.getByTestId("hero-sprite").evaluate((node) => (node as HTMLCanvasElement).toDataURL());
  const original = await image();
  await page.getByRole("button", { name: "브라운", exact: true }).click();
  await expect.poll(image).not.toBe(original);
  await page.getByTestId("preset-dalmatian").click();
  await expect(page.getByTestId("preset-dalmatian")).toHaveAttribute("aria-pressed", "true");
  const sliders = [["등 패턴 면적", "80"], ["옆구리 패턴 면적", "60"], ["달마시안 반점", "70"]];
  for (const [name, value] of sliders) {
    await page.getByRole("slider", { name: new RegExp(name) }).fill(value);
  }
  const configured = await image();
  await page.getByRole("button", { name: "파이어다운", exact: true }).click();
  await expect.poll(image).not.toBe(configured);
  await page.getByRole("button", { name: "파이어업", exact: true }).click();
  await expect.poll(image).toBe(configured);
  await page.getByLabel("개체 시드").fill("OTHER-SEED-27");
  await page.getByRole("button", { name: "시드 적용" }).click();
  await expect.poll(image).not.toBe(configured);
  await page.getByLabel("개체 시드").fill("GECKO-0014");
  await page.getByRole("button", { name: "시드 적용" }).click();
  await expect.poll(image).toBe(configured);
  await page.getByLabel("개체 시드").fill(" ");
  await page.getByRole("button", { name: "시드 적용" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "시드를 한 글자 이상" })).toBeVisible();
  expect(await image()).toBe(configured);
  const siblings = await Promise.all(["A","B","C"].map((value) => page.getByTestId("individual-" + value)
    .evaluate((node) => (node as HTMLCanvasElement).toDataURL())));
  expect(new Set(siblings).size).toBe(3);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.getByLabel("개체 시드").fill("x".repeat(128));
  await page.getByRole("button", { name: "시드 적용" }).click();
  await expect.poll(image).not.toBe(configured);
  await expect(page.getByTestId("individual-A")).toBeVisible();
  expect(errors).toEqual([]);
});

test("eight mask toggles can hide all pixels and restore the image", async ({ page }) => {
  const image = () => page.getByTestId("hero-sprite").evaluate((node) => (node as HTMLCanvasElement).toDataURL());
  const original = await image();
  const checkboxes = page.getByRole("checkbox");
  await expect(checkboxes).toHaveCount(8);
  for (const box of await checkboxes.all()) await box.uncheck();
  await expect.poll(() => page.getByTestId("hero-sprite").evaluate((node) => {
    const canvas = node as HTMLCanvasElement;
    const data = canvas.getContext("2d")!.getImageData(0,0,canvas.width,canvas.height).data;
    return data.every((value) => value === 0);
  })).toBe(true);
  for (const box of await checkboxes.all()) await box.check();
  await expect.poll(image).toBe(original);
});

test("loaded renderer works offline and exports a native transparent 96×96 PNG", async ({ page, context }) => {
  const original = await page.getByTestId("hero-sprite").evaluate((node) => (node as HTMLCanvasElement).toDataURL());
  await context.setOffline(true);
  await page.getByRole("button", { name: "크림", exact: true }).click();
  await expect.poll(() => page.getByTestId("hero-sprite").evaluate((node) => (node as HTMLCanvasElement).toDataURL())).not.toBe(original);
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: "PNG 저장" }).click();
  const download = await pending;
  const path = await download.path();
  const data = await readFile(path!);
  expect(Array.from(data.subarray(0,8))).toEqual([137,80,78,71,13,10,26,10]);
  expect(data.readUInt32BE(16)).toBe(96);
  expect(data.readUInt32BE(20)).toBe(96);
  await context.setOffline(false);
});

test("portrait PWA metadata and local icons are served without external APIs", async ({ page, request }) => {
  const external: string[] = [];
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (url.protocol.startsWith("http") && !["127.0.0.1","localhost"].includes(url.hostname)) external.push(url.hostname);
  });
  await page.reload();
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.orientation).toBe("portrait-primary");
  expect(manifest.display).toBe("standalone");
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
  expect(external).toEqual([]);
});
