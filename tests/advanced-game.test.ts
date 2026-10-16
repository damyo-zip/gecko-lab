import {readSave as currentReadSave} from '@/game/hardcore/save';
import { expect,test } from "vitest";
import { newGame,act,synchronize } from "./helpers/legacy-hardcore";
import { makeSave,readSave,checksum,exportBackup,parseBackup } from "./helpers/legacy-hardcore";
import { breedingCheck } from "@/game/hardcore/breeding";
import { legacyRecord,publicKnowledge,publicForecast } from "@/game/hardcore/genetics";
import { carrierProbability } from "@/genetics/advanced/inference";
import { legacyTraits } from "@/genetics/advanced/phenotype";
import { polyScores,POLY_IDS } from "@/genetics/advanced/polygenic";
import { valueGecko } from "@/game/hardcore/market";
import { validateGame } from "@/game/hardcore/validation";
import { specimen,morph } from "@/game/hardcore/adapter";
import { renderSprite } from "@/engine/render";
import { addDays } from "@/game/hardcore/time";
import { createNewGame } from "@/game/play";
import { makeSave as phase2Save } from "@/game/save";
import { migrateV2 } from "@/game/hardcore/create";
import type { HardcoreGame,LegacyV4Game } from "@/game/hardcore/model";

const DATE="2026-10-13";
function pair(seed="advanced-game"){
  let g=newGame(seed,DATE,{fertilizationChance:1,hatchChance:1});
  const [father,mother]=Object.keys(g.shop.offers);for(const id of [father,mother])g=act(g,{type:"buyGecko",offerId:id},DATE);
  return {g,father,mother};
}
function legacyV4(game:HardcoreGame):LegacyV4Game {
  const g={...structuredClone(game),saveVersion:4 as const};
  for(const i of [...Object.values(g.individuals),...Object.values(g.eggs).map(e=>e.embryo),...Object.values(g.shop.offers).map(o=>o.individual)])delete i.genetics;
  for(const m of Object.values(g.matings))delete m.genetics;return g;
}
test("unknown legacy Ax is not silently reconstructed as an established AA genotype",()=>{
  const record=legacyRecord({genotype:{modelVersion:1,loci:{"lilly-white":["n","n"]}}});
  expect(record.genome).toBeNull();expect(record.knowledge.loci.axanthic.probabilities).toBeNull();
});
test("same visible phenotype and public evidence produce the same morph, forecast and price despite different hidden truth",()=>{
  const {g,father,mother}=pair(),a=g.individuals[father],b=structuredClone(a);
  b.genotype.loci.axanthic=a.genotype.loci.axanthic.includes("ax")?["A","A"]:["A","ax"];
  b.genetics!.genome!.mendelian.loci.axanthic=b.genotype.loci.axanthic;
  expect(morph(a)).toBe(morph(b));expect(valueGecko(a)).toEqual(valueGecko(b));
  expect(publicForecast(publicKnowledge(a),publicKnowledge(g.individuals[mother]))).toEqual(publicForecast(publicKnowledge(b),publicKnowledge(g.individuals[mother])));
  expect(carrierProbability(publicKnowledge(a))).toBe(.5);
});
test("serialized cross-runtime rounding is accepted while materially altered phenotype is rejected",()=>{
  const {g,father}=pair();g.individuals[father].potential.redIntensity+=Number.EPSILON;
  expect(()=>validateGame(g)).not.toThrow();g.individuals[father].potential.redIntensity+=.001;expect(()=>validateGame(g)).toThrow();
});
test("new game purchase preserves pre-existing genome, inheritance is frozen in eggs and reloading never rerolls",()=>{
  let {g,father,mother}=pair();const f=g.individuals[father].genetics!.genome!,m=g.individuals[mother].genetics!.genome!;
  g=act(g,{type:"breed",fatherId:father,motherId:mother},DATE);g=synchronize(g,addDays(DATE,2));const embryos=structuredClone(g.eggs);
  g=parseBackup(exportBackup(g),g.lastDate);g=synchronize(g,addDays(DATE,3));
  for(const e of Object.values(embryos)){const c=g.individuals[e.embryo.id];expect(c).toEqual(e.embryo);
    for(const id of POLY_IDS){const pair=c.genetics!.genome!.polygenic.loci[id];expect(f.polygenic.loci[id]).toContain(pair[0]);expect(m.polygenic.loci[id]).toContain(pair[1]);}
    expect(c.potential).toEqual(legacyTraits(polyScores(c.genetics!.genome!.polygenic)));
  }expect(g.individuals[father].genetics!.genome).toEqual(f);expect(g.individuals[mother].genetics!.genome).toEqual(m);
  expect(readSave(makeSave(g),g.lastDate)).toEqual(g);
});
test("offspring observations update knowledge once, excluded failures reveal no hidden alleles",()=>{
  let {g,father,mother}=pair();g=act(g,{type:"breed",fatherId:father,motherId:mother},DATE);g=synchronize(g,addDays(DATE,3));
  const log=Object.values(g.matings)[0].genetics!;expect(log.observedIds).toHaveLength(2);expect(log.updates).toHaveLength(2);
  const after=structuredClone(g.individuals[father].genetics);g=synchronize(g,addDays(DATE,4));
  expect(Object.values(g.matings)[0].genetics!.updates).toHaveLength(2);expect(g.individuals[father].genetics).toEqual(after);
  let failed=pair("failed-evidence");failed.g.rules.hatchChance=0;failed.g=act(failed.g,{type:"breed",fatherId:failed.father,motherId:failed.mother},DATE);
  failed.g=synchronize(failed.g,addDays(DATE,3));expect(Object.values(failed.g.matings)[0].genetics!.updates).toEqual([]);
});
test("old pending eggs require a new game and the source backup is preserved",()=>{
 const game=newGame("pre-regional","2026-10-14");
 const raw=exportBackup(game),before=JSON.stringify(game);
 expect(()=>currentReadSave(JSON.parse(raw),"2026-10-14")).toThrow('새 게임');
 expect(JSON.stringify(game)).toBe(before);
});

test("recomputed checksum cannot hide mutated virtual genes, cached phenotype or duplicate inference evidence",()=>{
  let {g,father,mother}=pair();g=act(g,{type:"breed",fatherId:father,motherId:mother},DATE);g=synchronize(g,addDays(DATE,3));
  const child=Object.values(g.individuals).find(i=>i.parents)!;
  const changes=[(x:HardcoreGame)=>{x.individuals[child.id].genetics!.genome!.polygenic.loci[POLY_IDS[0]]=[4,4];},
    (x:HardcoreGame)=>{x.individuals[child.id].potential.redIntensity=.99;},
    (x:HardcoreGame)=>{Object.values(x.matings)[0].genetics!.observedIds.push(child.id);},
    (x:HardcoreGame)=>{x.individuals[father].genetics!.knowledge.loci.axanthic.probabilities={"A/A":.2};}];
  for(const change of changes){const bad=structuredClone(g);change(bad);expect(()=>readSave({format:"gecko-lab-save",version:5,checksum:checksum(bad),game:bad},DATE)).toThrow();}
});
test("provisional C/S/H safety applies before mating without claiming an embryonic lethality percentage",()=>{
  const {g,father,mother}=pair();g.individuals[father].genetics!.genome!.mendelian.loci["cappuccino-complex"]=["n","C"];
  g.individuals[mother].genetics!.genome!.mendelian.loci["cappuccino-complex"]=["n","S"];
  expect(breedingCheck(g,father,mother).reasons.join()).toContain("건강 위험");
});
test("20+ real gameplay generations retain complete virtual/Mendelian genomes through sale, death and backups",()=>{
  let {g,father,mother}=pair("twenty-generations");g.money=100_000_000;g.capacity=120;g.food=10000;
  const founder=father,original=structuredClone(g.individuals[founder].genetics!.genome);
  for(let generation=1;generation<=20;generation++){
    if(generation>1){const descendant=g.individuals[father],offer=Object.values(g.shop.offers).find(o=>o.individual.sex!==descendant.sex&&o.individual.stage==="adult"&&!o.individual.genotype.loci["lilly-white"].includes("Lw"))!;
      g=act(g,{type:"buyGecko",offerId:offer.id},g.lastDate);mother=descendant.sex==="female"?descendant.id:offer.id;father=descendant.sex==="male"?descendant.id:offer.id;
      for(let wait=0;breedingCheck(g,father,mother).reasons.length&&wait<7;wait++){g=synchronize(g,addDays(g.lastDate,1));g=act(g,{type:"feedAll"},g.lastDate);}
    }
    g=act(g,{type:"breed",fatherId:father,motherId:mother},g.lastDate);const mating=Object.values(g.matings).at(-1)!;
    for(let day=0;day<4;day++){g=synchronize(g,addDays(g.lastDate,1));g=act(g,{type:"feedAll"},g.lastDate);}
    const children=Object.values(g.eggs).filter(e=>e.matingId===mating.id).map(e=>g.individuals[e.embryo.id]);expect(children.every(c=>c.generation===generation+1)).toBe(true);
    father=children[0].id;g=parseBackup(exportBackup(g),g.lastDate);
  }
  g=act(g,{type:"sell",id:founder},g.lastDate);const dead=Object.values(g.individuals).find(i=>i.status==="owned"&&i.id!==father)!;dead.hearts=1;
  g=synchronize(g,addDays(g.lastDate,1));expect(g.individuals[dead.id].status).toBe("dead");expect(g.individuals[founder].genetics!.genome).toEqual(original);
  expect(g.individuals[father].generation).toBe(21);validateGame(g);expect(readSave(makeSave(g),g.lastDate)).toEqual(g);
},60_000);
