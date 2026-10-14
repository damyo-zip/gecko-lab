import {buyFood,manageResources,closeResources} from "./helpers/hardcore-navigation";
import {navigateGame,finishTurn,feedCollection} from "./helpers/hardcore-navigation";
import { test, expect, type Page, type Locator } from "@playwright/test";
import { newGame } from "./fixtures/legacy-catalog";
import {newGame as legacyGame} from "../tests/helpers/legacy-hardcore";
import {successfulPair} from "./fixtures/lifecycle";
import { actWithTime } from "../src/game/hardcore/time-source";
import { exportBackup, checksum } from "../src/game/hardcore/save";
import { addDays } from "../src/game/hardcore/time";
import type { HardcoreGame, LegacyHardcoreGame, TimeMode } from "../src/game/hardcore/model";

const DATE="2026-10-13";
const errors=new WeakMap<Page,string[]>();
async function click(locator:Locator,mobile:boolean) {if(mobile)await locator.tap();else await locator.click();}
async function tab(page:Page,name:string,mobile:boolean){await navigateGame(page,name,mobile);}
async function saved(page:Page):Promise<HardcoreGame> {
  return page.evaluate(async()=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open("gecko-lab",1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    return new Promise((resolve,reject)=>{const tx=db.transaction("games","readonly"),r=tx.objectStore("games").get("active");r.onsuccess=()=>resolve(r.result.save.game);tx.oncomplete=()=>db.close();tx.onerror=()=>reject(tx.error);});
  });
}
async function mode(page:Page,value:TimeMode,mobile:boolean) {
  await click(page.getByRole("button",{name:"저장 및 게임 설정",exact:true}),mobile);
  await page.getByRole("combobox",{name:"시간 진행 방식",exact:true}).selectOption(value);
  await click(page.getByRole("button",{name:"시간 방식 저장",exact:true}),mobile);
  await expect(page.getByRole("button",{name:"시간 방식 저장",exact:true})).toBeDisabled();
  await click(page.getByRole("button",{name:"상세 창 닫기",exact:true}),mobile);
}
async function endTurn(page:Page,mobile:boolean) {
  const before=Number(await page.getByTestId("game-day").textContent());
  await finishTurn(page,mobile);
  await expect(page.getByTestId("game-day")).toHaveText(String(before+1));
  await expect(page.locator(".game-tab-content")).toHaveAttribute("aria-busy","false");
}
test.beforeEach(async({page},info)=>{
  const list:string[]=[];errors.set(page,list);page.on("pageerror",e=>list.push(e.message));page.on("console",m=>{if(m.type()==="error")list.push(m.text());});
  await page.clock.setFixedTime(new Date(DATE+"T03:00:00Z"));await page.goto("/");
  await expect(page.getByRole("heading",{name:/^보유 개체/})).toBeVisible();
  await tab(page,"교배",info.project.name.startsWith("mobile"));await expect(page.getByRole("button",{name:"턴 마치기",exact:true})).toBeVisible();
});
test.afterEach(async({page})=>{expect(errors.get(page)).toEqual([]);});

test("manual turns play the entire mating-to-adulthood loop while wall time and reload stay paused",async({page},info)=>{
  const mobile=info.project.name.startsWith("mobile"),fixture=successfulPair("manual-browser-",DATE);
  await click(page.getByRole("button",{name:"저장 및 게임 설정",exact:true}),mobile);
  await page.getByLabel("JSON 백업 파일",{exact:true}).setInputFiles({name:"turn-game.json",mimeType:"application/json",buffer:Buffer.from(exportBackup(fixture.original))});
  await click(page.getByRole("button",{name:"복원 실행",exact:true}),mobile);await expect(page.getByRole("dialog")).toHaveCount(0);
  await tab(page,"상점",mobile);await click(page.getByRole("button",{name:"노멀 수컷 구매",exact:true}),mobile);await click(page.getByRole("button",{name:"노멀 암컷 구매",exact:true}),mobile);
  await buyFood(page,mobile,1000);
  const [father,mother]=Object.values((await saved(page)).individuals);
  await tab(page,"교배",mobile);await page.getByRole("combobox",{name:"수컷 부모",exact:true}).selectOption(father.id);await page.getByRole("combobox",{name:"암컷 부모",exact:true}).selectOption(mother.id);
  await click(page.getByRole("button",{name:"교배 일정 시작 · 공간 2칸 예약",exact:true}),mobile);await expect(page.getByRole("heading",{name:"인큐베이터",exact:true})).toBeVisible();
  const pending=await saved(page);expect(Object.values(pending.matings)[0].lifecycle!.offspring).toHaveLength(2);
  await page.clock.setFixedTime(new Date(addDays(DATE,700)+"T03:00:00Z"));await page.reload();await expect(page.getByTestId("game-day")).toHaveText("0");expect(await saved(page)).toEqual(pending);
  await endTurn(page,mobile);expect(Object.keys((await saved(page)).eggs)).toHaveLength(0);
  await endTurn(page,mobile);const eggs=Object.values((await saved(page)).eggs);expect(eggs).toHaveLength(2);const embryo=eggs[0].embryo;
  for(let t=3;t<6;t++){await endTurn(page,mobile);expect((await saved(page)).eggs[eggs[0].id].status).toBe("incubating");}
  await endTurn(page,mobile);expect((await saved(page)).individuals[embryo.id]).toEqual(embryo);
  await click(page.getByRole("button",{name:embryo.name+" 상세보기",exact:true}),mobile);await expect(page.getByRole("dialog")).toContainText("미구분 · 성체 때 공개");await click(page.getByRole("button",{name:"상세 창 닫기",exact:true}),mobile);
  for(let t=7;t<=17;t++)await endTurn(page,mobile);expect((await saved(page)).individuals[embryo.id].stage).toBe("juvenile");
  await endTurn(page,mobile);const g=await saved(page);expect(g.individuals[embryo.id]).toMatchObject({stage:"adult",hearts:5});expect(g.lastDate).toBe(addDays(DATE,18*7));
  await page.reload();await expect(page.getByTestId("game-day")).toHaveText("18");expect(await saved(page)).toEqual(g);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath("turn-mode-mobile.png"),scale:"css"});
});

test("v1.2 keeps the realtime option disabled and wall-clock signals never advance a saved game",async({page},info)=>{
 const mobile=info.project.name.startsWith("mobile");await tab(page,"상점",mobile);const offer=Object.values((await saved(page)).shop.offers)[0];await click(page.getByRole("button",{name:offer.individual.name+" 구매",exact:true}),mobile);await endTurn(page,mobile);const before=await saved(page);
 await click(page.getByRole("button",{name:"저장 및 게임 설정",exact:true}),mobile);await expect(page.getByRole("combobox",{name:"시간 진행 방식",exact:true}).locator('option[value="realtime"]')).toHaveJSProperty('disabled',true);await click(page.getByRole("button",{name:"상세 창 닫기",exact:true}),mobile);
 await page.clock.setFixedTime(new Date(addDays(DATE,100)+"T03:00:00Z"));await page.evaluate(()=>window.dispatchEvent(new Event("focus")));await page.reload();await expect(page.getByTestId("game-day")).toHaveText("1");expect(await saved(page)).toEqual(before);
});

test("v3 active slot migrates to manual v8 without changing records or applying absent days",async({page})=>{
  let original=legacyGame("old-v3-time",DATE);const offer=Object.values(original.shop.offers)[0];original=actWithTime(original,{type:"buyGecko",offerId:offer.id},DATE);
  const {time:_time,...fields}=original;const legacy:LegacyHardcoreGame={...fields,saveVersion:3};
  for(const g of [...Object.values(legacy.individuals),...Object.values(legacy.shop.offers).map(o=>o.individual)])delete g.genetics;
  await page.evaluate(async record=>{
    const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open("gecko-lab",1);r.onsuccess=()=>resolve(r.result);});
    await new Promise<void>(resolve=>{const tx=db.transaction("games","readwrite");tx.objectStore("games").put(record,"active");tx.oncomplete=()=>{db.close();resolve();};});
  },{save:{format:"gecko-lab-save",version:3,game:legacy,checksum:checksum(legacy)},writeRevision:10});
  await page.clock.setFixedTime(new Date(addDays(DATE,10)+"T03:00:00Z"));await page.reload();await expect(page.getByTestId("game-day")).toHaveText("0");
  const migrated=await saved(page);expect(migrated.saveVersion).toBe(8);expect(migrated.time.mode).toBe("turn");
  for(const id of Object.keys(legacy.individuals)){expect(migrated.individuals[id].genotype).toEqual(legacy.individuals[id].genotype);expect(migrated.individuals[id].potential).toEqual(legacy.individuals[id].potential);}expect(migrated.individuals[offer.id].genetics?.genome).toBeNull();
  expect(migrated.lastDate).toBe(DATE);expect(migrated.money).toBe(original.money);
});

test("real-date signals during a pending v1.2 save cannot advance turns or replay the action",async({page},info)=>{
  const mobile=info.project.name.startsWith("mobile");await tab(page,"상점",mobile);
  // Hold a real IndexedDB writer transaction so the application's save must wait.
  await page.evaluate(async()=>{
    const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open("gecko-lab",1);r.onsuccess=()=>resolve(r.result);});
    const tx=db.transaction("games","readwrite"),store=tx.objectStore("games");let hold=true;
    const pump=()=>{const r=store.get("keep-transaction-open");r.onsuccess=()=>{if(hold)pump();};};pump();
    (window as unknown as {releaseTimeTest:()=>void}).releaseTimeTest=()=>{hold=false;};tx.oncomplete=()=>db.close();
  });
  await manageResources(page,mobile);await click(page.getByRole("button",{name:"먹이 구입 · ₩10,000",exact:true}),mobile);
  await expect(page.locator(".game-tab-content")).toHaveAttribute("aria-busy","true");
  await page.clock.setFixedTime(new Date(addDays(DATE,1)+"T03:00:00Z"));await page.evaluate(()=>window.dispatchEvent(new Event("focus")));
  await page.evaluate(()=>(window as unknown as {releaseTimeTest:()=>void}).releaseTimeTest());
  await expect(page.getByTestId("game-day")).toHaveText("0");await expect(page.locator(".game-tab-content")).toHaveAttribute("aria-busy","false");
  const g=await saved(page);expect(g.food).toBe(10);expect(g.money).toBe(490000);expect(g.lastDate).toBe(DATE);
});
