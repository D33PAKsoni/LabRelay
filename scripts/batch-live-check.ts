import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { Account, AppwriteException, Client, ExecutionMethod, Functions, TablesDB } from 'node-appwrite';
import handler from '../src/function.js';
import { config, safeFailure } from './config.js';
import type { BatchManifest, Command, CommandResult } from '../src/domain/types.js';
const hosted=process.argv.includes('--hosted'),c=config();
process.env.APPWRITE_DATABASE_ID=c.databaseId;
const tag=randomUUID().replaceAll('-','').slice(0,10),batchId='rc_'+tag,ids=['rca_'+tag,'rcb_'+tag];
const sessions:{userId:string;sessionId:string}[]=[],tokens=new Map<string,string>();
const results:{check:string;status:'pass'|'fail';detail?:string}[]=[];
let command:Extract<Command,{kind:'reconcile_batch'}>,winnerCommand:Command,winner:Record<string,any>;
async function jwt(actor:string){
  if(tokens.has(actor))return tokens.get(actor)!;
  const session=await c.users.createSession({userId:actor});sessions.push({userId:actor,sessionId:session.$id});
  const token=(await c.users.createJWT({userId:actor,sessionId:session.$id,duration:1200})).jwt;tokens.set(actor,token);return token;
}
async function invoke(actor:string,method:'GET'|'POST',path:string,body:unknown={}){
  if(hosted){const result=await new Functions(new Client().setEndpoint(c.endpoint).setProject(c.projectId).setJWT(await jwt(actor))).createExecution({
    functionId:'labrelay_api',async:false,xpath:path,method:method==='GET'?ExecutionMethod.GET:ExecutionMethod.POST,...(method==='POST'?{body:JSON.stringify(body)}:{})});
    return {status:result.responseStatusCode,body:JSON.parse(result.responseBody) as Record<string,any>};}
  let status=0,value:unknown;
  await handler({req:{method,path,headers:{'x-appwrite-user-jwt':await jwt(actor),'x-appwrite-key':process.env.APPWRITE_API_KEY!},bodyJson:body},
    res:{json(body,code=200){status=code;value=body;return body;}},error(){}});
  return{status,body:value as Record<string,any>};
}
async function call(actor:string,body:object){
  const r=await invoke(actor,'POST','/commands',{operationId:randomUUID().replaceAll('-',''),...body});
  assert.equal(r.status,200,'Fixture command did not commit: '+String(r.body.error||r.status));return r.body;
}
async function check(name:string,run:()=>Promise<void>){
  try{await run();results.push({check:name,status:'pass'});console.log('PASS '+name);}
  catch(error){results.push({check:name,status:'fail',detail:safeFailure(error)});console.log('FAIL '+name);}
}
function receiptCommand(manifest:BatchManifest,scannedIds:string[],operationId:string):Extract<Command,{kind:'reconcile_batch'}>{
  const sample=manifest.items[0]!.sample;
  return{kind:'reconcile_batch',sampleId:sample.id,expectedVersion:sample.version,operationId,batchId:manifest.batchId,
    batchVersion:manifest.version,expected:manifest.items.map(({sample})=>({sampleId:sample.id,version:sample.version})),scannedIds};
}
try{
  for(const sampleId of ids){
    await call('lrtest_collector',{kind:'register_sample',sampleId,expectedVersion:0,label:'Fictional receipt test '+sampleId,batchId,siteId:'lr_site_001'});
    await call('lrtest_courier_0',{kind:'claim',sampleId,expectedVersion:0});
    const offer=await call('lrtest_collector',{kind:'offer_handoff',sampleId,expectedVersion:1,toUserId:'lrtest_courier_0'});
    await call('lrtest_courier_0',{kind:'accept_handoff',sampleId,expectedVersion:2,handoffId:offer.pendingHandoffId});
    await call('lrtest_courier_0',{kind:'offer_handoff',sampleId,expectedVersion:3,toUserId:'lrtest_receiver'});
  }
  await check('manifest is server-derived and receiver-authorized',async()=>{
    assert.equal((await invoke('lrtest_collector','GET','/batches/'+batchId+'/manifest')).status,403);
    assert.equal((await invoke('lrtest_outsider','GET','/batches/'+batchId+'/manifest')).status,403);
    const r=await invoke('lrtest_receiver','GET','/batches/'+batchId+'/manifest');assert.equal(r.status,200);
    const manifest=r.body as BatchManifest;assert.deepEqual(manifest.items.map(item=>item.sample.id),ids);
    command=receiptCommand(manifest,[ids[0]!,ids[0]!,'unlisted_'+tag],'receipt_'+tag);
  });
  await check('competing receipts commit one discrepancy report and preserve missing custody',async()=>{
    const competing={...command,operationId:'other_'+tag};
    const outcomes=await Promise.all([invoke('lrtest_receiver','POST','/commands',command),invoke('lrtest_receiver','POST','/commands',competing)]);
    assert.equal(outcomes.filter(r=>r.status===200).length,1);assert.equal(outcomes.filter(r=>r.status===409).length,1);
    const index=outcomes.findIndex(r=>r.status===200);winner=outcomes[index]!.body;winnerCommand=index===0?command:competing;
    const report=await invoke('lrtest_receiver','GET','/receipts/'+winner.receiptId);
    assert.equal(report.status,200);assert.equal(report.body.receivedCount,1);assert.equal(report.body.missingCount,1);
    assert.deepEqual(report.body.details.missing,[ids[1]]);assert.deepEqual(report.body.details.duplicateScans,[ids[0]]);
    assert.deepEqual(report.body.details.unexpected,['unlisted_'+tag]);
    const a=await c.db.getRow({databaseId:c.databaseId,tableId:'samples',rowId:ids[0]!});
    const b=await c.db.getRow({databaseId:c.databaseId,tableId:'samples',rowId:ids[1]!});
    assert.equal(a.custodianId,'lrtest_receiver');assert.equal(a.status,'received');
    assert.equal(b.custodianId,'lrtest_courier_0');assert.equal(b.status,'in_transit');assert.equal(b.version,5);assert.ok(b.pendingHandoffId);
  });
  await check('retry returns the original receipt and cross-organization reads are denied',async()=>{
    const retry=await invoke('lrtest_receiver','POST','/commands',winnerCommand);
    assert.equal(retry.status,200);assert.deepEqual(retry.body,winner);
    assert.equal((await invoke('lrtest_outsider','GET','/receipts/'+winner.receiptId)).status,404);
    const own=new TablesDB(new Client().setEndpoint(c.endpoint).setProject(c.projectId).setJWT(await jwt('lrtest_receiver')));
    const other=new TablesDB(new Client().setEndpoint(c.endpoint).setProject(c.projectId).setJWT(await jwt('lrtest_outsider')));
    assert.equal((await invoke('lrtest_receiver','GET','/receipts/'+winner.receiptId)).status,200);
    await assert.rejects(own.getRow({databaseId:c.databaseId,tableId:'batch_receipts',rowId:winner.receiptId}),e=>e instanceof AppwriteException&&[401,403,404].includes(e.code));
    await assert.rejects(other.getRow({databaseId:c.databaseId,tableId:'batch_receipts',rowId:winner.receiptId}),
      e=>e instanceof AppwriteException&&[401,403,404].includes(e.code));
    const workspace=await invoke('lrtest_receiver','GET','/workspace');
    assert.equal(workspace.body.receipts.filter((receipt:any)=>receipt.id===winner.receiptId).length,1);
  });
  await check('a stale receiving screen cannot overwrite an intervening observation',async()=>{
    const r=await invoke('lrtest_receiver','GET','/batches/'+batchId+'/manifest');assert.equal(r.status,200);
    const stale=receiptCommand(r.body as BatchManifest,[ids[1]!],'stale_'+tag);
    await call('lrtest_courier_0',{kind:'observe',sampleId:ids[1],expectedVersion:5,note:'Checked while missing receipt is reviewed',capturedAt:new Date().toISOString()});
    const denied=await invoke('lrtest_receiver','POST','/commands',stale);assert.equal(denied.status,409);assert.equal(denied.body.error,'STALE_MANIFEST');
    assert.equal((await c.db.getRow({databaseId:c.databaseId,tableId:'samples',rowId:ids[1]!})).custodianId,'lrtest_courier_0');
  });
  await check('a later matching receipt preserves the original missing-sample snapshot',async()=>{
    const r=await invoke('lrtest_receiver','GET','/batches/'+batchId+'/manifest');assert.equal(r.status,200);
    const accepted=await invoke('lrtest_receiver','POST','/commands',receiptCommand(r.body as BatchManifest,[ids[1]!],'later_'+tag));
    assert.equal(accepted.status,200);
    const current=await invoke('lrtest_receiver','GET','/receipts/'+accepted.body.receiptId);assert.equal(current.body.status,'matched');
    const prior=await invoke('lrtest_receiver','GET','/receipts/'+winner.receiptId);assert.deepEqual(prior.body.details.missing,[ids[1]]);
    assert.equal(prior.body.details.items.find((item:any)=>item.sampleId===ids[1]).toCustodianId,'lrtest_courier_0');
    assert.equal((await c.db.getRow({databaseId:c.databaseId,tableId:'samples',rowId:ids[1]!})).custodianId,'lrtest_receiver');
    assert.equal((await invoke('lrtest_receiver','GET','/batches/'+batchId+'/manifest')).status,404);
  });
}catch(error){results.push({check:'receipt prerequisites',status:'fail',detail:safeFailure(error)});}
finally{
  for(const session of sessions){try{await c.users.deleteSession(session);}catch{results.push({check:'session cleanup',status:'fail',detail:'Revoke remaining fictional-user sessions.'});}}
  const report=hosted?'reports/batch-hosted-results.json':'reports/batch-cloud-results.json';
  await writeFile(report,JSON.stringify({at:new Date().toISOString(),scope:hosted?'Hosted Appwrite Function with real JWTs and TablesDB transactions.':'Local handler against real Appwrite Auth and TablesDB.',batchId,results},null,2));
  console.log('Saved '+report+' (no secrets).');if(results.some(r=>r.status==='fail'))process.exitCode=1;
}
