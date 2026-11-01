import { Account, Client, Query, TablesDB } from 'node-appwrite';
import { AppwriteStore, unpack } from './adapters/appwrite.js';
import { DomainError } from './domain/errors.js';
import { LabRelayService } from './domain/service.js';
import { readHistory, readWorkspace } from './product.js';
import { readNearbySites } from './nearby.js';
import { publishChange, revokeLiveFeed } from './live.js';

interface Context {
  req: { method: string; path: string; headers: Record<string, string | undefined>; bodyJson: unknown };
  res: { json(body: unknown, status?: number): unknown };
  error(message: string): void;
}
export default async function handler({ req, res, error }: Context) {
  if (!['POST', 'GET'].includes(req.method)) return res.json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  const path = req.path.split('?')[0]!.replace(/\/$/, '') || '/';
  if ((req.method === 'POST' && !['/', '/commands', '/sites/nearby'].includes(path)) ||
      (req.method === 'GET' && path !== '/workspace' && !/^\/samples\/[A-Za-z0-9][A-Za-z0-9_.-]{0,35}\/history$/.test(path)
        && !/^\/batches\/[A-Za-z0-9][A-Za-z0-9_.-]{0,35}\/manifest$/.test(path) && !/^\/receipts\/[A-Za-z0-9][A-Za-z0-9_.-]{0,35}$/.test(path)))
    return res.json({ error: 'NOT_FOUND' }, 404);
  const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT ?? process.env.APPWRITE_ENDPOINT;
  const project = process.env.APPWRITE_FUNCTION_PROJECT_ID ?? process.env.APPWRITE_PROJECT_ID;
  const databaseId = process.env.APPWRITE_DATABASE_ID;
  const jwt = req.headers['x-appwrite-user-jwt'];
  const apiKey = req.headers['x-appwrite-key'];
  if (!jwt) return res.json({ error: 'UNAUTHENTICATED', message: 'Sign in to continue.' }, 401);
  if (!endpoint || !project || !databaseId || !apiKey) return res.json({ error: 'CONFIGURATION_REQUIRED' }, 503);
  let actorId: string;
  try { actorId = (await new Account(new Client().setEndpoint(endpoint).setProject(project).setJWT(jwt)).get()).$id; }
  catch { return res.json({ error: 'UNAUTHENTICATED' }, 401); }
  const db = new TablesDB(new Client().setEndpoint(endpoint).setProject(project).setKey(apiKey));
  const store = new AppwriteStore(db, databaseId, async orgId => {
    const users = await db.listRows({ databaseId, tableId: 'memberships',
      queries: [Query.equal('orgId', orgId), Query.equal('active', true), Query.limit(100)] });
    if (users.total > users.rows.length) throw new Error('Reader list exceeds development scope. Use Teams before expanding.');
    return users.rows.map(row => unpack<'memberships'>(row).id);
  });
  const service = new LabRelayService(store);
  try {
    if (req.method === 'GET') {
      const member = await service.member(actorId);
      if (path === '/workspace') return res.json(await readWorkspace(db, databaseId, member), 200);
      if (path.startsWith('/batches/')) return res.json(await service.batchManifest(actorId, path.split('/')[2]!), 200);
      if (path.startsWith('/receipts/')) return res.json(await service.readReceipt(actorId, path.split('/')[2]!), 200);
      const sample = await service.read(actorId, path.split('/')[2]!);
      return res.json(await readHistory(db, databaseId, sample), 200);
    }
    if (path === '/sites/nearby') return res.json(await readNearbySites(db, databaseId, await service.member(actorId), req.bodyJson), 200);
    const member=await service.member(actorId);
    const result=await service.execute(actorId, req.bodyJson);
    try {await publishChange(db,databaseId,member.orgId);} catch {error('Committed command; live refresh signal incomplete. Periodic refresh will recover.');}
    return res.json(result, 200);
  } catch (e) {
    if (e instanceof DomainError) {
      if(e.status===403)try{await revokeLiveFeed(db,databaseId,actorId);}catch{error('Could not remove live signal access.');}
      return res.json({ error: e.code, message: e.message }, e.status);
    }
    error('LabRelay request failed. Inspect execution and database configuration.');
    if (path === '/sites/nearby') return res.json({ error: 'SERVICE_UNAVAILABLE', message: 'Nearby sites are unavailable. Please try again.' }, 503);
    return res.json({ error: 'SERVICE_UNAVAILABLE', message: 'The result is unknown. Retry the same operation ID.' }, 503);
  }
}

