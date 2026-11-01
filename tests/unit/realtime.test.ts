import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppwriteException, type TablesDB } from 'node-appwrite';
import { ensureLiveFeed, publishChange, revokeLiveFeed } from '../../src/live.js';
import { refreshLoop } from '../../src/realtime/refresh.js';
const member={id:'actor',orgId:'org',role:'collector' as const,active:true};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('live feed creates only an owner-readable random refresh signal',async()=>{
  let created:any;
  const db={async getRow(){throw new AppwriteException('missing',404);},async createRow(args:any){created=args;}} as unknown as TablesDB;
  assert.deepEqual(await ensureLiveFeed(db,'db',member),{databaseId:'db',tableId:'live_updates',rowId:'actor'});
  assert.deepEqual(created.permissions,['read("user:actor")']);assert.deepEqual(Object.keys(created.data).sort(),['changedAt','token']);
  assert.equal(created.data.token.length,36);
});
test('existing feed with stale grants is narrowed to its owner and revoked feed becomes server-only',async()=>{
  const writes:any[]=[];const db={async getRow(){return {$permissions:['read("any")']};},async updateRow(args:any){writes.push(args);}} as unknown as TablesDB;
  await ensureLiveFeed(db,'db',member);await revokeLiveFeed(db,'db',member.id);
  assert.deepEqual(writes.map(w=>w.permissions),[['read("user:actor")'],[]]);
});
test('notification fanout queries active organization members and never publishes business payloads',async()=>{
  let query:any;const writes:any[]=[];
  const db={async listRows(args:any){query=args;return {total:2,rows:[{$id:'a'},{$id:'b'}]};},async updateRow(args:any){writes.push(args);}} as unknown as TablesDB;
  await publishChange(db,'db','org');
  const filters=query.queries.map(JSON.parse);assert(filters.some((q:any)=>q.attribute==='orgId'&&q.values[0]==='org'));assert(filters.some((q:any)=>q.attribute==='active'&&q.values[0]===true));
  assert.equal(writes.length,2);for(const w of writes){assert.deepEqual(Object.keys(w.data).sort(),['changedAt','token']);assert.deepEqual(w.permissions,['read("user:'+w.rowId+'")']);}
});
test('notification failure is visible to the caller and fanout cannot silently truncate',async()=>{
  const db={async listRows(){return {total:101,rows:[]};}} as unknown as TablesDB;
  await assert.rejects(publishChange(db,'db','org'));
  const broken={async listRows(){return {total:1,rows:[{$id:'a'}]};},async updateRow(){throw Error('unavailable');}} as unknown as TablesDB;
  await assert.rejects(publishChange(broken,'db','org'));
});
test('refresh coordinator coalesces bursts and schedules one follow-up for an in-flight change',async t=>{
  t.mock.timers.enable({apis:['setTimeout','setInterval']});let calls=0,release!:()=>void;
  const loop=refreshLoop(async()=>{calls++;if(calls===1)await new Promise<void>(resolve=>{release=resolve;});});
  loop.notify();loop.notify();t.mock.timers.tick(200);assert.equal(calls,1);
  loop.notify();loop.notify();t.mock.timers.tick(200);assert.equal(calls,1);
  release();await tick();t.mock.timers.tick(200);await tick();assert.equal(calls,2);loop.dispose();
});
test('periodic refresh recovers missed signals, failures do not stop later reads, and disposal stops timers',async t=>{
  t.mock.timers.enable({apis:['setTimeout','setInterval']});let calls=0;
  const loop=refreshLoop(async()=>{calls++;throw Error('temporary failure');});
  t.mock.timers.tick(30000);t.mock.timers.tick(200);await tick();assert.equal(calls,1);
  loop.notify();t.mock.timers.tick(200);await tick();assert.equal(calls,2);
  loop.notify();loop.dispose();t.mock.timers.tick(60000);await tick();assert.equal(calls,2);
});
