import { inheritGenotype } from "@/genetics/mendel";
import { expandedGenotype, HARDCORE_LOCI } from "@/genetics/hardcore";
import { inheritTraits } from "@/genetics/traits";
import { seededRandom, seedId } from "@/genetics/random";
import { legacyTraits } from "@/genetics/advanced/phenotype";
import { polyScores } from "@/genetics/advanced/polygenic";
import { legacyRecord, offspringRecord } from "./genetics";
import type { Embryo, HardcoreGame, Mating } from "./model";
import { inheritHealth } from '@/genetics/health';
import { LOCI, pairKey } from '@/genetics/advanced/loci';
import { addDays, type GameDate } from "./time";
import { isV12, V12 } from "./lifecycle";

/** One deterministic inheritance path for both legacy embryos and v1.2 fertilization. */
export function createEmbryo(game:HardcoreGame,mating:Mating,seed:string,id:string,name:string,birthTurn:number,birthDate:GameDate,newPatterns=game.saveVersion>=7):Embryo {
  const father=mating.genetics?.father??legacyRecord({genotype:mating.fatherGenotype});
  const mother=mating.genetics?.mother??legacyRecord({genotype:mating.motherGenotype});
  // Fully recorded parents inherit once through the advanced engine; the legacy
  // sampler is used only when virtual appearance genomes genuinely do not exist.
  const basic=father.genome&&mother.genome?null:inheritGenotype(expandedGenotype(mating.fatherGenotype),expandedGenotype(mating.motherGenotype),seed,HARDCORE_LOCI).genotype;
  const genetics=offspringRecord(father,mother,basic,seed,id,newPatterns,!!mating.riskModel,mating.genetics?.paletteVersion??null);
  const genotype=genetics.genome?{modelVersion:1 as const,loci:{'lilly-white':genetics.genome.mendelian.loci['lilly-white'],axanthic:genetics.genome.mendelian.loci.axanthic}}:basic!;
  // Advanced inheritance is the single source of truth when both genomes exist.
  const causes=genetics.genome?LOCI.filter(l=>l.nonViable.includes(pairKey(genetics.genome!.mendelian.loci[l.id],l))).map(l=>l.id):
    genotype.loci['lilly-white'].every(a=>a==='Lw')?['lilly-white']:[];
  if(game.saveVersion<9&&causes.length)throw new Error("이전 규칙의 비생존 교배 데이터입니다.");
  const risk=mating.riskModel;
  const adultDate=addDays(birthDate,game.rules.adultAfter*(isV12(game)?V12.daysPerTurn:1));
  return {id,name,sex:seededRandom(seed,"sex")()<.5?"male":"female",birthTurn,birthDate,stage:"hatchling",
    parents:{...mating.parents},generation:mating.generation,genotype,genetics,
    potential:genetics.genome?legacyTraits(polyScores(genetics.genome.polygenic)):inheritTraits(mating.fatherTraits,mating.motherTraits,seed,game.rules.traitVariation),
    visualSeed:id+"-"+seedId(seed,"visual"),nextBreedTurn:birthTurn+game.rules.adultAfter,
    status:"owned",hearts:5,lastFedDate:null,diedDate:null,cycleAnchor:adultDate,recoverUntil:adultDate,
    lineageIds:[...mating.lineageIds],provenance:"known",...(isV12(game)?{deathCause:null,lastProcessedTurn:birthTurn}:{}),
    ...(risk?{healthGenome:inheritHealth(risk.father,risk.mother,seed),development:{version:1 as const,viable:!causes.length,causes}}:{})};
}
