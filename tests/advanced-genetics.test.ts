import { expect, test } from "vitest";
import { LOCI, locusById, wildGenome } from "@/genetics/advanced/loci";
import { cross, gametes, inherit } from "@/genetics/advanced/inheritance";
import { condition, inferFamily, priorCross } from "@/genetics/advanced/inference";
import { diversity, founderPoly, inheritPoly, polyScores, POLY_IDS } from "@/genetics/advanced/polygenic";
import { phenotype } from "@/genetics/advanced/phenotype";
import { selectionExperiment, simulateCross } from "@/genetics/advanced/simulation";
import type { Locus } from "@/genetics/advanced/model";

const ax=locusById("axanthic");
function gene(pair:readonly [string,string]){const g=wildGenome();g.loci.axanthic=pair;return g;}
test("AA×aa=all Aa, Aa×Aa=1:2:1, Aa×aa=1:1 and both probability denominators normalize",()=>{
  expect(cross(gene(["A","A"]),gene(["ax","ax"])).outcomes).toMatchObject([{loci:{axanthic:["A","ax"]},probability:1}]);
  const carrier=gene(["A","ax"]),result=cross(carrier,carrier);
  expect(result.outcomes.map(o=>o.probability)).toEqual([.25,.5,.25]);
  expect(result.phenotypes).toEqual([{label:"Normal",probability:.75,viableProbability:.75},{label:"Axanthic",probability:.25,viableProbability:.25}]);
  expect(cross(carrier,gene(["ax","ax"])).outcomes.map(o=>o.probability)).toEqual([.5,.5]);
  expect(gametes(["A","A"])).toEqual([{allele:"A",probability:1}]);
});
test("independent AaBb cross has 9 genotypes and complete dominance 9:3:3:1",()=>{
  const definitions: Locus[]=["a","b"].map(id=>({id,name:id,alleles:["D","r"],inheritance:"dominant",modelVersion:1,
    phenotypes:{"D/D":id,"D/r":id,"r/r":"Normal"},nonViable:[],blocked:[],evidence:{sources:[],reviewed:"2026-10-13",level:"game-model",claim:"test fixture",disagreements:"",safety:""}}));
  const g={version:1 as const,loci:{a:["D","r"] as const,b:["D","r"] as const}},result=cross(g,g,definitions);
  expect(result.outcomes).toHaveLength(9);expect(result.outcomes.reduce((s,o)=>s+o.probability,0)).toBe(1);
  expect(result.phenotypes.map(p=>p.probability).sort((a,b)=>b-a)).toEqual([9/16,3/16,3/16,1/16]);
  expect(()=>cross(g,g,definitions.map(l=>({...l,linkage:{group:"unproven"}})))).toThrow("연관");
});
test("multi-allelic transmission, dosage, compound phenotype and welfare block are distinct from lethality",()=>{
  const f=wildGenome(),m=wildGenome();f.loci["cappuccino-complex"]=["n","C"];m.loci["cappuccino-complex"]=["n","S"];
  const result=cross(f,m);expect(result.outcomes.map(o=>o.probability)).toEqual([.25,.25,.25,.25]);
  expect(result.blockedProbability).toBe(.25);expect(result.nonViableProbability).toBe(0);
  expect(result.phenotypes.some(p=>p.label==="Luwak")).toBe(true);
  for(let i=0;i<100;i++){const child=inherit(f,m,"allelic-"+i).loci["cappuccino-complex"];expect(f.loci["cappuccino-complex"]).toContain(child[0]);expect(m.loci["cappuccino-complex"]).toContain(child[1]);}
  f.loci["lilly-white"]=["n","Lw"];m.loci["lilly-white"]=["n","Lw"];
  const risky=cross(f,m);expect(risky.nonViableProbability).toBe(.25);expect(risky.outcomes.reduce((s,o)=>s+o.viableProbability,0)).toBeCloseTo(1);
});
test("hidden recessive alleles pass grandparent→parent→grandchild without generation bonuses",()=>{
  const parent=inherit(gene(["ax","ax"]),gene(["A","A"]),"f1");
  expect(parent.loci.axanthic).toEqual(["ax","A"]);
  const g={version:1 as const,mendelian:parent,polygenic:founderPoly("f1")};
  expect(phenotype(g).geneticMorphs).not.toContain("Axanthic");
  expect(Array.from({length:100},(_,i)=>inherit(parent,parent,"f2-"+i)).some(g=>g.loci.axanthic.every(a=>a==="ax"))).toBe(true);
});
test("possible het is conditional on justified parents and visible Normal: exactly two thirds",()=>{
  const prior=priorCross({"A/ax":1},{"A/ax":1},ax);
  expect(condition(prior,ax,"Normal")).toEqual({"A/A":1/3,"A/ax":2/3});
  expect(condition(priorCross({"A/ax":1},{"A/A":1},ax),ax,"Normal")).toEqual({"A/A":.5,"A/ax":.5});
});
test("exact family Bayesian inference shares the latent parent across siblings; failures never prove AA",()=>{
  const prior={"A/A":1/3,"A/ax":2/3},mate={"ax/ax":1};
  expect(inferFamily(prior,mate,ax,["Axanthic"]).father).toEqual({"A/ax":1});
  expect(inferFamily(prior,mate,ax,["Normal"]).father["A/ax"]).toBeCloseTo(.5);
  expect(inferFamily(prior,mate,ax,["Normal","Normal"]).father["A/ax"]).toBeCloseTo(1/3);
  expect(inferFamily(prior,mate,ax,Array(20).fill("Normal")).father["A/ax"]).toBeGreaterThan(0);
  const both=inferFamily(prior,prior,ax,["Axanthic","Normal"]);
  expect(both.father).toEqual({"A/ax":1});expect(both.mother).toEqual({"A/ax":1});
});
test("all 60 polygenic loci inherit exactly one allele per parent, deterministic without score averaging",()=>{
  const f=founderPoly("father"),m=founderPoly("mother"),c=inheritPoly(f,m,"child");
  expect(c).toEqual(inheritPoly(f,m,"child"));
  for(const id of POLY_IDS){expect(f.loci[id]).toContain(c.loci[id][0]);expect(m.loci[id]).toContain(c.loci[id][1]);}
  expect(polyScores(c).red).not.toBeCloseTo((polyScores(f).red+polyScores(m).red)/2,6);
  expect(Object.values(polyScores(c)).every(s=>s>0&&s<1)).toBe(true);
  const before=JSON.stringify(c),g={version:1 as const,mendelian:wildGenome(),polygenic:c};
  expect(phenotype(g,{stage:"hatchling",fire:"down"}).scores.red).toBeLessThan(phenotype(g).scores.red);
  expect(phenotype(g,{stage:"hatchling",fire:"down"}).scores.spots).toBe(phenotype(g).scores.spots);expect(JSON.stringify(c)).toBe(before);
});
test("100,000 seeded crosses satisfy a five-sigma theoretical frequency bound",()=>{
  const f=gene(["A","ax"]),result=simulateCross(f,f,"statistical-validation",100_000),forecast=cross(f,f);
  expect(Object.values(result.counts).reduce((s,n)=>s+n,0)).toBe(100_000);
  for(const o of forecast.outcomes){const key=LOCI.map(l=>l.id+":"+o.loci[l.id].join("/")).join(";");
    const actual=result.counts[key]??0,sd=Math.sqrt(result.count*o.probability*(1-o.probability));expect(Math.abs(actual-result.count*o.probability)).toBeLessThan(5*sd+1);}
},30_000);
test("20 generations selection changes three starting populations while neutral generations add no score bonus",()=>{
  for(const seed of ["selection-a","selection-b","selection-c"]){const selected=selectionExperiment(seed,"red"),neutral=selectionExperiment(seed,"red",20,100,false);
    expect(selected.at(-1)!.mean-selected[0].mean).toBeGreaterThan(.2);
    expect(selected.at(-1)!.mean-neutral.at(-1)!.mean).toBeGreaterThan(.15);
    expect(selected.at(-1)!.diversity).toBeLessThan(selected[0].diversity);
    expect(Math.abs(neutral.at(-1)!.mean-neutral[0].mean)).toBeLessThan(.15);
  }
  const fixed={version:1 as const,loci:Object.fromEntries(POLY_IDS.map(id=>[id,[2,2] as const]))};
  expect(polyScores(inheritPoly(fixed,fixed,"later"))).toEqual(polyScores(fixed));expect(diversity([fixed])).toBe(0);
},30_000);
