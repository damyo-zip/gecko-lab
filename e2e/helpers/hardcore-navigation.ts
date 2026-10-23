import {expect,type Page,type Locator} from "@playwright/test";
export async function touch(l:Locator,mobile:boolean) {if(mobile)await l.tap();else await l.click();}
/** Drive the actual stacked picker, including the ID search and selection button. */
export async function chooseBreedingParent(page:Page,sex:'male'|'female',id:string,mobile=false){
  await touch(page.getByRole('button',{name:sex==='male'?'수컷 개체 변경':'암컷 개체 변경',exact:true}),mobile);
  const picker=page.getByRole('dialog',{name:sex==='male'?'수컷 개체 선택':'암컷 개체 선택',exact:true});
  if(id){await picker.getByRole('searchbox',{name:'개체 이름·번호·모프 검색',exact:true}).fill(id);await touch(picker.getByTestId('parent-candidate-'+id).getByRole('button',{name:'이 개체 선택',exact:true}),mobile);}
  else await touch(picker.getByRole('button',{name:'선택 해제',exact:true}),mobile);
  await expect(picker).toHaveCount(0);await expect(page.getByTestId('breed-parent-'+sex)).toHaveAttribute('data-parent-id',id);
}
/** Home has four tabs; incubator provides access to the other existing screens. */
export async function navigateGame(page:Page,name:string,mobile:boolean) {
  const breeding=page.getByRole('dialog',{name:'교배',exact:true});
  if(name==='교배'&&await breeding.count())return;
  for(const title of ['부화 확률과 슬롯 규칙','수컷 개체 선택','암컷 개체 선택','유전 정보','혈통 비교','교배 전 위험 확인','교배']){
    const d=page.getByRole('dialog',{name:title,exact:true});if(await d.count())await touch(d.getByRole('button',{name:'상세 창 닫기',exact:true}),mobile);
  }
  const resources=page.getByRole("dialog",{name:/^(사료|사육장) 구매$/});
  if(await resources.count())await touch(resources.getByRole("button",{name:"상세 창 닫기",exact:true}),mobile);
  const catalog=page.getByRole("dialog",{name:"전체 개체",exact:true});
  if(await catalog.count())await touch(catalog.getByRole("button",{name:"상세 창 닫기",exact:true}),mobile);
  const nav=page.getByRole("navigation",{name:"게임 탭"});
  const direct=nav.getByRole("button",{name,exact:true});
  if(await direct.count()){await touch(direct,mobile);return;}
  const aliases:Record<string,string>={"부화":"인큐베이터","혈통":"혈통도","인큐베이터":"부화","혈통도":"혈통"};
  if(aliases[name]&&await nav.getByRole("button",{name:aliases[name],exact:true}).count()){
    await touch(nav.getByRole("button",{name:aliases[name],exact:true}),mobile);return;
  }
  await touch(nav.getByRole("button",{name:"인큐베이터",exact:true}),mobile);
  if(name==='교배')await touch(page.getByRole('button',{name:'교배 열기',exact:true}),mobile);
  else if(name==='오늘'){await openIncubatorRecords(page,mobile);await touch(page.getByRole('button',{name:'오늘의 연구소',exact:true}),mobile);}
  else throw new Error('Unknown game view: '+name);
}
/** Advance through the collection CTA, then return for existing scenario assertions. */
export async function finishTurn(page:Page,mobile:boolean) {
  const current=await page.locator(".game-tab-content").getAttribute("data-view");
  const previousDay=Number(await page.getByTestId("game-day").textContent());
  await navigateGame(page,"컬렉션",mobile);
  await touch(page.getByRole("button",{name:"턴 넘기기",exact:true}),mobile);
  const shortage=page.getByRole("dialog",{name:"턴 종료 전 사료 부족",exact:true});
  if(await shortage.count())await touch(shortage.getByRole("button",{name:"사료 부족 상태로 턴 마치기",exact:true}),mobile);
  await expect(page.getByTestId("game-day")).toHaveText(String(previousDay+1));
  await expect(page.locator(".game-tab-content")).toHaveAttribute("aria-busy","false");
  const screens:Record<string,string>={collection:"컬렉션",breeding:"교배",incubator:"부화",home:"오늘",shop:"상점",lineage:"혈통"};
  if(current&&screens[current])await navigateGame(page,screens[current],mobile);
}
export async function feedCollection(page:Page,mobile:boolean) {
  await navigateGame(page,"컬렉션",mobile);
  await touch(page.getByRole("button",{name:"컨디션 관리",exact:true}),mobile);
  await expect(page.getByRole("dialog")).toContainText("급여는 턴 종료 시 자동 처리합니다.");
  await expect(page.locator(".game-tab-content")).toHaveAttribute("aria-busy","false");
  await touch(page.getByRole("dialog").getByRole("button",{name:"상세 창 닫기",exact:true}),mobile);
}

export async function manageResources(page:Page,mobile:boolean){
 if(await page.getByRole("dialog",{name:"사료 구매",exact:true}).count())return;
 if(!await page.getByRole("button",{name:"먹이 구입하기",exact:true}).count())await navigateGame(page,"인큐베이터",mobile);
 await touch(page.getByRole("button",{name:"먹이 구입하기",exact:true}),mobile);
}
export async function closeResources(page:Page,mobile:boolean){
 await touch(page.getByRole("dialog",{name:/^(사료|사육장) 구매$/}).getByRole("button",{name:"상세 창 닫기",exact:true}),mobile);
}
export async function buyFood(page:Page,mobile:boolean,amount:number){
 await manageResources(page,mobile);await page.getByLabel("먹이 구매 수량",{exact:true}).fill(String(amount));
 await touch(page.getByRole("button",{name:"먹이 구입 · ₩"+(amount*1000).toLocaleString("ko-KR"),exact:true}),mobile);
 await expect(page.locator(".game-tab-content")).toHaveAttribute("aria-busy","false");await closeResources(page,mobile);
}

export async function inspectGenetics(page:Page,mobile:boolean){
 const d=page.getByRole('dialog',{name:'유전 정보',exact:true});if(!await d.count())await touch(page.getByRole('button',{name:'유전 정보',exact:true}),mobile);
}
export async function closeGenetics(page:Page,mobile:boolean){
 const d=page.getByRole('dialog',{name:'유전 정보',exact:true});if(await d.count())await touch(d.getByRole('button',{name:'상세 창 닫기',exact:true}),mobile);
}

export async function closeBreeding(page:Page,mobile:boolean){
 for(const title of ['수컷 개체 선택','암컷 개체 선택','유전 정보','혈통 비교','교배 전 위험 확인','교배']){
  const d=page.getByRole('dialog',{name:title,exact:true});if(await d.count())await touch(d.getByRole('button',{name:'상세 창 닫기',exact:true}),mobile);
 }
}

/** The existing grid icon opens the persistent management dialog. */
export async function openCollectionCatalog(page:Page,mobile:boolean) {
  const catalog=page.getByRole('dialog',{name:'전체 개체',exact:true});
  if(!await catalog.count())await touch(page.getByRole('button',{name:'전체 개체 열기',exact:true}),mobile);
  await expect(catalog).toBeVisible();
}

/** Explicit player care actions for existing breeding scenarios after ending a turn. */
export async function tendIncubator(page:Page,mobile:boolean){
 const needed=await page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});
  return new Promise<boolean>(resolve=>{const tx=db.transaction('games'),r=tx.objectStore('games').get('active');r.onsuccess=()=>resolve(Object.values(r.result.save.game.eggs as Record<string,{status:string;care?:{collectedTurn:number|null;settledTurn:number|null}}>).some(e=>e.care?.collectedTurn===null||e.care?.settledTurn===null&&e.status!=='incubating'));tx.oncomplete=()=>db.close();});
 });
 if(!needed)return;
 const previous=(await page.getByRole('navigation',{name:'게임 탭'}).locator('[aria-pressed="true"]').innerText()).trim();
 await navigateGame(page,'인큐베이터',mobile);
 while(await page.getByRole('button',{name:'알 2개 수거',exact:true}).count()){
  const before=await page.getByRole('button',{name:'알 2개 수거',exact:true}).count();
  await touch(page.getByRole('button',{name:'알 2개 수거',exact:true}).first(),mobile);
  await expect.poll(()=>page.getByRole('button',{name:'알 2개 수거',exact:true}).count()).toBeLessThan(before);
  await expect(page.locator('.game-tab-content')).toHaveAttribute('aria-busy','false');
 }
 for(const prefix of ['receive-hatchling-','remove-egg-'])while(await page.locator(`[data-testid^="${prefix}"]`).count()){
  const before=await page.locator(`[data-testid^="${prefix}"]`).count();
  await touch(page.locator(`[data-testid^="${prefix}"]`).first(),mobile);
  await expect.poll(()=>page.locator(`[data-testid^="${prefix}"]`).count()).toBeLessThan(before);
  await expect(page.locator('.game-tab-content')).toHaveAttribute('aria-busy','false');
 }
 await navigateGame(page,previous,mobile);
}

/** Existing whole-game regressions now explicitly collect and settle every played clutch. */
export async function finishTurnAndTend(page:Page,mobile:boolean){
 await finishTurn(page,mobile);await tendIncubator(page,mobile);
}

/** The compact incubator keeps historical inference records in its rules dialog. */
export async function openIncubatorRecords(page:Page,mobile:boolean){
 await touch(page.getByRole('button',{name:'부화 확률과 슬롯 규칙',exact:true}),mobile);
 await expect(page.getByRole('dialog',{name:'부화 확률과 슬롯 규칙',exact:true})).toBeVisible();
}

/** Search is collapsed by default; existing workflows explicitly open it. */
export async function expandCollectionFilters(page:Page,mobile:boolean){
 const dialog=page.getByRole('dialog',{name:'전체 개체',exact:true}),toggle=dialog.getByRole('button',{name:'검색·필터 펼치기',exact:true});
 if(await toggle.count())await touch(toggle,mobile);
}

/** Housing is a separate purchase dialog, reachable from resource management. */
export async function manageHousing(page:Page,mobile:boolean){
 await manageResources(page,mobile);
 await touch(page.getByRole('dialog',{name:'사료 구매',exact:true}).getByRole('button',{name:'사육장 구매',exact:true}),mobile);
 await expect(page.getByRole('dialog',{name:'사육장 구매',exact:true})).toBeVisible();
}
