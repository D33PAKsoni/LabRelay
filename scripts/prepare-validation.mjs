import { readFile,writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import {config,marker,safeFailure} from '../dist/scripts/config.js';
import {AppwriteStore} from '../dist/src/adapters/appwrite.js';
import {LabRelayService} from '../dist/src/domain/service.js';
import {publishChange} from '../dist/src/live.js';
const path='.local/validation/current.json';
try{
 const c=config();if((await c.db.get({databaseId:c.databaseId})).description!==marker)throw Error('Unexpected database ownership.');
 let existing;try{existing=JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 if(existing&&!process.argv.includes('--new')){console.log(JSON.stringify({resumed:true,...existing}));process.exit(0);}
 const {accounts,orgId}=JSON.parse(await readFile('.local/demo-accounts.json','utf8'));
 const collector=accounts.find(a=>a.role==='collector'),courier=accounts.find(a=>a.role==='courier'),receiver=accounts.find(a=>a.role==='receiver');
 if(orgId!=='lrdemo_org'||!collector||!courier||!receiver)throw Error('Unexpected fictional account setup.');
 const service=new LabRelayService(new AppwriteStore(c.db,c.databaseId,async()=>[]));
 for(const actor of [collector,courier,receiver])if((await service.member(actor.id)).orgId!==orgId)throw Error('Unexpected membership.');
 const tag=randomBytes(3).toString('hex');
 const scenario={createdAt:new Date().toISOString(),url:'https://labrelay.appwrite.network',orgId,tag,
  pickup:{id:'val_'+tag+'_pickup',label:'Walkthrough '+tag+' - river pickup',batchId:'val_'+tag+'_pickup'},
  delivery:{batchId:'val_'+tag+'_delivery',arrivedId:'val_'+tag+'_arrived',missingId:'val_'+tag+'_missing',unexpectedId:'val_'+tag+'_unknown'},
  newCollection:{sampleId:'val_'+tag+'_new',batchId:'val_'+tag+'_field',siteId:'lrdemo_north_bank',label:'Walkthrough '+tag+' - field collection'},
  actors:{collector:collector.id,courier:courier.id,receiver:receiver.id}};
 await writeFile('.local/validation/preparing.json',JSON.stringify(scenario,null,2));
 for(const [sampleId,label,batchId,offer] of [[scenario.pickup.id,scenario.pickup.label,scenario.pickup.batchId,false],
   [scenario.delivery.arrivedId,'Walkthrough '+tag+' - delivered bottle',scenario.delivery.batchId,true],
   [scenario.delivery.missingId,'Walkthrough '+tag+' - second bottle',scenario.delivery.batchId,true]]){
  await service.execute(collector.id,{kind:'register_sample',sampleId,label,batchId,siteId:'lrdemo_north_bank',expectedVersion:0,operationId:'reg_'+sampleId});
  if(offer){await service.execute(courier.id,{kind:'claim',sampleId,expectedVersion:0,operationId:'claim_'+sampleId});
   const first=await service.execute(collector.id,{kind:'offer_handoff',sampleId,expectedVersion:1,toUserId:courier.id,operationId:'offer_'+sampleId});
   await service.execute(courier.id,{kind:'accept_handoff',sampleId,expectedVersion:2,handoffId:first.pendingHandoffId,operationId:'accept_'+sampleId});
   await service.execute(courier.id,{kind:'offer_handoff',sampleId,expectedVersion:3,toUserId:receiver.id,operationId:'lab_'+sampleId});}
 }
 await publishChange(c.db,c.databaseId,orgId);
 await writeFile(path,JSON.stringify(scenario,null,2)+'\n');
 await writeFile('.local/validation/scenario_'+tag+'.json',JSON.stringify(scenario,null,2)+'\n');
 console.log(JSON.stringify({prepared:true,...scenario}));
}catch(e){console.error(safeFailure(e));process.exitCode=1;}
