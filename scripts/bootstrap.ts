import { mkdir, writeFile } from 'node:fs/promises';
import { AppwriteException, Permission, Role } from 'node-appwrite';
import { config, marker, safeFailure } from './config.js';
import { schema } from './schema.js';
import type { Role as LabRole } from '../src/domain/types.js';

export interface Fixture { actors: { id: string; orgId: string; role: LabRole }[] }
async function main() {
  const c = config();
  try { await c.db.create({ databaseId: c.databaseId, name: 'LabRelay day-one spike', description: marker, specification: 'serverless' }); }
  catch (e) {
    if (!(e instanceof AppwriteException && (e.code === 409 || (e.code === 403 && e.type === 'additional_resource_not_allowed')))) throw e;
    const existing = await c.db.get({ databaseId: c.databaseId }).catch(() => { throw e; });
    if (existing.description !== marker) throw new Error('This database was not created by the LabRelay bootstrap. Refusing to modify it.');
  }
  for (const table of schema) {
    try { await c.db.createTable({ databaseId: c.databaseId, tableId: table.id, name: table.id,
      permissions: [], rowSecurity: true, columns: table.columns }); }
    catch (e) {
      if (!(e instanceof AppwriteException && e.code === 409)) throw e;
      const existing = await c.db.getTable({ databaseId: c.databaseId, tableId: table.id });
      if (!existing.rowSecurity || existing.$permissions.length) throw new Error(`Unexpected permissions on ${table.id}. Review the table manually.`);
    }
    // Schema creation can be asynchronous. Bound the wait and fail clearly.
    for (let attempt = 0; attempt < 60; attempt++) {
      const actual = await c.db.getTable({ databaseId: c.databaseId, tableId: table.id });
      const columns = actual.columns as unknown as { key: string; status: string }[];
      if (columns.some(col => col.status === 'failed' || col.status === 'stuck')) throw new Error(`Column creation failed on ${table.id}.`);
      if (columns.length === table.columns.length && columns.every(col => col.status === 'available')) break;
      if (attempt === 59) throw new Error(`Schema for ${table.id} is not ready. Retry after checking Console.`);
      await new Promise(r => setTimeout(r, 500));
    }
    for (const index of table.indexes) {
      try { await c.db.createIndex({ databaseId: c.databaseId, tableId: table.id, ...index }); }
      catch (e) { if (!(e instanceof AppwriteException && e.code === 409)) throw e; }
      for (let attempt = 0; attempt < 60; attempt++) {
        const actual = await c.db.getIndex({ databaseId: c.databaseId, tableId: table.id, key: index.key });
        if (actual.status === 'available') break;
        if (actual.status === 'failed' || attempt === 59) throw new Error(`Index ${table.id}.${index.key} is not ready.`);
        await new Promise(r => setTimeout(r, 500));
      }
    }
    console.log(`Ready: ${table.id}`);
  }
  const fixture: Fixture = { actors: [
    { id: 'lrtest_collector', orgId: 'lr_org_a', role: 'collector' },
    { id: 'lrtest_receiver', orgId: 'lr_org_a', role: 'receiver' },
    ...Array.from({ length: 10 }, (_, i) => ({ id: `lrtest_courier_${i}`, orgId: 'lr_org_a', role: 'courier' as const })),
    { id: 'lrtest_outsider', orgId: 'lr_org_b', role: 'courier' },
  ] };
  for (const actor of fixture.actors) {
    try { await c.users.create({ userId: actor.id, name: `LabRelay test ${actor.id}` }); }
    catch (e) {
      if (!(e instanceof AppwriteException && e.code === 409)) throw e;
      const existing = await c.users.get({ userId: actor.id });
      if (existing.name !== `LabRelay test ${actor.id}`) throw new Error('An unrelated user occupies a test identifier.');
    }
    try { await c.db.createRow({ databaseId: c.databaseId, tableId: 'memberships', rowId: actor.id,
      data: { orgId: actor.orgId, role: actor.role, active: true }, permissions: [] }); }
    catch (e) {
      if (!(e instanceof AppwriteException && e.code === 409)) throw e;
      const existing = await c.db.getRow({ databaseId: c.databaseId, tableId: 'memberships', rowId: actor.id });
      if (existing.orgId !== actor.orgId || existing.role !== actor.role || !existing.active)
        throw new Error('Existing test membership differs. Review it before continuing.');
    }
  }
  try { await c.db.createRow({ databaseId: c.databaseId, tableId: 'sites', rowId: 'lr_site_001',
    data: { orgId: 'lr_org_a', name: 'Fictional water sampling site', location: [78.4744,17.3850] },
    permissions: [] }); }
  catch (e) { if (!(e instanceof AppwriteException && e.code === 409)) throw e; }
  await mkdir('.local', { recursive: true });
  await writeFile('.local/fixture.json', JSON.stringify(fixture, null, 2), { mode: 0o600 });
  console.log('Bootstrap complete. Run npm run test:live. No passwords or JWTs were written.');
}
main().catch(e => { console.error(safeFailure(e)); process.exitCode = 1; });
