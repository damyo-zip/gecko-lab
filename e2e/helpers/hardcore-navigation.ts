import {expect,type Page,type Locator} from "@playwright/test";
export async function touch(l:Locator,mobile:boolean) {if(mobile)await l.tap();else await l.click();}
/** Use the home CTA and four tabs; other existing screens retain their six tabs. */
export async function navigateGame(page:Page,name:string,mobile:boolean) {
  const nav=page.getByRole("navigation",{name:"게임 탭"});
  const direct=nav.getByRole("button",{name,exact:true});
  if(await direct.count()){await touch(direct,mobile);return;}
  const aliases:Record<string,string>={"부화":"인큐베이터","혈통":"혈통도","인큐베이터":"부화","혈통도":"혈통"};
  if(aliases[name]&&await nav.getByRole("button",{name:aliases[name],exact:true}).count()){
    await touch(nav.getByRole("button",{name:aliases[name],exact:true}),mobile);return;
  }
  await touch(page.getByRole("button",{name:"교배하러 가기",exact:true}),mobile);
  if(name!=="교배")await touch(nav.getByRole("button",{name,exact:true}),mobile);
}
/** Advancing time now requires the real breeding screen; return for existing scenario assertions. */
export async function finishTurn(page:Page,mobile:boolean) {
  const current=await page.locator(".game-tab-content").getAttribute("data-view");
  const previousDay=Number(await page.getByTestId("game-day").textContent());
  await navigateGame(page,"교배",mobile);
  await touch(page.getByRole("button",{name:"턴 마치기",exact:true}),mobile);
  await expect(page.getByTestId("game-day")).toHaveText(String(previousDay+1));
  await expect(page.locator(".game-tab-content")).toHaveAttribute("aria-busy","false");
  const screens:Record<string,string>={collection:"컬렉션",incubator:"부화",home:"오늘",shop:"상점",lineage:"혈통"};
  if(current&&screens[current])await navigateGame(page,screens[current],mobile);
}
export async function feedCollection(page:Page,mobile:boolean) {
  await navigateGame(page,"컬렉션",mobile);
  await touch(page.getByRole("button",{name:"컨디션 관리",exact:true}),mobile);
  await touch(page.getByRole("dialog").getByRole("button",{name:/^수동 전체 급여/}),mobile);
  await expect(page.locator(".game-tab-content")).toHaveAttribute("aria-busy","false");
  await touch(page.getByRole("dialog").getByRole("button",{name:"상세 창 닫기",exact:true}),mobile);
}
