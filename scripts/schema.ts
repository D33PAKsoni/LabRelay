import { TablesDBIndexType } from 'node-appwrite';
import type { TableName } from '../src/domain/types.js';
const str = (key: string, size = 36, required = true) => ({ key, type: 'varchar', size, required });
const integer = (key: string) => ({ key, type: 'integer', required: true, min: 0 });
const idx = (key: string, columns: string[], type = TablesDBIndexType.Key) => ({ key, columns, type });
export const schema: { id: TableName; columns: object[]; indexes: { key: string; columns: string[]; type: TablesDBIndexType }[] }[] = [
  { id: 'memberships', columns: [str('orgId'), str('role', 16), { key: 'active', type: 'boolean', required: true }], indexes: [idx('org_active', ['orgId', 'active'])] },
  { id: 'sites', columns: [str('orgId'), str('name', 120), { key: 'location', type: 'point', required: true }], indexes: [idx('org', ['orgId']), idx('location_geo', ['location'], TablesDBIndexType.Spatial)] },
  { id: 'samples', columns: [str('orgId'), str('label', 120), str('batchId'), str('siteId'), str('status', 16),
    str('custodianId'), str('assignedCourierId', 36, false), str('pendingHandoffId', 36, false), integer('version')],
    indexes: [idx('org_status', ['orgId','status']), idx('org_batch', ['orgId','batchId'])] },
  { id: 'handoffs', columns: [str('orgId'), str('sampleId'), str('fromUserId'), str('toUserId'), str('status',16),
    { key: 'offeredAt', type: 'datetime', required: true }, { key: 'acceptedAt', type: 'datetime', required: false }],
    indexes: [idx('sample', ['sampleId']), idx('recipient_status', ['toUserId','status'])] },
  { id: 'events', columns: [str('orgId'), str('sampleId'), integer('version'), str('kind',24), str('actorId'),
    str('fromCustodianId'), str('toCustodianId'), { key: 'capturedAt', type: 'datetime', required: true },
    { key: 'recordedAt', type: 'datetime', required: true }, str('note',500)],
    indexes: [idx('sample_revision', ['sampleId','version'], TablesDBIndexType.Unique)] },
  { id: 'batches', columns: [str('orgId'), str('batchId'), integer('version')],
    indexes: [idx('org_batch', ['orgId','batchId'], TablesDBIndexType.Unique)] },
  { id: 'batch_changes', columns: [str('orgId'), str('batchId'), integer('version'), str('kind',24)],
    indexes: [idx('batch_revision', ['orgId','batchId','version'], TablesDBIndexType.Unique)] },
  { id: 'batch_receipts', columns: [str('orgId'), str('batchId'), str('actorId'),
    { key: 'recordedAt', type: 'datetime', required: true }, str('status',16),
    integer('expectedCount'), integer('receivedCount'), integer('missingCount'), integer('unexpectedCount'), integer('duplicateCount'), { key: 'detailsJson', type: 'text', required: true }],
    indexes: [idx('org_recorded', ['orgId','recordedAt']), idx('org_batch', ['orgId','batchId'])] },
  { id: 'live_updates', columns: [str('token'), { key: 'changedAt', type: 'datetime', required: true }], indexes: [] },
  { id: 'operations', columns: [str('orgId'), str('actorId'), str('sampleId'), str('fingerprint',64), str('resultJson',2048)],
    indexes: [idx('org_actor', ['orgId','actorId'])] },
];
