import type {Gecko,Mating} from './model';

export interface HistoryEntry {
 kind:'individual'|'mating'|'egg'|'sale';id:string;turn:number;revision:number;date:string;
 name:string;detail:string;
}
export interface BirthProof {
 originId:string;seed:string;name:string;plannedTurn:number;plannedDate:string;
 birthTurn:number;birthDate:string;
}
export interface CompactState {
 version:1;historyId:string;
 /** Only immediate, no-longer-owned parents. Their ancestors are not retained. */
 parentIds:string[];
 /** Conception inputs for living offspring/trophies, without duplicate embryos. */
 origins:Record<string,{mating:Mating;rulesVersion:2|4|5;startTurn:number;maxClutches:number}>;
 births:Record<string,BirthProof>;
 counts:Record<HistoryEntry['kind'],number>;
 recent:HistoryEntry[];
}
export type Compaction={game:import('./model').HardcoreGame;history:HistoryEntry[]};
/** Genetic identity survives, while ownership/care and distant ancestry do not. */
export function parentFact(source:Gecko):Gecko {
 return {...source,parents:null,status:'pedigree',hearts:5,diedDate:null,deathCause:null,lastFedDate:null,lineageIds:[]};
}
