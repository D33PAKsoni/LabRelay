import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../src/function.js';

test('function rejects a bare user ID without a verified JWT', async () => {
  let status = 0;
  await handler({ req: { method: 'POST', path: '/', headers: { 'x-appwrite-user-id': 'collector' }, bodyJson: {} },
    res: { json(body, code = 200) { status = code; return body; } }, error() {} });
  assert.equal(status, 401);
});
test('function rejects unsupported methods before touching Appwrite', async () => {
  let status = 0;
  await handler({ req: { method: 'DELETE', path: '/', headers: {}, bodyJson: {} },
    res: { json(body, code = 200) { status = code; return body; } }, error() {} });
  assert.equal(status, 405);
});
