/** Review images use real renderer pixels and fixed virtual allele fixtures. */
import ts from 'typescript';
import {mkdtemp,mkdir,readFile,readdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,relative,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {encodePNG} from './png.mjs';
const temp=await mkdtemp(join(tmpdir(),'gecko-pattern-report-')),folder='docs/inherited-patterns';
try{
 await writeFile(join(temp,'package.json'),JSON.stringify({type:'module'}));
 async function compile(dir){for(const entry of await readdir(dir,{withFileTypes:true})){
  const path=join(dir,entry.name);if(entry.isDirectory()){await compile(path);continue;}if(!path.endsWith('.ts'))continue;
  const target=join(temp,relative('src',path).replace(/\.ts$/,'.js'));
  const js=ts.transpileModule(await readFile(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
   .replace(/from (["'])([^"']+)\1/g,(m,q,s)=>s.startsWith('@/')?`from ${q}${pathToFileURL(join(temp,s.slice(2)+'.js'))}${q}`:s.startsWith('.')?`from ${q}${s}.js${q}`:m);
  await mkdir(dirname(target),{recursive:true});await writeFile(target,js);
 }}
 for(const dir of ['src/engine','src/genetics','src/phenotype','src/game'])await compile(dir);
 const load=path=>import(pathToFileURL(join(temp,path+'.js')));
 const {PATTERN_EXAMPLES,exampleGenome}=await load('genetics/advanced/pattern-examples');
 const {patternTraits}=await load('genetics/advanced/pattern-traits');
 const {buildPatternPlan}=await load('engine/pattern-plan');
 const {classifyPattern}=await load('phenotype/names');
 const {renderSprite}=await load('engine/render');
 const {MORPH_PRESETS,specimenFromPreset}=await load('engine/presets');
 const {patternSelectionExperiment}=await load('game/hardcore/pattern-experiment');
 const hash=p=>createHash('sha256').update(p).digest('hex');
 await mkdir(folder,{recursive:true});const report=[];
 for(const e of PATTERN_EXAMPLES){
  const traits=patternTraits(exampleGenome(e.id)),seed='patterns-v1|'+e.id,plan=buildPatternPlan(traits,seed),names=classifyPattern(traits,plan.observation);
  const wire={schemaVersion:1,id:e.id,name:names.primary,seed,state:{fire:'up'},appearance:{bodyColor:'orange',patternStyle:'harlequin',dorsalCoverage:traits.dorsal,flankCoverage:traits.flank,spotCount:Math.min(70,traits.spots.count),patterns:traits}};
  const r=renderSprite(wire),png=encodePNG(96,96,r.pixels);await writeFile(folder+'/'+e.id+'-96.png',png);
  await sharp(png).resize(384,384,{kernel:'nearest'}).png().toFile(folder+'/'+e.id+'-4x.png');
  report.push({id:e.id,target:e.title,...names,traits,observation:plan.observation,sha256:hash(r.pixels)});
 }
 // Existing six presets remain byte-identical. Different seeds of one genotype
 // retain geometry diversity without changing its inherited values.
 const legacy=MORPH_PRESETS.map(p=>({id:p.id,sha256:hash(renderSprite(specimenFromPreset(p,'phase6-comparison')).pixels)}));
 const traits=patternTraits(exampleGenome('harlequin'));
 const diversity=Array.from({length:12},(_,n)=>{
  const seed='pattern-diversity-'+n,wire={schemaVersion:1,id:seed,name:seed,seed,state:{fire:'up'},appearance:{bodyColor:'orange',patternStyle:'harlequin',dorsalCoverage:traits.dorsal,flankCoverage:traits.flank,spotCount:0,patterns:traits}};
  return {seed,sha256:hash(renderSprite(wire).pixels)};
 });
 const selection=['pin-selection-a','pin-selection-b','pin-selection-c'].map(seed=>({seed,selected:patternSelectionExperiment(seed,true),neutral:patternSelectionExperiment(seed,false)}));
 await writeFile(folder+'/report.json',JSON.stringify({rulesVersion:1,seed:'patterns-v1',legacy,diversity,selection,examples:report},null,2)+'\n');
 console.log(JSON.stringify(report.map(r=>({id:r.id,name:r.primary,features:r.features,flank:r.observation.flank,limbs:r.observation.limbs,spots:r.observation.spots,pin:r.observation.pin.map(p=>p.coverage),side:r.observation.side.map(p=>p.coverage)})),null,2));
}finally{await rm(temp,{recursive:true,force:true});}
