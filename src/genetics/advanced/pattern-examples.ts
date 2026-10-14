import { founderPoly } from "./polygenic";
import { wildGenome } from "./loci";
import type { Feature, Genome } from "./model";

/** Explicit virtual allele fixtures for visual regression. These do NOT generate
 * shop offerings, assign labels, or overwrite offspring inheritance. */
export const PATTERN_EXAMPLES:{id:string;title:string;values:Partial<Record<Feature,number>>;subsets?:Record<string,number>}[]=[
  {id:"patternless",title:"패턴리스",values:{dorsal:0,flank:0,harlequin:0,cream:0,pinstripe:0,spots:0}},
  {id:"flame",title:"플레임",values:{dorsal:4,flank:0,harlequin:0,cream:2,contrast:0,pinstripe:0,spots:0}},
  {id:"harlequin",title:"할리퀸",values:{dorsal:3,flank:3,harlequin:3,cream:2,contrast:2,pinstripe:0,spots:0}},
  {id:"extreme",title:"익스트림 할리퀸",values:{dorsal:4,flank:4,harlequin:4,cream:3,contrast:2,pinstripe:0,spots:0}},
  {id:"tricolor",title:"트라이컬러",values:{dorsal:3,flank:4,harlequin:4,cream:3,contrast:4,red:4,orange:4,pinstripe:0,spots:0}},
  {id:"tiger",title:"타이거",values:{dorsal:4,flank:0,harlequin:0,cream:0,contrast:3,pinstripe:0,spots:0}},
  {id:"brindle",title:"브린들",values:{dorsal:4,flank:0,harlequin:0,cream:0,contrast:4,pinstripe:0,spots:0}},
  {id:"partial",title:"파셜 핀스트라이프",values:{dorsal:3,flank:2,harlequin:2,cream:2,contrast:2,pinstripe:3,spots:0}},
  {id:"full",title:"풀 핀스트라이프",values:{dorsal:3,flank:2,harlequin:2,cream:2,pinstripe:4,spots:0}},
  {id:"quad",title:"쿼드 핀스트라이프",values:{dorsal:3,flank:4,harlequin:4,cream:4,pinstripe:4,spots:0}},
  {id:"drippy",title:"드리피",values:{dorsal:3,flank:4,harlequin:3,cream:4,contrast:2,pinstripe:0,spots:0},subsets:{"cream-3":1,"cream-4":1,"cream-5":1}},
  {id:"wall",title:"화이트월",values:{dorsal:3,flank:4,harlequin:4,cream:4,contrast:2,pinstripe:0,spots:0},subsets:{"cream-0":1,"cream-1":1,"cream-2":1}},
  {id:"dalmatian",title:"달마시안",values:{dorsal:0,flank:0,harlequin:0,cream:0,pinstripe:0,spots:3}},
  {id:"superdal",title:"슈퍼달마시안",values:{dorsal:0,flank:0,harlequin:0,cream:0,pinstripe:0,spots:4}},
];
export function exampleGenome(id:string):Genome {
  const example=PATTERN_EXAMPLES.find(e=>e.id===id);if(!example)throw new Error("무늬 예제 없음");
  const polygenic=founderPoly("pattern-example:"+id);
  for(const [feature,allele] of Object.entries(example.values))for(let n=0;n<6;n++)polygenic.loci[feature+"-"+n]=[allele!,allele!];
  for(const [id,allele] of Object.entries(example.subsets??{}))polygenic.loci[id]=[allele,allele];
  return {version:1,mendelian:wildGenome(),polygenic};
}
