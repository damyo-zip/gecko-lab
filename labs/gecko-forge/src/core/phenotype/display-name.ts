import {MORPH_KOREAN,REPRESENTATIVE_COMBINATIONS,SINGLE_GENETIC_NAMES} from './display-rules';

const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const englishNames=new RegExp('\\b('+Object.keys(MORPH_KOREAN).sort((a,b)=>b.length-a.length).map(escape).join('|')+')\\b','g');
/** Translate generated descriptions, never individual names, identifiers or alleles. */
export function koreanMorphText(text:string):string {
  return text.replace(englishNames,name=>MORPH_KOREAN[name]);
}
/** Public visual descriptions remain searchable in both languages, including
 * features omitted from the representative. Never pass undisclosed allele data. */
export function morphSearchText(description:string):string {
  const korean=koreanMorphText(description);
  return [description,korean,...Object.entries(MORPH_KOREAN).filter(([,label])=>korean.includes(label)).map(([english])=>english)].join(' ');
}

export interface MorphDisplayInput {
  geneticMorphs:readonly string[];
  color?:string;
  pattern?:string;
  /** Full existing visual description; unknown/untested combinations keep it. */
  fallback:string;
}

/** Pure presentation policy. Neither names nor aliases ever feed back into genetics. */
export function representativeMorphName(input:MorphDisplayInput):string {
  const labels=[...new Set(input.geneticMorphs.filter(n=>n&&n!=='Normal'))];
  const combination=REPRESENTATIVE_COMBINATIONS.find(r=>r.morphs.length===labels.length&&r.morphs.every(n=>labels.includes(n)));
  if(combination)return combination.name;
  if(labels.length===1){
    if(labels[0]==='Lilly White'){
      // Lilly-specific exceptions: tricolor takes precedence over red, not over other genes.
      if(input.pattern?.includes('트라이컬러'))return '트라이컬러 릴리';
      if(input.color==='레드')return '레드 릴리';
      return '릴리화이트';
    }
    const name=SINGLE_GENETIC_NAMES[labels[0]];
    if(name)return name;
  }
  return koreanMorphText(input.fallback||labels.join(' + ')||'Normal');
}
