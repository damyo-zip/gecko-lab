import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import type { Workspace } from '../src/engine/model';

// Keep filesystem downloads in the test runner, never in the public art assets.
async function snapshot(page: Page): Promise<Workspace> {
  const waiting = page.waitForEvent('download'); await page.locator('#export').click();
  const download = await waiting, path = await download.path();
  return JSON.parse(await readFile(path!, 'utf8'));
}
async function founder(page: Page, name: string, sex: string, seed: string) {
  await page.locator('#name').fill(name); await page.locator('#sex').selectOption(sex);
  await page.locator('#genome-seed').fill(seed); await page.locator('#reseed').click();
  await page.locator('#visual-seed').fill(`${seed}-visual`); await page.locator('#visual-seed').blur();
  await page.getByRole('button', { name: '설정으로 개체 생성', exact: true }).click();
}

test('founder, exact replay, native PNG, JSON and isolated local restore', async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('#population-count')).toHaveText('0');
  await page.evaluate(() => localStorage.setItem('gecko-lab:sentinel', 'unchanged'));
  await page.locator('#preset').selectOption('lilly');
  await founder(page, '망고', 'male', 'replay-founder');
  const original = await page.locator('#native').evaluate((c: HTMLCanvasElement) => c.toDataURL());
  await page.locator('#reproduce').click(); await expect(page.locator('#population-count')).toHaveText('2');
  expect(await page.locator('#native').evaluate((c: HTMLCanvasElement) => c.toDataURL())).toBe(original);
  await page.getByRole('button', { name: 'F-0002 즐겨찾기', exact: true }).click();
  const downloaded = page.waitForEvent('download'); await page.locator('#selected-png').click();
  const png = await readFile((await (await downloaded).path())!);
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([96, 96]);
  const data = await snapshot(page);
  expect(data.individuals[0].genome.mendelian.loci['lilly-white']).toEqual(['n', 'Lw']);
  expect(data.favorites).toEqual(['F-0002']);
  expect(data.individuals[0].genome).toEqual(data.individuals[1].genome);
  await page.reload(); await expect(page.locator('#population-count')).toHaveText('2');
  expect(await page.locator('#native').evaluate((c: HTMLCanvasElement) => c.toDataURL())).toBe(original);
  await page.locator('#new-workspace').click(); await expect(page.locator('#population-count')).toHaveText('0');
  await page.locator('#import').setInputFiles({ name: 'experiment.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
  await expect(page.locator('#population-count')).toHaveText('2');
  expect(await page.evaluate(() => localStorage.getItem('gecko-lab:sentinel'))).toBe('unchanged');
  await page.locator('#import').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"saveVersion":10}') });
  await expect(page.locator('#message')).toContainText('가져오기 실패'); await expect(page.locator('#population-count')).toHaveText('2');
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('forge-replay.png'), fullPage: true });
});

test('real batch inheritance and offspring parents across generations', async ({ page }, testInfo) => {
  await page.goto('/');
  await founder(page, '아비', 'male', 'father');
  await founder(page, '어미', 'female', 'mother');
  await page.locator('#father').selectOption('F-0001'); await page.locator('#mother').selectOption('F-0002');
  await page.locator('#count').fill('32'); await page.locator('#breeding-seed').fill('browser-cross');
  await page.getByRole('button', { name: '실제 상속으로 자손 생성' }).click();
  await expect(page.locator('#population-count')).toHaveText('34');
  await expect(page.locator('.gecko-card')).toHaveCount(24);
  await page.locator('#next').click(); await expect(page.locator('.gecko-card')).toHaveCount(10);
  await page.locator('#previous').click();
  const first = await snapshot(page), [f, m] = first.individuals;
  const children = first.individuals.slice(2);
  expect(children).toHaveLength(32);
  for (const c of children) {
    expect(c.generation).toBe(2); expect(c.parents).toEqual({ fatherId: f.id, motherId: m.id });
    for (const id of Object.keys(c.genome.polygenic.loci)) { expect(f.genome.polygenic.loci[id]).toContain(c.genome.polygenic.loci[id][0]); expect(m.genome.polygenic.loci[id]).toContain(c.genome.polygenic.loci[id][1]); }
  }
  const son = children.find(c => c.sex === 'male')!;
  await page.locator('#father').selectOption(son.id); await page.locator('#count').fill('4');
  await page.locator('#breeding-seed').fill('browser-next-generation');
  await page.getByRole('button', { name: '실제 상속으로 자손 생성' }).click();
  await expect(page.locator('#population-count')).toHaveText('38');
  const next = await snapshot(page); expect(next.individuals.slice(-4).every(c => c.generation === 3 && c.parents!.fatherId === son.id)).toBe(true);
  await page.reload(); expect(await snapshot(page)).toEqual(next);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('forge-breeding.png'), fullPage: true });
});

test('editing copies actual alleles, nonviable inspection and renderer reference', async ({ page }) => {
  await page.goto('/'); await founder(page, '기준', 'female', 'editing');
  const before = await snapshot(page);
  await page.locator('#feature-cream').evaluate((el: HTMLInputElement) => { el.value = '4'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.getByRole('button', { name: '설정으로 개체 생성', exact: true }).click();
  const after = await snapshot(page);
  expect(after.individuals[0]).toEqual(before.individuals[0]);
  for (const [id, pair] of Object.entries(after.individuals[1].genome.polygenic.loci)) {
    expect(pair).toEqual(id.startsWith('cream-') ? [4, 4] : before.individuals[0].genome.polygenic.loci[id]);
  }
  await page.locator('[data-locus="lilly-white"]').selectOption('Lw/Lw');
  await page.getByRole('button', { name: '설정으로 개체 생성', exact: true }).click();
  await expect(page.locator('.nonviable')).toHaveText('비생존 유전형');
  await expect(page.locator('[data-id="F-0003"] [data-action="parent"]')).toBeDisabled();
  await expect(page.locator('#selected-png')).toBeDisabled();
  const images = page.locator('#b-reference img');
  expect(await images.first().evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(96);
  await expect(images).toHaveCount(2);
  await page.locator('#preset').selectOption('normal'); await page.locator('#random').click();
  await expect(page.locator('#population-count')).toHaveText('4');
  const random = (await snapshot(page)).individuals[3];
  expect(random.creationSeed).not.toBe(before.individuals[0].creationSeed);
  expect(random.genome.mendelian.loci['lilly-white']).toEqual(['n', 'n']);
});
