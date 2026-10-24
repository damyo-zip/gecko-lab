import type {HardcoreGame} from './model';
import type {HistoryEntry} from './compact-model';
import {canonicalJSON} from '@/game/save';
import {checksum} from './save';
import {validateGame} from './validation';
import {validateHistoryEntry} from './compact-validation';

const DNA_FIELDS=new Set(['genome','forge','genotype','potential','healthGenome','fatherGenotype','motherGenotype','fatherTraits','motherTraits']);
export function packGame(game:HardcoreGame){
 const blobs:unknown[]=[],ids=new Map<string,number>(),seen=new WeakMap<object,number>();
 const visit=(v:unknown,key=''):unknown=>{
  if(v&&typeof v==='object'&&(DNA_FIELDS.has(key)||['father','mother'].includes(key)&&Object.hasOwn(v,'genome')&&Object.hasOwn(v,'knowledge'))){
   if(seen.has(v))return {$dna:seen.get(v)!};
   const signature=canonicalJSON(v);let id=ids.get(signature);
   if(id===undefined){id=blobs.length;ids.set(signature,id);seen.set(v,id);blobs.push(null);blobs[id]=plain(v);}else seen.set(v,id);
   return {$dna:id};
  }
  return plain(v);
 };
 const plain=(v:unknown):unknown=>{
  if(Array.isArray(v))return v.map(v=>visit(v));
  if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,visit((v as Record<string,unknown>)[k],k)]));
  return v;
 };
 return {game:visit(game),blobs};
}
export function compactChecksum(game:HardcoreGame):string {return checksum(packGame(game));}
export function compactDocument(game:HardcoreGame,history:HistoryEntry[]=[]){
 validateGame(game);if(!game.compact)throw Error('경량 저장 형식이 아닙니다.');
 history.forEach(validateHistoryEntry);
 const payload={...packGame(game),history};
 return {format:'gecko-lab-save' as const,version:11 as const,checksum:checksum(payload),...payload};
}
export function readCompactDocument(input:unknown):{game:HardcoreGame;history:HistoryEntry[]} {
 const fail=():never=>{throw Error('경량 백업의 원본 데이터·참조·체크섬이 손상되었습니다.');};
 if(!input||typeof input!=='object'||Array.isArray(input))fail();
 const d=input as ReturnType<typeof compactDocument>;
 if(Object.keys(d).sort().join()!=='blobs,checksum,format,game,history,version'||d.format!=='gecko-lab-save'||d.version!==11||!Array.isArray(d.blobs)||!Array.isArray(d.history)||d.blobs.length>150000||d.checksum!==checksum({game:d.game,blobs:d.blobs,history:d.history}))fail();
 const used=new Set<number>(),decoded=new Map<number,unknown>(),decoding=new Set<number>();
 const visit=(v:unknown):unknown=>{
  if(Array.isArray(v))return v.map(visit);
  if(v&&typeof v==='object'){
   if(Object.hasOwn(v,'$dna')){const id=(v as {$dna:number}).$dna;if(Object.keys(v).length!==1||!Number.isSafeInteger(id)||id<0||id>=d.blobs.length||decoding.has(id))fail();used.add(id);if(decoded.has(id))return decoded.get(id);decoding.add(id);const value=visit(d.blobs[id]);decoding.delete(id);decoded.set(id,value);return value;}
   return Object.fromEntries(Object.entries(v).map(([k,v])=>[k,visit(v)]));
  }
  return v;
 };
 const game=visit(d.game) as HardcoreGame;
 if(!game.compact||used.size!==d.blobs.length)fail();
 validateGame(game);d.history.forEach(validateHistoryEntry);
 if(d.history.some(e=>e.turn>game.turn||e.revision>game.revision||e.date>game.lastDate))fail();
 return {game,history:d.history};
}
