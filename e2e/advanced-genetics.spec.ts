import {openIncubatorRecords} from './helpers/hardcore-navigation';
import {chooseBreedingParent} from './helpers/hardcore-navigation';
import {inspectGenetics,closeGenetics,closeBreeding} from './helpers/hardcore-navigation';
import {buyFood,manageResources,closeResources} from "./helpers/hardcore-navigation";
import {navigateGame,finishTurnAndTend as finishTurn,feedCollection} from "./helpers/hardcore-navigation";
import { test,expect,type Page,type Locator } from "@playwright/test";
import {turns} from './helpers/forge-fixtures';
import {newGame as legacyGame} from "../tests/helpers/legacy-hardcore";
import { axCatalog as newGame,act,synchronize } from './helpers/forge-fixtures';
import { exportBackup,checksum } from "../src/game/hardcore/save";
import type { HardcoreGame } from "../src/game/hardcore/model";
import { addDays } from "../src/game/hardcore/time";
const DATE="2026-10-13",errors=new WeakMap<Page,string[]>();
test.setTimeout(90_000);
async function click(l:Locator,mobile:boolean){if(mobile)await l.tap();else await l.click();}
async function tab(page:Page,name:string,mobile:boolean){await navigateGame(page,name,mobile);}
async function saved(page:Page):Promise<HardcoreGame>{return page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open("gecko-lab",1);r.onsuccess=()=>resolve(r.result);});
  return new Promise(resolve=>{const tx=db.transaction("games","readonly"),r=tx.objectStore("games").get("active");r.onsuccess=()=>resolve(r.result.save.game);tx.oncomplete=()=>db.close();});
});}
async function restore(page:Page,text:string,mobile:boolean){await closeBreeding(page,mobile);await click(page.getByRole("button",{name:"저장 및 게임 설정",exact:true}),mobile);
  await page.getByLabel("JSON 백업 파일",{exact:true}).setInputFiles({name:"phase5.json",mimeType:"application/json",buffer:Buffer.from(text)});
  await click(page.getByRole("button",{name:"복원 실행",exact:true}),mobile);await expect(page.getByRole("dialog")).toHaveCount(0);
}
async function day(page:Page,mobile:boolean){const before=Number(await page.getByTestId("game-day").textContent());await finishTurn(page,mobile);
  await expect(page.getByTestId("game-day")).toHaveText(String(before+1));await expect(page.locator(".game-tab-content")).toHaveAttribute("aria-busy","false");
}
function scenario(){
  for(let n=0;n<100;n++){
    const original=newGame("advanced-browser-"+n,DATE,{initialMoney:3_000_000,initialCapacity:20});
    const offers=Object.values(original.shop.offers),father=offers[0],mother=offers[1];
    if(!father.individual.genotype.loci.axanthic.includes("ax")||mother.individual.sex!=="female")continue;
    let g=act(original,{type:"buyGecko",offerId:father.id},DATE);g=act(g,{type:"buyGecko",offerId:mother.id},DATE);g=act(g,{type:"buyFood",amount:1000},g.lastDate);g=turns(g,12);
    g=act(g,{type:"breed",fatherId:father.id,motherId:mother.id},g.lastDate);g=turns(g,6);
    if(Object.values(g.individuals).some(i=>i.parents&&i.genotype.loci.axanthic.every(a=>a==="ax")))return {original,father:father.id,mother:mother.id};
  }throw new Error("seeded evidence scenario missing");
}
test.beforeEach(async({page})=>{const list:string[]=[];errors.set(page,list);page.on("pageerror",e=>list.push(e.message));page.on("console",m=>{if(m.type()==="error")list.push(m.text());});
  await page.clock.setFixedTime(new Date(DATE+"T03:00:00Z"));await page.goto("/");await expect(page.getByRole("heading",{name:/^보유 개체/})).toBeVisible();
});
test.afterEach(async({page})=>{expect(errors.get(page)).toEqual([]);});

test("touch purchase possible het, mate with visual Ax, hatch and infer, name, grow, reload and preserve lineage",async({page},info)=>{
  const mobile=info.project.name.startsWith("mobile"),fixture=scenario();await restore(page,exportBackup(fixture.original),mobile);
  await tab(page,"상점",mobile);const card=page.getByTestId("shop-offer-"+fixture.father);await expect(card).toContainText("노멀");
  await tab(page,"컬렉션",mobile);await tab(page,"상점",mobile);
  await click(page.getByRole("button",{name:"노멀 수컷 구매",exact:true}),mobile);await click(page.getByRole("button",{name:"Ax 해칭 구매",exact:true}),mobile);
  await buyFood(page,mobile,1000);await tab(page,"컬렉션",mobile);for(let t=0;t<12;t++)await day(page,mobile);
  await tab(page,"교배",mobile);await chooseBreedingParent(page,'male',fixture.father);await chooseBreedingParent(page,'female',fixture.mother);
  await inspectGenetics(page,mobile);await expect(page.getByTestId("hardcore-forecast")).toContainText("25%");await expect(page.getByTestId("hardcore-forecast")).toContainText("아잔틱");
  await page.getByTestId("hardcore-forecast").scrollIntoViewIfNeeded();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:info.outputPath("phase5-forecast.png"),scale:"css"});
  await closeGenetics(page,mobile);await click(page.getByRole("button",{name:"교배하기",exact:true}),mobile);
  await day(page,mobile);await tab(page,"컬렉션",mobile);await feedCollection(page,mobile);
  await day(page,mobile);const eggs=(await saved(page)).eggs;expect(Object.keys(eggs)).toHaveLength(2);
  for(let t=0;t<4;t++)await day(page,mobile);const hatched=await saved(page);expect(hatched.individuals[fixture.father].genetics!.knowledge.loci.axanthic.probabilities).toEqual({"A/ax":1});
  await tab(page,"부화",mobile);await openIncubatorRecords(page,mobile);await click(page.getByText("교배 당시 예측·자손·추론 기록",{exact:true}),mobile);
  await expect(page.getByTestId("inference-update").first()).toContainText("50.0% → 100.0%");
  await page.getByTestId("inference-update").first().scrollIntoViewIfNeeded();
  await page.locator(".hc-event .genetic-panel").first().screenshot({path:info.outputPath("phase5-inference.png"),scale:"css"});
  await page.keyboard.press("Escape");const child=Object.values(hatched.individuals).find(g=>g.parents&&g.genotype.loci.axanthic.every(a=>a==="ax"))!;
  await tab(page,"컬렉션",mobile);await click(page.getByRole("button",{name:child.name+" 상세보기",exact:true}),mobile);
  await page.getByLabel("개체 이름",{exact:true}).fill("검증된 아잔틱");await click(page.getByRole("button",{name:"이름 저장",exact:true}),mobile);
  await expect(page.getByRole("dialog")).toContainText("아잔틱 · aa");await click(page.getByRole("button",{name:"파이어 다운 미리 보기",exact:true}),mobile);
  await expect(page.getByRole("button",{name:"파이어 업 미리 보기",exact:true})).toBeVisible();
  await page.getByTestId("public-genetics").scrollIntoViewIfNeeded();
  await page.screenshot({path:info.outputPath("phase5-details.png"),scale:"css"});
  await click(page.getByRole("button",{name:"상세 창 닫기",exact:true}),mobile);for(let t=0;t<12;t++)await day(page,mobile);
  const final=await saved(page);expect(final.individuals[child.id].stage).toBe("adult");expect(final.individuals[child.id].genetics!.genome).toEqual(eggs[child.id+"-egg"].embryo.genetics!.genome);
  await page.reload();await expect(page.getByTestId("game-day")).toHaveText("30");expect(await saved(page)).toEqual(final);
  await tab(page,"혈통",mobile);await page.getByRole("combobox",{name:"혈통을 볼 개체",exact:true}).selectOption(child.id);await expect(page.locator(".ancestor-list")).toContainText("노멀 수컷");await click(page.getByRole("button",{name:"아버지 노멀 수컷 혈통 보기",exact:true}),mobile);await click(page.getByRole("button",{name:"상세 정보",exact:true}),mobile);await expect(page.getByRole("dialog")).toContainText("100% het 아잔틱");await page.keyboard.press("Escape");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test("learning calculator shows risky multi-allelic outcomes without creating offspring or changing saved genomes",async({page},info)=>{
  const mobile=info.project.name.startsWith("mobile");await tab(page,"교배",mobile);await inspectGenetics(page,mobile);await click(page.getByText("유전학 도감",{exact:true}),mobile);await click(page.getByText("독립 좌위 학습 계산기",{exact:true}),mobile);
  const before=await saved(page);await page.getByRole("combobox",{name:"cappuccino-complex 수컷",exact:true}).selectOption("n/C");
  await page.getByRole("combobox",{name:"cappuccino-complex 암컷",exact:true}).selectOption("n/S");await expect(page.getByRole("dialog",{name:"유전 정보",exact:true})).toContainText("루왁");
  await expect(page.getByRole("dialog",{name:"유전 정보",exact:true})).toContainText("주의 조합 발생 25.0%");expect(await saved(page)).toEqual(before);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test("actual v4 IndexedDB slot migrates and archives atomically without inventing virtual alleles",async({page},info)=>{
  const mobile=info.project.name.startsWith("mobile"),original=legacyGame("migration-browser",DATE),offer=Object.values(original.shop.offers)[0];
  let g=act(original,{type:"buyGecko",offerId:offer.id},DATE);const old={...g,saveVersion:4};
  for(const i of [...Object.values(old.individuals),...Object.values(old.shop.offers).map(o=>o.individual)])delete i.genetics;
  await page.evaluate(async record=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open("gecko-lab",1);r.onsuccess=()=>resolve(r.result);});await new Promise<void>(resolve=>{const tx=db.transaction("games","readwrite");tx.objectStore("games").put(record,"active");tx.oncomplete=()=>{db.close();resolve();};});},
    {save:{format:"gecko-lab-save",version:4,checksum:checksum(old),game:old},writeRevision:7});
  await page.reload();await expect(page.getByTestId("game-day")).toHaveText("0");g=await saved(page);expect(g.saveVersion).toBe(10);expect(g.individuals[offer.id].genetics!.genome).toBeNull();
  await tab(page,"컬렉션",mobile);await click(page.getByRole("button",{name:"노멀 수컷 상세보기",exact:true}),mobile);await expect(page.getByRole("dialog")).toContainText("과거 유전 기록이 없어 일부 형질은 미확인");
  const archive=await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open("gecko-lab",1);r.onsuccess=()=>resolve(r.result);});return new Promise<string[]>(resolve=>{const tx=db.transaction("games","readonly"),r=tx.objectStore("games").getAllKeys();r.onsuccess=()=>resolve(r.result.map(String));tx.oncomplete=()=>db.close();});});expect(archive).toContain("archive-v4-8");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
