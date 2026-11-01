import { Outbox, QueueDatabase } from '../../src/offline/outbox.js';
import type { Command } from '../../src/domain/types.js';

const db = new QueueDatabase('labrelay-browser-check');
const outbox = new Outbox(db);
let loseAckOnce = false;
let actor = 'collector';
async function render() {
  const items = await outbox.list(actor);
  document.getElementById('status')!.textContent = items.length ? items.map(x =>
    `${x.command.operationId}: ${x.state === 'pending' ? 'Pending sync — not confirmed by server' :
      x.state === 'needs_review' ? `Needs review (${x.errorCode})` : 'Confirmed by server'}`).join('\n') : 'No queued observations';
}
async function enqueue(operationId = 'offline_note', expectedVersion = 0) {
  const command: Command = { kind: 'observe', sampleId: 'water_001', operationId,
    expectedVersion, note: 'Seal intact', capturedAt: '2026-10-27T11:00:00.000Z' };
  await outbox.enqueue(actor, command); await render();
}
async function sync() {
  await outbox.sync(actor, async command => {
    const response = await fetch('/api/command', { method: 'POST', headers: {
      'Content-Type': 'application/json', 'X-Demo-Actor': actor }, body: JSON.stringify(command) });
    const body = await response.json();
    if (loseAckOnce) { loseAckOnce = false; throw new TypeError('Simulated lost acknowledgment after commit'); }
    return response.ok ? { ok: true, result: body } : { ok: false, code: body.error, status: response.status };
  });
  await render();
}
const ready = (async () => {
  if ('serviceWorker' in navigator) {
    await navigator.serviceWorker.register('/sw.js'); await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
  }
  await render();
})();
Object.assign(window, { harness: { ready, enqueue, sync, list: () => outbox.list(actor),
  loseAck: () => { loseAckOnce = true; }, setActor: async (id: string) => { actor = id; await render(); } } });
document.getElementById('queue')!.addEventListener('click', () => { void enqueue(); });
document.getElementById('sync')!.addEventListener('click', () => { void sync(); });
