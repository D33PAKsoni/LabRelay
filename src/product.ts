import { Query, TablesDB } from 'node-appwrite';
import { unpack } from './adapters/appwrite.js';
import { openReceipt } from './domain/batch.js';
import { ensureLiveFeed, type LiveFeed } from './live.js';
import type { BatchReceipt, CustodyEvent, Handoff, Membership, Sample, Site } from './domain/types.js';

export interface Workspace {
  live: LiveFeed;
  member: Membership;
  members: Pick<Membership, 'id' | 'role'>[];
  samples: Sample[];
  sites: Site[];
  handoffs: Handoff[];
  receipts: BatchReceipt[];
  receiptsTruncated: boolean;
  truncated: boolean;
}
export interface History { sample: Sample; events: CustodyEvent[]; truncated: boolean }

export async function readWorkspace(db: TablesDB, databaseId: string, member: Membership): Promise<Workspace> {
  const list = (tableId: string, extra: string[] = []) => db.listRows({
    databaseId, tableId, queries: [Query.equal('orgId', member.orgId), Query.limit(100), ...extra],
  });
  const [sampleRows, siteRows, memberRows, receiptRows] = await Promise.all([
    list('samples', [Query.orderDesc('$createdAt')]), list('sites'), list('memberships', [Query.equal('active', true)]),
    db.listRows({ databaseId, tableId: 'batch_receipts', queries: [Query.equal('orgId', member.orgId), Query.orderDesc('recordedAt'), Query.limit(20)] }),
  ]);
  const samples = sampleRows.rows.map(row => unpack<'samples'>(row));
  const handoffIds = [...new Set(samples.map(sample => sample.pendingHandoffId).filter((id): id is string => !!id))];
  const handoffs = (await Promise.all(handoffIds.map(rowId => db.getRow({ databaseId, tableId: 'handoffs', rowId }))))
    .map(row => unpack<'handoffs'>(row)).filter(handoff => handoff.orgId === member.orgId);
  return { live: await ensureLiveFeed(db,databaseId,member), member, samples, receipts: receiptRows.rows.map(row => openReceipt(unpack<'batch_receipts'>(row))),
    receiptsTruncated: receiptRows.total > receiptRows.rows.length, sites: siteRows.rows.map(row => unpack<'sites'>(row)), handoffs,
    members: memberRows.rows.map(row => { const m = unpack<'memberships'>(row); return { id: m.id, role: m.role }; }),
    truncated: sampleRows.total > samples.length || siteRows.total > siteRows.rows.length || memberRows.total > memberRows.rows.length };
}
export async function readHistory(db: TablesDB, databaseId: string, sample: Sample): Promise<History> {
  const rows = await db.listRows({ databaseId, tableId: 'events',
    queries: [Query.equal('sampleId', sample.id), Query.orderDesc('version'), Query.limit(100)] });
  return { sample, events: rows.rows.map(row => unpack<'events'>(row)).filter(event => event.orgId === sample.orgId).reverse(),
    truncated: rows.total > rows.rows.length };
}
