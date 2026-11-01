import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Account, AppwriteException, Client, Permission, Query, Role, TablesDB } from 'node-appwrite';
import handler from '../src/function.js';
import { AppwriteStore, pack } from '../src/adapters/appwrite.js';
import { DomainError, StorageConflict } from '../src/domain/errors.js';
import { LabRelayService } from '../src/domain/service.js';
import type { Sample } from '../src/domain/types.js';
import type { Fixture } from './bootstrap.js';
import { config, marker, safeFailure } from './config.js';

const results: { check: string; status: 'pass' | 'fail'; detail?: string }[] = [];
async function main() {
  const c = config();
  const existing = await c.db.get({ databaseId: c.databaseId });
  if (existing.description !== marker) throw new Error('Refusing to run against a database not marked as the LabRelay spike.');
  const fixture: Fixture = JSON.parse(await readFile('.local/fixture.json', 'utf8'));
  const readers = async (orgId: string) => fixture.actors.filter(a => a.orgId === orgId).map(a => a.id);
  const store = new AppwriteStore(c.db, c.databaseId, readers);
  const service = new LabRelayService(store);
  const tag = randomUUID().replaceAll('-', '').slice(0, 12);
  const sessions: { userId: string; sessionId: string }[] = [];
  const tokens = new Map<string,string>();
  process.env.APPWRITE_DATABASE_ID = c.databaseId;
  async function token(actor: string) {
    if (tokens.has(actor)) return tokens.get(actor)!;
    const session = await c.users.createSession({ userId: actor });
    sessions.push({ userId: actor, sessionId: session.$id });
    const jwt = (await c.users.createJWT({ userId: actor, sessionId: session.$id, duration: 300 })).jwt;
    tokens.set(actor, jwt); return jwt;
  }
  async function userDb(actor: string) {
    const client = new Client().setEndpoint(c.endpoint).setProject(c.projectId).setJWT(await token(actor));
    assert.equal((await new Account(client).get()).$id, actor); // positive authentication control
    return new TablesDB(client);
  }
  async function sample(suffix: string, orgId = 'lr_org_a', custodianId = 'lrtest_collector') {
    const row: Sample = { id: `lr_${tag}_${suffix}`, orgId, label: 'Fictional water test sample', batchId: `batch_${tag}`,
      siteId: 'lr_site_001', status: 'ready', custodianId, assignedCourierId: null, pendingHandoffId: null, version: 0 };
    await c.db.createRow({ databaseId: c.databaseId, tableId: 'samples', rowId: row.id, data: pack(row),
      permissions: [] });
    return row;
  }
  async function invoke(actor: string, body: unknown) {
    const value = body as Record<string, unknown>;
    const payload = typeof value.operationId === 'string' ? { ...value, operationId: value.operationId + '_' + tag } : body;
    let status = 0, response: unknown;
    await handler({ req: { method: 'POST', path: '/', headers: { 'x-appwrite-user-jwt': await token(actor),
      'x-appwrite-key': process.env.APPWRITE_API_KEY! }, bodyJson: payload },
      res: { json(value, code = 200) { response = value; status = code; return value; } }, error() {} });
    return { status, body: response as Record<string, unknown> };
  }
  async function check(name: string, run: () => Promise<void>) {
    try { await run(); results.push({ check: name, status: 'pass' }); console.log(`PASS ${name}`); }
    catch (error) { results.push({ check: name, status: 'fail', detail: safeFailure(error) }); console.log(`FAIL ${name}`); }
  }
  async function eventCount(id: string) {
    return (await c.db.listRows({ databaseId: c.databaseId, tableId: 'events', queries: [Query.equal('sampleId', id)], total: true })).total;
  }
  try {
    await check('ten simultaneous authenticated claims: one winner, one event, collector retains custody', async () => {
      const s = await sample('race');
      const couriers = fixture.actors.filter(a => a.orgId === 'lr_org_a' && a.role === 'courier');
      assert.equal(couriers.length, 10);
      for (const actor of couriers) await token(actor.id);
      const r = await Promise.all(couriers.map((a,i) => invoke(a.id, { kind: 'claim', sampleId: s.id, operationId: `race_${i}`, expectedVersion: 0 })));
      assert.equal(r.filter(x => x.status === 200).length, 1);
      for (const outcome of r) assert.ok([200,409].includes(outcome.status), `Unexpected status ${outcome.status}`);
      assert.equal(await eventCount(s.id), 1);
      const current = await service.read('lrtest_collector', s.id);
      assert.equal(current.version, 1); assert.equal(current.custodianId, 'lrtest_collector');
    });
    await check('duplicate request after response loss creates no extra event', async () => {
      const s = await sample('retry');
      const command = { kind: 'claim', sampleId: s.id, expectedVersion: 0, operationId: 'retry_one' };
      const first = await invoke('lrtest_courier_0', command), second = await invoke('lrtest_courier_0', command);
      assert.equal(first.status, 200); assert.equal(second.status, 200);
      assert.deepEqual(first.body, second.body); assert.equal(await eventCount(s.id), 1);
    });
    await check('direct row reads are denied while authorized service reads remain organization-isolated', async () => {
      const a = await sample('org_a'), b = await sample('org_b', 'lr_org_b', 'lrtest_outsider');
      const own = await userDb('lrtest_collector'), other = await userDb('lrtest_outsider');
      for(const [db,id] of [[own,a.id],[other,b.id]] as const)await assert.rejects(db.getRow({databaseId:c.databaseId,tableId:'samples',rowId:id}),e=>e instanceof AppwriteException&&[401,403,404].includes(e.code));
      assert.equal((await service.read('lrtest_collector',a.id)).id,a.id);assert.equal((await service.read('lrtest_outsider',b.id)).id,b.id);
      await assert.rejects(other.getRow({ databaseId: c.databaseId, tableId: 'samples', rowId: a.id }),
        e => e instanceof AppwriteException && [401,403,404].includes(e.code));
      assert.equal((await invoke('lrtest_outsider', { kind: 'claim', sampleId: a.id, expectedVersion: 0, operationId: 'wrong_org' })).status, 404);
    });
    await check('direct client mutation remains denied for private business rows', async () => {
      const s = await sample('write'); const client = await userDb('lrtest_collector');
      const patch: Record<string, unknown> = { version: 999 };
      await assert.rejects(client.updateRow({ databaseId: c.databaseId, tableId: 'samples', rowId: s.id, data: patch }),
        e => e instanceof AppwriteException && [401,403,404].includes(e.code));
      assert.equal((await service.read('lrtest_collector', s.id)).version, 0);
    });
    await check('stale observation is rejected without a custody overwrite', async () => {
      const s = await sample('stale');
      await service.execute('lrtest_courier_0', { kind: 'claim', sampleId: s.id, expectedVersion: 0, operationId: 'advance_' + tag });
      await assert.rejects(service.execute('lrtest_collector', { kind: 'observe', sampleId: s.id, expectedVersion: 0,
        operationId: 'stale_' + tag, note: 'Saved before pickup assignment', capturedAt: new Date().toISOString() }), e => e instanceof DomainError && e.code === 'STALE_VERSION');
      assert.equal(await eventCount(s.id), 1);
    });
    await check('transaction rollback leaves the earlier staged row unchanged', async () => {
      const s = await sample('rollback');
      await assert.rejects(store.commit([
        { action: 'update', table: 'samples', record: { ...s, version: 99 } },
        { action: 'create', table: 'samples', record: s },
      ]), e => e instanceof StorageConflict);
      assert.equal((await service.read('lrtest_collector', s.id)).version, 0);
    });
    await check('two acknowledged handoffs reach the laboratory through the authenticated handler', async () => {
      const s = await sample('journey');
      const call = async (actor: string, body: object) => { const r = await invoke(actor, { sampleId: s.id, ...body }); assert.equal(r.status, 200); return r.body; };
      await call('lrtest_courier_0', { kind: 'claim', expectedVersion: 0, operationId: 'claim' });
      const a = await call('lrtest_collector', { kind: 'offer_handoff', expectedVersion: 1, operationId: 'offer_1', toUserId: 'lrtest_courier_0' });
      await call('lrtest_courier_0', { kind: 'accept_handoff', expectedVersion: 2, operationId: 'accept_1', handoffId: a.pendingHandoffId });
      const b = await call('lrtest_courier_0', { kind: 'offer_handoff', expectedVersion: 3, operationId: 'offer_2', toUserId: 'lrtest_receiver' });
      const done = await call('lrtest_receiver', { kind: 'accept_handoff', expectedVersion: 4, operationId: 'accept_2', handoffId: b.pendingHandoffId });
      assert.equal(done.status, 'received'); assert.equal(done.custodianId, 'lrtest_receiver'); assert.equal(await eventCount(s.id), 5);
    });
  } finally {
    for (const session of sessions) {
      try { await c.users.deleteSession(session); }
      catch { results.push({ check: 'test session cleanup', status: 'fail', detail: 'Revoke remaining lrtest sessions in Console.' }); }
    }
  }
  if (results.some(x => x.status === 'fail')) process.exitCode = 1;
}
try { await main(); }
catch (error) { results.push({ check: 'cloud prerequisites', status: 'fail', detail: safeFailure(error) }); process.exitCode = 1; }
await mkdir('reports', { recursive: true });
await writeFile('reports/cloud-results.json', JSON.stringify({ at: new Date().toISOString(),
  scope: 'Locally invoked handler against real Appwrite Auth and TablesDB; hosted function deployment is a separate check.', results }, null, 2));
console.log('Saved reports/cloud-results.json (no API keys, JWTs or session secrets).');
