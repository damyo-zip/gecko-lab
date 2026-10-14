import {test,expect} from "vitest";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {newGame as oldGame,act as oldAct} from "./helpers/legacy-hardcore";
import {patternTraits} from "@/genetics/advanced/pattern-traits";
import {PATTERN_EXAMPLES,exampleGenome} from "@/genetics/advanced/pattern-examples";
import {founderPoly,inheritPoly,POLY_IDS} from "@/genetics/advanced/polygenic";
import {wildGenome} from "@/genetics/advanced/loci";
import {classifyPattern,fullLine} from "@/phenotype/names";
import {buildPatternPlan,patternCacheSize,patternSkinPixel} from "@/engine/pattern-plan";
import {renderSprite} from "@/engine/render";
import {createBaseSprite} from "@/engine/art";
import {specimen,morph,visualName} from "@/game/hardcore/adapter";
import {appearanceProfile} from "@/game/hardcore/appearance";
import {newGame,act} from "@/game/hardcore/play";
import {actWithTime} from "@/game/hardcore/time-source";
import {exportBackup,parseBackup} from "@/game/hardcore/save";
import {valueGecko} from "@/game/hardcore/market";
import {patternSelectionExperiment} from "@/game/hardcore/pattern-experiment";
import type {Genome,PolyGenome} from "@/genetics/advanced/model";
import type {GeckoSpecimen} from "@/engine/model";
const hash=(v:Uint8ClampedArray)=>createHash("sha256").update(v).digest("hex");
const wire=(id:string,seed="patterns-v1|"+id):GeckoSpecimen=>{
 const t=patternTraits(exampleGenome(id));return {schemaVersion:1,id,name:id,seed,state:{fire:"up"},appearance:{bodyColor:"orange",patternStyle:"harlequin",dorsalCoverage:t.dorsal,flankCoverage:t.flank,spotCount:Math.min(70,t.spots.count),patterns:t}};
};
test.each(PATTERN_EXAMPLES)("$title is named from actual anatomical pixels, never its fixture title",e=>{
 const w=wire(e.id),t=w.appearance.patterns!,p=buildPatternPlan(t,w.seed),n=classifyPattern(t,p.observation),r=renderSprite(w);
 expect([n.primary,...n.features].join(" · ")).toContain(e.title);expect(r.version).toBe("2.1.0");
 for(let i=0;i<9216;i++){if(p.pins[i])expect(r.layers[5].mask[i]).toBe(255);if(p.spots[i])expect(r.layers[6].mask[i]).toBe(255);}
 expect(p.spotCenters.length).toBe(p.observation.spots);expect(hash(r.pixels)).toBe(hash(renderSprite(w).pixels));
});
test("same genes render twelve distinct seeds with invariant anatomy, protected iris/pupil and bounded cache",()=>{
 const b=createBaseSprite(),outputs=Array.from({length:12},(_,n)=>renderSprite(wire("harlequin","individual-"+n)));
 expect(new Set(outputs.map(r=>hash(r.pixels))).size).toBe(12);
 for(let n=0;n<140;n++){const w=wire("harlequin","cache-"+n);buildPatternPlan(w.appearance.patterns!,w.seed);}expect(patternCacheSize()).toBeLessThanOrEqual(128);
 let alphaErrors=0,eyeErrors=0,protectedPaint=0;
 for(const r of outputs)for(let i=0;i<9216;i++){
  if(r.pixels[i*4+3]!==b.silhouette[i])alphaErrors++;
  if(b.eye[i])for(let c=0;c<4;c++)if(r.pixels[i*4+c]!==outputs[0].pixels[i*4+c])eyeErrors++;
  if(!patternSkinPixel(i))for(const layer of r.layers.slice(4,7))if(layer.mask[i])protectedPaint++;
 }
 expect({alphaErrors,eyeErrors,protectedPaint}).toEqual({alphaErrors:0,eyeErrors:0,protectedPaint:0});
});
test("full pin requires both actual complete paths; high requested connection, one-sided or internal holes cannot masquerade as full",()=>{
 const w=wire("full"),t=w.appearance.patterns!,o=structuredClone(buildPatternPlan(t,w.seed).observation);
 expect(o.pin.every(fullLine)).toBe(true);
 const gap={...o.pin[1],coverage:25/26,longestRun:13,gapCount:1};
 const n=classifyPattern(t,{...o,pin:[o.pin[0],gap]});expect(n.features).not.toContain("풀 핀스트라이프");expect(n.features).toContain("파셜 핀스트라이프");
 const q=wire("quad"),plan=buildPatternPlan(q.appearance.patterns!,q.seed);
 expect(plan.observation.pin.every(fullLine)).toBe(true);expect(plan.observation.side.every(s=>s.coverage>=.9)).toBe(true);
 expect(plan.pins.filter(Boolean).length).toBeGreaterThan(buildPatternPlan(t,w.seed).pins.filter(Boolean).length);
});
test("extreme has measurably richer flank than harlequin; three distinct pigment regions, descending drips and continuous wall actually render",()=>{
 const plan=(id:string)=>buildPatternPlan(wire(id).appearance.patterns!,wire(id).seed);
 expect(plan("extreme").observation.flank).toBeGreaterThan(plan("harlequin").observation.flank+.10);
 const tri=plan("tricolor").observation;expect(Math.min(tri.baseArea,tri.creamArea,tri.secondaryArea)).toBeGreaterThan(.10);
 expect(plan("drippy").observation.drips).toBeGreaterThanOrEqual(3);expect(plan("wall").observation.wall).toBeGreaterThan(.2);
 expect(hash(renderSprite(wire("tiger")).pixels)).not.toBe(hash(renderSprite(wire("brindle")).pixels));
});
test("tricolor color areas exclude actual black spot pixels rather than counting them as visible base pigment",()=>{
 const w=wire("tricolor"),traits={...w.appearance.patterns!,spots:{count:80,size:.5}},plan=buildPatternPlan(traits,w.seed);
 const skin=Array.from({length:9216},(_,i)=>i).filter(patternSkinPixel).length;
 const visibleSpots=renderSprite({...w,appearance:{...w.appearance,patterns:traits}}).layers[6].mask.filter(Boolean).length;
 expect(visibleSpots).toBeGreaterThan(80);
 const o=plan.observation;expect(o.baseArea+o.creamArea+o.secondaryArea).toBeCloseTo(1-visibleSpots/skin,12);
});
test("all five color groups have distinct body palettes and Ax/Lilly override expression without revealing carrier truth",()=>{
 const colors=new Map<string,string>();
 for(const [id,changes] of Object.entries({red:{red:4},orange:{orange:4,red:0},yellow:{orange:0,red:0},cream:{cream:4,brightness:4,red:0,orange:0},dark:{brightness:0,red:0}})){
  const g=exampleGenome("patternless");for(const [f,a] of Object.entries(changes))for(let n=0;n<6;n++)g.polygenic.loci[f+"-"+n]=[a,a];
  const t=patternTraits(g);colors.set(t.color,t.palette.base.join());expect(t.color).toBe({red:"레드",orange:"오렌지",yellow:"옐로",cream:"크림",dark:"다크"}[id]);
 }
 expect(new Set(colors.values()).size).toBe(5);
 const g=exampleGenome("tricolor");g.mendelian.loci.axanthic=["ax","ax"];expect(patternTraits(g).color).toBe("회색");
 g.mendelian.loci["lilly-white"]=["n","Lw"];expect(patternTraits(g).cream).toBeGreaterThan(.8);
});
test("siblings inherit one actual allele from each parent and differ in genotype/geometry; names never participate in inheritance",()=>{
 const f=founderPoly("sib-f"),m=founderPoly("sib-m"),children=Array.from({length:40},(_,n)=>inheritPoly(f,m,"siblings|"+n));
 for(const c of children)for(const id of POLY_IDS){expect(f.loci[id]).toContain(c.loci[id][0]);expect(m.loci[id]).toContain(c.loci[id][1]);}
 expect(new Set(children.map(c=>JSON.stringify(c))).size).toBeGreaterThan(30);
 const traits=children.map(polygenic=>patternTraits({version:1,mendelian:wildGenome(),polygenic}));expect(new Set(traits.map(t=>t.pin.join())).size).toBeGreaterThan(10);
});
test.each(["pin-selection-a","pin-selection-b","pin-selection-c"])("%s: phenotypic selection accumulates pin alleles and increases actual full-pin frequency versus neutral control",seed=>{
 const selected=patternSelectionExperiment(seed,true),neutral=patternSelectionExperiment(seed,false),s=selected.at(-1)!,n=neutral.at(-1)!;
 expect(s.mean).toBeGreaterThan(n.mean+.25);expect(s.fullRate).toBeGreaterThan(n.fullRate+.15);expect(s.visibleQuality).toBeGreaterThan(n.visibleQuality+.25);
 // Population experiment tests alleles; it does not override gameplay kinship protection.
},30_000);
test("new-model game egg identity, naming, rendered pixels, ancestry and quotations survive hatch, growth and JSON reload",()=>{
 let game=newGame("pattern-game-loop","2026-10-14",{initialMoney:10_000_000,initialCapacity:20});
 const [f,m]=Object.keys(game.shop.offers);for(const id of [f,m])game=act(game,{type:"buyGecko",offerId:id},game.lastDate);
 game=act(game,{type:"buyFood",amount:100},game.lastDate);game=act(game,{type:"breed",fatherId:f,motherId:m},game.lastDate);
 const mating=Object.values(game.matings)[0],embryos=mating.lifecycle!.offspring;
 for(let n=0;n<18;n++)game=actWithTime(game,{type:"endTurn"},game.lastDate);
 const original=exportBackup(game),loaded=parseBackup(original,game.lastDate);expect(loaded).toEqual(game);
 for(const id of [f,m,...embryos.map(o=>o.embryo.id).filter(id=>game.individuals[id])]){
  const a=game.individuals[id],b=loaded.individuals[id];expect(morph(a)).toBe(morph(b));expect(visualName(a)).toBe(visualName(b));expect(appearanceProfile(a)).toEqual(appearanceProfile(b));
  expect(hash(renderSprite(specimen(a)).pixels)).toBe(hash(renderSprite(specimen(b)).pixels));expect(valueGecko(a)).toEqual(valueGecko(b));
 }
 expect(game.individuals[f].genetics!.appearanceVersion).toBe("patterns-1");
 for(const o of embryos)if(game.individuals[o.embryo.id]){expect(game.individuals[o.embryo.id].genetics!.genome).toEqual(o.embryo.genetics!.genome);expect(game.individuals[o.embryo.id].stage).toBe("adult");}
 const a=game.individuals[f],renamed={...a,name:"비싼 풀핀 슈퍼달마시안"};expect(valueGecko(renamed)).toEqual(valueGecko(a));
 expect(exportBackup(game)).toBe(original);
});
test("actual pre-upgrade v7 save preserves frozen appearance version, all genomes, quotations and pending breeding records",()=>{
 const envelope=JSON.parse(readFileSync("tests/fixtures/pre-pattern-v7.json","utf8")),loaded=parseBackup(JSON.stringify(envelope),"2026-10-14");
 expect(loaded).toEqual(envelope.game);
 for(const o of Object.values(loaded.shop.offers)){expect(o.individual.genetics!.appearanceVersion).toBe("5.0");expect(specimen(o.individual).appearance.patterns).toBeUndefined();expect(renderSprite(specimen(o.individual)).version).toBe("2.0.1");}
});
test("pending actual v5 and historical v6 embryos replay their saved appearance version in v7 validation without rerolling",()=>{
 let old=oldGame("v5-live","2026-10-14",{initialCapacity:20});const [f,m]=Object.keys(old.shop.offers);
 for(const id of [f,m])old=oldAct(old,{type:"buyGecko",offerId:id},old.lastDate);
 old=oldAct(old,{type:"breed",fatherId:f,motherId:m},old.lastDate);old.time.mode="realtime";
 const upgraded=parseBackup(exportBackup(old),"2026-10-14");expect(upgraded.saveVersion).toBe(7);
 const frozen=Object.values(upgraded.matings)[0].lifecycle!.offspring.map(o=>({genetics:o.embryo.genetics,pixels:hash(renderSprite(specimen(o.embryo)).pixels)}));
 const reread=parseBackup(exportBackup(upgraded),"2026-10-14");expect(reread).toEqual(upgraded);
 expect(Object.values(reread.matings)[0].lifecycle!.offspring.map(o=>({genetics:o.embryo.genetics,pixels:hash(renderSprite(specimen(o.embryo)).pixels)}))).toEqual(frozen);
 const fixtures=JSON.parse(readFileSync("tests/fixtures/three-clutch-v6.json","utf8"));
 for(const envelope of Object.values(fixtures)){
  const migrated=parseBackup(JSON.stringify(envelope),"2026-10-14");expect(parseBackup(exportBackup(migrated),"2026-10-14")).toEqual(migrated);
  for(const mating of Object.values(migrated.matings))for(const o of mating.lifecycle?.offspring??[])expect(o.embryo.genetics!.appearanceVersion).toBe("5.0");
 }
});
