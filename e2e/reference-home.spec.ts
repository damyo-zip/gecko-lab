import {collectionEntries} from '../src/components/hardcore/collection-query';
import {test,expect,type Page} from "@playwright/test";
import {writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {referenceHomeGame,REFERENCE_DATE} from './helpers/forge-fixtures';
import {touch,openCollectionCatalog} from "./helpers/hardcore-navigation";
import {exportBackup} from "../src/game/hardcore/save";
import {legacyRecord} from "../src/game/hardcore/genetics";
import type {HardcoreGame} from "../src/game/hardcore/model";
import {addDays} from "../src/game/hardcore/time";

async function saved(page:Page):Promise<HardcoreGame> {
  return page.evaluate(async()=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open("gecko-lab",1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    return new Promise((resolve,reject)=>{const tx=db.transaction("games","readonly"),r=tx.objectStore("games").get("active");r.onsuccess=()=>resolve(r.result.save.game);tx.oncomplete=()=>db.close();tx.onerror=()=>reject(tx.error);});
  });
}
async function restore(page:Page,game:HardcoreGame,mobile:boolean) {
  await touch(page.getByRole("button",{name:"저장 및 게임 설정",exact:true}),mobile);
  await page.getByLabel("JSON 백업 파일",{exact:true}).setInputFiles({name:"reference-home.json",mimeType:"application/json",buffer:Buffer.from(exportBackup(game))});
  await touch(page.getByRole("button",{name:"복원 실행",exact:true}),mobile);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".home-card")).toHaveCount(Object.keys(game.individuals).length);
}
async function ready(page:Page) {
  await page.clock.setFixedTime(new Date(REFERENCE_DATE+"T03:00:00Z"));await page.goto("/");
  await expect(page.getByRole("heading",{name:/^보유 개체/})).toBeVisible();
}
async function noOverflow(page:Page) {
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
}

test("reference home binds six real specimens, preserves read-only state and advances a day without leaving collection",async({page},info)=>{
  const mobile=info.project.name.startsWith("mobile"),errors:string[]=[];
  page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
  if(mobile)await page.setViewportSize({width:390,height:844});
  await ready(page);const fixture=referenceHomeGame();await restore(page,fixture,mobile);
  const original=await saved(page);
  expect(original).toEqual(fixture);
  await expect(page.getByRole("heading",{name:/^보유 개체/})).toContainText("6 / 20");
  await expect(page.getByTestId("game-money")).toHaveText("12,450");await expect(page.getByTestId("game-food")).toHaveText("38");
  await expect(page.getByRole("button",{name:"턴 마치기",exact:true})).toHaveCount(0);
  const nav=page.getByRole("navigation",{name:"게임 탭"});
  expect(await nav.getByRole("button").allTextContents()).toEqual(["컬렉션","인큐베이터","혈통도","상점"]);
  const [hero,art,panel,inventory,cta]=await Promise.all([".home-hero",".home-hero-art",".home-info",".home-inventory",".home-turn-cta"].map(s=>page.locator(s).boundingBox()));
  expect(art!.x).toBeLessThan(panel!.x);expect(panel!.x).toBeGreaterThan(hero!.x+hero!.width*.5);
  expect(inventory!.y).toBeGreaterThan(hero!.y+hero!.height);const content=await page.locator(".reference-content").boundingBox();expect(cta!.y).toBeGreaterThanOrEqual(content!.y+content!.height);
  const cards=await page.locator(".home-card").all();
  expect((await cards[0].boundingBox())!.y).toBe((await cards[2].boundingBox())!.y);
  expect((await cards[3].boundingBox())!.y).toBeGreaterThan((await cards[0].boundingBox())!.y);
  await expect(page.locator(".home-name")).toContainText("모카");
  for(const c of await page.locator(".home-collection canvas").all()){
    expect(await c.evaluate(el=>{const c=el as HTMLCanvasElement,ctx=c.getContext("2d")!;return !ctx.imageSmoothingEnabled&&ctx.getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0);})).toBe(true);
  }
  await noOverflow(page);await page.evaluate(()=>document.fonts.ready);
  if(mobile){
    const bottomNav=await nav.boundingBox();expect(cta!.y+cta!.height).toBeLessThanOrEqual(bottomNav!.y);
    await page.screenshot({path:info.outputPath("home-390x844.png"),animations:"disabled",scale:"css"});
    await page.screenshot({path:info.outputPath("home-390-full.png"),fullPage:true,animations:"disabled",scale:"css"});
    await page.setViewportSize({width:390,height:693});await noOverflow(page);await page.screenshot({path:info.outputPath("home-390x693.png"),animations:"disabled",scale:"css"});
    await page.setViewportSize({width:360,height:800});await noOverflow(page);await page.screenshot({path:info.outputPath("home-360x800.png"),animations:"disabled",scale:"css"});
    const smallCta=await page.locator(".home-turn-cta").boundingBox(),smallNav=await nav.boundingBox();expect(smallCta!.y+smallCta!.height).toBeLessThanOrEqual(smallNav!.y);
    await page.setViewportSize({width:720,height:1280});await noOverflow(page);await page.screenshot({path:info.outputPath("home-720x1280.png"),animations:"disabled",scale:"css"});
    await page.setViewportSize({width:390,height:844});
    const safe=await page.addStyleTag({content:".hc-shell.home-shell { --home-safe-top:44px; --home-safe-bottom:34px; }"});
    expect(await page.locator(".home-shell").evaluate(el=>getComputedStyle(el).getPropertyValue("--home-safe-top").trim())).toBe("44px");
    expect(await page.locator(".home-shell").evaluate(el=>getComputedStyle(el).getPropertyValue("--home-safe-bottom").trim())).toBe("34px");
    const safeCta=await page.locator(".home-turn-cta").boundingBox(),safeNav=await nav.boundingBox();
    expect(safeCta!.y+safeCta!.height).toBeLessThanOrEqual(safeNav!.y);
    const safePanel=await page.locator(".home-info").boundingBox(),safeHearts=await page.locator(".home-heart-row").boundingBox();
    expect(safeHearts!.y+safeHearts!.height).toBeLessThanOrEqual(safePanel!.y+safePanel!.height);
    await page.screenshot({path:info.outputPath("home-safe-area-390.png"),animations:"disabled",scale:"css"});
    await page.setViewportSize({width:360,height:800});
    const safeSmallCta=await page.locator(".home-turn-cta").boundingBox(),safeSmallNav=await nav.boundingBox(),safeSmallPanel=await page.locator(".home-info").boundingBox(),safeSmallHearts=await page.locator(".home-heart-row").boundingBox();
    expect(safeSmallCta!.y+safeSmallCta!.height).toBeLessThanOrEqual(safeSmallNav!.y);
    expect(safeSmallHearts!.y+safeSmallHearts!.height).toBeLessThanOrEqual(safeSmallPanel!.y+safeSmallPanel!.height);
    await page.screenshot({path:info.outputPath("home-safe-area-360.png"),animations:"disabled",scale:"css"});
    await safe.evaluate(el=>el.parentNode?.removeChild(el));await page.setViewportSize({width:390,height:844});
  }
  await writeFile(info.outputPath("home-capture-state.json"),JSON.stringify({gameSha256:createHash("sha256").update(JSON.stringify(original)).digest("hex"),game:original},null,2));
  await touch(page.getByRole("button",{name:"다음 개체",exact:true}),mobile);await expect(page.locator(".home-name")).toContainText("치즈");
  await touch(page.getByRole("button",{name:"이전 개체",exact:true}),mobile);await expect(page.locator(".home-name")).toContainText("모카");
  await touch(page.getByRole("button",{name:"그레이 선택",exact:true}),mobile);await expect(page.locator(".home-name")).toContainText("그레이");
  await page.getByRole("combobox",{name:"모프 필터",exact:true}).selectOption("axanthic");await expect(page.locator(".home-card")).toHaveCount(1);
  await page.getByRole("combobox",{name:"모프 필터",exact:true}).selectOption("all");
  await page.getByRole("combobox",{name:"개체 정렬",exact:true}).selectOption("name");
  await expect(page.locator(".home-card-grid")).toHaveClass(/columns-3/);
  const first=page.locator(".home-card").first(),thumb=first.locator("canvas"),thumbBox=await thumb.boundingBox();
  const fraction=await thumb.evaluate(el=>{const c=el as HTMLCanvasElement,rgba=c.getContext("2d")!.getImageData(0,0,c.width,c.height).data;for(let y=c.height-1;y>=0;y--)for(let x=0;x<c.width;x++)if(rgba[(y*c.width+x)*4+3])return (y+1)/c.height;return 0;});
  // The enlarged card intentionally lets the tail enter only the top of the name
  // row. Bound the real opaque pixels, not the canvas's transparent padding.
  const nameBox=(await first.locator(".home-card-name > span").boundingBox())!,paintBottom=thumbBox!.y+thumbBox!.height*fraction;
  // The native B-ORIGIN-01 tail ends one source pixel below the previous art.
  expect(fraction).toBeGreaterThan(0);expect(paintBottom-nameBox.y).toBeGreaterThan(0);expect(paintBottom-nameBox.y).toBeLessThanOrEqual(5);
  expect(paintBottom).toBeLessThan(nameBox.y+nameBox.height*.25);
  expect(paintBottom).toBeLessThan((await first.locator(".home-status").first().boundingBox())!.y);
  if(mobile)await page.screenshot({path:info.outputPath("home-three-columns.png"),fullPage:true,animations:"disabled",scale:"css"});
  await openCollectionCatalog(page,mobile);await expect(page.getByRole("dialog").locator(".collection-list-row")).toHaveCount(6);await page.keyboard.press("Escape");
  await touch(page.getByRole("button",{name:"그레이 상세보기",exact:true}),mobile);await expect(page.getByRole("dialog")).toContainText("공개 유전 정보");await page.keyboard.press("Escape");
  expect(await saved(page)).toEqual(original);
  const turn=page.getByRole("button",{name:"턴 넘기기",exact:true});await expect(turn).toBeEnabled();
  // Hold a real writer so the CTA must stay disabled until the daily result is saved.
  await page.evaluate(async()=>{
    const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open("gecko-lab",1);r.onsuccess=()=>resolve(r.result);});
    const tx=db.transaction("games","readwrite"),store=tx.objectStore("games");let hold=true;
    const pump=()=>{const r=store.get("hold-home-turn");r.onsuccess=()=>{if(hold)pump();};};pump();
    (window as unknown as {releaseHomeTurn:()=>void}).releaseHomeTurn=()=>{hold=false;};tx.oncomplete=()=>db.close();
  });
  await touch(turn,mobile);await expect(turn).toBeDisabled();await expect(page.getByTestId("game-day")).toHaveText("0");
  await page.evaluate(()=>(window as unknown as {releaseHomeTurn:()=>void}).releaseHomeTurn());
  await expect(page.getByTestId("game-day")).toHaveText("1");await expect(turn).toBeEnabled();
  await expect(page.getByTestId("game-date")).toHaveText(addDays(original.lastDate,7));
  await expect(page.locator(".game-tab-content")).toHaveAttribute("data-view","collection");
  await expect(page.getByRole("heading",{name:"교배",exact:true})).toHaveCount(0);
  const next=await saved(page);for(const id of Object.keys(original.individuals)){expect(next.individuals[id].hearts).toBe(Math.min(5,original.individuals[id].hearts+1));expect(next.individuals[id].genetics).toEqual(original.individuals[id].genetics);expect(next.individuals[id].visualSeed).toBe(original.individuals[id].visualSeed);}
  await expect(page.getByRole("button",{name:"턴 마치기",exact:true})).toHaveCount(0);
  await touch(page.getByRole("button",{name:"컨디션 관리",exact:true}),mobile);
  await expect(page.getByRole("dialog")).toContainText("급여는 턴 종료 시 자동 처리합니다.");await expect(page.locator(".game-tab-content")).toHaveAttribute("aria-busy","false");await page.keyboard.press("Escape");
  const fed=await saved(page);expect(fed.food).toBe(32);expect(fed.individuals[Object.keys(original.individuals)[0]].hearts).toBe(4);
  await touch(page.getByRole("button",{name:"모카 상세보기",exact:true}),mobile);await page.getByLabel("개체 이름",{exact:true}).fill("모카 연구소");await touch(page.getByRole("button",{name:"이름 저장",exact:true}),mobile);await expect(page.getByRole("heading",{name:"모카 연구소 상세",exact:true})).toBeVisible();await page.keyboard.press("Escape");
  const final=await saved(page);await page.reload();await expect(page.getByRole("heading",{name:/^보유 개체/})).toBeVisible();expect(await saved(page)).toEqual(final);await expect(page.locator(".home-name")).toContainText("모카 연구소");
  await touch(page.getByRole("button",{name:"모카 연구소 상세보기",exact:true}),mobile);await touch(page.getByRole("button",{name:"부모로 선택",exact:true}),mobile);
  await expect(page.getByRole("heading",{name:"교배",exact:true})).toBeVisible();await expect(page.getByTestId('breed-parent-female')).toHaveAttribute('data-parent-id',Object.keys(original.individuals)[0]);
  expect(await saved(page)).toEqual(final);
  expect(errors).toEqual([]);
});

test("empty home shows actual starting resources, resource buttons work and hatchling sex stays private",async({page},info)=>{
  const mobile=info.project.name.startsWith("mobile");await page.setViewportSize({width:360,height:800});await ready(page);
  await expect(page.getByRole("heading",{name:/^보유 개체/})).toContainText("0 / 4");
  await expect(page.getByTestId("game-money")).toHaveText("500,000");await expect(page.getByTestId("game-food")).toHaveText("0");await expect(page.locator(".home-card")).toHaveCount(0);
  await noOverflow(page);if(mobile)await page.screenshot({path:info.outputPath("home-empty-360.png"),scale:"css"});
  await openCollectionCatalog(page,mobile);await expect(page.getByRole("dialog")).toContainText("보유 개체가 없습니다.");await page.keyboard.press("Escape");
  await touch(page.getByRole("button",{name:"먹이 구입하기",exact:true}),mobile);await expect(page.getByRole("dialog",{name:"사료 구매",exact:true})).toBeVisible();await page.keyboard.press("Escape");
  const fixture=referenceHomeGame(),first=Object.values(fixture.individuals)[0];first.stage="hatchling";first.birthTurn=0;first.birthDate=REFERENCE_DATE;first.nextBreedTurn=fixture.rules.adultAfter;
  const carrier=Object.values(fixture.individuals)[1];carrier.genotype.loci.axanthic=["A","ax"];carrier.genetics={...legacyRecord(carrier),forge:{version:1}};
  await restore(page,fixture,mobile);await expect(page.locator(".home-name .home-sex")).toHaveText("?");
  await expect(page.getByTestId("hc-card-"+carrier.id).locator(".home-morph")).not.toContainText("het");
  await expect(page.locator(".home-card").first().locator(".home-sex")).toHaveText("?");await expect(page.locator(".home-info")).toContainText("해칭");
  await touch(page.getByRole("button",{name:carrier.name+" 상세보기",exact:true}),mobile);await expect(page.getByTestId("detail-morph-description")).toContainText("100% het 아잔틱");await page.keyboard.press("Escape");
  await touch(page.getByRole("button",{name:"컨디션 관리",exact:true}),mobile);await page.getByRole("combobox",{name:"성장 단계 필터",exact:true}).selectOption("hatchling");await page.keyboard.press("Escape");
  await expect(page.locator(".home-card")).toHaveCount(1);expect(await saved(page)).toEqual(fixture);await noOverflow(page);
});

test("long names, six main cards, full management and empty filters do not damage records or overflow",async({page},info)=>{
  const mobile=info.project.name.startsWith("mobile");await page.setViewportSize({width:360,height:800});await ready(page);
  const fixture=referenceHomeGame(),source=Object.values(fixture.individuals)[0];fixture.capacity=40;fixture.rules.initialCapacity=40;
  for(let n=0;n<9;n++){const g=structuredClone(source);g.id=fixture.gameId+"-extra-"+n;g.name="아주 긴 개체 이름을 가진 연구소 게코";g.visualSeed=g.id;fixture.individuals[g.id]=g;}
  await touch(page.getByRole("button",{name:"저장 및 게임 설정",exact:true}),mobile);await page.getByLabel("JSON 백업 파일",{exact:true}).setInputFiles({name:"many.json",mimeType:"application/json",buffer:Buffer.from(exportBackup(fixture))});await touch(page.getByRole("button",{name:"복원 실행",exact:true}),mobile);await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".home-card-grid .home-card")).toHaveCount(6);await expect(page.getByRole("button",{name:"개체 더 보기",exact:true})).toHaveCount(0);
  await noOverflow(page);await expect(page.locator(".home-card-grid")).toHaveClass(/columns-3/);
  await openCollectionCatalog(page,mobile);await expect(page.getByRole("dialog",{name:"전체 개체",exact:true}).getByRole("status")).toHaveText("15 / 15마리");await page.keyboard.press("Escape");
  await page.getByRole("combobox",{name:"모프 필터",exact:true}).selectOption("normal");await expect(page.locator(".home-card")).toHaveCount(collectionEntries(Object.values(fixture.individuals),{morph:"normal",stage:"all",sort:"default"}).length);
  await touch(page.getByRole("button",{name:"컨디션 관리",exact:true}),mobile);await page.getByRole("combobox",{name:"성장 단계 필터",exact:true}).selectOption("hatchling");await page.keyboard.press("Escape");await expect(page.locator(".home-card")).toHaveCount(0);
  await expect(page.locator(".home-empty")).toContainText("필터에 맞는");expect(await saved(page)).toEqual(fixture);await noOverflow(page);
});
