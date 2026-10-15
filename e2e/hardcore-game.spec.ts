import {chooseBreedingParent} from './helpers/hardcore-navigation';
import {bornIndividual} from '../src/game/hardcore/egg-outcome';
import {inspectGenetics,closeGenetics,closeBreeding} from './helpers/hardcore-navigation';
import {buyFood,manageResources,closeResources} from "./helpers/hardcore-navigation";
import {navigateGame,feedCollection,finishTurnAndTend as finishTurn} from "./helpers/hardcore-navigation";
import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFile } from "node:fs/promises";
import {turns,successfulPair} from "./fixtures/lifecycle";
import { newGame, act, synchronize } from "./fixtures/legacy-catalog";
import { makeSave, exportBackup, parseBackup } from "../src/game/hardcore/save";
import { createNewGame, applyAction } from "../src/game/play";
import { makeSave as legacySave } from "../src/game/save";
import type { HardcoreGame } from "../src/game/hardcore/model";
import { addDays } from "../src/game/hardcore/time";
import { migrateV2 } from "../src/game/hardcore/create";
import type { TimeMode } from "../src/game/hardcore/model";

test.setTimeout(90_000);
const DATE = "2026-10-13", errors = new WeakMap<Page,string[]>();
async function click(locator:Locator,mobile:boolean) { if(mobile) await locator.tap(); else await locator.click(); }
async function tab(page:Page,name:string,mobile:boolean){await navigateGame(page,name,mobile);}
async function saved(page:Page):Promise<HardcoreGame> {
  return page.evaluate(async()=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open("gecko-lab",1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    return new Promise((resolve,reject)=>{const tx=db.transaction("games","readonly"),r=tx.objectStore("games").get("active");r.onsuccess=()=>resolve(r.result.save.game);tx.oncomplete=()=>db.close();tx.onerror=()=>reject(tx.error);});
  });
}
async function date(page:Page,next:string) {
  await page.clock.setFixedTime(new Date(next+"T03:00:00Z"));
  await page.evaluate(()=>window.dispatchEvent(new Event("focus")));
  await expect(page.getByTestId("game-date")).toHaveText(next);
  await expect(page.locator(".game-tab-content")).toHaveAttribute("aria-busy","false");
}
async function timeMode(page:Page,mode:TimeMode,mobile:boolean) {
  await click(page.getByRole("button",{name:"저장 및 게임 설정",exact:true}),mobile);
  await page.getByRole("combobox",{name:"시간 진행 방식",exact:true}).selectOption(mode);
  const button=page.getByRole("button",{name:"시간 방식 저장",exact:true});
  if(await button.isEnabled()) {await click(button,mobile);await expect(button).toBeDisabled();}
  await click(page.getByRole("button",{name:"상세 창 닫기",exact:true}),mobile);
}
async function care(page:Page,mobile:boolean) {
  await tab(page,"컬렉션",mobile);
  await feedCollection(page,mobile);
  await expect(page.locator(".game-tab-content")).toHaveAttribute("aria-busy","false");
}
async function restore(page:Page,input:string,mobile:boolean) {await closeBreeding(page,mobile);
  await click(page.getByRole("button",{name:"저장 및 게임 설정",exact:true}),mobile);
  await page.getByLabel("JSON 백업 파일",{exact:true}).setInputFiles({name:"save.json",mimeType:"application/json",buffer:Buffer.from(input)});
  await click(page.getByRole("button",{name:"복원 실행",exact:true}),mobile);
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
function winningGame() {
 for(let n=0;n<100;n++){
  const first=successfulPair("mobile-v12-"+n+"-",DATE),original=first.original;let g=original;
  for(const id of [first.father,first.mother])g=act(g,{type:"buyGecko",offerId:id},g.lastDate);
  g=act(g,{type:"buyFood",amount:1000},g.lastDate);g=act(g,{type:"breed",fatherId:first.father,motherId:first.mother},g.lastDate);g=turns(g,18);
  const child=Object.values(g.individuals).filter(i=>i.parents&&i.stage==='adult')[1],partner=Object.values(g.shop.offers).find(o=>o.individual.stage==='adult'&&o.individual.sex!==child.sex&&o.individual.genotype.loci['lilly-white'].every(a=>a==='n')&&o.individual.genotype.loci.axanthic.every(a=>a==='A'))!;
  if(!child||!partner)continue;
  g=act(g,{type:"buyGecko",offerId:partner.id},g.lastDate);g=act(g,{type:"breed",fatherId:child.sex==='male'?child.id:partner.id,motherId:child.sex==='female'?child.id:partner.id},g.lastDate);g=turns(g,6);
  if(Object.values(g.individuals).some(i=>i.generation===3))return original;
 }throw new Error("two-generation seed unavailable");
}
test.beforeEach(async({page},info)=>{
  const list:string[]=[];errors.set(page,list);page.on("pageerror",e=>list.push(e.message));
  page.on("console",message=>{if(message.type()==="error")list.push(message.text());});
  await page.clock.setFixedTime(new Date(DATE+"T03:00:00Z"));await page.goto("/");
  await expect(page.getByRole("heading",{name:/^보유 개체/})).toBeVisible();

});
test.afterEach(async({page})=>{expect(errors.get(page)).toEqual([]);});

test("real mobile purchases, automatic care, two generations, hidden sex, sale, expansion and lineage",async({page},info)=>{
 const mobile=info.project.name.startsWith("mobile");await restore(page,exportBackup(winningGame()),mobile);
 await tab(page,"상점",mobile);await expect(page.locator(".shop-offer")).toHaveCount(4);
 await buyFood(page,mobile,1000);
 for(const name of ["노멀 수컷 구매","노멀 암컷 구매"])await click(page.getByRole("button",{name,exact:true}),mobile);
 let g=await saved(page);const [father,mother]=Object.values(g.individuals);await page.screenshot({path:info.outputPath("phase3-shop.png"),scale:"css"});
 await tab(page,"혈통",mobile);await click(page.getByRole("button",{name:"관심 혈통 등록",exact:true}),mobile);await page.getByLabel("혈통 이름",{exact:true}).fill("Moonlight Line");await click(page.getByRole("button",{name:"혈통 이름 등록",exact:true}),mobile);
 await tab(page,"교배",mobile);await chooseBreedingParent(page,'male',father.id);await chooseBreedingParent(page,'female',mother.id);
 await inspectGenetics(page,mobile);await expect(page.getByTestId("hardcore-forecast")).toContainText("100%");await closeGenetics(page,mobile);await click(page.getByRole("button",{name:"교배하기",exact:true}),mobile);
 expect(Object.keys((await saved(page)).eggs)).toHaveLength(0);
 await tab(page,"컬렉션",mobile);for(let t=0;t<2;t++)await finishTurn(page,mobile);g=await saved(page);expect(Object.keys(g.eggs)).toHaveLength(2);const embryos=Object.values(g.eggs).map(e=>e.embryo);
 await tab(page,"부화",mobile);await page.screenshot({path:info.outputPath("phase3-eggs.png"),scale:"css"});await tab(page,"컬렉션",mobile);
 for(let t=0;t<4;t++)await finishTurn(page,mobile);g=await saved(page);for(const embryo of embryos)expect(g.individuals[embryo.id]).toEqual(bornIndividual(embryo));
 await click(page.getByRole("button",{name:embryos[0].name+" 상세보기",exact:true}),mobile);await expect(page.getByRole("dialog")).toContainText("미구분 · 성체 때 공개");
 await page.getByLabel("개체 이름",{exact:true}).fill("새싹");await click(page.getByRole("button",{name:"이름 저장",exact:true}),mobile);await expect(page.getByRole("heading",{name:"새싹 상세",exact:true})).toBeVisible();await page.getByRole("dialog").screenshot({path:info.outputPath("phase3-hatchling.png"),scale:"css"});await page.keyboard.press("Escape");
 for(let t=0;t<12;t++)await finishTurn(page,mobile);await click(page.getByRole("button",{name:"새싹 상세보기",exact:true}),mobile);await expect(page.getByRole("dialog")).not.toContainText("미구분 · 성체 때 공개");
 const beforeSale=(await saved(page)).money;await click(page.getByRole("button",{name:/^분양 준비/}),mobile);await click(page.getByRole("button",{name:"분양 확정",exact:true}),mobile);await expect(page.getByRole("dialog")).toContainText("판매 완료");expect((await saved(page)).money).toBeGreaterThan(beforeSale);await page.keyboard.press("Escape");
 await tab(page,"상점",mobile);await manageResources(page,mobile);await click(page.getByRole("button",{name:"사육장 +4칸 · ₩100,000",exact:true}),mobile);await closeResources(page,mobile);g=await saved(page);
 const child=g.individuals[embryos[1].id],partner=Object.values(g.shop.offers).find(o=>o.individual.stage==='adult'&&o.individual.sex!==child.sex&&o.individual.genotype.loci['lilly-white'].every(a=>a==='n')&&o.individual.genotype.loci.axanthic.every(a=>a==='A'))!;
 await click(page.getByRole("button",{name:partner.individual.name+" 구매",exact:true}),mobile);await tab(page,"교배",mobile);
 await chooseBreedingParent(page,'male',child.sex==='male'?child.id:partner.id);await chooseBreedingParent(page,'female',child.sex==='female'?child.id:partner.id);await click(page.getByRole("button",{name:"교배하기",exact:true}),mobile);
 await tab(page,"컬렉션",mobile);for(let t=0;t<6;t++)await finishTurn(page,mobile);g=await saved(page);const grandchild=Object.values(g.individuals).find(i=>i.generation===3)!;expect(grandchild).toBeDefined();
 await tab(page,"혈통",mobile);await page.getByRole("combobox",{name:"혈통을 볼 개체",exact:true}).selectOption(grandchild.id);await expect(page.locator(".ancestor-list")).toContainText(father.name);await expect(page.locator(".lineage-root")).toContainText("Moonlight Line");await expect(page.getByRole("combobox",{name:"혈통을 볼 개체",exact:true})).toContainText("판매 완료");
 await page.screenshot({path:info.outputPath("phase3-lineage.png"),scale:"css"});await page.reload();await expect(page.getByTestId("game-day")).toHaveText("24");expect(await saved(page)).toEqual(g);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test("offline time stays paused; five unfed manual turns kill once and preserve dead records",async({page},info)=>{
  const mobile=info.project.name.startsWith("mobile"),fixture=newGame("offline",DATE),offer=Object.values(fixture.shop.offers)[0];
  await restore(page,exportBackup(act(fixture,{type:"buyGecko",offerId:offer.id},DATE)),mobile);
  await page.clock.setFixedTime(new Date(addDays(DATE,5)+"T03:00:00Z"));await page.reload();
  await expect(page.getByTestId("game-date")).toHaveText(DATE);expect((await saved(page)).turn).toBe(0);
  for(let n=0;n<5;n++)await finishTurn(page,mobile);let g=await saved(page);
  expect(g.turn).toBe(5);expect(g.individuals[offer.id]).toMatchObject({status:"dead",hearts:0});
  await page.reload();await expect(page.getByRole("heading",{name:/^보유 개체/})).toBeVisible();expect(await saved(page)).toEqual(g);
  await tab(page,"혈통",mobile);await click(page.getByRole("button",{name:"상세 정보",exact:true}),mobile);
  await expect(page.getByRole("dialog")).toContainText("폐사");await expect(page.getByRole("button",{name:"먹이 1개 급여",exact:true})).toHaveCount(0);
  await expect(page.getByRole("button",{name:/분양 준비/})).toHaveCount(0);
});

test("Phase 2 IndexedDB migration preserves embryos, IDs and reserves capacity atomically",async({page},info)=>{
  const old=createNewGame("legacy-import"),[father,mother]=Object.values(old.individuals),bred=applyAction(old,{type:"breed",fatherId:father.id,motherId:mother.id});
  await page.evaluate(async record=>{
    const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open("gecko-lab",1);r.onsuccess=()=>resolve(r.result);});
    await new Promise<void>(resolve=>{const tx=db.transaction("games","readwrite");tx.objectStore("games").put(record,"active");tx.oncomplete=()=>{db.close();resolve();};});
  },{save:legacySave(bred),writeRevision:50});
  await page.reload();await expect(page.getByTestId("game-date")).toHaveText(DATE);const g=await saved(page);
  expect(g.migration).toEqual({from:2,date:DATE});expect(g.capacity).toBeGreaterThanOrEqual(8);expect(g.nextClutch).toBe(bred.nextClutch);
  for(const i of Object.values(bred.individuals)){expect(g.individuals[i.id].genotype).toEqual(i.genotype);expect(g.individuals[i.id].potential).toEqual(i.potential);expect(g.individuals[i.id].visualSeed).toBe(i.visualSeed);}
  for(const e of Object.values(bred.eggs)){expect(g.eggs[e.id].embryo.genotype).toEqual(e.embryo.genotype);expect(g.eggs[e.id].embryo.potential).toEqual(e.embryo.potential);expect(g.eggs[e.id].embryo.parents).toEqual(e.embryo.parents);}
  for(let t=0;t<4;t++)await finishTurn(page,info.project.name.startsWith("mobile"));expect(Object.values((await saved(page)).eggs).every(e=>e.status!=="incubating")).toBe(true);
});

test("backup, corruption rejection, recovery archive and new-game separation",async({page},info)=>{
  const mobile=info.project.name.startsWith("mobile"),original=await saved(page);
  await click(page.getByRole("button",{name:"저장 및 게임 설정",exact:true}),mobile);const wait=page.waitForEvent("download");
  await click(page.getByRole("button",{name:"JSON 백업 저장",exact:true}),mobile);const downloaded=await wait,buffer=await readFile((await downloaded.path())!);
  expect(parseBackup(buffer.toString(),DATE)).toEqual(original);
  const bad=makeSave(original);bad.checksum="broken";
  await page.getByLabel("JSON 백업 파일",{exact:true}).setInputFiles({name:"broken.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(bad))});
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("무결성");expect(await saved(page)).toEqual(original);
  await page.getByLabel("새 게임 시드",{exact:true}).fill("fresh-retry");await click(page.getByRole("button",{name:"새 게임 준비",exact:true}),mobile);
  await click(page.getByRole("button",{name:"취소",exact:true}),mobile);expect(await saved(page)).toEqual(original);
  await click(page.getByRole("button",{name:"새 게임 준비",exact:true}),mobile);await click(page.getByRole("button",{name:"새 게임 시작",exact:true}),mobile);
  await expect(page.getByRole("dialog")).toHaveCount(0);expect((await saved(page)).gameId).not.toBe(original.gameId);
  await click(page.getByRole("button",{name:"저장 및 게임 설정",exact:true}),mobile);await click(page.getByRole("button",{name:"이전 게임 아카이브 조회",exact:true}),mobile);
  await expect(page.getByRole("dialog")).toContainText("보존된 이전 게임 1개");
});

test("stale tabs cannot overwrite money or daily care, all six screens fit 360px and have touch targets",async({page,context},info)=>{
  const mobile=info.project.name.startsWith("mobile"),other=await context.newPage();await other.clock.setFixedTime(new Date(DATE+"T03:00:00Z"));await other.goto("/");
  await expect(other.getByRole("heading",{name:/^보유 개체/})).toBeVisible();
  await tab(page,"상점",mobile);await manageResources(page,mobile);await click(page.getByRole("button",{name:"먹이 구입 · ₩10,000",exact:true}),mobile);
  await tab(other,"상점",mobile);await manageResources(other,mobile);await click(other.getByRole("button",{name:"먹이 구입 · ₩10,000",exact:true}),mobile);
  await expect(other.getByRole("alert").filter({hasText:"다른 창"})).toBeVisible();expect((await saved(page)).food).toBe(10);await other.close();
  for(const name of ["오늘","컬렉션","교배","부화","상점","혈통"]) {
    await tab(page,name,mobile);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const label=name==='부화'?'인큐베이터':name==='혈통'?'혈통도':name;
    const control=name==="교배"?page.locator(".breed-change").first():page.getByRole("navigation",{name:"게임 탭"}).getByRole("button",{name:label,exact:true});const box=await control.boundingBox();expect(box!.width).toBeGreaterThanOrEqual(44);expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await expect(page.getByRole("button",{name:"1턴 진행",exact:true})).toHaveCount(0);await expect(page.getByRole("button",{name:"+5턴",exact:true})).toHaveCount(0);
});

test("offline production shell reload preserves paused IndexedDB and allows explicit player turns",async({page,context},info)=>{
  const mobile=info.project.name.startsWith("mobile");await tab(page,"상점",mobile);
  const offer=Object.values((await saved(page)).shop.offers)[0];await click(page.getByRole("button",{name:offer.individual.name+" 구매",exact:true}),mobile);
  const before=await saved(page);
  await page.evaluate(async()=>{await navigator.serviceWorker.ready; if(!navigator.serviceWorker.controller)await new Promise<void>(resolve=>navigator.serviceWorker.addEventListener("controllerchange",()=>resolve(),{once:true}));});
  await context.setOffline(true);await page.clock.setFixedTime(new Date(addDays(DATE,2)+"T03:00:00Z"));await page.reload();
  await expect(page.getByTestId("game-date")).toHaveText(DATE);expect(await saved(page)).toEqual(before);await finishTurn(page,mobile);const after=await saved(page);
  expect(after.money).toBe(before.money);expect(after.food).toBe(before.food);
  expect(Object.values(after.individuals)[0].hearts).toBe(4);expect(after.turn).toBe(1);expect(after.lastDate).toBe(addDays(DATE,7));
  await context.setOffline(false);await page.reload();await expect(page.getByRole("heading",{name:/^보유 개체/})).toBeVisible();
  expect(await saved(page)).toEqual(after);
});

test("corrupt active v3 stays untouched until confirmed recovery and is archived",async({page},info)=>{
  const mobile=info.project.name.startsWith("mobile"),original=await saved(page);
  await page.evaluate(async()=>{
    const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open("gecko-lab",1);r.onsuccess=()=>resolve(r.result);});
    await new Promise<void>(resolve=>{const tx=db.transaction("games","readwrite"),s=tx.objectStore("games"),r=s.get("active");r.onsuccess=()=>{const v=r.result;v.save.checksum="CORRUPT-V3";s.put(v,"active");};tx.oncomplete=()=>{db.close();resolve();};});
  });
  await page.reload();await expect(page.getByRole("heading",{name:"저장 데이터를 불러오지 못했습니다",exact:true})).toBeVisible();
  const checksum=await page.evaluate(async()=>{
    const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open("gecko-lab",1);r.onsuccess=()=>resolve(r.result);});
    return new Promise<string>(resolve=>{const tx=db.transaction("games","readonly"),r=tx.objectStore("games").get("active");r.onsuccess=()=>resolve(r.result.save.checksum);tx.oncomplete=()=>db.close();});
  });expect(checksum).toBe("CORRUPT-V3");
  await click(page.getByRole("button",{name:"백업 복원 또는 새 게임",exact:true}),mobile);
  await page.getByLabel("JSON 백업 파일",{exact:true}).setInputFiles({name:"recovery.json",mimeType:"application/json",buffer:Buffer.from(exportBackup(original))});
  await click(page.getByRole("button",{name:"복원 실행",exact:true}),mobile);await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await saved(page)).toEqual(original);
  await click(page.getByRole("button",{name:"저장 및 게임 설정",exact:true}),mobile);await click(page.getByRole("button",{name:"이전 게임 아카이브 조회",exact:true}),mobile);
  await expect(page.getByRole("dialog")).toContainText("보존된 이전 게임 1개");
});

test("live UI distinguishes lethal conditional odds and allows acknowledged risky and lineal matings after adulthood",async({page},info)=>{
  const mobile=info.project.name.startsWith("mobile"),fixture=migrateV2(legacySave(createNewGame("risk-ui")),DATE);
  fixture.capacity=12;fixture.rules={...fixture.rules,fertilizationChance:1,hatchChance:1,juvenileAfter:1,adultAfter:1};
  fixture.time.mode="turn";fixture.food=500;
  await restore(page,exportBackup(fixture),mobile);
  const [normal,lillyFemale,,,lillyMale]=Object.values(fixture.individuals);
  await tab(page,"교배",mobile);await chooseBreedingParent(page,'male',lillyMale.id);await chooseBreedingParent(page,'female',lillyFemale.id);
  await inspectGenetics(page,mobile);const forecast=page.getByTestId("hardcore-forecast");await expect(forecast).toContainText("비생존 · 25%");await expect(forecast).toContainText("33.3%");await expect(forecast).toContainText("66.7%");
  await closeGenetics(page,mobile);await expect(page.getByRole("button",{name:"교배하기",exact:true})).toBeEnabled();
  await click(page.getByRole("button",{name:"교배하기",exact:true}),mobile);await expect(page.getByRole('dialog',{name:'교배 전 위험 확인',exact:true})).toContainText('25.0%');await click(page.getByRole('button',{name:'취소',exact:true}),mobile);
  await chooseBreedingParent(page,'male',normal.id);await click(page.getByRole("button",{name:"교배하기",exact:true}),mobile);
  await tab(page,"컬렉션",mobile);for(let t=0;t<22;t++)await finishTurn(page,mobile);const g=await saved(page),child=Object.values(g.individuals).find(i=>i.parents&&i.stage==='adult')!;
  await tab(page,"교배",mobile);await chooseBreedingParent(page,'male',child.sex==="male"?child.id:normal.id);await chooseBreedingParent(page,'female',child.sex==="female"?child.id:lillyFemale.id);
  await expect(page.getByTestId('breeding-caution')).toContainText('근친교배');await expect(page.getByRole("button",{name:"교배하기",exact:true})).toBeEnabled();await click(page.getByRole("button",{name:"교배하기",exact:true}),mobile);await expect(page.getByRole('dialog',{name:'교배 전 위험 확인',exact:true})).toContainText('부모·자식');await click(page.getByRole('button',{name:'취소',exact:true}),mobile);
});
