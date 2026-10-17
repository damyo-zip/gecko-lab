/** Trade combination names are interactions, never extra loci or random morph rolls. */
export const COMBINATIONS=[
  {requires:["Lilly White","Cappuccino"],name:"Frappuccino",evidence:"브리더 조합명"},
  {requires:["Lilly White","Super Cappuccino"],name:"Sorak · 건강 위험",evidence:"Foundation Genetics PSA 2026-09-08"},
] as const;
export function classifyCombination(labels:readonly string[]):string[] {
  const result=labels.filter(l=>l&&l!=="Normal");for(const c of COMBINATIONS)if(c.requires.every(l=>result.includes(l))){
    for(const l of c.requires)result.splice(result.indexOf(l),1);result.push(c.name);
  }return result;
}
