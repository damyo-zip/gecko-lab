import { founderHealth } from '@/genetics/health';
import { bornIndividual } from './egg-outcome';
import { normalGenotype, lillyGenotype } from '@/genetics/mendel';
import { expandedGenotype } from '@/genetics/hardcore';
import { seedId, seededRandom } from '@/genetics/random';
import { belief, childKnowledge, unknownKnowledge } from '@/genetics/advanced/inference';
import { legacyTraits, observedLoci } from '@/genetics/advanced/phenotype';
import { polyScores } from '@/genetics/advanced/polygenic';
import { founderRecord, advancedSafety } from './genetics';
import { createEmbryo } from './offspring';
import { addDays } from './time';
import { visualName } from './adapter';
import { MARKET, valueGecko, type PriceTable } from './market';
import type { Gecko, HardcoreGame, Mating, ShopOffer } from './model';

export const SHOP_REFRESH_PRICE=2_000;
export const SHOP_SIZE=4;

function parent(game:HardcoreGame,id:string,seed:string,sex:'male'|'female',matingTurn:number,profile:number,subdued:boolean):Gecko {
  const genotype=expandedGenotype(profile===1?lillyGenotype():normalGenotype());
  if(profile===2)genotype.loci.axanthic=['A','ax'];
  if(profile===3)genotype.loci.axanthic=['ax','ax'];
  const genetics=founderRecord(genotype,seed,subdued);
  if(game.saveVersion>=9&&profile>=4)genetics.genome!.mendelian.loci['cappuccino-complex']=['n',['C','S','H'][profile-4]];
  // Observe the phenotype, never turn secret carrier truth into seller evidence.
  genetics.knowledge=childKnowledge(unknownKnowledge(),unknownKnowledge(),observedLoci(genetics.genome!),id);
  if(game.saveVersion>=9){const pair=genetics.genome!.mendelian.loci['cappuccino-complex'];
    genetics.knowledge.loci['cappuccino-complex']=belief({[pair.join('/')]:1},'appearance','게임의 관찰 가능한 복합 계통 표현형 · 실제 같은 좌위 규칙은 잠정 모델',[id]);}
  const birthTurn=matingTurn-16-Math.floor(seededRandom(seed,'parent-age')()*25);
  return {id,name:sex==='male'?'매물 부계':'매물 모계',sex,birthTurn,birthDate:addDays(game.lastDate,(birthTurn-game.turn)*7),
    stage:'adult',parents:null,generation:1,genotype,potential:legacyTraits(polyScores(genetics.genome!.polygenic)),genetics,
    visualSeed:id+'-'+seedId(seed,'visual'),nextBreedTurn:0,status:'pedigree',hearts:5,lastFedDate:null,diedDate:null,
    cycleAnchor:addDays(game.lastDate,(matingTurn-game.turn)*7),recoverUntil:addDays(game.lastDate,(matingTurn-game.turn)*7),
    lineageIds:[],provenance:'unverified',deathCause:null,lastProcessedTurn:game.turn,...(game.saveVersion>=9?{healthGenome:founderHealth(seed+'|health')}:{})};
}

/** The same embryo factory and allele transmission as player breeding; no copied appearance. */
export function familyOffer(game:HardcoreGame,batch:number,index:number,table:PriceTable=MARKET):ShopOffer {
  const seed=game.seed+'|family-shop:'+game.lastDate+'|'+batch+'|'+index;
  const random=seededRandom(seed,'catalog'),starter=batch===1&&index<2;
  const age=starter?12:Math.floor(random()*30),birthTurn=game.turn-age,matingTurn=birthTurn-6;
  const id=game.gameId+'-store-'+batch+'-'+index;
  const profiles=game.saveVersion>=9?7:4;
  const father=parent(game,id+'-father',seed+'|father','male',matingTurn,starter?0:Math.floor(random()*profiles),starter);
  let mother=parent(game,id+'-mother',seed+'|mother','female',matingTurn,starter?0:Math.floor(random()*profiles),starter);
  // All offspring must come from a safe pair, including Lilly homozygous risks.
  if(advancedSafety(father,mother).length)mother=parent(game,id+'-mother',seed+'|mother','female',matingTurn,0,starter);
  const mating:Mating={id:id+'-origin',ordinal:1,date:addDays(game.lastDate,(matingTurn-game.turn)*7),
    parents:{fatherId:father.id,motherId:mother.id},fatherGenotype:father.genotype,motherGenotype:mother.genotype,
    fatherTraits:father.potential,motherTraits:mother.potential,generation:2,lineageIds:[],seed,
    fertilizationChance:.95,hatchChance:.95,status:'laid',resolvedDate:game.lastDate,
    genetics:{father:father.genetics!,mother:mother.genetics!,observedIds:[],updates:[]}};
  if(game.saveVersion>=9)mating.riskModel={version:1,father:father.healthGenome!,mother:mother.healthGenome!};
  let child:Gecko|undefined,childSeed='';
  // Curate two affordable unrelated adults on a new game; inherit sex normally.
  for(let attempt=0;attempt<100;attempt++){
    childSeed=seed+'|child:'+attempt;
    const embryo=createEmbryo(game,mating,childSeed,id,'매물',birthTurn,addDays(game.lastDate,-age*7));
    if(embryo.development?.viable===false)continue;
    child=bornIndividual(embryo);
    if(!starter||child.sex===(index===0?'male':'female'))break;
  }
  if(!child)throw new Error('매물 생성 실패');
  child.stage=age>=12?'adult':age>=6?'juvenile':'hatchling';
  child.nextBreedTurn=Math.max(0,birthTurn+12);child.lastProcessedTurn=game.turn;
  const label=visualName(child);
  child.name=(label==='Normal'?'노멀':label==='Lilly White'?'릴리':label==='Axanthic'?'Ax':label).slice(0,16)+' '+(child.stage==='adult'?child.sex==='male'?'수컷':'암컷':child.stage==='hatchling'?'해칭':'아성체');
  const quote=valueGecko(child,table);
  return {id,individual:child,askPrice:quote.ask,marketBase:quote.marketBase,marketVersion:quote.marketVersion,
    purchased:false,family:{version:1,seed:childSeed,matingTurn,father,mother}};
}

export function refreshFamilyShop(game:HardcoreGame,table:PriceTable=MARKET):void {
  const batch=(game.shop.batch??0)+1;
  const offers=Array.from({length:SHOP_SIZE},(_,n)=>familyOffer(game,batch,n,table));
  game.shop={date:game.lastDate,batch,offers:Object.fromEntries(offers.map(o=>[o.id,o]))};game.marketVersion=table.version;
}

/** Preserve actual old offers and their unknown parentage; never invent their relatives. */
export function migrateShop(game:HardcoreGame):HardcoreGame {
  if(game.saveVersion>=7)return game;
  const next=structuredClone(game);next.saveVersion=7;
  const offers=Object.values(next.shop.offers).slice(0,SHOP_SIZE).map(o=>({...o,family:null,purchased:false}));
  for(let n=offers.length;n<SHOP_SIZE;n++)offers.push(familyOffer(next,0,n) as typeof offers[number]);
  next.shop={date:next.lastDate,batch:0,offers:Object.fromEntries(offers.map(o=>[o.id,o]))};
  return next;
}
