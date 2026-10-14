import {navigateGame,finishTurn,feedCollection} from "./helpers/hardcore-navigation";
import { test, expect, type Page, type Locator } from "@playwright/test";
import { newGame } from "../src/game/hardcore/play";
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
  const mobile=info.project.name.startsWith("mobile");
  const fixture=newGame("manual-browser",DATE,{fertilizationChance:1,hatchChance:1});
  await click(page.getByRole("button",{name:"저장 및 게임 설정",exact:true}),mobile);
  await page.getByLabel("JSON 백업 파일",{exact:true}).setInputFiles({name:"turn-game.json",mimeType:"application/json",buffer:Buffer.from(exportBackup(fixture))});
  await click(page.getByRole("button",{name:"복원 실행",exact:true}),mobile);await expect(page.getByRole("dialog")).toHaveCount(0);
  await tab(page,"상점",mobile);await click(page.getByRole("button",{name:"노멀 수컷 구매",exact:true}),mobile);await click(page.getByRole("button",{name:"노멀 암컷 구매",exact:true}),mobile);
  await click(page.getByRole("button",{name:"먹이 구입 · ₩10,000",exact:true}),mobile);
  const [father,mother]=Object.values((await saved(page)).individuals);
  await tab(page,"교배",mobile);await page.getByRole("combobox",{name:"수컷 부모",exact:true}).selectOption(father.id);await page.getByRole("combobox",{name:"암컷 부모",exact:true}).selectOption(mother.id);
  await click(page.getByRole("button",{name:"교배 일정 시작 · 공간 2칸 예약",exact:true}),mobile);await expect(page.getByRole("heading",{name:"인큐베이터",exact:true})).toBeVisible();
  const pending=await saved(page);
  await page.clock.setFixedTime(new Date(addDays(DATE,20)+"T03:00:00Z"));await page.reload();await expect(page.getByTestId("game-day")).toHaveText("0");expect(await saved(page)).toEqual(pending);
  await endTurn(page,mobile);expect(Object.values((await saved(page)).matings)[0].status).toBe("fertilized");
  await tab(page,"컬렉션",mobile);await feedCollection(page,mobile);
  await endTurn(page,mobile);let g=await saved(page);expect(Object.values(g.eggs)).toHaveLength(2);const embryo=Object.values(g.eggs)[0].embryo;
  await endTurn(page,mobile);g=await saved(page);expect(g.individuals[embryo.id]).toEqual(embryo);
  await click(page.getByRole("button",{name:embryo.name+" 상세보기",exact:true}),mobile);await expect(page.getByRole("dialog")).toContainText("미구분 · 성체 때 공개");
  await click(page.getByRole("button",{name:"상세 창 닫기",exact:true}),mobile);await endTurn(page,mobile);
  g=await saved(page);expect(g.individuals[embryo.id]).toMatchObject({stage:"adult",hearts:4});expect(g.lastDate).toBe(addDays(DATE,4));
  await page.reload();await expect(page.getByTestId("game-day")).toHaveText("4");expect(await saved(page)).toEqual(g);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath("turn-mode-mobile.png"),scale:"css"});
});

test("switching modes preserves progress, anchors real days and persists through backups and reload",async({page},info)=>{
  const mobile=info.project.name.startsWith("mobile");await tab(page,"상점",mobile);await click(page.getByRole("button",{name:"노멀 수컷 구매",exact:true}),mobile);
  await endTurn(page,mobile);await endTurn(page,mobile);const before=await saved(page);
  await mode(page,"realtime",mobile);await expect(page.getByRole("button",{name:"턴 마치기",exact:true})).toHaveCount(0);
  expect((await saved(page)).individuals).toEqual(before.individuals);await tab(page,"컬렉션",mobile);
  const realtime=await saved(page),turn=page.getByRole("button",{name:"턴 넘기기",exact:true});await expect(turn).toBeDisabled();await expect(turn).toHaveAccessibleDescription(/한국 자정 모드/);
  await turn.evaluate(el=>(el as HTMLButtonElement).click());expect(await saved(page)).toEqual(realtime);
  await page.reload();await expect(page.getByTestId("game-day")).toHaveText("2");await expect(turn).toBeDisabled();
  await page.clock.setFixedTime(new Date(addDays(DATE,1)+"T03:00:00Z"));await page.evaluate(()=>window.dispatchEvent(new Event("focus")));
  await expect(page.getByTestId("game-day")).toHaveText("3");let g=await saved(page);expect(g.lastDate).toBe(addDays(DATE,3));
  expect(Object.values(g.individuals)[0].hearts).toBe(2);
  await mode(page,"turn",mobile);g=await saved(page);await page.clock.setFixedTime(new Date(addDays(DATE,30)+"T03:00:00Z"));await page.reload();
  await expect(page.getByTestId("game-day")).toHaveText("3");await expect(turn).toBeEnabled();expect(await saved(page)).toEqual(g);
  await endTurn(page,mobile);expect(Object.values((await saved(page)).individuals)[0].hearts).toBe(1);
});

test("v3 active slot migrates to manual v5 without changing records or applying absent days",async({page})=>{
  let original=newGame("old-v3-time",DATE);const offer=Object.values(original.shop.offers)[0];original=actWithTime(original,{type:"buyGecko",offerId:offer.id},DATE);
  const {time:_time,...fields}=original;const legacy:LegacyHardcoreGame={...fields,saveVersion:3};
  for(const g of [...Object.values(legacy.individuals),...Object.values(legacy.shop.offers).map(o=>o.individual)])delete g.genetics;
  await page.evaluate(async record=>{
    const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open("gecko-lab",1);r.onsuccess=()=>resolve(r.result);});
    await new Promise<void>(resolve=>{const tx=db.transaction("games","readwrite");tx.objectStore("games").put(record,"active");tx.oncomplete=()=>{db.close();resolve();};});
  },{save:{format:"gecko-lab-save",version:3,game:legacy,checksum:checksum(legacy)},writeRevision:10});
  await page.clock.setFixedTime(new Date(addDays(DATE,10)+"T03:00:00Z"));await page.reload();await expect(page.getByTestId("game-day")).toHaveText("0");
  const migrated=await saved(page);expect(migrated.saveVersion).toBe(5);expect(migrated.time.mode).toBe("turn");
  expect(migrated.individuals).toMatchObject(legacy.individuals);expect(migrated.individuals[offer.id].genetics?.genome).toBeNull();
  expect(migrated.lastDate).toBe(DATE);expect(migrated.money).toBe(original.money);
});

test("real-date signals during a pending save are drained after commit instead of being dropped",async({page},info)=>{
  const mobile=info.project.name.startsWith("mobile");await mode(page,"realtime",mobile);await tab(page,"상점",mobile);
  // Hold a real IndexedDB writer transaction so the application's save must wait.
  await page.evaluate(async()=>{
    const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open("gecko-lab",1);r.onsuccess=()=>resolve(r.result);});
    const tx=db.transaction("games","readwrite"),store=tx.objectStore("games");let hold=true;
    const pump=()=>{const r=store.get("keep-transaction-open");r.onsuccess=()=>{if(hold)pump();};};pump();
    (window as unknown as {releaseTimeTest:()=>void}).releaseTimeTest=()=>{hold=false;};tx.oncomplete=()=>db.close();
  });
  await click(page.getByRole("button",{name:"먹이 구입 · ₩10,000",exact:true}),mobile);
  await expect(page.locator(".game-tab-content")).toHaveAttribute("aria-busy","true");
  await page.clock.setFixedTime(new Date(addDays(DATE,1)+"T03:00:00Z"));await page.evaluate(()=>window.dispatchEvent(new Event("focus")));
  await page.evaluate(()=>(window as unknown as {releaseTimeTest:()=>void}).releaseTimeTest());
  await expect(page.getByTestId("game-day")).toHaveText("1");await expect(page.locator(".game-tab-content")).toHaveAttribute("aria-busy","false");
  const g=await saved(page);expect(g.food).toBe(10);expect(g.money).toBe(490000);expect(g.time.realtimeAnchorDate).toBe(addDays(DATE,1));
});
