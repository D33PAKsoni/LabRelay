import { AppwriteException, Query, TablesDB } from 'node-appwrite';
import { DomainError, StorageConflict } from '../domain/errors.js';
import type { Store, TableName, Tables, Write } from '../domain/types.js';

export function unpack<K extends TableName>(row: { $id: string; [key: string]: unknown }): Tables[K] {
  const data = Object.fromEntries(Object.entries(row).filter(([key]) => !key.startsWith('$')));
  return { ...data, id: row.$id } as unknown as Tables[K];
}
export function pack(record: { id: string }) {
  return Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'id'));
}
export class AppwriteStore implements Store {
  constructor(private db: TablesDB, private databaseId: string,
    private readers: (orgId: string) => Promise<string[]>) {}
  async get<K extends TableName>(table: K, id: string): Promise<Tables[K] | null> {
    try { return unpack<K>(await this.db.getRow({ databaseId: this.databaseId, tableId: table, rowId: id })); }
    catch (e) { if (e instanceof AppwriteException && e.code === 404) return null; throw e; }
  }
  async listBatch(orgId: string, batchId: string) {
    const rows = await this.db.listRows({ databaseId: this.databaseId, tableId: 'samples',
      queries: [Query.equal('orgId', orgId), Query.equal('batchId', batchId), Query.limit(101)] });
    if (rows.total > 100) throw new DomainError('BATCH_TOO_LARGE', 'This pilot supports at most 100 registered samples per batch.', 400);
    return rows.rows.map(row => unpack<'samples'>(row));
  }
  async commit(writes: Write[]): Promise<void> {
    const tx = await this.db.createTransaction({ ttl: 60 });
    try {
      for (const w of writes) {
        if (w.action === 'create') {
          // Business records are available only through the membership-authorized Function.
          const permissions: string[] = [];
          await this.db.createRow({ databaseId: this.databaseId, tableId: w.table,
            rowId: w.record.id, data: pack(w.record), permissions, transactionId: tx.$id });
        } else {
          // Also removes legacy direct read grants on touched rows.
          await this.db.updateRow({ databaseId: this.databaseId, tableId: w.table,
            rowId: w.record.id, data: pack(w.record), permissions: [], transactionId: tx.$id });
        }
      }
      await this.db.updateTransaction({ transactionId: tx.$id, commit: true });
    } catch (error) {
      try { await this.db.updateTransaction({ transactionId: tx.$id, rollback: true }); } catch { /* already committed/expired; retain original error */ }
      if (error instanceof AppwriteException && error.code === 409) throw new StorageConflict();
      throw error;
    }
  }
}
