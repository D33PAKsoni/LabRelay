import { Dexie, type Table } from 'dexie';
import type { Command, CommandResult } from '../domain/types.js';

export interface OutboxItem {
  key: string; actorId: string; command: Command; state: 'pending' | 'synced' | 'needs_review' | 'archived';
  savedAt: string; errorCode?: string; result?: CommandResult;
}
export class QueueDatabase extends Dexie {
  outbox!: Table<OutboxItem, string>;
  constructor(name = 'labrelay-pending-v1') {
    super(name); this.version(1).stores({ outbox: '&key, actorId, state, savedAt' });
  }
}
export interface SendOutcome { ok: boolean; result?: CommandResult; code?: string; status?: number }
export class Outbox {
  private flushing: Promise<void> | undefined;
  constructor(private db: QueueDatabase) {}
  async enqueue(actorId: string, command: Command): Promise<OutboxItem> {
    const key = `${actorId}:${command.operationId}`;
    return this.db.transaction('rw', this.db.outbox, async () => {
      const prior = await this.db.outbox.get(key);
      if (prior) {
        const canon = (v: Command) => JSON.stringify(Object.keys(v).sort().map(k => [k, v[k as keyof Command]]));
        if (canon(prior.command) !== canon(command)) throw new Error('Operation ID already has a different pending request.');
        return prior;
      }
      const row: OutboxItem = { key, actorId, command, state: 'pending', savedAt: new Date().toISOString() };
      await this.db.outbox.add(row); return row;
    });
  }
  async list(actorId: string): Promise<OutboxItem[]> {
    return this.db.outbox.where('actorId').equals(actorId).sortBy('savedAt');
  }
  async archiveRejected(actorId: string, key: string): Promise<void> {
    await this.db.transaction('rw', this.db.outbox, async () => {
      const item = await this.db.outbox.get(key);
      if (!item || item.actorId !== actorId || item.state !== 'needs_review') throw new Error('Only your rejected actions can be archived.');
      await this.db.outbox.update(key, { state: 'archived' });
    });
  }
  async sync(actorId: string, send: (command: Command) => Promise<SendOutcome>): Promise<void> {
    if (this.flushing) return this.flushing;
    this.flushing = this.flush(actorId, send);
    try { await this.flushing; } finally { this.flushing = undefined; }
  }
  private async flush(actorId: string, send: (command: Command) => Promise<SendOutcome>) {
    const items = await this.list(actorId);
    if (items.some(row => row.state === 'needs_review')) return;
    const pending = items.filter(row => row.state === 'pending');
    for (const row of pending) {
      let outcome: SendOutcome;
      try { outcome = await send(row.command); } catch { return; }
      if (outcome.ok && outcome.result) {
        await this.db.outbox.update(row.key, { state: 'synced', result: outcome.result });
      } else if ([400, 403, 404, 409, 422].includes(outcome.status ?? 0)) {
        await this.db.outbox.update(row.key, { state: 'needs_review', errorCode: outcome.code ?? 'REJECTED' });
        // Do not automatically replay dependent actions after a rejected transition.
        return;
      } else { return; } // Offline, rate limit, authentication, or unknown commit outcome: keep pending.
    }
  }
}
