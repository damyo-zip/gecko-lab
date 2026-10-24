import { toSpecimen, phenotypeOf } from "@/game/adapter";
import { axanthicState } from "@/genetics/hardcore";
import type { Gecko } from "./model";
import { carrierProbability } from "@/genetics/advanced/inference";
import { publicKnowledge } from "./genetics";
import { phenotype } from "@/genetics/advanced/phenotype";
import { appearanceProfile } from "./appearance";
import {koreanMorphText,representativeMorphName} from "@/phenotype/display-name";
import {forgeView} from './forge-appearance';
import {tagForgeSurface} from '@/forge/surface';

function legacyView(g: Gecko) {
  return { ...g, genotype: { modelVersion: 1 as const, loci: { "lilly-white": g.genotype.loci["lilly-white"] } } };
}
/** Morph filtering needs a classification, not a rendered sprite buffer. */
export function visualPatternStyle(g:Gecko,profile=appearanceProfile(g)) {
 if(g.genotype.loci['lilly-white'].includes('Lw'))return 'lilly';
 if(axanthicState(g.genotype)==='visual')return 'axanthic';
 if(profile)return profile.names.base.includes('트라이컬러')?'tricolor':profile.names.base.includes('할리퀸')?'harlequin':profile.names.base.includes('달마시안')?'dalmatian':'normal';
 return toSpecimen(legacyView(g)).appearance.patternStyle;
}
export function morph(g: Gecko): string {
  const profile=appearanceProfile(g);
  if(profile){const p=carrierProbability(publicKnowledge(g));
    return [profile.names.primary,...profile.names.features].join(" · ")+(p===null?" · 유전 정보 미확인":p>1-1e-9?" · 100% het Ax":p>0?" · "+(p*100).toFixed(1)+"% possible het Ax":"");}
  const lilly = g.genotype.loci["lilly-white"].includes("Lw"), ax = axanthicState(g.genotype);
  if (ax === "visual") return lilly ? "Axanthic + Lilly (복합 외형)" : "Axanthic";
  const label = phenotypeOf(legacyView(g)).description;
  const complex=g.genetics?.genome?phenotype(g.genetics.genome).geneticMorphs.filter(m=>m!=="Lilly White"&&m!=="Axanthic"):[];
  const p=carrierProbability(publicKnowledge(g));
  return [label,...complex].join(" · ") + (p===null?" · 유전 정보 미확인":p>1-1e-9?" · 100% het Ax":p>0?" · "+(p*100).toFixed(1)+"% possible het Ax":"");
}
/** Shared gameplay presentation boundary; runtime Forge tags never enter a save. */
export function specimen(g: Gecko,fire:"up"|"down"="up") {
  const result = toSpecimen(legacyView(g));
  if(g.genetics?.genome){const s=phenotype(g.genetics.genome,{stage:g.stage,fire:"up"}).scores,lilly=g.genotype.loci["lilly-white"].includes("Lw");
    result.appearance.expression={red:s.red,orange:s.orange,brightness:s.brightness,cream:s.cream,harlequin:s.harlequin,pinstripe:s.pinstripe,contrast:s.contrast};
    if(!lilly){result.appearance.bodyColor=s.red>.55||s.orange>.58?"orange":s.brightness<.42?"brown":s.cream>.7?"cream":"orange";
      result.appearance.dorsalCoverage=(s.dorsal*.4+s.cream*.3+s.pinstripe*.3)*(.8+.2*s.contrast);
      result.appearance.flankCoverage=(s.flank*.4+s.harlequin*.35+s.cream*.25)*(.8+.2*s.contrast);}
  }
  if (axanthicState(g.genotype) === "visual") {
    result.appearance.bodyColor = "slate";
    if (!g.genotype.loci["lilly-white"].includes("Lw")) result.appearance.patternStyle = "axanthic";
  }
  const profile=appearanceProfile(g);
  if(profile){const t=profile.traits;
    result.appearance.patterns=t;
    result.appearance.patternStyle=visualPatternStyle(g,profile);
    result.appearance.dorsalCoverage=t.dorsal;result.appearance.flankCoverage=t.flank;result.appearance.spotCount=Math.min(70,t.spots.count);
  }
  result.state.fire=fire;
  const current=forgeView(g,fire);
  if(current)tagForgeSurface(result,current.input,!g.genotype.loci['lilly-white'].every(a=>a==='Lw'),current.description.sprite.pixels);
  return result;
}
/** Catalog naming follows the record's engine. Saved individual names are never
 * recomputed by a load or by the player-facing naming policy. */
export function descriptiveVisualName(g:Gecko):string {
  return appearanceProfile(g)?.names.primary??morph(g).replace(/^일반형(?: · (?:반점|할리퀸|트라이컬러) 외형)?|^릴리화이트 이형접합체/,
    {normal:"Normal",lilly:"Lilly White",axanthic:"Axanthic",dalmatian:"Dalmatian",harlequin:"Harlequin",tricolor:"Tricolor Harlequin"}[specimen(g).appearance.patternStyle]).split(" · ").filter(s=>!s.includes("het")&&!s.includes("유전 정보")).join(" · ");
}
/** Only expressed morphs: a hidden recessive carrier is never a naming input. */
export function visibleGeneticMorphs(g:Gecko):string[] {
  if(g.genetics?.genome)return phenotype(g.genetics.genome).geneticMorphs;
  return [g.genotype.loci['lilly-white'].includes('Lw')?'Lilly White':'',axanthicState(g.genotype)==='visual'?'Axanthic':''].filter(Boolean);
}
const displayNames=new WeakMap<Gecko,string>();
/** One computed representative for every gameplay screen; no save writes. */
export function visualName(g:Gecko):string {
  const profile=appearanceProfile(g);if(profile?.displayName)return profile.displayName;
  let name=displayNames.get(g);if(name!==undefined)return name;
  const geneticMorphs=visibleGeneticMorphs(g);
  // Older sprites have no measured color/pattern profile. Do not invent those traits.
  const legacyPattern=profile?'':{normal:'',lilly:'',axanthic:'',dalmatian:'달마시안',harlequin:'할리퀸',tricolor:'트라이컬러 할리퀸'}[specimen(g).appearance.patternStyle];
  const fallback=profile?.names.primary??(geneticMorphs.length?[geneticMorphs.join(' + '),legacyPattern].filter(Boolean).join(' · '):descriptiveVisualName(g));
  name=representativeMorphName({geneticMorphs,color:profile?.names.color,pattern:profile?.names.base,fallback});
  displayNames.set(g,name);return name;
}
/** Full pre-existing classification and public carrier information remain in details. */
export const morphDescription=(g:Gecko)=>koreanMorphText(morph(g));
export function disclosedSex(g: Gecko): string {
  return g.stage === "adult" ? g.sex === "male" ? "수컷 ♂" : "암컷 ♀" : "미구분 · 성체 때 공개";
}
