import { inheritGenotype } from "@/genetics/mendel";
import { expandedGenotype, HARDCORE_LOCI } from "@/genetics/hardcore";
import { inheritTraits } from "@/genetics/traits";
import { seededRandom, seedId } from "@/genetics/random";
import { legacyTraits } from "@/genetics/advanced/phenotype";
import { polyScores } from "@/genetics/advanced/polygenic";
import { cachedGenotype, legacyRecord, offspringRecord } from "./genetics";
import type { Gecko, HardcoreGame, Mating } from "./model";
import { addDays, type GameDate } from "./time";
import { isV12, V12 } from "./lifecycle";

/** One deterministic inheritance path for both legacy embryos and v1.2 fertilization. */
export function createEmbryo(game:HardcoreGame,mating:Mating,seed:string,id:string,name:string,birthTurn:number,birthDate:GameDate,newPatterns=game.saveVersion>=7):Gecko {
  const inheritance=inheritGenotype(expandedGenotype(mating.fatherGenotype),expandedGenotype(mating.motherGenotype),seed,HARDCORE_LOCI);
  if(!inheritance.viable)throw new Error("위험 교배 데이터입니다. 비생존 유전형을 개체로 만들지 않습니다.");
  const genetics=offspringRecord(mating.genetics?.father??legacyRecord({genotype:mating.fatherGenotype}),
    mating.genetics?.mother??legacyRecord({genotype:mating.motherGenotype}),inheritance.genotype,seed,id,newPatterns);
  const adultDate=addDays(birthDate,game.rules.adultAfter*(isV12(game)?V12.daysPerTurn:1));
  return {id,name,sex:seededRandom(seed,"sex")()<.5?"male":"female",birthTurn,birthDate,stage:"hatchling",
    parents:{...mating.parents},generation:mating.generation,genotype:cachedGenotype(genetics,inheritance.genotype),genetics,
    potential:genetics.genome?legacyTraits(polyScores(genetics.genome.polygenic)):inheritTraits(mating.fatherTraits,mating.motherTraits,seed,game.rules.traitVariation),
    visualSeed:id+"-"+seedId(seed,"visual"),nextBreedTurn:birthTurn+game.rules.adultAfter,
    status:"owned",hearts:5,lastFedDate:null,diedDate:null,cycleAnchor:adultDate,recoverUntil:adultDate,
    lineageIds:[...mating.lineageIds],provenance:"known",...(isV12(game)?{deathCause:null,lastProcessedTurn:birthTurn}:{})};
}
