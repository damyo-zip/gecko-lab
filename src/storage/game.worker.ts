import {GameCheckpoint,type GameRequest,type GameResponse} from './game-checkpoint';
import {SaveConflict} from './indexed-db';
const checkpoint=new GameCheckpoint();let chain=Promise.resolve();
self.onmessage=(event:MessageEvent<GameRequest>)=>{
 const request=event.data;
 chain=chain.then(async()=>{
  let response:GameResponse;
  try{
   if(request.type==='load'){const loaded=await checkpoint.open(request.date);response={id:request.id,ok:true,loaded,writeRevision:loaded.writeRevision};}
   else if(request.type==='init'){checkpoint.initialize(request.loaded);response={id:request.id,ok:true,writeRevision:request.loaded.writeRevision};}
   else response={id:request.id,ok:true,...await checkpoint.execute(request.date,request.action,request.replacement,request.history)};
  }catch(e){response={id:request.id,ok:false,message:e instanceof Error?e.message:'게임 저장 실패',conflict:e instanceof SaveConflict};}
  self.postMessage(response);
 });
};
