import {test,expect,type Page} from "@playwright/test";
import {mkdir,writeFile} from "node:fs/promises";
import {referenceHomeGame,REFERENCE_DATE} from "./fixtures/reference-home";
import {touch} from "./helpers/hardcore-navigation";
import {exportBackup} from "../src/game/hardcore/save";
import type {HardcoreGame} from "../src/game/hardcore/model";

const TABS=[["컬렉션","collection"],["인큐베이터","incubator"],["혈통도","lineage"],["상점","shop"]] as const;
async function saved(page:Page):Promise<HardcoreGame> {
  return page.evaluate(async()=>{
    const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open("gecko-lab",1);r.onsuccess=()=>resolve(r.result);});
    return new Promise(resolve=>{const tx=db.transaction("games"),r=tx.objectStore("games").get("active");r.onsuccess=()=>resolve(r.result.save.game);tx.oncomplete=()=>db.close();});
  });
}
async function restore(page:Page,mobile:boolean) {
  await page.clock.setFixedTime(new Date(REFERENCE_DATE+"T03:00:00Z"));await page.goto("/");
  await expect(page.getByRole("heading",{name:/^보유 개체/})).toBeVisible();
  await touch(page.getByRole("button",{name:"저장 및 게임 설정",exact:true}),mobile);
  await page.getByLabel("JSON 백업 파일",{exact:true}).setInputFiles({name:"common-ui.json",mimeType:"application/json",buffer:Buffer.from(exportBackup(referenceHomeGame()))});
  await touch(page.getByRole("button",{name:"복원 실행",exact:true}),mobile);
  await expect(page.getByRole("dialog")).toHaveCount(0);await page.evaluate(()=>document.fonts.ready);
}
async function chrome(page:Page) {
  return page.evaluate(()=>[".home-header",".home-settings",".home-brand",".home-brand img",".home-resources",".home-footer",".home-turn-cta",".home-nav",".home-turn-cta > span",...Array.from({length:4},(_,i)=>`.home-nav > button:nth-child(${i+1})`),".home-nav button svg"].map(selector=>{
    const el=document.querySelector(selector)!,r=el.getBoundingClientRect(),s=getComputedStyle(el);
    return {selector,x:r.x,y:r.y,width:r.width,height:r.height,padding:s.padding,gap:s.gap,fontSize:s.fontSize};
  }));
}

test("collection geometry and persistent chrome stay pixel-identical across all tabs, scrolling, viewport and safe areas",async({page},info)=>{
  test.setTimeout(60_000);
  const mobile=info.project.name.startsWith("mobile"),errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await restore(page,mobile);const original=await saved(page),reports=[];
  await page.locator('.home-header,.home-footer').evaluateAll(nodes=>nodes.forEach(n=>n.setAttribute('data-instance','persistent')));
  const viewports=mobile?[[360,800],[390,844],[430,932],[360,640],[844,390]]:[[720,1280],[1280,900]];
  for(const [width,height] of viewports)for(const safe of [false,true]) {
    await page.setViewportSize({width,height});
    const style=safe?await page.addStyleTag({content:".hc-shell.reference-shell {--home-safe-top:44px;--home-safe-bottom:34px;--home-safe-left:20px;--home-safe-right:20px;}"}):null;
    await touch(page.getByRole('navigation',{name:'게임 탭'}).getByRole('button',{name:'컬렉션',exact:true}),mobile);
    const baseline=await chrome(page);
    for(const [label,view] of TABS) {
      await touch(page.getByRole('navigation',{name:'게임 탭'}).getByRole('button',{name:label,exact:true}),mobile);
      await expect(page.locator('.game-tab-content')).toHaveAttribute('data-view',view);
      await expect(page.locator('.reference-content')).toHaveJSProperty('scrollTop',0);
      expect(await chrome(page),`${view} ${width}×${height} safe=${safe}`).toEqual(baseline);
      await expect(page.locator('.home-header[data-instance="persistent"],.home-footer[data-instance="persistent"]')).toHaveCount(2);
      await expect(page.getByRole('button',{name:'턴 넘기기',exact:true})).toHaveCount(1);
      await expect(page.getByRole('navigation',{name:'게임 탭'}).getByRole('button',{name:label,exact:true})).toHaveAttribute('aria-pressed','true');
      const content=await page.locator('.reference-content').boundingBox(),cta=await page.locator('.home-turn-cta').boundingBox(),nav=await page.locator('.home-nav').boundingBox();
      expect(content!.y+content!.height).toBeLessThanOrEqual(cta!.y);expect(cta!.y+cta!.height).toBeLessThanOrEqual(nav!.y);
      expect(nav!.y+nav!.height).toBe(height);expect(cta!.height).toBeGreaterThanOrEqual(44);
      if(safe) {
        const buttons=page.locator('.home-nav > button'),first=await buttons.first().boundingBox(),last=await buttons.last().boundingBox();
        expect(first!.x).toBeGreaterThanOrEqual(20);expect(last!.x+last!.width).toBeLessThanOrEqual(width-20);
        expect(nav!.y+nav!.height-34).toBeGreaterThanOrEqual(last!.y+last!.height);
      }
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&scrollY===0)).toBe(true);
      if(mobile&&width===390&&!safe)await page.screenshot({path:info.outputPath(`${view}-390.png`),scale:'css'});
      // The album retains genuine scrolling; collection now has six fixed main cards.
      await page.locator('.reference-content').evaluate(el=>{el.scrollTop=el.scrollHeight;});
      if(view==='lineage')expect(await page.locator('.reference-content').evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
      expect(await chrome(page)).toEqual(baseline);
      reports.push({width,height,safe,view,geometry:baseline});
    }
    if(style)await style.evaluate(el=>el.parentNode?.removeChild(el));
  }
  expect(await saved(page)).toEqual(original);expect(errors).toEqual([]);
  if(mobile){await mkdir('docs/common-ui',{recursive:true});await writeFile('docs/common-ui/geometry.json',JSON.stringify(reports,null,2));}
});

test("one shared turn action retains shortage confirmation, duplicate-click guard, resource bindings and reload",async({page},info)=>{
  const mobile=info.project.name.startsWith('mobile');await restore(page,mobile);
  for(const [label,view] of TABS) {
    await touch(page.getByRole('navigation',{name:'게임 탭'}).getByRole('button',{name:label,exact:true}),mobile);
    const previous=await saved(page);
    await page.getByRole('button',{name:'턴 넘기기',exact:true}).evaluate(el=>{(el as HTMLButtonElement).click();(el as HTMLButtonElement).click();});
    await expect(page.getByTestId('game-day')).toHaveText(String(previous.turn+1));
    await expect(page.locator('.game-tab-content')).toHaveAttribute('aria-busy','false');
    const next=await saved(page);expect(next.turn).toBe(previous.turn+1);expect(next.food).toBe(previous.food-6);expect(next.money).toBe(previous.money);
    await expect(page.getByTestId('game-food')).toHaveText(String(next.food));
    await expect(page.locator('.game-tab-content')).toHaveAttribute('data-view',view);
  }
  await touch(page.getByRole('button',{name:'먹이 구입하기',exact:true}),mobile);await expect(page.getByRole('dialog',{name:'사료 및 사육장 관리',exact:true})).toBeVisible();await page.keyboard.press('Escape');
  // Six turns exhaust the fixture's 38 food; the shared button must still open the real warning.
  for(let n=0;n<2;n++){await touch(page.getByRole('button',{name:'턴 넘기기',exact:true}),mobile);await expect(page.getByTestId('game-day')).toHaveText(String(5+n));await expect(page.locator('.game-tab-content')).toHaveAttribute('aria-busy','false');}
  const unchanged=await saved(page);await touch(page.getByRole('button',{name:'턴 넘기기',exact:true}),mobile);
  await expect(page.getByRole('dialog',{name:'턴 종료 전 사료 부족',exact:true})).toBeVisible();expect(await saved(page)).toEqual(unchanged);await page.keyboard.press('Escape');
  await page.reload();await expect(page.getByTestId('game-day')).toHaveText('6');expect(await saved(page)).toEqual(unchanged);
});
