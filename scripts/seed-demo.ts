import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { Account, AppwriteException, Client } from 'node-appwrite';
import { AppwriteStore } from '../src/adapters/appwrite.js';
import { LabRelayService } from '../src/domain/service.js';
import { config, marker, safeFailure } from './config.js';
import type { Role } from '../src/domain/types.js';
const path = '.local/demo-accounts.json';
const orgId = 'lrdemo_org';
const definitions: { id: string; name: string; email: string; role: Role }[] = [
  { id: 'lrdemo_collector', name: 'Demo field collector', email: 'collector@labrelay.example', role: 'collector' },
  { id: 'lrdemo_courier_0', name: 'Demo courier', email: 'courier@labrelay.example', role: 'courier' },
  { id: 'lrdemo_receiver', name: 'Demo lab receiver', email: 'receiver@labrelay.example', role: 'receiver' },
];
try {
  const c = config();
  if ((await c.db.get({ databaseId: c.databaseId })).description !== marker) throw new Error('Refusing to seed an unmarked database.');
  let accounts: (typeof definitions[number] & { password: string })[];
  let existing = false;
  try {
    accounts = JSON.parse(await readFile(path, 'utf8')).accounts;
    if (accounts.length !== 3 || definitions.some(d => !accounts.some(a => a.id === d.id && a.email === d.email && a.role === d.role && typeof a.password === 'string')))
      throw new Error('Unexpected demo credential file. Review it locally.');
    existing = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    for (const d of definitions) {
      try { await c.users.get({ userId: d.id }); throw new Error('Demo user already exists but its local credentials are missing. Review the account manually; no password will be reset.'); }
      catch (e) { if (!(e instanceof AppwriteException && e.code === 404)) throw e; }
    }
    accounts = definitions.map(d => ({ ...d, password: 'Lr!' + randomBytes(24).toString('base64url') }));
    await mkdir('.local', { recursive: true });
    await writeFile(path, JSON.stringify({ purpose: 'Fictional LabRelay development accounts only', orgId, accounts }, null, 2), { mode: 0o600 });
  }
  for (const account of accounts!) {
    try { await c.users.create({ userId: account.id, name: account.name, email: account.email, password: account.password }); }
    catch (error) {
      if (!(error instanceof AppwriteException && error.code === 409)) throw error;
      const user = await c.users.get({ userId: account.id });
      if (!existing || user.email !== account.email || user.name !== account.name) throw new Error('An unrelated account occupies a demo identifier.');
    }
    try { await c.db.createRow({ databaseId: c.databaseId, tableId: 'memberships', rowId: account.id,
      data: { orgId, role: account.role, active: true }, permissions: [] }); }
    catch (error) {
      if (!(error instanceof AppwriteException && error.code === 409)) throw error;
      const row = await c.db.getRow({ databaseId: c.databaseId, tableId: 'memberships', rowId: account.id });
      if (row.orgId !== orgId || row.role !== account.role || !row.active) throw new Error('Unexpected demo membership. Review before continuing.');
    }
    const auth = new Account(new Client().setEndpoint(c.endpoint).setProject(c.projectId));
    const session = await auth.createEmailPasswordSession({ email: account.email, password: account.password });
    try { if (session.userId !== account.id) throw new Error('Demo password sign-in returned another user.'); }
    finally { await c.users.deleteSession({ userId: account.id, sessionId: session.$id }); }
  }
  try { await c.db.createRow({ databaseId: c.databaseId, tableId: 'sites', rowId: 'lrdemo_north_bank',
    data: { orgId, name: 'Fictional north bank collection site', location: [78.4744,17.385] }, permissions: [] }); }
  catch (error) {
    if (!(error instanceof AppwriteException && error.code === 409)) throw error;
    const site = await c.db.getRow({ databaseId: c.databaseId, tableId: 'sites', rowId: 'lrdemo_north_bank' });
    if (site.orgId !== orgId) throw new Error('Unexpected demo site ownership.');
  }
  const service = new LabRelayService(new AppwriteStore(c.db, c.databaseId, async org => org === orgId ? accounts!.map(a => a.id) : []));
  for (let i = 1; i <= 3; i++) await service.execute('lrdemo_collector', { kind: 'register_sample',
    operationId: 'demo_register_' + i, sampleId: 'lrdemo_water_00' + i, expectedVersion: 0,
    label: 'Fictional water sample ' + String(i).padStart(2, '0'), siteId: 'lrdemo_north_bank', batchId: 'lrdemo_batch_001' });
  await writeFile('reports/demo-setup.json', JSON.stringify({ at: new Date().toISOString(), orgId,
    users: accounts!.map(({ id, role }) => ({ id, role })), passwordSignInVerified: true, seededSamples: 3,
    credentialFile: path, secretsIncludedInReport: false }, null, 2));
  console.log('PASS: three isolated fictional demo accounts and samples are ready. Password sign-in verified; test sessions revoked.');
  console.log('Credentials are in the ignored .local/demo-accounts.json file. No password was printed.');
} catch (error) { console.error(safeFailure(error)); process.exitCode = 1; }
