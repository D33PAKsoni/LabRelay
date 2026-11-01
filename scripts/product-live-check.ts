import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { Client, ExecutionMethod, Functions, AppwriteException } from 'node-appwrite';
import handler from '../src/function.js';
import { config, safeFailure } from './config.js';
const hosted = process.argv.includes('--hosted');
const results: { check: string; status: 'pass' | 'fail'; detail?: string }[] = [];
const sessions: { userId: string; sessionId: string }[] = [];
const tokens = new Map<string, string>();
const c = config();
process.env.APPWRITE_DATABASE_ID = c.databaseId;
const tag = randomUUID().replaceAll('-', '').slice(0, 12);
const sampleId = 'lr_product_' + tag;
async function jwt(actor: string) {
  if (tokens.has(actor)) return tokens.get(actor)!;
  const session = await c.users.createSession({ userId: actor });
  sessions.push({ userId: actor, sessionId: session.$id });
  const token = (await c.users.createJWT({ userId: actor, sessionId: session.$id, duration: 900 })).jwt;
  tokens.set(actor, token); return token;
}
async function invoke(actor: string, method: 'GET' | 'POST', path: string, body: unknown = {}) {
  if (hosted) {
    const client = new Client().setEndpoint(c.endpoint).setProject(c.projectId).setJWT(await jwt(actor));
    const execution = await new Functions(client).createExecution({ functionId: 'labrelay_api', async: false,
      xpath: path, method: method === 'GET' ? ExecutionMethod.GET : ExecutionMethod.POST,
      ...(method === 'POST' ? { body: JSON.stringify(body) } : {}) });
    return { status: execution.responseStatusCode, body: JSON.parse(execution.responseBody) as Record<string, any> };
  }
  let status = 0; let value: unknown;
  await handler({ req: { method, path, bodyJson: body, headers: { 'x-appwrite-user-jwt': await jwt(actor),
    'x-appwrite-key': process.env.APPWRITE_API_KEY! } },
    res: { json(body, code = 200) { status = code; value = body; return body; } }, error() {} });
  return { status, body: value as Record<string, any> };
}
async function check(name: string, run: () => Promise<void>) {
  try { await run(); results.push({ check: name, status: 'pass' }); console.log('PASS ' + name); }
  catch (error) { results.push({ check: name, status: 'fail', detail: safeFailure(error) }); console.log('FAIL ' + name); }
}
try {
  await check('workspace reads resolve membership and isolate organizations', async () => {
    const own = await invoke('lrtest_collector', 'GET', '/workspace');
    assert.equal(own.status, 200); assert.equal(own.body.member.id, 'lrtest_collector');
    assert.ok(own.body.samples.every((sample: any) => sample.orgId === 'lr_org_a'));
    const other = await invoke('lrtest_outsider', 'GET', '/workspace');
    assert.equal(other.status, 200); assert.equal(other.body.member.orgId, 'lr_org_b');
    assert.ok(other.body.samples.every((sample: any) => sample.orgId === 'lr_org_b'));
  });
  const registration = { kind: 'register_sample', operationId: 'register_' + tag, sampleId,
    expectedVersion: 0, label: 'Fictional product journey', batchId: 'product_' + tag, siteId: 'lr_site_001' };
  await check('registration is collector-only and retries return one initial event', async () => {
    assert.equal((await invoke('lrtest_courier_0', 'POST', '/commands', registration)).status, 403);
    const created = await invoke('lrtest_collector', 'POST', '/commands', registration);
    assert.equal(created.status, 200); assert.equal(created.body.custodianId, 'lrtest_collector');
    assert.deepEqual(await invoke('lrtest_collector', 'POST', '/commands', registration), created);
    const history = await invoke('lrtest_collector', 'GET', '/samples/' + sampleId + '/history');
    assert.equal(history.status, 200); assert.equal(history.body.events.length, 1);
    assert.equal(history.body.events[0].kind, 'register_sample');
    assert.equal((await invoke('lrtest_outsider', 'GET', '/samples/' + sampleId + '/history')).status, 404);
  });
  await check('product routes complete both handoffs and return a six-event custody history', async () => {
    const call = async (actor: string, body: object) => {
      const result = await invoke(actor, 'POST', '/commands', { sampleId, ...body });
      assert.equal(result.status, 200); return result.body;
    };
    await call('lrtest_courier_0', { kind: 'claim', operationId: 'claim_' + tag, expectedVersion: 0 });
    const first = await call('lrtest_collector', { kind: 'offer_handoff', operationId: 'offer_a_' + tag, expectedVersion: 1, toUserId: 'lrtest_courier_0' });
    await call('lrtest_courier_0', { kind: 'accept_handoff', operationId: 'accept_a_' + tag, expectedVersion: 2, handoffId: first.pendingHandoffId });
    const last = await call('lrtest_courier_0', { kind: 'offer_handoff', operationId: 'offer_b_' + tag, expectedVersion: 3, toUserId: 'lrtest_receiver' });
    const receipt = await call('lrtest_receiver', { kind: 'accept_handoff', operationId: 'accept_b_' + tag, expectedVersion: 4, handoffId: last.pendingHandoffId });
    assert.equal(receipt.status, 'received'); assert.equal(receipt.custodianId, 'lrtest_receiver');
    const history = await invoke('lrtest_receiver', 'GET', '/samples/' + sampleId + '/history');
    assert.equal(history.status, 200); assert.equal(history.body.events.length, 6);
    assert.deepEqual(history.body.events.map((event: any) => event.version), [0,1,2,3,4,5]);
  });
  await check('read routes require authentication and unknown routes stay closed', async () => {
    if (hosted) {
      const anon = new Functions(new Client().setEndpoint(c.endpoint).setProject(c.projectId));
      await assert.rejects(anon.createExecution({ functionId: 'labrelay_api', async: false, xpath: '/workspace', method: ExecutionMethod.GET }),
        error => error instanceof AppwriteException && [401,403].includes(error.code));
    } else {
      let code = 0;
      await handler({ req: { method: 'GET', path: '/workspace', headers: {}, bodyJson: {} },
        res: { json(body, status = 200) { code = status; return body; } }, error() {} });
      assert.equal(code, 401);
    }
    assert.equal((await invoke('lrtest_collector', 'GET', '/private-config')).status, 404);
  });
} catch (error) { results.push({ check: 'product prerequisites', status: 'fail', detail: safeFailure(error) }); }
finally {
  for (const session of sessions) {
    try { await c.users.deleteSession(session); }
    catch { results.push({ check: 'test session cleanup', status: 'fail', detail: 'Revoke remaining fictional test sessions in Console.' }); }
  }
  await mkdir('reports', { recursive: true });
  const report = hosted ? 'reports/hosted-function-results.json' : 'reports/product-cloud-results.json';
  await writeFile(report, JSON.stringify({ at: new Date().toISOString(),
    scope: hosted ? 'Hosted Appwrite Function with real user JWT execution and TablesDB.' : 'Locally invoked product handler against real Appwrite Auth and TablesDB.',
    sampleId, results }, null, 2));
  console.log('Saved ' + report + ' (no secrets).');
  if (results.some(result => result.status === 'fail')) process.exitCode = 1;
}
