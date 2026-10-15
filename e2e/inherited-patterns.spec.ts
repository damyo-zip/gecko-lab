import {chooseBreedingParent} from './helpers/hardcore-navigation';
import {test,expect,type Page,type Locator} from "@playwright/test";
import {createHash} from "node:crypto";
import {mkdir} from "node:fs/promises";
import {newGame,act} from "../src/game/hardcore/play";
import {exportBackup} from "../src/game/hardcore/save";
import {specimen,visualName,morph} from "../src/game/hardcore/adapter";
import {appearanceProfile} from "../src/game/hardcore/appearance";
import {renderSprite} from "../src/engine/render";
import {PATTERN_EXAMPLES,exampleGenome} from "../src/genetics/advanced/pattern-examples";
import {patternTraits} from "../src/genetics/advanced/pattern-traits";
import {buildPatternPlan} from "../src/engine/pattern-plan";
import {classifyPattern} from "../src/phenotype/names";
import {navigateGame,touch,buyFood,finishTurn} from "./helpers/hardcore-navigation";
import type {Gecko,HardcoreGame} from "../src/game/hardcore/model";
const DATE="2026-10-14",errors=new WeakMap<Page,string[]>();
test.beforeEach(async({page})=>{const e:string[]=[];errors.set(page,e);page.on("pageerror",err=>e.push(err.message));page.on("console",m=>{if(m.type()==="error")e.push(m.text());});await page.clock.setFixedTime(new Date(DATE+"T03:00:00Z"));});
test.afterEach(async({page})=>expect(errors.get(page)).toEqual([]));
async function saved(page:Page):Promise<HardcoreGame>{return page.evaluate(async()=>{
 const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open("gecko-lab",1);r.onsuccess=()=>resolve(r.result);});
 return new Promise(resolve=>{const tx=db.transaction("games","readonly"),r=tx.objectStore("games").get("active");r.onsuccess=()=>resolve(r.result.save.game);tx.oncomplete=()=>db.close();});
});}
async function pixels(l:Locator){return l.evaluate(el=>{const c=el as HTMLCanvasElement,ctx=c.getContext("2d")!,scale=c.width/96,raw=ctx.getImageData(0,0,c.width,c.height).data,p:number[]=[];
 for(let y=0;y<96;y++)for(let x=0;x<96;x++)p.push(...raw.slice((y*scale*c.width+x*scale)*4,(y*scale*c.width+x*scale)*4+4));return {pixels:p,smoothing:ctx.imageSmoothingEnabled};});}
const hash=(p:readonly number[]|Uint8ClampedArray)=>createHash("sha256").update(Buffer.from(p)).digest("hex");
async function sameSprite(l:Locator,g:Gecko){await expect(l).toHaveAttribute("data-renderer-version","2.1.0");await expect.poll(async()=>hash((await pixels(l)).pixels)).toBe(hash(renderSprite(specimen(g)).pixels));expect((await pixels(l)).smoothing).toBe(false);}
test("14 anatomical patterns have matching browser pixels and Korean names, distinct tiger/brindle and responsive 360–430px gallery",async({page},info)=>{
 await page.goto("/lab/patterns");await expect(page.getByRole("heading",{name:"실제 무늬 비교 연구실"})).toBeVisible();
 for(const e of PATTERN_EXAMPLES){const traits=patternTraits(exampleGenome(e.id)),seed="patterns-v1|"+e.id,o=buildPatternPlan(traits,seed).observation,n=classifyPattern(traits,o);
  const article=page.getByTestId("pattern-example-"+e.id);await expect(article.getByTestId("pattern-name")).toHaveText(n.primary);await expect(article).toContainText(e.title);
  const r=renderSprite({schemaVersion:1,id:e.id,name:n.primary,seed,state:{fire:"up"},appearance:{bodyColor:"orange",patternStyle:"harlequin",dorsalCoverage:traits.dorsal,flankCoverage:traits.flank,spotCount:Math.min(70,traits.spots.count),patterns:traits}});
  await expect.poll(async()=>hash((await pixels(page.getByTestId("pattern-sprite-"+e.id))).pixels)).toBe(hash(r.pixels));
 }
 if(info.project.name.startsWith("mobile")){await mkdir("docs/inherited-patterns",{recursive:true});for(const width of [360,390,430]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:info.outputPath("patterns-"+width+".png"),fullPage:true,scale:"css"});}await page.setViewportSize({width:390,height:844});await page.screenshot({path:"docs/inherited-patterns/gallery-mobile.png",fullPage:true,scale:"css"});}
 else await page.screenshot({path:"docs/inherited-patterns/gallery-desktop.png",fullPage:true,scale:"css"});
});
test("same individual retains exact name and sprite across purchase, collection, details, parents, breeding, pedigree, hatching and IndexedDB reload",async({page},info)=>{
 test.setTimeout(120_000);const mobile=info.project.name.startsWith("mobile"),original=newGame("pattern-browser-live",DATE,{initialMoney:10_000_000,initialCapacity:30});
 await page.goto("/");await expect(page.getByRole("heading",{name:/보유 개체/})).toBeVisible();await touch(page.getByRole("button",{name:"저장 및 게임 설정",exact:true}),mobile);
 await page.getByLabel("JSON 백업 파일",{exact:true}).setInputFiles({name:"pattern-v7.json",mimeType:"application/json",buffer:Buffer.from(exportBackup(original))});await touch(page.getByRole("button",{name:"복원 실행",exact:true}),mobile);await expect(page.getByRole("dialog")).toHaveCount(0);
 await navigateGame(page,"상점",mobile);const offers=Object.values(original.shop.offers),a=offers[0],b=offers[1];
 const card=page.getByTestId("shop-offer-"+a.id);await expect(card.locator(".shop-morph")).toHaveText(visualName(a.individual));await sameSprite(card.locator("canvas"),a.individual);
 await touch(card.getByRole("button",{name:a.individual.name+" 부모",exact:true}),mobile);const dialog=page.getByRole("dialog");await expect(dialog).not.toContainText("A/ax");await expect(dialog).not.toContainText("possible het");
 await sameSprite(dialog.getByTestId("hardcore-sprite-"+a.family!.father.id),a.family!.father);await page.keyboard.press("Escape");
 for(const o of [a,b])await touch(page.getByTestId("shop-offer-"+o.id).getByRole("button",{name:o.individual.name+" 구매",exact:true}),mobile);
 await buyFood(page,mobile,1000);await navigateGame(page,"컬렉션",mobile);await sameSprite(page.getByTestId("hardcore-sprite-"+a.id),a.individual);
 await touch(page.getByRole("button",{name:a.individual.name+" 상세보기",exact:true}),mobile);await touch(page.getByTestId("pattern-info").locator("summary"),mobile);await expect(page.getByTestId("pattern-primary")).toHaveText(visualName(a.individual));await expect(page.getByTestId("pattern-features")).toContainText(appearanceProfile(a.individual)!.names.features.join(" · ")||"없음");await sameSprite(page.getByRole("dialog").getByTestId("hardcore-sprite-"+a.id),a.individual);
 if(mobile)await page.getByRole("dialog").screenshot({path:"docs/inherited-patterns/individual-mobile.png",scale:"css"});await page.keyboard.press("Escape");
 await navigateGame(page,"혈통도",mobile);await page.getByRole("combobox",{name:"혈통을 볼 개체"}).selectOption(a.id);await sameSprite(page.locator(".lineage-root canvas"),a.individual);await expect(page.locator(".lineage-root")).toContainText(visualName(a.individual));
 await navigateGame(page,"교배",mobile);await chooseBreedingParent(page,'male',a.id);await chooseBreedingParent(page,'female',b.id);await sameSprite(page.locator(".parent-summary").first().locator("canvas"),a.individual);await expect(page.locator(".parent-summary").first()).toContainText(visualName(a.individual));
 await touch(page.getByRole("button",{name:"교배하기",exact:true}),mobile);const frozen=Object.values((await saved(page)).matings)[0].lifecycle!.offspring;
 await navigateGame(page,"상점",mobile);for(let n=1;n<=18;n++){await touch(page.getByRole("button",{name:"턴 넘기기",exact:true}),mobile);await expect(page.getByTestId("game-day")).toHaveText(String(n));await expect(page.locator(".game-tab-content")).toHaveAttribute("aria-busy","false");}
 const state=await saved(page),children=frozen.map(o=>state.individuals[o.embryo.id]).filter(Boolean);expect(children.length).toBeGreaterThan(0);
 for(const c of children){expect(c.genetics!.genome).toEqual(frozen.find(o=>o.embryo.id===c.id)!.embryo.genetics!.genome);expect(c.stage).toBe("adult");}
 await navigateGame(page,"인큐베이터",mobile);for(const c of children){const egg=Object.values(state.eggs).find(o=>o.embryo.id===c.id)!;await expect(page.getByTestId("hc-egg-"+egg.id)).toContainText(morph(c));await sameSprite(page.getByTestId("hardcore-sprite-"+c.id),c);}
 if(mobile){await navigateGame(page,"컬렉션",mobile);await page.screenshot({path:"docs/inherited-patterns/collection-mobile.png",fullPage:true,scale:"css"});}
 await page.reload();await expect(page.getByTestId("game-day")).toHaveText("18");expect(await saved(page)).toEqual(state);await navigateGame(page,"컬렉션",mobile);await sameSprite(page.getByTestId("hardcore-sprite-"+a.id),state.individuals[a.id]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
