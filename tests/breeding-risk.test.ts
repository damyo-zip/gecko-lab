import { expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { pedigreeCoefficient, pedigreeRelationship } from '@/game/pedigree-risk';
import type { Individual } from '@/game/model';
import { founderHealth, inheritHealth, healthEffects, HEALTH_LOCI, type HealthGenome } from '@/genetics/health';
import { seededRandom } from '@/genetics/random';
import { newGame, act } from '@/game/hardcore/play';
import { actWithTime } from '@/game/hardcore/time-source';
import { breedingCheck, startMating } from '@/game/hardcore/breeding';
import { breedingRisk } from '@/game/hardcore/breeding-risk';
import { founderRecord, cachedGenotype, legacyRecord } from '@/game/hardcore/genetics';
import { legacyTraits } from '@/genetics/advanced/phenotype';
import { polyScores } from '@/genetics/advanced/polygenic';
import { inherit, cross } from '@/genetics/advanced/inheritance';
import { lillyGenotype } from '@/genetics/mendel';
import { expandedGenotype } from '@/genetics/hardcore';
import { freeSlots, reserved } from '@/game/hardcore/survival';
import { createEmbryo } from '@/game/hardcore/offspring';
import { seasonEvents, seasonEggSeed } from '@/game/hardcore/season';
import { eggFailure, bornIndividual, fertileChance } from '@/game/hardcore/egg-outcome';
import { makeSave, readSave, checksum, exportBackup, parseBackup } from '@/game/hardcore/save';
import { validateGame } from '@/game/hardcore/validation';
import { renderSprite } from '@/engine/render';
import { specimen, visualName } from '@/game/hardcore/adapter';
import type { Gecko, HardcoreGame } from '@/game/hardcore/model';
import { breedingRiskFixture } from '../e2e/fixtures/breeding-risk';
import {migrateAlbum} from '@/game/hardcore/migrate-album';
import { LOCI, wildGenome } from '@/genetics/advanced/loci';
const DATE='2026-10-14';
const normalHealth=():HealthGenome=>({version:1 as const,loci:Object.fromEntries(HEALTH_LOCI.map(l=>[l.id,['N','N'] as const]))});
function pedigree(){const p:Record<string,Individual>={};const add=(id:string,f?:string,m?:string)=>p[id]={id,parents:f&&m?{fatherId:f,motherId:m}:null} as Individual;return {p,add};}
function pair(seed='risk-game'){
 let g=newGame(seed,DATE,{initialMoney:5_000_000,initialCapacity:30});const [father,mother]=Object.keys(g.shop.offers);
 for(const id of [father,mother])g=act(g,{type:'buyGecko',offerId:id},DATE);
 g.food=1000;return {g,father,mother};
}
function knownPair(seed='lilly-risk'){
 const {g,father,mother}=pair(seed);
 // Tests use actual founder factory without claiming a seller pedigree.
 const source=structuredClone(g.shop.offers);
 for(const id of [father,mother]){const owned=g.individuals[id];owned.parents=null;owned.generation=1;owned.genetics=founderRecord(expandedGenotype(lillyGenotype()),id);owned.genotype=cachedGenotype(owned.genetics,owned.genotype);owned.potential=legacyTraits(polyScores(owned.genetics.genome!.polygenic));owned.healthGenome=normalHealth();}
 // Refresh real catalog so edited testing founders are independent of immutable purchase receipts.
 g.shop.offers=source;
 for(const id of [father,mother])delete g.individuals[g.shop.offers[id].family!.father.id];
 for(const id of [father,mother])delete g.individuals[g.shop.offers[id].family!.mother.id];
 // Refresh via common engine requires prevalidation, so use repository stock generator for this test fixture.
 return {g,father,mother};
}
import { refreshFamilyShop } from '@/game/hardcore/shop-family';
function riskyPair(seed='lilly-risk') {const r=knownPair(seed);refreshFamilyShop(r.g);validateGame(r.g);return r;}
const turns=(g:HardcoreGame,n:number)=>{for(let i=0;i<n;i++)g=actWithTime(g,{type:'endTurn'},DATE);return g;};
const mate=(g:HardcoreGame,f:string,m:string)=>act(g,{type:'breed',fatherId:f,motherId:m,riskAcknowledgement:breedingRisk(g,g.individuals[f],g.individuals[m]).acknowledgement},g.lastDate);

test('full siblings, half siblings, cousins, lineal and distant ancestors have exact recorded-pedigree F with explicit founder assumptions',()=>{
 const {p,add}=pedigree();for(const id of ['f','m','x','y'])add(id);add('a','f','m');add('b','f','m');add('half','f','x');add('cousin1','a','x');add('cousin2','b','y');
 expect(pedigreeCoefficient('a','b',p).coefficient).toBe(.25);expect(pedigreeCoefficient('a','half',p).coefficient).toBe(.125);
 expect(pedigreeCoefficient('cousin1','cousin2',p).coefficient).toBe(.0625);expect(pedigreeCoefficient('f','a',p).coefficient).toBe(.25);
 expect(pedigreeCoefficient('f','m',p)).toMatchObject({coefficient:0,founderAssumptions:2});
 expect(pedigreeRelationship(p.a,p.b,p)).toBe('친형제자매');expect(pedigreeRelationship(p.a,p.half,p)).toBe('이복형제자매');expect(pedigreeRelationship(p.cousin1,p.cousin2,p)).toBe('사촌 관계');
 add('d1','cousin1','x');add('d2','cousin2','y');expect(pedigreeRelationship(p.d1,p.d2,p)).toBe('먼 공통 조상');expect(pedigreeCoefficient('d1','d2',p).coefficient).toBeGreaterThan(0);
});
test('repeated sib matings include already inbred ancestors; coefficient is not a generation count',()=>{
 const {p,add}=pedigree();add('f');add('m');let f='f',m='m';const observed:number[]=[];
 for(let n=0;n<6;n++){const a='male'+n,b='female'+n;add(a,f,m);add(b,f,m);observed.push(pedigreeCoefficient(a,b,p).coefficient);f=a;m=b;}
 expect(observed.slice(0,4)).toEqual([.25,.375,.5,.59375]);expect(observed[5]).toBeGreaterThan(observed[4]);
});
test('sparse recursion matches an independent dense tabular oracle on a collapsed random 150-animal pedigree and rejects cycles',()=>{
 const {p,add}=pedigree(),a:number[][]=[],rng=seededRandom('pedigree-oracle','pedigree');
 for(let i=0;i<150;i++){
  const f=i<8?-1:Math.floor(rng()*i),m=i<8?-1:Math.floor(rng()*i);add('g'+i,f<0?undefined:'g'+f,m<0?undefined:'g'+m);
  a[i]=[];for(let j=0;j<i;j++){a[i][j]=f<0?0:(a[f][j]+a[m][j])/2;a[j][i]=a[i][j];}a[i][i]=1+(f<0?0:a[f][m]/2);
 }
 for(let i=0;i<150;i+=7)for(let j=0;j<150;j+=11)expect(pedigreeCoefficient('g'+i,'g'+j,p).coefficient).toBeCloseTo(a[i][j]/2,12);
 p.g0.parents={fatherId:'g149',motherId:'g1'};expect(()=>pedigreeCoefficient('g0','g1',p)).toThrow('순환');
});
test('deep ancestry calculation avoids the JS call stack',()=>{
 const {p,add}=pedigree();add('f');add('m');let f='f';for(let n=0;n<1800;n++){const id='deep'+n;add(id,f,'m');f=id;}
 expect(pedigreeCoefficient(f,'m',p).coefficient).toBeCloseTo(.5);expect(pedigreeCoefficient(f,'m',p).coefficient).toBeGreaterThan(0);
});
test('fictional variants segregate 1:2:1, carriers remain unaffected and distinct homozygous loci affect distinct outcomes',()=>{
 const f=normalHealth();for(const l of HEALTH_LOCI)f.loci[l.id]=['N',l.mutant];const count=[0,0,0];
 for(let n=0;n<20_000;n++){const child=inheritHealth(f,f,'health-stat-'+n);count[child.loci['embryonic-vigor'].filter(a=>a==='v').length]++;expect(f.loci.fertility).toContain(child.loci.fertility[0]);}
 for(let i=0;i<3;i++)expect(Math.abs(count[i]/20_000-[.25,.5,.25][i])).toBeLessThan(.02);
 expect(healthEffects(f)).toMatchObject({hatchFactor:1,fertilityFactor:1});const v=normalHealth();v.loci['embryonic-vigor']=['v','v'];expect(healthEffects(v)).toMatchObject({hatchFactor:.75,fertilityFactor:1});
 const fertility=normalHealth();fertility.loci.fertility=['f','f'];expect(healthEffects(fertility)).toMatchObject({hatchFactor:1,fertilityFactor:.8});
 expect(inheritHealth(f,f,'same')).toEqual(inheritHealth(f,f,'same'));expect(founderHealth('same')).toEqual(founderHealth('same'));expect(new Set(Array.from({length:100},(_,n)=>JSON.stringify(founderHealth('founder-'+n)))).size).toBeGreaterThan(1);
});
test('Lilly crosses are permitted, require acknowledgement, preserve two reserved slots and independently fail lethal embryos after exactly four incubation turns',()=>{
 let found=false;
 for(let n=0;n<30&&!found;n++){
  let {g,father,mother}=riskyPair('lilly-split-'+n);const risk=breedingRisk(g,g.individuals[father],g.individuals[mother]);
  expect(risk.warnings.map(w=>w.code)).toEqual(['lilly']);expect(risk.warnings[0].message).toContain('25.0%');expect(breedingCheck(g,father,mother).reasons).toEqual([]);
  const before=structuredClone(g);expect(()=>startMating(g,father,mother)).toThrow('위험');expect(g).toEqual(before);
  g=mate(g,father,mother);expect(reserved(g)).toBe(2);const embryos=Object.values(g.matings)[0].lifecycle!.offspring;
  if(!embryos.some(o=>o.fertilized&&!o.embryo.development!.viable)||!embryos.some(o=>o.fertilized&&o.embryo.development!.viable))continue;
  const frozen=structuredClone(embryos);g=turns(g,2);expect(Object.values(g.eggs)).toHaveLength(2);expect(reserved(g)).toBe(2);
  expect(parseBackup(exportBackup(g),DATE)).toEqual(g);g=turns(g,3);expect(Object.values(g.eggs).every(e=>e.status==='incubating')).toBe(true);
  g=turns(g,1);for(const egg of Object.values(g.eggs))if(!egg.embryo.development!.viable){expect(egg.lifecycle!.failure).toBe('genetic');expect(g.individuals[egg.embryo.id]).toBeUndefined();expect(()=>bornIndividual(egg.embryo)).toThrow('비생존');}
  expect(Object.values(g.matings)[0].lifecycle!.offspring).toEqual(frozen);expect(reserved(g)).toBe(0);expect(freeSlots(g)).toBe(g.capacity-Object.values(g.individuals).filter(x=>x.status==='owned').length);
  const resolved=structuredClone(g);seasonEvents(g);expect(g).toEqual(resolved);expect(parseBackup(exportBackup(g),DATE)).toEqual(g);found=true;
 }expect(found).toBe(true);
});
test('20,000 advanced Lilly crosses reproduce 25:50:25, with distinct conception vs viable denominators and synchronized cached genotype',()=>{
 const f=wildGenome();f.loci['lilly-white']=['n','Lw'];const counts=[0,0,0];
 for(let n=0;n<20_000;n++){const child=inherit(f,f,'lilly-distribution-'+n);counts[child.loci['lilly-white'].filter(a=>a==='Lw').length]++;}
 for(let i=0;i<3;i++)expect(Math.abs(counts[i]/20_000-[.25,.5,.25][i])).toBeLessThan(.02);
 const odds=cross(f,f);expect(odds.nonViableProbability).toBe(.25);expect(odds.outcomes.map(o=>o.viableProbability)).toEqual([1/3,2/3,0]);
 let {g,father,mother}=riskyPair('synchronized');g=mate(g,father,mother);const mating=Object.values(g.matings)[0];
 for(let n=0;n<200;n++){const e=createEmbryo(g,mating,'sync-'+n,'sync-'+n,'배아',6,'2026-11-25');expect(e.genotype).toEqual(cachedGenotype(e.genetics!,e.genotype));expect(e.development!.viable).toBe(!e.genotype.loci['lilly-white'].every(a=>a==='Lw'));}
});
test.each([['C','C'],['C','S'],['C','H'],['S','S'],['S','H'],['H','H']])('complex %s × %s inherits real alleles without invented lethality',(a,b)=>{
 let {g,father,mother}=riskyPair('complex-risk');for(const [id,pair] of [[father,['n',a]],[mother,['n',b]]] as const){const x=g.individuals[id];x.genetics!.genome!.mendelian.loci['lilly-white']=['n','n'];x.genotype=cachedGenotype(x.genetics!,x.genotype);x.genetics!.genome!.mendelian.loci['cappuccino-complex']=pair;x.genetics!.knowledge.loci['lilly-white'].probabilities={'n/n':1};x.genetics!.knowledge.loci['cappuccino-complex'].probabilities={[pair.join('/')]:1};}
 validateGame(g);expect(breedingCheck(g,father,mother).reasons).toEqual([]);expect(breedingRisk(g,g.individuals[father],g.individuals[mother]).warnings.map(w=>w.code)).toEqual(['complex']);g=mate(g,father,mother);
 const mating=Object.values(g.matings)[0],seen=new Set<string>();for(let n=0;n<100;n++){const e=createEmbryo(g,mating,'complex-'+n,'complex-'+n,'배아',6,'2026-11-25');expect(e.development!.viable).toBe(true);seen.add(e.genetics!.genome!.mendelian.loci['cappuccino-complex'].join('/'));}
 expect(seen.has(a+'/'+b)).toBe(true);expect(parseBackup(exportBackup(turns(g,6)),DATE)).toBeDefined();
});
test('public warning/confirmation tokens do not change with secret carrier or health truth; stale acknowledgements are rejected',()=>{
 let {g,father,mother}=riskyPair();const before=breedingRisk(g,g.individuals[father],g.individuals[mother]);g.individuals[father].healthGenome!.loci.fertility=['f','f'];
 expect(breedingRisk(g,g.individuals[father],g.individuals[mother])).toEqual(before);g.revision++;expect(()=>startMating(g,father,mother,before.acknowledgement)).toThrow('위험');
});
test('unknown legacy complex alleles remain unknown while the known parental gamete survives a mixed cross',()=>{
 let {g,father,mother}=riskyPair('partial-legacy');const f=g.individuals[father],m=g.individuals[mother];f.genetics!.genome!.mendelian.loci['cappuccino-complex']=['C','C'];f.genetics!.knowledge.loci['cappuccino-complex'].probabilities={'C/C':1};m.genetics=legacyRecord(m);
 validateGame(g);g=mate(g,father,mother);for(const o of Object.values(g.matings)[0].lifecycle!.offspring){expect(o.embryo.genetics!.genome).toBeNull();expect(o.embryo.genetics!.unresolvedComplex).toEqual(['C',null]);expect(o.embryo.genetics!.knowledge.loci['cappuccino-complex'].probabilities).toBeNull();}
 expect(parseBackup(exportBackup(turns(g,6)),DATE)).toBeDefined();
});
test('ordinary sex, adulthood, retirement, recovery and two-slot requirements still block breeding',()=>{
 const {g,father,mother}=pair();const f=g.individuals[father],m=g.individuals[mother];expect(breedingCheck(g,father,mother).reasons).toEqual([]);
 f.sex='female';expect(breedingCheck(g,father,mother).reasons.join()).toContain('수컷');f.sex='male';f.stage='juvenile';expect(breedingCheck(g,father,mother).reasons.join()).toContain('성체');f.stage='adult';f.birthTurn=g.turn-60;expect(breedingCheck(g,father,mother).reasons.join()).toContain('은퇴');f.birthTurn=g.turn-12;m.nextBreedTurn=1;expect(breedingCheck(g,father,mother).reasons.join()).toContain('회복');m.nextBreedTurn=0;g.capacity=3;expect(breedingCheck(g,father,mother).reasons.join()).toContain('1개 부족');
});
test('v7/v8 migration deterministically adds only health fields; old genomes, pixels, names, failures and pending conception remain unchanged',()=>{
 const envelope=JSON.parse(readFileSync('docs/lineage-reference/baseline-game.json','utf8')),original=structuredClone(envelope);
 const migrated=readSave(envelope,DATE);expect(envelope).toEqual(original);expect(migrated.saveVersion).toBe(9);expect(readSave(envelope,DATE)).toEqual(migrated);
 for(const [id,old] of Object.entries(original.game.individuals) as [string,Gecko][]){const next=migrated.individuals[id];expect(next.genetics).toEqual(old.genetics);expect(next.genotype).toEqual(old.genotype);expect(next.parents).toEqual(old.parents);expect(renderSprite(specimen(next)).pixels).toEqual(renderSprite(specimen(old)).pixels);expect(visualName(next)).toBe(visualName(old));}
 expect(migrated.eggs).toMatchObject(original.game.eggs);expect(readSave(makeSave(migrated),DATE)).toBe(migrated);
 const corrupt=makeSave(structuredClone(migrated));delete Object.values(corrupt.game.individuals)[0].healthGenome;corrupt.checksum=checksum(corrupt.game);expect(()=>readSave(corrupt,DATE)).toThrow();
});

test('real adult siblings and parent/child matings are permitted with combined public warnings; healthy inbred offspring can hatch',()=>{
 let {game:g,fatherId:f,motherId:m,normalId}=breedingRiskFixture();
 const risk=breedingRisk(g,g.individuals[f],g.individuals[m]);expect(risk.pedigree.coefficient).toBe(.25);expect(risk.warnings.map(w=>w.code)).toEqual(['kinship','lilly']);expect(breedingCheck(g,f,m).reasons).toEqual([]);
 expect(breedingRisk(g,g.individuals[normalId],g.individuals[m]).relationship).toBe('부모·자식');expect(breedingCheck(g,normalId,m).reasons).toEqual([]);
 g=mate(g,f,m);g=turns(g,6);const offspring=Object.values(g.eggs).filter(e=>e.matingId===Object.values(g.matings).at(-1)!.id);
 for(const e of offspring){expect(e.embryo.parents).toEqual({fatherId:f,motherId:m});expect(healthEffects(e.embryo.healthGenome!)).toMatchObject({hatchFactor:1,fertilityFactor:1});}
 expect(parseBackup(exportBackup(g),DATE)).toEqual(g);
},30_000);

test('fictional vigor can fail unrelated viable embryos; baseline hatch and genetic lethality remain disjoint causes',()=>{
 let {g,father,mother}=riskyPair('fictional-vigor');
 for(const id of [father,mother]){
  const p=g.individuals[id];p.genetics!.genome!.mendelian.loci['lilly-white']=['n','n'];p.genetics!.knowledge.loci['lilly-white'].probabilities={'n/n':1};p.genotype=cachedGenotype(p.genetics!,p.genotype);p.healthGenome!.loci['embryonic-vigor']=['v','v'];
 }
 expect(breedingRisk(g,g.individuals[father],g.individuals[mother]).warnings).toEqual([]);g=mate(g,father,mother);const mating=Object.values(g.matings)[0],causes=new Set<string|null>();
 for(let n=0;n<200;n++){
  const seed='vigor-egg-'+n,embryo=createEmbryo(g,mating,seed,'vigor-'+n,'배아',6,'2026-11-25');
  const egg={id:embryo.id+'-egg',matingId:mating.id,laidDate:'2026-10-28',dueDate:embryo.birthDate,embryo,hatchChance:.95,seed,status:'incubating' as const,resolvedDate:null,lifecycle:{laidTurn:2,dueTurn:6,fertilized:true,failure:null}};
  const cause=eggFailure(egg);causes.add(cause);expect(embryo.development!.viable).toBe(true);if(cause==='health')expect(seededRandom(seed,'hatch')()).toBeLessThan(.95);
 }
 expect(causes).toEqual(new Set([null,'health','hatch']));
});

test('pending actual v8 conception outcomes and per-egg failures survive v9 migration and future turns unchanged',()=>{
 // This checked-in historical v7 save contains pending embryos produced by the older engine.
 const original=JSON.parse(readFileSync('tests/fixtures/pre-pattern-v7.json','utf8')),old=migrateAlbum(original.game as HardcoreGame);
 const next=readSave(makeSave(old),DATE);expect(Object.values(next.matings).every(m=>m.riskModel===null)).toBe(true);
 const embryos=Object.values(old.matings).flatMap(m=>m.lifecycle?.offspring??[]);
 for(const o of Object.values(next.matings).flatMap(m=>m.lifecycle?.offspring??[])){
  const prior=embryos.find(x=>x.embryo.id===o.embryo.id)!;expect(o.fertilized).toBe(prior.fertilized);expect(o.embryo.genetics).toEqual(prior.embryo.genetics);expect(o.embryo.genotype).toEqual(prior.embryo.genotype);expect(o.embryo.development).toBeUndefined();
 }
 const frozen=structuredClone(next.matings);const advanced=turns(next,6);for(const m of Object.values(advanced.matings))expect(m.lifecycle!.offspring).toEqual(frozen[m.id].lifecycle!.offspring);
 expect(parseBackup(exportBackup(advanced),DATE)).toEqual(advanced);
});

test('current shop supplies actual inherited C/S/H alleles while starter pair, four offers, hidden Ax knowledge and existing pricing remain intact',()=>{
 let g=newGame('playable-complex-stock',DATE,{initialMoney:5_000_000,initialCapacity:30});
 const starter=Object.values(g.shop.offers).slice(0,2);for(const o of starter){expect(o.individual.stage).toBe('adult');expect(o.individual.genetics!.genome!.mendelian.loci['cappuccino-complex']).toEqual(['n','n']);}
 const found=new Set<string>();
 for(let n=0;n<18;n++){
  for(const o of Object.values(g.shop.offers)){
   const pair=o.individual.genetics!.genome!.mendelian.loci['cappuccino-complex'];for(const a of pair)if(a!=='n')found.add(a);
   const f=o.family!;expect(o.individual.genetics!.genome!.mendelian).toEqual(inherit(f.father.genetics!.genome!.mendelian,f.mother.genetics!.genome!.mendelian,f.seed));
  }
  const before=g.money;g=act(g,{type:'refreshShop'},DATE);expect(g.money).toBe(before-2000);expect(Object.values(g.shop.offers)).toHaveLength(4);
 }
 expect(found).toEqual(new Set(['C','S','H']));expect(parseBackup(exportBackup(g),DATE)).toEqual(g);
});

test('fictional fertility homozygotes affect per-egg fertilization, stay eligible and reserve two slots without leaking their health genotype',()=>{
 let {g,father,mother}=riskyPair('fertility-expression');for(const id of [father,mother])g.individuals[id].healthGenome!.loci.fertility=['f','f'];
 const visible=breedingRisk(g,g.individuals[father],g.individuals[mother]);expect(visible.warnings.map(w=>w.code)).toEqual(['lilly']);expect(breedingCheck(g,father,mother).reasons).toEqual([]);
 g=mate(g,father,mother);const m=Object.values(g.matings)[0];expect(fertileChance(m)).toBeCloseTo(.95*.8*.8);expect(m.lifecycle!.offspring).toHaveLength(2);expect(reserved(g)).toBe(2);
 for(const [i,o] of m.lifecycle!.offspring.entries())expect(o.fertilized).toBe(seededRandom(seasonEggSeed(m,1,i+1),'fertilization')()<.95*.8*.8);
 expect(parseBackup(exportBackup(turns(g,6)),DATE)).toBeDefined();
});
