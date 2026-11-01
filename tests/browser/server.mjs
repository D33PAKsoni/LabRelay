import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fixture, fixedTime } from '../../dist/tests/unit/fixtures.js';
import { DomainError } from '../../dist/src/domain/errors.js';
let state = fixture();
const routes = { '/': ['tests/browser/index.html', 'text/html'], '/harness.js': ['dist/browser/harness.js', 'text/javascript'], '/sw.js': ['tests/browser/sw.js', 'text/javascript'] };
const server = createServer(async (req, res) => {
  const respond = (status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
  try {
    if (req.method === 'POST' && req.url === '/api/reset') { state = fixture(); return respond(200, { ok: true }); }
    if (req.method === 'POST' && req.url === '/api/advance') {
      await state.service.execute('collector', { kind: 'observe', operationId: 'remote', sampleId: 'water_001', expectedVersion: 0, note: 'Updated on another device', capturedAt: fixedTime });
      return respond(200, { ok: true });
    }
    if (req.method === 'GET' && req.url === '/api/stats') return respond(200, { events: state.store.list('events').length, sample: await state.store.get('samples', 'water_001') });
    if (req.method === 'POST' && req.url === '/api/command') {
      let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 4096) return respond(413, { error: 'TOO_LARGE' }); }
      return respond(200, await state.service.execute(String(req.headers['x-demo-actor'] ?? ''), JSON.parse(body)));
    }
    const route = routes[req.url];
    if (req.method === 'GET' && route) { res.writeHead(200, { 'Content-Type': route[1], 'Cache-Control': 'no-cache' }); return res.end(await readFile(route[0])); }
    respond(404, { error: 'NOT_FOUND' });
  } catch (error) { respond(error instanceof DomainError ? error.status : 500, { error: error instanceof DomainError ? error.code : 'TEST_SERVER_ERROR' }); }
});
server.listen(4179, '127.0.0.1', () => console.log('LabRelay diagnostic at http://127.0.0.1:4179'));
