import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture, fixedTime } from './fixtures.js';
import { DomainError } from '../../src/domain/errors.js';
import { stableId } from '../../src/domain/service.js';
import type { Command, Sample, Write } from '../../src/domain/types.js';
const isCode = (value: string) => (error: unknown) => error instanceof DomainError && error.code === value;
async function setup() {
  const f = fixture();
  f.store.seed('sites', { id: 'site_001', orgId: 'org_a', name: 'Fictional site', location: [78,17] });
  for (const id of ['water_001','water_002']) {
    if (id !== 'water_001') f.store.seed('samples', { ...f.sample, id });
    await f.service.execute('courier_0', { kind: 'claim', sampleId: id, operationId: 'claim_'+id, expectedVersion: 0 });
    const first = await f.service.execute('collector', { kind: 'offer_handoff', sampleId: id, operationId: 'offer_'+id, expectedVersion: 1, toUserId: 'courier_0' });
    await f.service.execute('courier_0', { kind: 'accept_handoff', sampleId: id, operationId: 'take_'+id, expectedVersion: 2, handoffId: first.pendingHandoffId });
    await f.service.execute('courier_0', { kind: 'offer_handoff', sampleId: id, operationId: 'lab_'+id, expectedVersion: 3, toUserId: 'receiver' });
  }
  const manifest = await f.service.batchManifest('receiver','batch_001');
  const command: Extract<Command,{kind:'reconcile_batch'}> = { kind:'reconcile_batch', operationId:'receipt_1', batchId:manifest.batchId,
    batchVersion:manifest.version, sampleId:manifest.items[0]!.sample.id, expectedVersion:manifest.items[0]!.sample.version,
    expected:manifest.items.map(({sample})=>({sampleId:sample.id,version:sample.version})), scannedIds:['water_001','water_001','foreign_id'] };
  return { ...f, manifest, command };
}
test('batch receipt persists all discrepancies and transfers only one unique matching sample', async () => {
  const { service, store, command } = await setup();
  const result = await service.execute('receiver',command);
  const report = await service.readReceipt('collector',result.receiptId!);
  assert.equal(report.status,'discrepancy'); assert.equal(report.receivedCount,1); assert.equal(report.missingCount,1);
  assert.deepEqual(report.details.missing,['water_002']); assert.deepEqual(report.details.unexpected,['foreign_id']);
  assert.deepEqual(report.details.duplicateScans,['water_001']);
  const received = await service.read('receiver','water_001'), missing = await service.read('receiver','water_002');
  assert.equal(received.status,'received'); assert.equal(received.custodianId,'receiver'); assert.equal(received.version,5);
  assert.equal(missing.status,'in_transit'); assert.equal(missing.custodianId,'courier_0'); assert.equal(missing.version,5);
  assert.ok(missing.pendingHandoffId);
  assert.equal((await store.get('handoffs',missing.pendingHandoffId!))!.status,'offered');
  assert.equal(store.list('events').filter(e=>e.kind==='receipt_accepted').length,1);
  assert.equal(store.list('events').filter(e=>e.kind==='receipt_missing').length,1);
  assert.equal(await store.get('samples','foreign_id'),null);
});
test('a lost acknowledgment replays the same receipt without additional transfers or records', async () => {
  const { service, store, command } = await setup();
  const first = await service.execute('receiver',command), events = store.list('events').length;
  assert.deepEqual(await service.execute('receiver',command),first);
  assert.equal(store.list('batch_receipts').length,1); assert.equal(store.list('events').length,events);
  await assert.rejects(service.execute('receiver',{...command,scannedIds:['water_002']}),isCode('OPERATION_ID_REUSED'));
});
test('only the intended receiver can inspect the manifest or reconcile it', async () => {
  const { service, store, command } = await setup();
  store.seed('memberships',{id:'wrong_receiver',orgId:'org_a',role:'receiver',active:true});
  store.seed('memberships',{id:'other_lab',orgId:'org_b',role:'receiver',active:true});
  for (const actor of ['collector','courier_0']) await assert.rejects(service.execute(actor,command),isCode('FORBIDDEN'));
  for (const actor of ['wrong_receiver','other_lab']) await assert.rejects(service.execute(actor,command),isCode('NO_OFFERED_SAMPLES'));
  const result = await service.execute('receiver',command);
  await assert.rejects(service.readReceipt('other_lab',result.receiptId!),isCode('NOT_FOUND'));
});
test('omitted samples, altered revisions and stale batch versions cannot shrink the expected manifest', async () => {
  const { service, store, command } = await setup();
  await assert.rejects(service.execute('receiver',{...command,expected:command.expected.slice(0,1)}),isCode('STALE_MANIFEST'));
  await assert.rejects(service.execute('receiver',{...command,batchVersion:command.batchVersion-1}),isCode('STALE_MANIFEST'));
  await service.execute('courier_0',{kind:'observe',sampleId:'water_002',expectedVersion:4,operationId:'changed',note:'Seal rechecked',capturedAt:fixedTime});
  await assert.rejects(service.execute('receiver',command),isCode('STALE_MANIFEST'));
  assert.equal(store.list('batch_receipts').length,0);
  assert.equal((await service.read('receiver','water_001')).custodianId,'courier_0');
});
test('a late transaction failure rolls back received and missing sample revisions together', async () => {
  const { service, store, command } = await setup();
  const commit = store.commit.bind(store);
  store.commit = async writes => commit([...writes,{table:'samples',action:'create',record:(await store.get('samples','water_001'))!}]);
  await assert.rejects(service.execute('receiver',command),isCode('CONFLICT'));
  assert.equal(store.list('batch_receipts').length,0);
  for(const id of ['water_001','water_002']) { const sample=await service.read('receiver',id); assert.equal(sample.version,4);assert.equal(sample.custodianId,'courier_0'); }
});
test('competing receipts yield one report and no partial custody change', async () => {
  const { service, store, command } = await setup();
  let arrivals=0;let release!:()=>void;const barrier=new Promise<void>(resolve=>{release=resolve;});
  store.beforeCommit=async()=>{if(++arrivals===2)release();await barrier;};
  const results=await Promise.allSettled([service.execute('receiver',command),service.execute('receiver',{...command,operationId:'competitor',scannedIds:['water_002']})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(store.list('batch_receipts').length,1);
  assert.equal(store.list('events').filter(e=>e.kind.startsWith('receipt_')).length,2);
});
test('registration racing a receipt invalidates the manifest transaction before custody changes', async () => {
  const { service, store, command } = await setup();
  const commit=store.commit.bind(store);let advanced=false;
  store.commit=async writes=>{
    if(!advanced && writes.some(w=>w.table==='batch_receipts')) {
      advanced=true;
      await service.execute('collector',{kind:'register_sample',sampleId:'late_sample',expectedVersion:0,operationId:'late_registration',
        batchId:'batch_001',siteId:'site_001',label:'Late collection'});
    }
    return commit(writes);
  };
  await assert.rejects(service.execute('receiver',command),isCode('CONFLICT'));
  assert.equal(store.list('batch_receipts').length,0);
  assert.equal((await service.read('receiver','water_001')).version,4);
});
test('missing samples can be received later without rewriting the historical discrepancy', async () => {
  const { service, command }=await setup();
  const first=await service.execute('receiver',command);
  const manifest=await service.batchManifest('receiver','batch_001');
  assert.deepEqual(manifest.items.map(i=>i.sample.id),['water_002']);
  const last=await service.execute('receiver',{kind:'reconcile_batch',operationId:'late_receipt',batchId:'batch_001',batchVersion:manifest.version,
    sampleId:'water_002',expectedVersion:5,expected:[{sampleId:'water_002',version:5}],scannedIds:['water_002']});
  assert.equal((await service.readReceipt('receiver',last.receiptId!)).status,'matched');
  assert.deepEqual((await service.readReceipt('receiver',first.receiptId!)).details.missing,['water_002']);
  assert.equal((await service.read('receiver','water_002')).custodianId,'receiver');
});
test('an explicitly empty scan list records absence without changing any custodian',async()=>{
  const {service,store,command}=await setup();
  const result=await service.execute('receiver',{...command,scannedIds:[]});
  assert.equal((await service.readReceipt('receiver',result.receiptId!)).missingCount,2);
  assert.ok(store.list('samples').every(sample=>sample.custodianId==='courier_0'));
});
test('malformed or oversized receipt inputs do not write a report',async()=>{
  const {service,store,command}=await setup();
  for(const change of [{scannedIds:Array(61).fill('water_001')},{expected:[command.expected[0],command.expected[0]]},
    {scannedIds:['invalid id']},{batchVersion:-1},{orgId:'forged'},{expected:[]}])
    await assert.rejects(service.execute('receiver',{...command,...change}),isCode('INVALID_COMMAND'));
  assert.equal(store.list('batch_receipts').length,0);
});
test('twenty matching samples stay within the Free-plan transaction budget',async()=>{
  const {service,store,sample}=fixture();
  for(let i=0;i<20;i++){
    const id='bulk_'+i, handoffId='offer_'+i;
    store.seed('samples',{...sample,id,batchId:'bulk_batch',status:'in_transit',version:4,custodianId:'courier_0',assignedCourierId:'courier_0',pendingHandoffId:handoffId});
    store.seed('handoffs',{id:handoffId,orgId:'org_a',sampleId:id,fromUserId:'courier_0',toUserId:'receiver',status:'offered',offeredAt:'2026-10-27T12:00:00Z',acceptedAt:null});
  }
  const manifest=await service.batchManifest('receiver','bulk_batch');
  let count=0;const commit=store.commit.bind(store);store.commit=async writes=>{count=writes.length;return commit(writes);};
  const result=await service.execute('receiver',{kind:'reconcile_batch',operationId:'bulk_receipt',sampleId:manifest.items[0]!.sample.id,expectedVersion:4,
    batchId:'bulk_batch',batchVersion:manifest.version,expected:manifest.items.map(({sample})=>({sampleId:sample.id,version:4})),scannedIds:manifest.items.map(({sample})=>sample.id)});
  assert.equal((await service.readReceipt('receiver',result.receiptId!)).receivedCount,20);assert.equal(count,64);
});
