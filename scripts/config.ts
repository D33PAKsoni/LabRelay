import { AppwriteException, Client, TablesDB, Users } from 'node-appwrite';
export function config() {
  const missing = ['APPWRITE_ENDPOINT', 'APPWRITE_PROJECT_ID', 'APPWRITE_API_KEY'].filter(k => !process.env[k] || process.env[k]!.includes('YOUR_'));
  if (missing.length) throw new Error(`Configuration required: ${missing.join(', ')}. Edit .env locally; never paste an API key in chat.`);
  const endpoint = process.env.APPWRITE_ENDPOINT!;
  const parsed = new URL(endpoint);
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost','127.0.0.1'].includes(parsed.hostname)))
    throw new Error('Use HTTPS for Appwrite Cloud.');
  const databaseId = process.env.APPWRITE_DATABASE_ID || 'labrelay_spike';
  if (!/^labrelay_[A-Za-z0-9_.-]{1,27}$/.test(databaseId)) throw new Error('Use an isolated database ID beginning labrelay_.');
  const client = new Client().setEndpoint(endpoint).setProject(process.env.APPWRITE_PROJECT_ID!).setKey(process.env.APPWRITE_API_KEY!);
  return { endpoint, projectId: process.env.APPWRITE_PROJECT_ID!, databaseId, client, db: new TablesDB(client), users: new Users(client) };
}
export function safeFailure(error: unknown): string {
  if (error instanceof AppwriteException) return `Appwrite request failed (HTTP ${error.code}, type ${error.type}). Check endpoint, scopes, schema readiness and quotas.`;
  return error instanceof Error ? error.message : 'Unexpected failure';
}
export const marker = 'LabRelay day-one isolated feasibility database';
