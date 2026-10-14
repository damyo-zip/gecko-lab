import {navigateGame,finishTurn} from "./helpers/hardcore-navigation";
import {test,expect,type Locator,type Page} from "@playwright/test";
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {decodePNG} from "../scripts/png.mjs";
import {renderSprite,renderLegacySprite} from "../src/engine/render";
import {MORPH_PRESETS,specimenFromPreset} from "../src/engine/presets";
import {successfulPair} from "./fixtures/lifecycle";
import {newGame} from "../src/game/hardcore/play";
import {exportBackup} from "../src/game/hardcore/save";
import type {HardcoreGame} from "../src/game/hardcore/model";
const DATE="2026-10-14",errors=new WeakMap<Page,string[]>();
async function click(l:Locator,mobile:boolean){if(mobile)await l.tap();else await l.click();}
async function tab(page:Page,name:string,mobile:boolean){await navigateGame(page,name,mobile);}
async function saved(page:Page):Promise<HardcoreGame>{return page.evaluate(async()=>{
 const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open("gecko-lab",1);r.onsuccess=()=>resolve(r.result);});
 return new Promise(resolve=>{const tx=db.transaction("games","readonly"),r=tx.objectStore("games").get("active");r.onsuccess=()=>resolve(r.result.save.game);tx.oncomplete=()=>db.close();});
});}
async function canvasVisible(page:Page){
 const canvases=page.locator("canvas");expect(await canvases.count()).toBeGreaterThan(0);
 for(const canvas of await canvases.all()){
  await expect(canvas).toHaveAttribute("data-renderer-version","2.0.1");
  const result=await canvas.evaluate(node=>{const c=node as HTMLCanvasElement,ctx=c.getContext("2d")!,p=ctx.getImageData(0,0,c.width,c.height).data,r=c.getBoundingClientRect();
   return {opaque:p.some((v,i)=>i%4===3&&v>0),smoothing:ctx.imageSmoothingEnabled,integerSize:c.width%96===0&&c.height%96===0,fits:r.width<=innerWidth};});
  expect(result).toEqual({opaque:true,smoothing:false,integerSize:true,fits:true});
 }expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
}
test.beforeEach(async({page})=>{const list:string[]=[];errors.set(page,list);page.on("pageerror",e=>list.push(e.message));page.on("console",m=>{if(m.type()==="error")list.push(m.text());});});
test.afterEach(async({page})=>expect(errors.get(page)).toEqual([]));

test("new art/old art toggle matches both actual pixel engines and leaves phenotype/seed intact",async({page},info)=>{
 const mobile=info.project.name.startsWith("mobile"),input=specimenFromPreset(MORPH_PRESETS[0]);await page.goto("/lab");
 await click(page.getByRole("button",{name:"1×",exact:true}),mobile);await expect(page.getByTestId("hero-sprite")).toHaveAttribute("width","96");
 const actual=()=>page.getByTestId("hero-sprite").evaluate(c=>Array.from((c as HTMLCanvasElement).getContext("2d")!.getImageData(0,0,96,96).data));
 await expect.poll(actual).toEqual(Array.from(renderSprite(input).pixels));
 await click(page.getByRole("button",{name:"이전 아트 v1",exact:true}),mobile);await expect.poll(actual).toEqual(Array.from(renderLegacySprite(input).pixels));
 await expect(page.getByTestId("hero-sprite")).toHaveAttribute("data-renderer-version","1.0.0");
 await click(page.getByRole("button",{name:"새 아트 v2",exact:true}),mobile);await expect.poll(actual).toEqual(Array.from(renderSprite(input).pixels));
 await expect(page.getByLabel("개체 시드")).toHaveValue(input.seed);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test("six morphs, twelve selected-morph seeds and committed image data agree in the real browser",async({page},info)=>{
 const mobile=info.project.name.startsWith("mobile");await page.goto("/lab");await click(page.getByTestId("preset-dalmatian"),mobile);
 const canvases=page.locator('[data-testid^="individual-"]');await expect(canvases).toHaveCount(12);
 const hashes=[];for(const canvas of await canvases.all()){await expect(canvas).toHaveAttribute("data-renderer-version","2.0.1");
  const data=await canvas.evaluate(c=>Array.from((c as HTMLCanvasElement).getContext("2d")!.getImageData(0,0,96,96).data));hashes.push(createHash("sha256").update(Buffer.from(data)).digest("hex"));}
 expect(new Set(hashes).size).toBe(12);await page.locator(".individual-panel").screenshot({path:info.outputPath("art-diversity-lab.png"),scale:"css"});
 await page.getByLabel("개체 시드").fill("phase6-comparison");await click(page.getByRole("button",{name:"시드 적용",exact:true}),mobile);
 for(const preset of MORPH_PRESETS){const reference=decodePNG(await readFile("docs/phase6/"+preset.id+"-96.png"));
  const canvas=page.getByTestId("gallery-"+preset.id);await expect.poll(()=>canvas.evaluate(c=>Array.from((c as HTMLCanvasElement).getContext("2d")!.getImageData(0,0,96,96).data))).toEqual(Array.from(reference.pixels));}
 await page.locator(".gallery-section").screenshot({path:info.outputPath("art-morphs-lab.png"),scale:"css"});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test("six real face canvases recolor periocular skin while preserving the authored iris and pupil",async({page},info)=>{
 const mobile=info.project.name.startsWith("mobile");
 const [source,eye,skin]=await Promise.all(["normal-base","eye","eye-surround"].map(async name=>decodePNG(await readFile("public/art/gecko-v2/"+name+".png"))));
 const selected=(pixels:readonly number[]|Uint8ClampedArray,mask:typeof eye)=>Array.from({length:9216},(_,i)=>i).filter(i=>mask.pixels[i*4+3]).flatMap(i=>Array.from(pixels.slice(i*4,i*4+4)));
 const eyes=selected(source.pixels,eye),skins:number[][]=[];
 await page.goto("/lab");await click(page.getByRole("button",{name:"1×",exact:true}),mobile);
 const canvas=page.getByTestId("hero-sprite");
 for(const preset of MORPH_PRESETS){
  await click(page.getByTestId("preset-"+preset.id),mobile);
  await expect(canvas).toHaveAttribute("data-renderer-version","2.0.1");
  const pixels=()=>canvas.evaluate(c=>Array.from((c as HTMLCanvasElement).getContext("2d")!.getImageData(0,0,96,96).data));
  await expect.poll(async()=>selected(await pixels(),eye)).toEqual(eyes);
  await expect.poll(async()=>await pixels()).toEqual(Array.from(renderSprite(specimenFromPreset(preset)).pixels));
  skins.push(selected(await pixels(),skin));
 }
 expect(new Set(skins.map(p=>createHash("sha256").update(Buffer.from(p)).digest("hex"))).size).toBe(6);
 for(let i=0;i<skins[2].length;i+=4)expect(Math.max(...skins[2].slice(i,i+3))-Math.min(...skins[2].slice(i,i+3))).toBeLessThanOrEqual(20);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test("real collection/details/shop/hatching/pedigree use new art while turns, genes, money and reload remain sound",async({page},info)=>{
 test.setTimeout(90_000);const mobile=info.project.name.startsWith("mobile");await page.clock.setFixedTime(new Date(DATE+"T03:00:00Z"));await page.goto("/");
 await expect(page.getByRole("heading",{name:/^보유 개체/})).toBeVisible();await click(page.getByRole("button",{name:"저장 및 게임 설정",exact:true}),mobile);
 await page.getByLabel("JSON 백업 파일",{exact:true}).setInputFiles({name:"art-test.json",mimeType:"application/json",buffer:Buffer.from(exportBackup(successfulPair("phase6-mobile-",DATE).original))});
 await click(page.getByRole("button",{name:"복원 실행",exact:true}),mobile);await expect(page.getByRole("dialog")).toHaveCount(0);
 await tab(page,"상점",mobile);await canvasVisible(page);await page.locator(".hc-grid").screenshot({path:info.outputPath("art-shop.png"),scale:"css"});
 await click(page.getByRole("button",{name:"노멀 수컷 구매",exact:true}),mobile);await click(page.getByRole("button",{name:"노멀 암컷 구매",exact:true}),mobile);
 await page.getByLabel("먹이 구매 수량",{exact:true}).fill("100");await click(page.getByRole("button",{name:"먹이 구입 · ₩100,000",exact:true}),mobile);
 const parents=Object.values((await saved(page)).individuals),genomes=parents.map(g=>g.genetics!.genome),parentSeeds=parents.map(g=>g.visualSeed);
 await tab(page,"컬렉션",mobile);await canvasVisible(page);await page.locator(".hc-grid").scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath("art-collection.png"),scale:"css"});
 await click(page.getByRole("button",{name:"노멀 수컷 상세보기",exact:true}),mobile);await canvasVisible(page);await page.getByRole("dialog").screenshot({path:info.outputPath("art-detail.png"),scale:"css"});
 await click(page.getByRole("button",{name:"상세 창 닫기",exact:true}),mobile);
 await tab(page,"교배",mobile);await page.getByRole("combobox",{name:"수컷 부모",exact:true}).selectOption(parents[0].id);await page.getByRole("combobox",{name:"암컷 부모",exact:true}).selectOption(parents[1].id);
 await click(page.getByRole("button",{name:"교배 일정 시작 · 공간 2칸 예약",exact:true}),mobile);
 for(let day=0;day<6;day++){const before=Number(await page.getByTestId("game-day").textContent());await finishTurn(page,mobile);await expect(page.getByTestId("game-day")).toHaveText(String(before+1));}
 await canvasVisible(page);const game=await saved(page);expect(Object.values(game.eggs).filter(e=>e.lifecycle!.laidTurn===2).every(e=>e.status==="hatched")).toBe(true);expect(Object.keys(game.individuals)).toHaveLength(4);
 for(let i=0;i<2;i++){expect(game.individuals[parents[i].id].genetics!.genome).toEqual(genomes[i]);expect(game.individuals[parents[i].id].visualSeed).toBe(parentSeeds[i]);}
 await page.locator(".hc-grid").screenshot({path:info.outputPath("art-hatching.png"),scale:"css"});
 const child=Object.values(game.individuals).find(g=>g.parents)!;await tab(page,"혈통",mobile);await page.getByRole("combobox",{name:"혈통을 볼 개체",exact:true}).selectOption(child.id);await canvasVisible(page);
 await page.locator(".lineage-root").screenshot({path:info.outputPath("art-lineage.png"),scale:"css"});await page.reload();await expect(page.getByTestId("game-day")).toHaveText("6");expect(await saved(page)).toEqual(game);
});
