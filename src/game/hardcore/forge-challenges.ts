import {forgeView} from './forge-appearance';
import {polyScores} from '@/genetics/advanced/polygenic';
import type {ChallengeId} from './challenge-rules';
import type {Gecko} from './model';

/** New native grid has at most 48 tiny spots. Version 1's 65-spot target stays
 * frozen for historical animals; current awards record evaluatorVersion 2. */
export const FORGE_CHALLENGE_THRESHOLDS={superSpots:32,regionSpots:3,whiteCoverage:.60,veilStrength:.85,darkLuminance:58,darkBaseArea:.72,orangeStrength:.75,orangeBaseArea:.70,solidMaxSpots:5}as const;
export function evaluateForgeChallenge(g:Gecko,id:ChallengeId):boolean {
 const v=forgeView(g),genome=g.genetics?.genome;if(!v||!genome||v.description.complexMetrics.restricted)return false;
 const d=v.description,p=d.parameters,o=v.observation,t=FORGE_CHALLENGE_THRESHOLDS;
 const white=p.lilly&&d.veilMetrics.strength>=t.veilStrength&&v.whiteCoverage>=t.whiteCoverage;
 switch(id){
  case 'white':return white;
  case 'monochrome':return white&&p.axanthic;
  case 'midnight':return !p.lilly&&!p.axanthic&&v.traits.palette.base.reduce((s,c,n)=>s+c*[.2126,.7152,.0722][n],0)<=t.darkLuminance&&o.baseArea>=t.darkBaseArea;
  case 'sun':return !p.lilly&&!p.axanthic&&v.names.color==='오렌지'&&polyScores(genome.polygenic).orange>=t.orangeStrength&&o.baseArea>=t.orangeBaseArea&&o.spots<=t.solidMaxSpots;
  case 'stars':{const r=d.spotMetrics.regions;return o.spots>=t.superSpots&&(r[1]??0)>=t.regionSpots&&(r[2]??0)+(r[3]??0)+(r[4]??0)>=t.regionSpots&&(r[7]??0)>=t.regionSpots;}
 }
}
