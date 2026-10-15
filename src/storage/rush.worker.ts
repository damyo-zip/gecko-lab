import {RushCheckpoint,type RushRequest,type RushResponse} from './rush-checkpoint';
import {SaveConflict} from './indexed-db';

const checkpoint=new RushCheckpoint();
// The caller holds the same useHardcore action lock as every other game action.
let chain=Promise.resolve();
self.onmessage=(event:MessageEvent<RushRequest>)=>{
  const request=event.data;
  chain=chain.then(async()=>{
    let response:RushResponse;
    try{
      if(request.type==='init'){
        checkpoint.initialize(request.loaded);
        response={id:request.id,ok:true,writeRevision:request.loaded.writeRevision};
      }else response={id:request.id,ok:true,...await checkpoint.step(request.action,request.date)};
    }catch(error){
      response={id:request.id,ok:false,message:error instanceof Error?error.message:'크레 러시 저장 실패',conflict:error instanceof SaveConflict};
    }
    self.postMessage(response);
  });
};
