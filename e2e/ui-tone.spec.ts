import {navigateGame,finishTurn} from "./helpers/hardcore-navigation";
import {test,expect,type Page,type Locator} from "@playwright/test";
import {writeFile} from "node:fs/promises";
import {turns} from "./fixtures/lifecycle";
import {newGame,act,synchronize} from "../src/game/hardcore/play";
import {addDays} from "../src/game/hardcore/time";
import {exportBackup} from "../src/game/hardcore/save";
import type {HardcoreGame} from "../src/game/hardcore/model";
const DATE="2026-10-14";
function fixture(){
 for(let n=0;n<50;n++){
  let game=newGame("terrarium-ui-"+n,DATE,{initialMoney:3_000_000,initialCapacity:12});
  const offers=Object.values(game.shop.offers).slice(0,4),names=["해솔","밤비","모카","그레이"];
  for(let i=0;i<offers.length;i++){game=act(game,{type:"buyGecko",offerId:offers[i].id},DATE);game=act(game,{type:"rename",id:offers[i].id,name:names[i]},DATE);}
  game=act(game,{type:"buyFood",amount:100},DATE);
  const base=game,fatherId=offers[0].id,motherId=offers[2].id;
  game=act(game,{type:"breed",fatherId,motherId},DATE);
  game=turns(game,2);
  if(Object.keys(game.eggs).length!==2)continue;
  const hatch=turns(game,4);if(Object.values(hatch.eggs).filter(e=>e.lifecycle!.laidTurn===2).every(e=>e.status==="hatched"))return{base,incubator:game,fatherId,motherId};
 }throw new Error("Default 90% breeding fixture unavailable");
}
const FIXTURE=fixture();
async function click(l:Locator,mobile:boolean){if(mobile)await l.tap();else await l.click();}
async function tab(page:Page,name:string,mobile:boolean){await navigateGame(page,name,mobile);}
async function saved(page:Page):Promise<HardcoreGame>{return page.evaluate(async()=>{
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open("gecko-lab",1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 return new Promise((resolve,reject)=>{const tx=db.transaction("games","readonly"),r=tx.objectStore("games").get("active");r.onsuccess=()=>resolve(r.result.save.game);tx.oncomplete=()=>db.close();tx.onerror=()=>reject(tx.error);});
});}
async function restore(page:Page,game:HardcoreGame,mobile:boolean){
 await click(page.getByRole("button",{name:"저장 및 게임 설정",exact:true}),mobile);
 await page.getByLabel("JSON 백업 파일",{exact:true}).setInputFiles({name:"ui-review.json",mimeType:"application/json",buffer:Buffer.from(exportBackup(game))});
 await click(page.getByRole("button",{name:"복원 실행",exact:true}),mobile);await expect(page.getByRole("dialog")).toHaveCount(0);
 await expect(page.locator(".game-tab-content")).toHaveAttribute("aria-busy","false");
}
test("four portrait screens retain readable controls, immutable records and the real hatch-to-collection loop",async({page},info)=>{
 test.setTimeout(90_000);const mobile=info.project.name.startsWith("mobile"),errors:string[]=[];
 page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
 await page.clock.setFixedTime(new Date(DATE+"T03:00:00Z"));await page.goto("/");
 await expect(page.getByRole("heading",{name:/^보유 개체/})).toBeVisible();
 await restore(page,FIXTURE.base,mobile);const original=await saved(page);
 async function frame(name:string){
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const dialog=page.getByRole("dialog"),inside=await dialog.count()?dialog:page.locator(".game-tab-content");
  expect(await inside.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  for(const c of await inside.locator("canvas").all())expect(await c.evaluate(node=>{const c=node as HTMLCanvasElement,ctx=c.getContext("2d")!;return !ctx.imageSmoothingEnabled&&ctx.getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0);})).toBe(true);
  for(const control of await page.getByRole("navigation",{name:"게임 탭"}).getByRole("button").all()){
   const box=await control.boundingBox();expect(box!.width).toBeGreaterThanOrEqual(44);expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:info.outputPath("ui-"+name+".png"),scale:"css",animations:"disabled"});
  if(name!=="details")await page.screenshot({path:info.outputPath("ui-"+name+"-full.png"),fullPage:true,scale:"css",animations:"disabled"});
 }
 await tab(page,"컬렉션",mobile);await expect(page.locator(".hc-card")).toHaveCount(4);await frame("collection");
 await click(page.getByRole("button",{name:"컨디션 관리",exact:true}),mobile);await page.getByRole("combobox",{name:"성장 단계 필터",exact:true}).selectOption("adult");await click(page.getByRole("dialog").getByRole("button",{name:"상세 창 닫기",exact:true}),mobile);await expect(page.locator(".hc-card")).toHaveCount(4);
 await click(page.getByRole("button",{name:"모카 상세보기",exact:true}),mobile);await expect(page.getByRole("heading",{name:"모카 상세",exact:true})).toBeVisible();await frame("details");
 await expect(page.getByRole("dialog")).toContainText("공개 유전 정보");await page.getByRole("button",{name:"파이어 다운 미리 보기",exact:true}).scrollIntoViewIfNeeded();await click(page.getByRole("button",{name:"파이어 다운 미리 보기",exact:true}),mobile);
 await expect(page.getByRole("button",{name:"파이어 업 미리 보기",exact:true})).toBeVisible();await page.keyboard.press("Escape");await expect(page.getByRole("dialog")).toHaveCount(0);
 await tab(page,"교배",mobile);await page.getByRole("combobox",{name:"수컷 부모",exact:true}).selectOption(FIXTURE.fatherId);await page.getByRole("combobox",{name:"암컷 부모",exact:true}).selectOption(FIXTURE.motherId);
 await expect(page.getByTestId("hardcore-forecast")).toContainText("50%");await expect(page.getByRole("button",{name:"교배 일정 시작 · 공간 6칸 예약",exact:true})).toBeEnabled();await frame("breeding");
 expect(await saved(page)).toEqual(original);
 await restore(page,FIXTURE.incubator,mobile);const incubator=await saved(page);await tab(page,"부화",mobile);await expect(page.locator(".egg-card")).toHaveCount(2);await frame("incubator");
 expect(await saved(page)).toEqual(incubator);
 await writeFile(info.outputPath("ui-state.json"),JSON.stringify({base:original,incubator},null,2));
 for(let t=0;t<4;t++)await finishTurn(page,mobile);await expect(page.getByTestId("game-day")).toHaveText("6");
 const hatched=await saved(page);expect(Object.values(hatched.eggs).filter(e=>e.lifecycle!.laidTurn===2).every(e=>e.status==="hatched")).toBe(true);
 for(const id of [FIXTURE.fatherId,FIXTURE.motherId]){expect(hatched.individuals[id].genetics?.genome).toEqual(incubator.individuals[id].genetics?.genome);expect(hatched.individuals[id].genotype).toEqual(incubator.individuals[id].genotype);expect(hatched.individuals[id].visualSeed).toBe(incubator.individuals[id].visualSeed);}
 await tab(page,"컬렉션",mobile);await expect(page.locator(".hc-card")).toHaveCount(6);const child=Object.values(hatched.individuals).find(g=>g.parents)!;
 await click(page.getByRole("button",{name:child.name+" 상세보기",exact:true}),mobile);await expect(page.getByRole("dialog")).toContainText("미구분 · 성체 때 공개");
 await page.keyboard.press("Escape");await page.reload();await expect(page.getByTestId("game-day")).toHaveText("6");expect(await saved(page)).toEqual(hatched);expect(errors).toEqual([]);
});
