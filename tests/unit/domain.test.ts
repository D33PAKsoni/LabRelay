import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DomainError, StorageConflict } from '../../src/domain/errors.js';
import { reconcileManifest } from '../../src/domain/manifest.js';
import { fixedTime, fixture } from './fixtures.js';

const code = (value: string) => (e: unknown) => e instanceof DomainError && e.code === value;
const claim = { kind: 'claim', sampleId: 'water_001', expectedVersion: 0, operationId: 'claim_001' };

test('ten concurrent couriers produce exactly one accepted claim and keep custody with collector', async () => {
  const { store, service } = fixture();
  let count = 0; let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  store.beforeCommit = async () => { count++; if (count === 10) release(); await barrier; };
  const results = await Promise.allSettled(Array.from({ length: 10 }, (_, i) => service.execute(`courier_${i}`, { ...claim, operationId: `race_${i}` })));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  for (const r of results) if (r.status === 'rejected') assert.ok(code('CONFLICT')(r.reason));
  assert.equal(store.list('events').length, 1); assert.equal(store.list('operations').length, 1);
  const sample = await service.read('collector', 'water_001');
  assert.equal(sample.version, 1); assert.equal(sample.custodianId, 'collector');
  assert.equal(sample.status, 'assigned'); assert.match(sample.assignedCourierId!, /^courier_/);
});
test('retrying after a lost response returns the original result without another event', async () => {
  const { service, store } = fixture();
  const first = await service.execute('courier_0', claim);
  assert.deepEqual(await service.execute('courier_0', claim), first);
  assert.equal(store.list('events').length, 1); assert.equal(store.list('operations').length, 1);
});
test('simultaneous identical operations are idempotent', async () => {
  const { service, store } = fixture();
  let arrivals = 0; let release!: () => void;
  const barrier = new Promise<void>(r => { release = r; });
  store.beforeCommit = async () => { if (++arrivals === 2) release(); await barrier; };
  const [a,b] = await Promise.all([service.execute('courier_0', claim), service.execute('courier_0', claim)]);
  assert.deepEqual(a,b); assert.equal(store.list('events').length, 1);
});
test('reusing an operation ID for a changed payload is rejected', async () => {
  const { service } = fixture(); await service.execute('courier_0', claim);
  await assert.rejects(service.execute('courier_0', { ...claim, expectedVersion: 1 }), code('OPERATION_ID_REUSED'));
});
test('a second courier with a fresh version still cannot take an assigned pickup', async () => {
  const { service } = fixture(); await service.execute('courier_0', claim);
  await assert.rejects(service.execute('courier_1', { ...claim, expectedVersion: 1, operationId: 'second' }), code('ALREADY_ASSIGNED'));
});
test('collector and receiver roles cannot claim a pickup', async () => {
  const { service } = fixture();
  for (const actor of ['collector', 'receiver']) await assert.rejects(service.execute(actor, claim), code('FORBIDDEN'));
});
test('organization isolation blocks service reads and mutations', async () => {
  const { service } = fixture();
  await assert.rejects(service.read('outsider', 'water_001'), code('NOT_FOUND'));
  await assert.rejects(service.execute('outsider', claim), code('NOT_FOUND'));
});
test('missing or disabled memberships cannot access a sample', async () => {
  const { service } = fixture();
  for (const actor of ['unknown', 'disabled']) await assert.rejects(service.read(actor, 'water_001'), code('FORBIDDEN'));
});
test('request body cannot spoof actor, organization, or role', async () => {
  const { service } = fixture();
  for (const extra of [{ actorId: 'collector' }, { orgId: 'org_a' }, { role: 'courier' }])
    await assert.rejects(service.execute('courier_0', { ...claim, ...extra }), code('INVALID_COMMAND'));
});
test('a complete journey requires sender offer and intended receiver acknowledgment', async () => {
  const { service, store } = fixture();
  await service.execute('courier_0', claim);
  const offer = await service.execute('collector', { kind: 'offer_handoff', sampleId: 'water_001', operationId: 'offer_1', expectedVersion: 1, toUserId: 'courier_0' });
  assert.equal(offer.custodianId, 'collector');
  await assert.rejects(service.execute('courier_1', { kind: 'accept_handoff', sampleId: 'water_001', operationId: 'steal', expectedVersion: 2, handoffId: offer.pendingHandoffId }), code('FORBIDDEN'));
  const pickup = await service.execute('courier_0', { kind: 'accept_handoff', sampleId: 'water_001', operationId: 'pickup', expectedVersion: 2, handoffId: offer.pendingHandoffId });
  assert.equal(pickup.custodianId, 'courier_0'); assert.equal(pickup.status, 'in_transit');
  const delivery = await service.execute('courier_0', { kind: 'offer_handoff', sampleId: 'water_001', operationId: 'offer_2', expectedVersion: 3, toUserId: 'receiver' });
  const received = await service.execute('receiver', { kind: 'accept_handoff', sampleId: 'water_001', operationId: 'receipt', expectedVersion: 4, handoffId: delivery.pendingHandoffId });
  assert.equal(received.status, 'received'); assert.equal(received.custodianId, 'receiver');
  assert.equal(store.list('events').length, 5);
  assert.ok(store.list('handoffs').every(h => h.status === 'accepted'));
});
test('courier cannot offer or receive a sample before the collector offers it', async () => {
  const { service } = fixture(); await service.execute('courier_0', claim);
  await assert.rejects(service.execute('courier_0', { kind: 'offer_handoff', sampleId: 'water_001', operationId: 'wrong', expectedVersion: 1, toUserId: 'receiver' }), code('FORBIDDEN'));
});
test('stale offline observation cannot overwrite a newer revision', async () => {
  const { service, store } = fixture(); await service.execute('courier_0', claim);
  await assert.rejects(service.execute('collector', { kind: 'observe', sampleId: 'water_001', operationId: 'offline_old', expectedVersion: 0, note: 'Seal intact', capturedAt: fixedTime }), code('STALE_VERSION'));
  assert.equal(store.list('events').length, 1); assert.equal((await service.read('collector', 'water_001')).version, 1);
});
test('observations preserve client capture time separately from server recorded time', async () => {
  const { service, store } = fixture();
  await service.execute('collector', { kind: 'observe', sampleId: 'water_001', operationId: 'note', expectedVersion: 0, note: 'Seal intact', capturedAt: '2026-10-27T10:00:00Z' });
  const event = store.list('events')[0]!;
  assert.equal(event.capturedAt, '2026-10-27T10:00:00.000Z'); assert.equal(event.recordedAt, fixedTime);
});
test('invalid observations and malformed commands do not write anything', async () => {
  const { service, store } = fixture();
  for (const input of [null, [], { ...claim, expectedVersion: -1 }, { ...claim, kind: 'delete' },
    { kind: 'observe', sampleId: 'water_001', operationId: 'empty', expectedVersion: 0, note: '', capturedAt: fixedTime }])
    await assert.rejects(service.execute('collector', input), code('INVALID_COMMAND'));
  assert.equal(store.list('events').length, 0);
});
test('transaction model rolls back all earlier staged writes when a later create conflicts', async () => {
  const { store, sample } = fixture();
  await assert.rejects(store.commit([{ table: 'samples', action: 'update', record: { ...sample, version: 10 } },
    { table: 'samples', action: 'create', record: sample }]), e => e instanceof StorageConflict);
  assert.equal((await store.get('samples', sample.id))!.version, 0);
});
test('manifest reconciliation detects missing, unexpected, and duplicate scans', () => {
  assert.deepEqual(reconcileManifest(['a', 'b', 'c'], ['a', 'b', 'b', 'wrong']),
    { received: ['a', 'b'], missing: ['c'], unexpected: ['wrong'], duplicateScans: ['b'] });
  assert.throws(() => reconcileManifest(['a','a'], ['a']), code('INVALID_MANIFEST'));
});
