import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './fixtures.js';
import { DomainError } from '../../src/domain/errors.js';

const input = { kind: 'register_sample', sampleId: 'new_sample', operationId: 'register_1',
  expectedVersion: 0, label: 'River water · north bank', batchId: 'batch_002', siteId: 'site_001' };
const isCode = (code: string) => (error: unknown) => error instanceof DomainError && error.code === code;
function setup() {
  const f = fixture();
  f.store.seed('sites', { id: 'site_001', orgId: 'org_a', name: 'North bank', location: [78, 17] });
  f.store.seed('sites', { id: 'private_site', orgId: 'org_b', name: 'Other organization', location: [78, 17] });
  return f;
}
test('collector registration commits the sample, initial history and retry receipt together', async () => {
  const { service, store } = setup();
  const result = await service.execute('collector', input);
  assert.equal(result.version, 0); assert.equal(result.custodianId, 'collector'); assert.equal(result.status, 'ready');
  assert.equal((await service.read('collector', input.sampleId)).label, input.label);
  assert.equal(store.list('events').filter(e => e.sampleId === input.sampleId).length, 1);
  assert.deepEqual(await service.execute('collector', input), result);
  assert.equal(store.list('operations').length, 1);
});
test('registration denies self-selected roles, another organization site, and invalid revisions', async () => {
  const { service, store } = setup();
  await assert.rejects(service.execute('courier_0', input), isCode('FORBIDDEN'));
  await assert.rejects(service.execute('collector', { ...input, siteId: 'private_site' }), isCode('SITE_NOT_FOUND'));
  await assert.rejects(service.execute('collector', { ...input, expectedVersion: 1 }), isCode('INVALID_COMMAND'));
  await assert.rejects(service.execute('collector', { ...input, role: 'collector' }), isCode('INVALID_COMMAND'));
  assert.equal(store.list('operations').length, 0);
});
test('a second registration cannot replace an existing sample or its custodian', async () => {
  const { service } = setup();
  await service.execute('collector', input);
  await assert.rejects(service.execute('collector', { ...input, operationId: 'new_request' }), isCode('SAMPLE_EXISTS'));
  assert.equal((await service.read('collector', input.sampleId)).version, 0);
});
test('simultaneous registration creates one initial event and preserves the winner', async () => {
  const { service, store } = setup();
  let arrivals = 0; let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  store.beforeCommit = async () => { if (++arrivals === 2) release(); await barrier; };
  const results = await Promise.allSettled([
    service.execute('collector', input), service.execute('collector', { ...input, operationId: 'register_other' }),
  ]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(store.list('events').filter(e => e.sampleId === input.sampleId).length, 1);
});
