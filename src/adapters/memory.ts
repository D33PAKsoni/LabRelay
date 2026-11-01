import { StorageConflict } from '../domain/errors.js';
import type { StoredRecord, Store, TableName, Tables, Write } from '../domain/types.js';

/** Test double only. It models all-or-nothing writes and unique primary keys;
 * passing here is not evidence of Appwrite transaction behavior or row ACLs. */
export class MemoryStore implements Store {
  private rows = new Map<string, StoredRecord>();
  beforeCommit?: () => Promise<void>;
  private key(table: TableName, id: string) { return `${table}:${id}`; }
  seed<K extends TableName>(table: K, record: Tables[K]) { this.rows.set(this.key(table, record.id), structuredClone(record)); }
  async get<K extends TableName>(table: K, id: string): Promise<Tables[K] | null> {
    const row = this.rows.get(this.key(table, id)); return row ? structuredClone(row) as Tables[K] : null;
  }
  list<K extends TableName>(table: K): Tables[K][] {
    return [...this.rows.entries()].filter(([k]) => k.startsWith(`${table}:`)).map(([,v]) => structuredClone(v) as Tables[K]);
  }
  async listBatch(orgId: string, batchId: string) {
    return this.list('samples').filter(sample => sample.orgId === orgId && sample.batchId === batchId);
  }
  async commit(writes: Write[]): Promise<void> {
    await this.beforeCommit?.();
    const staged = new Map(this.rows);
    for (const w of writes) {
      const key = this.key(w.table, w.record.id);
      if ((w.action === 'create' && staged.has(key)) || (w.action === 'update' && !staged.has(key))) throw new StorageConflict();
      staged.set(key, structuredClone(w.record));
    }
    this.rows = staged;
  }
}
