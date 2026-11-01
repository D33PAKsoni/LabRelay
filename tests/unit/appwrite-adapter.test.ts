import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppwriteException, type TablesDB } from 'node-appwrite';
import { AppwriteStore } from '../../src/adapters/appwrite.js';
import { StorageConflict } from '../../src/domain/errors.js';
import { fixture } from './fixtures.js';

test('adapter stages related writes atomically and removes all direct business-row grants', async () => {
  const calls: { operation: string; args: Record<string, unknown> }[] = [];
  const fake = {
    async createTransaction() { return { $id: 'tx' }; },
    async createRow(args: Record<string, unknown>) { calls.push({ operation: 'create', args }); },
    async updateRow(args: Record<string, unknown>) { calls.push({ operation: 'update', args }); },
    async updateTransaction(args: Record<string, unknown>) { calls.push({ operation: 'finish', args }); },
  } as unknown as TablesDB;
  const { sample } = fixture();
  await new AppwriteStore(fake, 'test', async () => ['collector']).commit([
    { table: 'samples', action: 'update', record: { ...sample, version: 1 } },
    { table: 'handoffs', action: 'create', record: { id: 'handoff', orgId: 'org_a', sampleId: sample.id,
      fromUserId: 'collector', toUserId: 'courier', status: 'offered', offeredAt: '2026-10-27T12:00:00Z', acceptedAt: null } },
  ]);
  assert.deepEqual(calls.map(c => c.operation), ['update','create','finish']);
  assert.deepEqual(calls[0]!.args.permissions, []);
  assert.deepEqual(calls[1]!.args.permissions, []);
  for (const c of calls) assert.equal(c.args.transactionId, 'tx');
  assert.equal(calls[2]!.args.commit, true);
});
test('adapter rolls back and maps SDK conflicts to the domain conflict type', async () => {
  let rolledBack = false;
  const fake = {
    async createTransaction() { return { $id: 'tx' }; },
    async createRow() { throw new AppwriteException('conflict', 409, 'row_already_exists'); },
    async updateTransaction(args: { rollback: boolean }) { rolledBack = args.rollback; },
  } as unknown as TablesDB;
  const { sample } = fixture();
  await assert.rejects(new AppwriteStore(fake, 'test', async () => ['collector']).commit([
    { table: 'samples', action: 'create', record: sample },
  ]), e => e instanceof StorageConflict);
  assert.equal(rolledBack, true);
});
