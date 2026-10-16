import {comparisonSubject} from '@/engine/regional/fixtures';
import {regionalObservation,regionalAppearance} from '@/engine/regional';
import {anatomy} from '@/engine/regional/anatomy';
import {tendBrood} from './helpers/tend-brood';
import {preRiskRecord} from './helpers/risk-projection';
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
 const t=patternTraits(exampleGenome(id));return {genome:exampleGenome(id),schemaVersion:1,id,name:id,seed,state:{fire:"up"},appearance:{bodyColor:"orange",patternStyle:"harlequin",dorsalCoverage:t.dorsal,flankCoverage:t.flank,spotCount:Math.min(70,t.spots.count),patterns:t}};
};
test.each(PATTERN_EXAMPLES)("$title geometry intent remains deterministic and production observes its final v2 materials",e=>{
 const w=wire(e.id),t=w.appearance.patterns!,p=buildPatternPlan(t,w.seed),n=classifyPattern(t,p.observation),r=renderSprite(w);
 expect([n.primary,...n.features].join(" · ")).toContain(e.title);expect(r.version).toBe("regional-2");
 const observed=regionalObservation({genome:w.genome!,seed:w.seed});
 expect(appearanceProfile({...comparisonSubject(w.genome!,w.seed),genetics:{...comparisonSubject(w.genome!,w.seed).genetics!,appearanceVersion:'regional-2'}})!.observation).toEqual(observed.observation);
 for(let i=0;i<9216;i++)if(p.spots[i]&&anatomy.skin[i])expect(r.layers[6].mask[i]).toBe(255);
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
  if(anatomy.protectedPixels[i])for(const layer of r.layers.slice(4,7))if(layer.mask[i])protectedPaint++;
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
test("shared geometry preserves richer flank, three pigment intents, descending drips and continuous wall",()=>{
 const plan=(id:string)=>buildPatternPlan(wire(id).appearance.patterns!,wire(id).seed);
 expect(plan("extreme").observation.flank).toBeGreaterThan(plan("harlequin").observation.flank+.10);
 const tri=plan("tricolor").observation;expect(Math.min(tri.baseArea,tri.creamArea,tri.secondaryArea)).toBeGreaterThan(.10);
 expect(plan("drippy").observation.drips).toBeGreaterThanOrEqual(3);expect(plan("wall").observation.wall).toBeGreaterThan(.2);
 expect(hash(renderSprite(wire("tiger")).pixels)).not.toBe(hash(renderSprite(wire("brindle")).pixels));
});
test("measured pigment areas exclude the actual visible spot pixels",()=>{
 const w=wire('tricolor');for(let n=0;n<6;n++)w.genome!.polygenic.loci['spots-'+n]=[4,4];
 const r=regionalAppearance({genome:w.genome!,seed:w.seed}),o=regionalObservation({genome:w.genome!,seed:w.seed}).observation;
 const skin=anatomy.skin.filter(Boolean).length,spotPixels=r.materials.filter(v=>v===5).length;
 expect(spotPixels).toBeGreaterThan(80);expect(o.baseArea+o.creamArea+o.secondaryArea).toBeCloseTo(1-spotPixels/skin,12);expect(o.spots).toBeGreaterThan(48);
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
 const selected=patternSelectionExperiment(seed,true,6,32),neutral=patternSelectionExperiment(seed,false,6,32),s=selected.at(-1)!,n=neutral.at(-1)!;
 expect(s.mean).toBeGreaterThan(n.mean+.12);expect(s.fullRate).toBeGreaterThanOrEqual(n.fullRate);expect(s.visibleQuality).toBeGreaterThan(n.visibleQuality+.12);
 // Population experiment tests alleles; it does not override gameplay kinship protection.
},30_000);
test("new-model game egg identity, naming, rendered pixels, ancestry and quotations survive hatch, growth and JSON reload",()=>{
 let game=newGame("pattern-game-loop","2026-10-14",{initialMoney:10_000_000,initialCapacity:20});
 const [f,m]=Object.keys(game.shop.offers);for(const id of [f,m])game=act(game,{type:"buyGecko",offerId:id},game.lastDate);
 game=act(game,{type:"buyFood",amount:100},game.lastDate);game=act(game,{type:"breed",fatherId:f,motherId:m},game.lastDate);
 const mating=Object.values(game.matings)[0],embryos=mating.lifecycle!.offspring;
 for(let n=0;n<18;n++)game=tendBrood(actWithTime(game,{type:"endTurn"},game.lastDate));
 const original=exportBackup(game),loaded=parseBackup(original,game.lastDate);expect(loaded).toEqual(game);
 for(const id of [f,m,...embryos.map(o=>o.embryo.id).filter(id=>game.individuals[id])]){
  const a=game.individuals[id],b=loaded.individuals[id];expect(morph(a)).toBe(morph(b));expect(visualName(a)).toBe(visualName(b));expect(appearanceProfile(a)).toEqual(appearanceProfile(b));
  expect(hash(renderSprite(specimen(a)).pixels)).toBe(hash(renderSprite(specimen(b)).pixels));expect(valueGecko(a)).toEqual(valueGecko(b));
 }
 expect(game.individuals[f].genetics!.appearanceVersion).toBe("regional-2");
 for(const o of embryos)if(game.individuals[o.embryo.id]){expect(game.individuals[o.embryo.id].genetics!.genome).toEqual(o.embryo.genetics!.genome);expect(game.individuals[o.embryo.id].stage).toBe("adult");}
 const a=game.individuals[f],renamed={...a,name:"비싼 풀핀 슈퍼달마시안"};expect(valueGecko(renamed)).toEqual(valueGecko(a));
 expect(exportBackup(game)).toBe(original);
});
test("pre-regional save files require an explicit new game and are not rewritten",()=>{
 for(const file of ['pre-pattern-v7.json','three-clutch-v6.json']){
  const raw=readFileSync('tests/fixtures/'+file,'utf8');
  const values=file==='three-clutch-v6.json'?Object.values(JSON.parse(raw)):[JSON.parse(raw)];
  for(const value of values)expect(()=>parseBackup(JSON.stringify(value),'2026-10-17')).toThrow('새 게임');
  expect(readFileSync('tests/fixtures/'+file,'utf8')).toBe(raw);
 }
});
