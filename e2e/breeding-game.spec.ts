import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createNewGame, applyAction } from "../src/game/play";
import { exportBackup, parseBackup } from "../src/game/save";
import type { GameState } from "../src/game/model";

test.setTimeout(60_000);
const errors = new WeakMap<Page,string[]>();
async function activate(locator: Locator, mobile: boolean) { if (mobile) await locator.tap(); else await locator.click(); }
async function saved(page: Page): Promise<GameState> {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve,reject) => {
      const request = indexedDB.open("gecko-lab",1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    return new Promise((resolve,reject) => {
      const transaction = database.transaction("games","readonly"), request = transaction.objectStore("games").get("active");
      request.onsuccess = () => resolve(request.result.save.game);
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => database.close();
    });
  });
}
async function advance(page: Page, turns: 1 | 5, mobile: boolean) {
  const before = Number(await page.getByTestId("game-turn").textContent());
  await activate(page.getByRole("button",{name:turns === 1 ? "1턴 진행" : "+5턴",exact:true}),mobile);
  await expect(page.getByTestId("game-turn")).toHaveText(String(before+turns));
  await expect(page.locator(".game-tab-content")).toHaveAttribute("aria-busy","false");
}
async function tab(page: Page, label: string, mobile: boolean) {
  await activate(page.getByRole("navigation",{name:"게임 탭"}).getByRole("button",{name:label,exact:true}),mobile);
}
async function layStarterEggs(page: Page, mobile: boolean) {
  await tab(page,"교배",mobile);
  await activate(page.getByRole("button",{name:"교배하고 알 2개 생성",exact:true}),mobile);
  await expect(page.getByRole("heading",{name:"인큐베이터",exact:true})).toBeVisible();
}
test.beforeEach(async ({page}) => {
  const collected: string[] = []; errors.set(page,collected);
  page.on("pageerror",error => collected.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading",{name:/컬렉션/})).toBeVisible();
  await expect(page.getByTestId("game-turn")).toHaveText("0");
});
test.afterEach(async ({page}) => { expect(errors.get(page)).toEqual([]); });

test("plays two generations through selection, probabilities, eggs, hatch, naming, growth and refresh", async ({page},info) => {
  const mobile = info.project.name.startsWith("mobile");
  const initial = createNewGame(), population = Object.values(initial.individuals), [father,mother,unrelatedMale,unrelatedFemale,lillyMale] = population;
  await page.screenshot({path:info.outputPath("phase2-collection.png"),fullPage:true,scale:"css"});
  await page.screenshot({path:info.outputPath("phase2-collection-viewport.png"),scale:"css"});
  await tab(page,"교배",mobile);
  await page.getByRole("combobox",{name:"수컷 부모",exact:true}).selectOption(father.id);
  await page.getByRole("combobox",{name:"암컷 부모",exact:true}).selectOption(mother.id);
  const forecast = page.getByTestId("genetics-forecast");
  await expect(forecast.locator(".probability-row")).toHaveCount(2);
  for (const row of await forecast.locator(".probability-row").all()) await expect(row).toContainText("50%");
  await page.getByRole("combobox",{name:"수컷 부모",exact:true}).selectOption(lillyMale.id);
  await expect(forecast.locator(".nonviable")).toContainText("25%");
  await expect(forecast.locator(".conditional-probability")).toContainText("33.3%");
  await expect(forecast.locator(".conditional-probability")).toContainText("66.7%");
  await expect(page.getByRole("button",{name:"교배하고 알 2개 생성",exact:true})).toBeDisabled();
  expect(Object.keys((await saved(page)).eggs)).toHaveLength(0);
  await page.getByRole("combobox",{name:"수컷 부모",exact:true}).selectOption(father.id);
  await page.screenshot({path:info.outputPath("phase2-breeding.png"),fullPage:true,scale:"css"});
  await forecast.evaluate(node => node.scrollIntoView({block:"start"}));
  await page.screenshot({path:info.outputPath("phase2-probabilities-viewport.png"),scale:"css"});
  await activate(page.getByRole("button",{name:"교배하고 알 2개 생성",exact:true}),mobile);
  await expect(page.getByRole("heading",{name:"인큐베이터",exact:true})).toBeVisible();
  const laid = await saved(page), eggs = Object.values(laid.eggs);
  expect(eggs).toHaveLength(2);
  expect(eggs[0].embryo.visualSeed).not.toBe(eggs[1].embryo.visualSeed);
  await page.screenshot({path:info.outputPath("phase2-eggs.png"),fullPage:true,scale:"css"});
  await page.evaluate(() => window.scrollTo({top:0}));
  await page.screenshot({path:info.outputPath("phase2-eggs-viewport.png"),scale:"css"});
  await advance(page,1,mobile); await advance(page,1,mobile);
  const hatched = await saved(page), child = hatched.individuals[eggs[0].embryo.id];
  expect(child).toEqual(eggs[0].embryo);
  expect(Object.keys(hatched.individuals)).toHaveLength(8);
  await activate(page.getByRole("button",{name:child.name+" 이름과 상세 정보",exact:true}),mobile);
  await expect(page.getByRole("dialog")).toContainText("Gen 2");
  await page.getByLabel("개체 이름",{exact:true}).fill("새싹");
  await activate(page.getByRole("button",{name:"이름 저장",exact:true}),mobile);
  await expect(page.getByRole("heading",{name:"새싹 상세",exact:true})).toBeVisible();
  await page.getByRole("dialog").screenshot({path:info.outputPath("phase2-hatchling.png"),scale:"css"});
  await activate(page.getByRole("button",{name:"상세 창 닫기",exact:true}),mobile);
  await tab(page,"컬렉션",mobile);
  await expect(page.getByRole("button",{name:"새싹 상세보기",exact:true})).toContainText("해칭");
  await advance(page,5,mobile);
  await expect(page.getByRole("button",{name:"새싹 상세보기",exact:true})).toContainText("아성체");
  await advance(page,1,mobile);
  await expect(page.getByRole("button",{name:"새싹 상세보기",exact:true})).toContainText("성체 · 교배 가능");
  await activate(page.getByRole("button",{name:"새싹 상세보기",exact:true}),mobile);
  await activate(page.getByRole("button",{name:"부모로 선택",exact:true}),mobile);
  await expect(page.getByRole("button",{name:"교배하고 알 2개 생성",exact:true})).toBeDisabled();
  await expect(page.locator(".game-warning")).toContainText("직계");
  const partner = child.sex === "male" ? unrelatedFemale : unrelatedMale;
  await page.getByRole("combobox",{name:child.sex === "male" ? "암컷 부모" : "수컷 부모",exact:true}).selectOption(partner.id);
  await expect(page.getByRole("button",{name:"교배하고 알 2개 생성",exact:true})).toBeEnabled();
  await activate(page.getByRole("button",{name:"교배하고 알 2개 생성",exact:true}),mobile);
  await expect(page.getByRole("heading",{name:"인큐베이터",exact:true})).toBeVisible();
  const second = await saved(page), nextEggs = Object.values(second.eggs).filter(v => v.clutch === 2);
  expect(nextEggs.map(v => v.embryo.generation)).toEqual([3,3]);
  for (const egg of nextEggs) expect(Object.values(egg.parents)).toContain(child.id);
  await advance(page,1,mobile); await advance(page,1,mobile);
  await tab(page,"혈통도",mobile);
  await page.getByRole("combobox",{name:"혈통을 볼 개체",exact:true}).selectOption(nextEggs[0].embryo.id);
  await expect(page.locator(".ancestor-list")).toContainText("새싹");
  await expect(page.locator(".ancestor-list")).toContainText("치즈");
  await expect(page.locator(".ancestor-list")).toContainText("모카");
  await page.screenshot({path:info.outputPath("phase2-lineage.png"),fullPage:true,scale:"css"});
  await page.locator(".ancestor-list").evaluate(node => node.scrollIntoView({block:"start"}));
  await page.screenshot({path:info.outputPath("phase2-lineage-viewport.png"),scale:"css"});
  const beforeReload = await saved(page);
  await page.reload();
  await expect(page.getByRole("heading",{name:/컬렉션/})).toBeVisible();
  expect(await saved(page)).toEqual(beforeReload);
  await expect(page.getByRole("button",{name:"새싹 상세보기",exact:true})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("backs up and restores eggs, genes, parents, turn and next seeded offspring", async ({page},info) => {
  const mobile = info.project.name.startsWith("mobile");
  await layStarterEggs(page,mobile); await advance(page,1,mobile); await advance(page,1,mobile);
  const original = await saved(page);
  await activate(page.getByRole("button",{name:"저장 및 게임 설정",exact:true}),mobile);
  const waiting = page.waitForEvent("download");
  await activate(page.getByRole("button",{name:"JSON 백업 저장",exact:true}),mobile);
  const download = await waiting, buffer = await readFile((await download.path())!);
  expect(parseBackup(buffer.toString())).toEqual(original);
  await activate(page.getByRole("button",{name:"상세 창 닫기",exact:true}),mobile);
  await advance(page,5,mobile);
  await activate(page.getByRole("button",{name:"저장 및 게임 설정",exact:true}),mobile);
  await page.getByLabel("JSON 백업 파일",{exact:true}).setInputFiles({name:"gecko-backup.json",mimeType:"application/json",buffer});
  await expect(page.getByTestId("replacement-confirm")).toContainText("TURN 2");
  await activate(page.getByRole("button",{name:"복원 실행",exact:true}),mobile);
  await expect(page.getByTestId("game-turn")).toHaveText("2");
  expect(await saved(page)).toEqual(original);
  await layStarterEggs(page,mobile);
  const [father,mother] = Object.values(original.individuals);
  expect(await saved(page)).toEqual(applyAction(original,{type:"breed",fatherId:father.id,motherId:mother.id}));
});

test("rejects malformed and unsupported backups without overwriting progress", async ({page},info) => {
  const mobile = info.project.name.startsWith("mobile"), original = await saved(page);
  await activate(page.getByRole("button",{name:"저장 및 게임 설정",exact:true}),mobile);
  const input = page.getByLabel("JSON 백업 파일",{exact:true});
  await input.setInputFiles({name:"broken.json",mimeType:"application/json",buffer:Buffer.from("{")});
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("JSON");
  expect(await saved(page)).toEqual(original);
  const wrong = JSON.parse(exportBackup(original)); wrong.version = 999;
  await input.setInputFiles({name:"future.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(wrong))});
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("버전");
  expect(await saved(page)).toEqual(original);
});

test("preserves corrupt IndexedDB data until an explicitly confirmed recovery", async ({page},info) => {
  const mobile = info.project.name.startsWith("mobile"), original = await saved(page);
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>(resolve => {const req=indexedDB.open("gecko-lab",1);req.onsuccess=()=>resolve(req.result);});
    await new Promise<void>((resolve,reject) => {
      const tx=database.transaction("games","readwrite"),store=tx.objectStore("games"),req=store.get("active");
      req.onsuccess=()=>{const record=req.result;record.save.checksum="CORRUPTED";store.put(record,"active");};
      tx.oncomplete=()=>{database.close();resolve();};tx.onerror=()=>reject(tx.error);
    });
  });
  await page.reload();
  await expect(page.getByRole("heading",{name:"저장 데이터를 불러오지 못했습니다",exact:true})).toBeVisible();
  await expect(page.getByRole("alert").filter({hasText:"무결성"})).toBeVisible();
  // Read raw checksum to demonstrate that failed initialization did not replace the record.
  const checksum = await page.evaluate(async () => {
    const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open("gecko-lab",1);r.onsuccess=()=>resolve(r.result);});
    return new Promise<string>(resolve=>{const tx=db.transaction("games","readonly"),r=tx.objectStore("games").get("active");
      r.onsuccess=()=>resolve(r.result.save.checksum);tx.oncomplete=()=>db.close();});
  });
  expect(checksum).toBe("CORRUPTED");
  await activate(page.getByRole("button",{name:"백업 복원 또는 새 게임",exact:true}),mobile);
  await page.getByLabel("JSON 백업 파일",{exact:true}).setInputFiles({name:"valid.json",mimeType:"application/json",buffer:Buffer.from(exportBackup(original))});
  await activate(page.getByRole("button",{name:"복원 실행",exact:true}),mobile);
  await expect(page.getByRole("heading",{name:/컬렉션/})).toBeVisible();
  expect(await saved(page)).toEqual(original);
});

test("prevents stale tabs from overwriting newer progress", async ({page,context},info) => {
  const mobile = info.project.name.startsWith("mobile"), other = await context.newPage();
  const otherErrors: string[]=[];other.on("pageerror",e=>otherErrors.push(e.message));
  await other.goto("/"); await expect(other.getByTestId("game-turn")).toHaveText("0");
  await advance(page,1,mobile);
  await activate(other.getByRole("button",{name:"1턴 진행",exact:true}),mobile);
  await expect(other.getByRole("alert").filter({hasText:"다른 창"})).toBeVisible();
  await expect(other.getByTestId("game-turn")).toHaveText("0");
  expect((await saved(page)).turn).toBe(1);
  await activate(other.getByRole("button",{name:"저장 상태 새로고침",exact:true}),mobile);
  await expect(other.getByTestId("game-turn")).toHaveText("1");
  expect(otherErrors).toEqual([]);await other.close();
});

test("supports configurable new games with a replacement confirmation and mobile tabs", async ({page},info) => {
  const mobile = info.project.name.startsWith("mobile");
  for (const [label,heading] of [["컬렉션","컬렉션"],["교배","교배 연구실"],["인큐베이터","인큐베이터"],["혈통도","혈통도"]]) {
    await tab(page,label,mobile);
    await expect(page.getByRole("heading",{name:new RegExp("^"+heading)})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    const box=await page.getByRole("navigation",{name:"게임 탭"}).getByRole("button",{name:label,exact:true}).boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await advance(page,1,mobile);
  const before=await saved(page);
  await activate(page.getByRole("button",{name:"저장 및 게임 설정",exact:true}),mobile);
  await activate(page.locator(".new-game-settings > summary"),mobile);
  await page.getByLabel("새 게임 시드",{exact:true}).fill("mobile-new-game");
  await page.getByLabel("부화 기간 (턴)",{exact:true}).fill("3");
  await page.getByLabel("아성체가 되는 나이 (턴)",{exact:true}).fill("2");
  await page.getByLabel("성체가 되는 나이 (턴)",{exact:true}).fill("4");
  await activate(page.getByRole("button",{name:"새 게임 준비",exact:true}),mobile);
  expect(await saved(page)).toEqual(before);
  await activate(page.getByRole("button",{name:"취소",exact:true}),mobile);
  expect(await saved(page)).toEqual(before);
  await activate(page.getByRole("button",{name:"새 게임 준비",exact:true}),mobile);
  await activate(page.getByRole("button",{name:"새 게임 시작",exact:true}),mobile);
  await expect(page.getByTestId("game-turn")).toHaveText("0");
  const restarted = await saved(page);
  expect(restarted.seed).toBe("mobile-new-game");
  expect(restarted.rules).toMatchObject({incubationTurns:3,juvenileAfter:2,adultAfter:4});
  expect(Object.keys(restarted.individuals)).toHaveLength(6);
  expect(Object.keys(restarted.eggs)).toHaveLength(0);
  await page.reload();await expect(page.getByRole("heading",{name:/컬렉션/})).toBeVisible();
  expect(await saved(page)).toEqual(restarted);
});
