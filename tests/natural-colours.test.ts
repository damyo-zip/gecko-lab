import {test,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {naturalColours} from '@/game/hardcore/natural-colours';
import {newForgeGame,act} from '@/game/hardcore/play';
import {parseForgeBackup,exportBackup,makeSave,readForgeSave} from '@/game/hardcore/save';
import {forgeView} from '@/game/hardcore/forge-appearance';
import {specimen} from '@/game/hardcore/adapter';
import {forgeSurface} from '@/forge/surface';
import {actWithTime} from '@/game/hardcore/time-source';
import {validateGame} from '@/game/hardcore/validation';
import {validateForge} from '@/game/hardcore/forge-genetics';
import {founderPatternColour,inheritPatternColour,patternColourWarmth,validatePatternColour,validatePatternColourChild} from '@/game/hardcore/colour-genetics';
import {inheritPoly} from '@/genetics/advanced/polygenic';
import {inherit} from '@/genetics/advanced/inheritance';
import {offspringRecord} from '@/game/hardcore/genetics';
import {createCompanionPatternsFounder} from '@/forge/engine/companion-patterns-breeding';
import {legacyTraits} from '@/genetics/advanced/phenotype';
import {polyScores} from '@/genetics/advanced/polygenic';
import {unknownKnowledge} from '@/genetics/advanced/inference';
import {B_ORIGIN_01 as source} from '@/forge/engine/art/b-origin-01';
import pixels from './fixtures/natural-colours/previous-pixels.json';
import type {Gecko} from '@/game/hardcore/model';

const DATE='2026-10-23',backup=readFileSync('tests/fixtures/natural-colours/previous-backup.json','utf8');
const legacy=parseForgeBackup(backup,DATE),hash=(data:Uint8ClampedArray)=>createHash('sha256').update(data).digest('hex');
const template=Object.values(legacy.individuals).find(g=>g.parents===null)!;
function sample(morph:'base'|'lilly'|'axanthic'|'dalmatian'|'select-harlequin'|'tiger',seed:string):Gecko{
 const f=createCompanionPatternsFounder({id:seed,seed,name:seed,sex:'female',morph});
 return{...structuredClone(template),id:seed,name:seed,parents:null,visualSeed:f.visualSeed,
  genotype:{modelVersion:1,loci:{'lilly-white':f.genome.mendelian.loci['lilly-white'],axanthic:f.genome.mendelian.loci.axanthic}},
  potential:legacyTraits(polyScores(f.genome.polygenic)),
  genetics:{version:1,genome:f.genome,knowledge:unknownKnowledge(),appearanceVersion:'patterns-1',forge:{version:1,paletteVersion:2,patternColour:founderPatternColour(seed),...(f.extensions?{extensions:f.extensions}:{})}},
 };
}

test('bounded natural families cover dark/light warm/neutral material colours without invalid RGB',()=>{
 const colours=[];
 for(const red of[0,.2,.4,.6,.8,1])for(const orange of[0,.2,.4,.6,.8,1])for(const brightness of[0,.2,.4,.6,.8,1]){
  const c=naturalColours({red,orange,brightness},'up',orange);colours.push(c);
  for(const rgb of Object.values(c))expect(rgb.every(v=>Number.isInteger(v)&&v>=0&&v<=255)).toBe(true);
 }
 const distance=(a:readonly number[],b:readonly number[])=>Math.hypot(...a.map((v,n)=>v-b[n]));
 expect(Math.max(...colours.map(c=>distance(c.body,[57,52,50])))).toBeGreaterThan(160);
 expect(Math.max(...colours.map(c=>distance(c.pattern,[242,238,226])))).toBeGreaterThan(120);
 for(const value of[NaN,Infinity,-.1,1.1])expect(()=>naturalColours({red:value,orange:.5,brightness:.5})).toThrow();
 expect(()=>naturalColours({red:.5,orange:.5,brightness:.5},'unknown' as 'up')).toThrow();
});

test('cream controls area, independent warmth controls pattern hue, orange retains a distinct secondary material',()=>{
 const a=sample('select-harlequin','natural-area'),b=structuredClone(a),c=structuredClone(a),d=structuredClone(a);
 for(let n=0;n<6;n++){a.genetics!.genome!.polygenic.loci['cream-'+n]=[0,0];b.genetics!.genome!.polygenic.loci['cream-'+n]=[4,4];d.genetics!.genome!.polygenic.loci['orange-'+n]=[0,0];}
 c.genetics!.forge!.patternColour={version:1,warmth:Array.from({length:6},()=>[4,4]as const)};
 const av=forgeView(a)!.description.parameters,bv=forgeView(b)!.description.parameters,cv=forgeView(c)!.description.parameters,dv=forgeView(d)!.description.parameters;
 expect(av.detailColor).toEqual(bv.detailColor);expect(av.bodyColor).toEqual(bv.bodyColor);expect(av.creamCoverage).not.toBe(bv.creamCoverage);
 expect(av.detailColor).not.toEqual(cv.detailColor);
 expect(av.bodyColor).toEqual(cv.bodyColor);expect(av.orangeColor).toEqual(cv.orangeColor);
 expect(av.detailColor).toEqual(dv.detailColor);expect(av.orangeColor).not.toEqual(dv.orangeColor);
});

test('six morphs retain native alpha, protected pixels, spot shapes and black spot material',()=>{
 for(const morph of['base','lilly','axanthic','dalmatian','select-harlequin','tiger']as const)for(let n=0;n<2;n++){
  const g=sample(morph,'natural-'+morph+'-'+n),old=structuredClone(g);delete old.genetics!.forge!.paletteVersion;delete old.genetics!.forge!.patternColour;
  const a=forgeView(g)!.description,b=forgeView(old)!.description;
  expect(a.spotMask).toEqual(b.spotMask);expect(a.pinMask).toEqual(b.pinMask);expect(a.whiteMask).toEqual(b.whiteMask);
  const approved:number[]=[],current:number[]=[],oldSpots:number[]=[],newSpots:number[]=[];
  for(let i=0;i<9216;i++){
   expect(a.sprite.pixels[i*4+3]).toBe(b.sprite.pixels[i*4+3]);
   if(source.protection[i]){approved.push(...b.sprite.pixels.slice(i*4,i*4+4));current.push(...a.sprite.pixels.slice(i*4,i*4+4));}
   if(a.spotMask[i]){oldSpots.push(...b.sprite.pixels.slice(i*4,i*4+4));newSpots.push(...a.sprite.pixels.slice(i*4,i*4+4));}
  }
  expect(current).toEqual(approved);expect(newSpots).toEqual(oldSpots);
  if(morph==='axanthic')expect(Math.max(...a.pigment.skin.resolved)-Math.min(...a.pigment.skin.resolved)).toBeLessThan(15);
 }
},30_000);

test('actual families keep DNA, modifiers, health, sex and visual seeds from the old factory',()=>{
 const current=newForgeGame(pixels.seed,DATE,{initialMoney:10000000,initialCapacity:20});
 for(const offer of Object.values(current.shop.offers).slice(0,2))for(const g of[offer.individual,offer.family!.father,offer.family!.mother]){
  const old=legacy.individuals[g.id];expect(old).toBeDefined();
  expect(g.genetics!.genome).toEqual(old.genetics!.genome);expect(g.genetics!.forge!.extensions).toEqual(old.genetics!.forge!.extensions);
  expect(g.genotype).toEqual(old.genotype);expect(g.sex).toBe(old.sex);expect(g.visualSeed).toBe(old.visualSeed);expect(g.healthGenome).toEqual(old.healthGenome);
  expect(g.genetics!.forge!.paletteVersion).toBe(2);
  expect(g.genetics!.forge!.patternColour).toBeDefined();
 }
 expect(readForgeSave(makeSave(current),DATE)).toEqual(current);
},30_000);

test('a real pre-palette backup keeps all twenty pinned pixel fingerprints and the exact saved game',()=>{
 const restored=parseForgeBackup(backup,DATE);expect(exportBackup(restored)).toBe(backup);
 const all=[...Object.values(restored.individuals),...Object.values(restored.eggs).map(e=>e.embryo),...Object.values(restored.shop.offers).flatMap(o=>[o.individual,o.family!.father,o.family!.mother])];
 for(const g of all){
  expect(g.genetics!.forge!.paletteVersion).toBeUndefined();
  expect(hash(forgeSurface(specimen(g))!.pixels)).toBe(pixels.records[g.id as keyof typeof pixels.records].rgba);
 }
},30_000);

test('old conceptions hatch with their saved colours; the next conception uses the new palette and unchanged inheritance',()=>{
 let game=structuredClone(legacy),oldMating=Object.values(game.matings)[0];
 game=act(game,{type:'collectEggs',matingId:oldMating.id},DATE);
 for(let n=0;n<4;n++)game=actWithTime(readForgeSave(makeSave(game),game.lastDate),{type:'endTurn'},DATE);
 const children=Object.values(game.eggs).filter(e=>e.status==='hatched');expect(children.length).toBeGreaterThan(0);
 for(const egg of children){
  expect(egg.embryo.genetics!.forge!.paletteVersion).toBeUndefined();
  expect(hash(forgeSurface(specimen(egg.embryo))!.pixels)).toBe(pixels.records[egg.embryo.id as keyof typeof pixels.records].rgba);
  game=act(game,{type:'receiveHatchling',eggId:egg.id},DATE);
 }
 game=act(game,{type:'breed',fatherId:oldMating.parents.fatherId,motherId:oldMating.parents.motherId},DATE);
 const mating=Object.values(game.matings).at(-1)!,father=mating.genetics!.father,mother=mating.genetics!.mother;
 for(const [n,o]of mating.lifecycle!.offspring.entries()){
  const seed=mating.seed+'|clutch:1|egg:'+(n+1),record=o.embryo.genetics!;
  expect(record.forge!.paletteVersion).toBe(2);expect(record.genome!.mendelian).toEqual(inherit(father.genome!.mendelian,mother.genome!.mendelian,seed));
  expect(record.genome!.polygenic).toEqual(inheritPoly(father.genome!.polygenic,mother.genome!.polygenic,seed));
  expect(record.forge!.patternColour!.warmth.flat()).toEqual(Array(12).fill(null));
 }
 expect(readForgeSave(makeSave(game),game.lastDate)).toEqual(game);validateGame(game);
},60_000);

test('colour version cannot silently downgrade a new family or accept an unsupported model',()=>{
 expect(()=>validateForge({version:1,paletteVersion:3})).toThrow();
 expect(()=>validateForge({version:1,paletteVersion:undefined})).toThrow();
 const game=newForgeGame('natural-version-corruption',DATE),offer=Object.values(game.shop.offers)[0];
 delete offer.individual.genetics!.forge!.paletteVersion;expect(()=>validateGame(game)).toThrow();
},30_000);

test('inherited colours are deterministic and independent of visual seed and rendering frequency',()=>{
 const father=sample('select-harlequin','colour-father'),mother=sample('select-harlequin','colour-mother');
 for(const g of[father,mother]){
  for(const feature of['red','orange','brightness'])for(let n=0;n<6;n++)g.genetics!.genome!.polygenic.loci[feature+'-'+n]=[1,3];
  g.potential=legacyTraits(polyScores(g.genetics!.genome!.polygenic));
  g.genetics!.forge!.patternColour={version:1,warmth:Array.from({length:6},()=>[1,3]as const)};
 }
 const distinct=new Set<string>();
 for(let n=0;n<16;n++){
  const genetics=offspringRecord(father.genetics!,mother.genetics!,null,'natural-child-'+n,'natural-child-'+n,true,true);
  const g={...structuredClone(father),id:'natural-child-'+n,genetics},same=structuredClone(g);same.visualSeed+='-other-layout';
  const a=forgeView(g)!.description,b=forgeView(same)!.description;
  expect(a.parameters.bodyColor).toEqual(b.parameters.bodyColor);expect(a.parameters.detailColor).toEqual(b.parameters.detailColor);
  expect(forgeView(structuredClone(g))).toBe(forgeView(g));distinct.add(JSON.stringify([a.parameters.bodyColor,a.parameters.detailColor]));
 }
 expect(distinct.size).toBeGreaterThan(8);
},30_000);

test('pattern warmth copies segregate deterministically without inventing unknown parental alleles',()=>{
 const father={version:1 as const,warmth:Array.from({length:6},()=>[0,4]as const)},mother={version:1 as const,warmth:Array.from({length:6},()=>[1,3]as const)};
 const expressions=new Set<number>();
 for(let n=0;n<64;n++){
  const seed='pattern-inheritance-'+n,c=inheritPatternColour(father,mother,seed);validatePatternColour(c);validatePatternColourChild(c,father,mother);
  expect(c).toEqual(inheritPatternColour(father,mother,seed));expressions.add(patternColourWarmth(c));
  const mixed=inheritPatternColour(undefined,mother,seed);expect(mixed.warmth.every(p=>p[0]===null&&mother.warmth[0].includes(p[1] as 1|3))).toBe(true);
 }
 expect(expressions.size).toBeGreaterThan(8);
 const unknown=inheritPatternColour(undefined,undefined,'unknown');expect(unknown.warmth.flat()).toEqual(Array(12).fill(null));expect(patternColourWarmth(unknown)).toBe(.375);
 const founders=Array.from({length:64},(_,n)=>founderPatternColour('pattern-founder-'+n));founders.forEach(validatePatternColour);
 expect(Math.min(...founders.map(patternColourWarmth))).toBeLessThan(.1);expect(Math.max(...founders.map(patternColourWarmth))).toBeGreaterThan(.9);
 expect(founders[0]).toEqual(founderPatternColour('pattern-founder-0'));
 for(const copy of[-1,5,.5,undefined])expect(()=>validatePatternColour({version:1,warmth:Array.from({length:6},()=>[copy,0])})).toThrow();
 expect(()=>validatePatternColour({version:1,warmth:[[0,0]]})).toThrow();expect(()=>validatePatternColourChild(father,undefined,undefined)).toThrow();
});
