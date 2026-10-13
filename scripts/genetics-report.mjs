// Compile the independent TS genetics engine into a disposable ESM directory.
// No browser, network, game state or external API is used by this experiment.
import ts from "typescript";
import { mkdtemp, readFile, readdir, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { pathToFileURL } from "node:url";

const temp=await mkdtemp(join(tmpdir(),"gecko-genetics-report-"));
try {
  await writeFile(join(temp,"package.json"),JSON.stringify({type:"module"}));
  async function compile(dir,relative=""){
    for(const entry of await readdir(dir,{withFileTypes:true})){
      const next=join(relative,entry.name),source=join(dir,entry.name);
      if(entry.isDirectory()){await compile(source,next);continue;}
      if(!entry.name.endsWith(".ts"))continue;
      const js=ts.transpileModule(await readFile(source,"utf8"),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
        .replace(/from (["'])(\.[^"']+)\1/g,(_match,quote,path)=>`from ${quote}${path}.js${quote}`);
      const dest=join(temp,next.replace(/\.ts$/,".js"));await mkdir(dirname(dest),{recursive:true});await writeFile(dest,js);
    }
  }
  await compile("src/genetics");
  const {wildGenome,LOCI,pairKey}=await import(pathToFileURL(join(temp,"advanced/loci.js")));
  const {cross}=await import(pathToFileURL(join(temp,"advanced/inheritance.js")));
  const {simulateCross,selectionExperiment}=await import(pathToFileURL(join(temp,"advanced/simulation.js")));
  const father=wildGenome();father.loci.axanthic=["A","ax"];
  const sample=simulateCross(father,father,"statistical-validation",100_000),theory=cross(father,father);
  const frequencies=theory.outcomes.map(o=>{const key=LOCI.map(l=>l.id+":"+pairKey(o.loci[l.id],l)).join(";");const count=sample.counts[key]??0;
    return {genotype:key,theoretical:o.probability,count,frequency:count/sample.count,z:(count-sample.count*o.probability)/Math.sqrt(sample.count*o.probability*(1-o.probability))};});
  const populations=["selection-a","selection-b","selection-c"].map(seed=>({seed,selected:selectionExperiment(seed,"red"),neutral:selectionExperiment(seed,"red",20,100,false)}));
  process.stdout.write(JSON.stringify({modelVersion:1,reviewed:"2026-10-13",count:sample.count,seed:sample.seed,frequencies,populations,
    note:"가상 다유전자 게임 모델의 집단 실험. 게임 내 근친 차단 정책과 별개이며 현실 브리딩 예측이나 혈연 교배 허가가 아닙니다."},null,2)+"\n");
} finally {await rm(temp,{recursive:true,force:true});}
