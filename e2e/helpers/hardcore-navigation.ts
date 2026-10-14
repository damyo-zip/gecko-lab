import {expect,type Page,type Locator} from "@playwright/test";
export async function touch(l:Locator,mobile:boolean) {if(mobile)await l.tap();else await l.click();}
/** Home has four tabs; incubator provides access to the other existing screens. */
export async function navigateGame(page:Page,name:string,mobile:boolean) {
  const breeding=page.getByRole('dialog',{name:'교배',exact:true});
  if(name==='교배'&&await breeding.count())return;
  for(const title of ['유전 정보','혈통 비교','교배 전 위험 확인','교배']){
    const d=page.getByRole('dialog',{name:title,exact:true});if(await d.count())await touch(d.getByRole('button',{name:'상세 창 닫기',exact:true}),mobile);
  }
  const resources=page.getByRole("dialog",{name:"사료 및 사육장 관리",exact:true});
  if(await resources.count())await touch(resources.getByRole("button",{name:"상세 창 닫기",exact:true}),mobile);
  const nav=page.getByRole("navigation",{name:"게임 탭"});
  const direct=nav.getByRole("button",{name,exact:true});
  if(await direct.count()){await touch(direct,mobile);return;}
  const aliases:Record<string,string>={"부화":"인큐베이터","혈통":"혈통도","인큐베이터":"부화","혈통도":"혈통"};
  if(aliases[name]&&await nav.getByRole("button",{name:aliases[name],exact:true}).count()){
    await touch(nav.getByRole("button",{name:aliases[name],exact:true}),mobile);return;
  }
  await touch(nav.getByRole("button",{name:"인큐베이터",exact:true}),mobile);
  await touch(page.getByRole("navigation",{name:"연구소 도구"}).getByRole("button",{name,exact:true}),mobile);
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
  await expect(page.getByRole("dialog")).toContainText("자동 급여");
  await expect(page.locator(".game-tab-content")).toHaveAttribute("aria-busy","false");
  await touch(page.getByRole("dialog").getByRole("button",{name:"상세 창 닫기",exact:true}),mobile);
}

export async function manageResources(page:Page,mobile:boolean){
 if(await page.getByRole("dialog",{name:"사료 및 사육장 관리",exact:true}).count())return;
 if(!await page.getByRole("button",{name:"먹이 구입하기",exact:true}).count())await navigateGame(page,"인큐베이터",mobile);
 await touch(page.getByRole("button",{name:"먹이 구입하기",exact:true}),mobile);
}
export async function closeResources(page:Page,mobile:boolean){
 await touch(page.getByRole("dialog",{name:"사료 및 사육장 관리",exact:true}).getByRole("button",{name:"상세 창 닫기",exact:true}),mobile);
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
 for(const title of ['유전 정보','혈통 비교','교배 전 위험 확인','교배']){
  const d=page.getByRole('dialog',{name:title,exact:true});if(await d.count())await touch(d.getByRole('button',{name:'상세 창 닫기',exact:true}),mobile);
 }
}
