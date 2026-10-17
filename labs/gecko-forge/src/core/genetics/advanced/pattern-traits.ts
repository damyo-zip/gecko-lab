import type { PatternTraits, RGB } from "@/phenotype/model";
import type { Feature, Genome } from "./model";
import { observedLoci } from "./phenotype";
import { polyScores, POLY_CONFIG } from "./polygenic";

const clamp=(v:number)=>Math.max(0,Math.min(1,v));
/** Reuse the existing 60 inherited virtual loci. Subsets express left/right and
 * shape differences (declared pleiotropy), not new real causal genes. No seed
 * changes breeding values; only the later anatomical plan varies by visual seed. */
export function patternTraits(genome:Genome):PatternTraits {
  const s=polyScores(genome.polygenic),seen=observedLoci(genome);
  const group=(feature:Feature,start:number,end:number,offset=0)=>{
    let sum=0;for(let i=start;i<end;i++)for(const a of genome.polygenic.loci[feature+"-"+i])sum+=POLY_CONFIG.alleleEffects[a];
    return 1/(1+Math.exp(-(offset+sum*1.3/Math.sqrt((end-start)*2))));
  };
  const ax=seen.axanthic==="Axanthic",lilly=seen["lilly-white"]==="Lilly White";
  const color:PatternTraits["color"]=ax?"회색":s.brightness<.30?"다크":s.red>.60?"레드":s.cream>.72&&s.brightness>.60?"크림":s.orange>.60?"오렌지":"옐로";
  const bases:Record<PatternTraits["color"],RGB>={레드:[174,61,42],오렌지:[214,121,43],옐로:[204,167,68],크림:[213,188,143],다크:[66,49,44],회색:[100,100,113]};
  const pigment:RGB=color==="레드"?[220,70,40]:color==="오렌지"?[236,147,46]:bases[color];
  const intensity=color==="레드"?clamp((s.red-.60)/.40):color==="오렌지"?clamp((s.orange-.60)/.40):0;
  const base=bases[color].map((v,i)=>Math.round((v+(pigment[i]-v)*intensity*.55)*(.78+s.brightness*.40))) as unknown as RGB;
  const flank=clamp(s.flank*.68+s.harlequin*.32),cream=lilly?.82+s.cream*.18:s.cream;
  return {version:1,color,palette:{base,secondary:ax?[59,59,73]:[106,58,32],cream:ax?[207,204,216]:lilly?[255,244,220]:[251,223,161]},
    dorsal:lilly?.85:clamp((s.dorsal-.08)*1.05),flank:lilly?Math.max(.7,flank):flank,
    limbs:lilly?.75:clamp(s.harlequin*.65+flank*.35),cream,complexity:group("harlequin",0,3),contrast:s.contrast,
    pin:[group("pinstripe",0,3),group("pinstripe",3,6)],
    side:[clamp(group("flank",0,3,-.8)*.6+cream*.4+(s.pinstripe-.5)*.25),clamp(group("flank",3,6,-.8)*.6+cream*.4+(s.pinstripe-.5)*.25)],
    drippy:group("cream",0,3,-1.2)*flank,wall:group("cream",3,6,-1.1)*flank,
    tiger:group("dorsal",0,3)*clamp(1-cream)*group("contrast",0,3),brindle:group("contrast",3,6),
    spots:{count:Math.round(clamp((s.spots-.075)/.72)*100),size:group("spots",3,6)},
  };
}
