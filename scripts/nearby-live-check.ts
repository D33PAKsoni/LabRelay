import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { AppwriteException, Client, ExecutionMethod, Functions } from 'node-appwrite';
import handler from '../src/function.js';
import { config, marker, safeFailure } from './config.js';
const hosted = process.argv.includes('--hosted');
const c = config(); process.env.APPWRITE_DATABASE_ID=c.databaseId;
const sessions: {userId:string;sessionId:string}[]=[];
const tokens=new Map<string,string>();
const results: {check:string;status:'pass'|'fail';detail?:string}[]=[];
async function token(userId:string) {
  if(tokens.has(userId))return tokens.get(userId)!;
  const s=await c.users.createSession({userId});sessions.push({userId,sessionId:s.$id});
  const jwt=(await c.users.createJWT({userId,sessionId:s.$id,duration:900})).jwt;tokens.set(userId,jwt);return jwt;
}
async function invoke(actor:string,body:unknown,path='/sites/nearby') {
  if(hosted) {
    const e=await new Functions(new Client().setEndpoint(c.endpoint).setProject(c.projectId).setJWT(await token(actor)))
      .createExecution({functionId:'labrelay_api',async:false,xpath:path,method:ExecutionMethod.POST,body:JSON.stringify(body)});
    return {status:e.responseStatusCode,body:JSON.parse(e.responseBody)};
  }
  let status=0,value:any;
  await handler({req:{method:'POST',path,bodyJson:body,headers:{'x-appwrite-user-jwt':await token(actor),'x-appwrite-key':process.env.APPWRITE_API_KEY!}},
    res:{json(body,code=200){status=code;value=body;return body;}},error(){}});
  return {status,body:value};
}
async function check(name:string,run:()=>Promise<void>) {
  try{await run();results.push({check:name,status:'pass'});console.log('PASS '+name);}
  catch(e){results.push({check:name,status:'fail',detail:safeFailure(e)});console.log('FAIL '+name);}
}
const input={originSiteId:'lr_geo_origin',radiusKm:1};
try {
  assert.equal((await c.db.get({databaseId:c.databaseId})).description,marker);
  for(const site of [
    {id:'lr_geo_origin',orgId:'lr_org_a',name:'Fictional geo reference',location:[78.4744,17.385]},
    {id:'lr_geo_near',orgId:'lr_org_a',name:'Fictional nearby station',location:[78.478,17.385]},
    {id:'lr_geo_far',orgId:'lr_org_a',name:'Fictional distant station',location:[78.6,17.5]},
    {id:'lr_geo_other',orgId:'lr_org_b',name:'Fictional other organization station',location:[78.4744,17.385]},
  ]) {
    const {id,...data}=site;
    try{await c.db.createRow({databaseId:c.databaseId,tableId:'sites',rowId:id,data,permissions:[]});}
    catch(e){if(!(e instanceof AppwriteException && e.code===409))throw e;const row=await c.db.getRow({databaseId:c.databaseId,tableId:'sites',rowId:id});assert.equal(row.orgId,site.orgId);assert.equal(row.name,site.name);assert.deepEqual(row.location,site.location);}
  }
  await check('real meter-based spatial query includes the nearby site and excludes distant and foreign sites',async()=>{
    const response=await invoke('lrtest_courier_0',input);assert.equal(response.status,200);
    const ids=response.body.sites.map((item:any)=>item.site.id);
    assert(ids.includes('lr_geo_origin'));assert(ids.includes('lr_geo_near'));assert(!ids.includes('lr_geo_far'));assert(!ids.includes('lr_geo_other'));
    assert(response.body.sites.every((item:any)=>item.site.orgId==='lr_org_a'));
    const near=response.body.sites.find((item:any)=>item.site.id==='lr_geo_near');assert(near.distanceMeters>300 && near.distanceMeters<450);
    for(let i=1;i<response.body.sites.length;i++)assert(response.body.sites[i].distanceMeters>=response.body.sites[i-1].distanceMeters);
  });
  await check('radius changes are honored and all active roles can query their own sites',async()=>{
    const tight=await invoke('lrtest_collector',{...input,radiusKm:0.1});assert.equal(tight.status,200);assert(!tight.body.sites.some((item:any)=>item.site.id==='lr_geo_near'));
    const wide=await invoke('lrtest_receiver',{...input,radiusKm:50});assert.equal(wide.status,200);assert(wide.body.sites.some((item:any)=>item.site.id==='lr_geo_far'));
  });
  await check('foreign and missing origins are indistinguishable and organization spoofing is rejected',async()=>{
    const foreign=await invoke('lrtest_outsider',input);const missing=await invoke('lrtest_outsider',{...input,originSiteId:'lr_geo_missing'});
    assert.equal(foreign.status,404);assert.deepEqual(foreign,missing);
    const own=await invoke('lrtest_outsider',{...input,originSiteId:'lr_geo_other'});assert.equal(own.status,200);assert(own.body.sites.every((item:any)=>item.site.orgId==='lr_org_b'));
    assert.equal((await invoke('lrtest_courier_0',{...input,orgId:'lr_org_b'})).status,400);
  });
  await check('invalid radius and anonymous execution remain closed',async()=>{
    for(const radiusKm of [0,-1,101,'1',null])assert.equal((await invoke('lrtest_courier_0',{...input,radiusKm})).status,400);
    if(hosted)await assert.rejects(new Functions(new Client().setEndpoint(c.endpoint).setProject(c.projectId)).createExecution({functionId:'labrelay_api',async:false,xpath:'/sites/nearby',method:ExecutionMethod.POST,body:JSON.stringify(input)}),e=>e instanceof AppwriteException && [401,403].includes(e.code));
    else {let status=0;await handler({req:{method:'POST',path:'/sites/nearby',bodyJson:input,headers:{}},res:{json(value,code=200){status=code;return value;}},error(){}});assert.equal(status,401);}
  });
} catch(e) {results.push({check:'nearby prerequisites',status:'fail',detail:safeFailure(e)});}
finally {
  for(const session of sessions)try{await c.users.deleteSession(session);}catch{results.push({check:'test session cleanup',status:'fail'});}
  await mkdir('reports',{recursive:true});const path=hosted?'reports/nearby-hosted-results.json':'reports/nearby-cloud-results.json';
  await writeFile(path,JSON.stringify({at:new Date().toISOString(),scope:hosted?'Deployed Appwrite Function with real JWTs and spatial queries.':'Local handler with real Appwrite Auth and indexed spatial queries.',results},null,2)+'\n');
  console.log('Saved '+path+' (no secrets).');if(results.some(r=>r.status==='fail'))process.exitCode=1;
}
