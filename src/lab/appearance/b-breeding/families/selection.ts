import type {Genome} from '@/genetics/advanced/model';
import {bPhenotype} from '../phenotype';
import {randomFor} from '@/engine/random';
import {FAMILIES,type FamilyId,type Cadence,type ArtMorph} from './art-source';
/** Artistic archetype matching only. No trait name, family ID or picture is
 * inherited. The existing 60-locus scores are the sole genetic inputs. */
export const FAMILY_SELECTION={coverageWeight:.65,tieWindow:.015} as const;
export function selectFamily(genome:Genome,seed:string){
 const p=bPhenotype(genome),s=p.scores,e=p.expressed;
 const coverage=s.cream*.4+s.flank*.25+s.harlequin*.2+s.dorsal*.15,connection=s.pinstripe;
 const ranked=FAMILIES.map(f=>({id:f.id,distance:Math.abs(coverage-f.coverage)*FAMILY_SELECTION.coverageWeight+Math.abs(connection-f.connection)*(1-FAMILY_SELECTION.coverageWeight)})).toSorted((a,b)=>a.distance-b.distance);
 const rng=randomFor(seed,'B-pattern-family-1');
 // A seed can break a near tie only; it cannot send low expression to the
 // opposite end of the curated library or alter the inherited scores.
 const candidates=ranked.filter(f=>f.distance<=ranked[0].distance+FAMILY_SELECTION.tieWindow),chosen=candidates[Math.floor(rng()*candidates.length)];
 const morph:ArtMorph=e.lilly?'lilly':e.highway?'highway':e.sable?'sable':e.cappuccino?'cappuccino':e.axanthic?'axanthic':'normal';
 const tailEmphasis=(s.dorsal+s.cream+s.contrast)/3,regionalBias=s.dorsal*.6+tailEmphasis*.4-(s.flank*.6+s.harlequin*.4);
 // Cadence A follows the original dorsal/tail flow, B has the authored stepped
 // flank connection. Near the boundary only, a seed chooses between the two.
 const cadence:Cadence=regionalBias>.30?'a':regionalBias<.12?'b':rng()<.5?'a':'b';
 return {family:chosen.id as FamilyId,morph,cadence,coverage,connection,regionalBias,tailEmphasis,ranked,scores:s};
}
