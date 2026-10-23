import {productionSprite,productionName,productionDescription,productionAppearance} from './helpers/forge';
import {test,expect,type Page,type Locator} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {newForgeGame as newGame,act} from '../src/game/hardcore/play';
import {exportBackup} from '../src/game/hardcore/save';
import {visualName,morphDescription,specimen} from '../src/game/hardcore/adapter';
import {renderSprite} from '../src/engine/render';
import {navigateGame,touch,chooseBreedingParent,finishTurnAndTend} from './helpers/hardcore-navigation';
import type {HardcoreGame,Gecko} from '../src/game/hardcore/model';
import {SHOP_NICKNAMES} from '../src/game/hardcore/shop-nicknames';
const DATE='2026-10-16';
function fixture(){
 let game=newGame('representative-browser',DATE,{initialMoney:10_000_000,initialCapacity:20});
 const mother=Object.values(game.shop.offers)[1].id;game=act(game,{type:'buyGecko',offerId:mother},DATE);game=act(game,{type:'rename',id:mother,name:'내가 지은 엄마 이름'},DATE);game=act(game,{type:'buyFood',amount:100},DATE);
 for(let n=0;n<80;n++){
  const offer=Object.values(game.shop.offers).find(o=>o.individual.stage==='adult'&&o.individual.sex==='male'&&productionName(o.individual).includes('하이웨이'));
  if(offer)return {game,mother,offer};
  game=act(game,{type:'refreshShop'},DATE);
 }
 throw new Error('Actual Highway male offer missing');
}
async function saved(page:Page):Promise<HardcoreGame>{return page.evaluate(async()=>{
 const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('gecko-lab',1);r.onsuccess=()=>resolve(r.result);});
 return new Promise(resolve=>{const tx=db.transaction('games'),r=tx.objectStore('games').get('active');r.onsuccess=()=>resolve(r.result.save.game);tx.oncomplete=()=>db.close();});
});}
function hash(p:ArrayLike<number>){let h=2166136261;for(let i=0;i<p.length;i++)h=Math.imul(h^p[i],16777619);return h>>>0;}
async function sameSprite(root:Locator,g:Gecko){
 const c=root.locator('canvas');await expect(c).toHaveCount(1);
 await expect.poll(()=>c.evaluate(node=>{const canvas=node as HTMLCanvasElement,ctx=canvas.getContext('2d')!,p=ctx.getImageData(0,0,canvas.width,canvas.height).data,scale=canvas.width/96;let h=2166136261;
  for(let y=0;y<96;y++)for(let x=0;x<96;x++)for(let n=0;n<4;n++)h=Math.imul(h^p[((y*scale)*canvas.width+x*scale)*4+n],16777619);return h>>>0;
 })).toBe(hash(productionSprite(g).pixels));
}
test('Korean representative stays identical across live shop, collection, details, picker, breeding, incubator, pedigree and reload',async({page},info)=>{
 test.setTimeout(120_000);const mobile=info.project.name.startsWith('mobile'),f=fixture(),g=f.offer.individual,errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 expect(SHOP_NICKNAMES).toContain(g.name);expect(productionName(g)).not.toMatch(/ · | \+ /);
 await page.clock.setFixedTime(new Date(DATE+'T03:00:00Z'));await page.goto('/');await touch(page.getByRole('button',{name:'저장 및 게임 설정',exact:true}),mobile);
 await page.getByLabel('JSON 백업 파일',{exact:true}).setInputFiles({name:'before-display-change.json',mimeType:'application/json',buffer:Buffer.from(exportBackup(f.game))});
 await touch(page.getByRole('button',{name:'복원 실행',exact:true}),mobile);await expect(page.getByRole('dialog')).toHaveCount(0);
 await navigateGame(page,'상점',mobile);const offer=page.getByTestId('shop-offer-'+g.id);await expect(offer.locator('h3')).toHaveText(g.name);await expect(offer.locator('.shop-morph')).toHaveText(productionName(g));await sameSprite(offer,g);
 await touch(offer.getByRole('button',{name:g.name+' 부모',exact:true}),mobile);
 for(const parent of [f.offer.family!.father,f.offer.family!.mother]){await expect(page.locator('.shop-family-grid')).toContainText(productionName(parent));await sameSprite(page.locator('.shop-family-grid article').filter({has:page.getByTestId('hardcore-sprite-'+parent.id)}),parent);}
 await page.keyboard.press('Escape');expect(await saved(page)).toEqual(f.game);
 await touch(offer.getByRole('button',{name:g.name+' 구매',exact:true}),mobile);const bought=await saved(page);expect(bought.individuals[g.id]).toEqual(g);expect(bought.money).toBe(f.game.money-f.offer.askPrice);
 await navigateGame(page,'컬렉션',mobile);await expect(page.getByTestId('hc-card-'+g.id).locator('.home-morph')).toHaveText(productionName(g));await sameSprite(page.getByTestId('hc-card-'+g.id),g);
 await touch(page.getByRole('button',{name:g.name+' 상세보기',exact:true}),mobile);await expect(page.getByTestId('detail-morph')).toHaveText(productionName(g));await expect(page.getByTestId('detail-morph-description')).toHaveText(productionDescription(g));await expect(page.getByLabel('개체 이름',{exact:true})).toHaveValue(g.name);
 if(mobile){await mkdir('docs/morph-display-names',{recursive:true});await page.getByTestId('detail-morph').scrollIntoViewIfNeeded();await page.getByRole('dialog').screenshot({path:'docs/morph-display-names/details-360.png',scale:'css'});}await page.keyboard.press('Escape');
 await navigateGame(page,'교배',mobile);await touch(page.getByRole('button',{name:'수컷 개체 변경',exact:true}),mobile);const picker=page.getByRole('dialog',{name:'수컷 개체 선택',exact:true});
 await picker.getByLabel('모프 필터',{exact:true}).selectOption('visible:Highway');await expect(picker.getByLabel('모프 필터',{exact:true}).getByRole('option',{name:'하이웨이',exact:true})).toHaveAttribute('value','visible:Highway');await picker.getByRole('searchbox').fill('하이웨이');
 const candidate=picker.getByTestId('parent-candidate-'+g.id);await expect(candidate.locator('.parent-search-morph')).toHaveText(productionName(g));await touch(candidate.getByRole('button',{name:'이 개체 선택',exact:true}),mobile);await chooseBreedingParent(page,'female',f.mother,mobile);
 await expect(page.getByTestId('breed-parent-male').locator('.breed-parent-caption > strong')).toHaveText(productionName(g));expect(await saved(page)).toEqual(bought);
 if(mobile)await page.getByRole('dialog',{name:'교배',exact:true}).screenshot({path:'docs/morph-display-names/breeding-360.png',scale:'css'});
 await touch(page.getByTestId('breed-submit'),mobile);const warning=page.getByRole('dialog',{name:'교배 전 위험 확인',exact:true});if(await warning.count())await touch(warning.getByRole('button',{name:'위험을 확인하고 교배하기',exact:true}),mobile);
 await expect(page.getByRole('dialog')).toHaveCount(0);await finishTurnAndTend(page,mobile);await finishTurnAndTend(page,mobile);
 let state=await saved(page);expect(Object.values(state.eggs)).toHaveLength(2);await navigateGame(page,'인큐베이터',mobile);await touch(page.getByTestId('select-egg-'+Object.values(state.eggs)[0].id),mobile);await expect(page.getByTestId('incubator-parent-info').locator('.inc-parent-morph').last()).toHaveText(productionName(g));await sameSprite(page.getByTestId('incubator-parent-male'),state.individuals[g.id]);
 await navigateGame(page,'혈통도',mobile);await page.getByRole('combobox',{name:'혈통을 볼 개체',exact:true}).selectOption(g.id);await expect(page.locator('.lineage-root .album-selected-facts dl > div').filter({has:page.getByText('모프',{exact:true})}).locator('dd')).toHaveText(productionName(g));
 await navigateGame(page,'컬렉션',mobile);await expect(page.getByTestId('hc-card-'+f.mother)).toContainText('내가 지은 엄마 이름');
 for(const [width,height] of [[360,800],[390,844],[430,932]]){await page.setViewportSize({width,height});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.getByTestId('hc-card-'+g.id).locator('.home-morph')).toHaveText(productionName(g));if(mobile&&width===390)await page.screenshot({path:'docs/morph-display-names/collection-390.png',scale:'css'});}
 state=await saved(page);await page.reload();await expect(page.getByTestId('game-day')).toHaveText('2');expect(await saved(page)).toEqual(state);await expect(page.getByTestId('hc-card-'+g.id).locator('.home-morph')).toHaveText(productionName(g));expect(errors).toEqual([]);
});
