import { DomainError, StorageConflict } from './errors.js';
import { reconcileManifest } from './manifest.js';
import { stableId } from './ids.js';
import type { BatchManifest, BatchReceipt, BatchReceiptRecord, Command, CommandResult, Membership, OperationReceipt, Store, Write } from './types.js';

export function openReceipt(row: BatchReceiptRecord): BatchReceipt {
  const { detailsJson, ...record } = row;
  return { ...record, details: JSON.parse(detailsJson) as BatchReceipt['details'] };
}
export async function batchGuard(store: Store, orgId: string, batchId: string, kind: string, expectedRevision?: number): Promise<Write[]> {
  const id = stableId('batch', orgId, batchId);
  const batch = await store.get('batches', id);
  const revision = batch?.version ?? 0;
  if (expectedRevision !== undefined && revision !== expectedRevision)
    throw new DomainError('STALE_MANIFEST', 'This batch changed. Refresh its manifest before recording receipt.');
  if (revision === Number.MAX_SAFE_INTEGER) throw new DomainError('VERSION_LIMIT', 'Batch revision limit reached.');
  return [
    { table: 'batches', action: batch ? 'update' : 'create', record: { id, orgId, batchId, version: revision + 1 } },
    { table: 'batch_changes', action: 'create', record: { id: stableId('batch-revision', orgId, batchId, revision + 1),
      orgId, batchId, version: revision + 1, kind } },
  ];
}
export async function loadBatchManifest(store: Store, member: Membership, batchId: string): Promise<BatchManifest> {
  if (member.role !== 'receiver') throw new DomainError('FORBIDDEN', 'Only a laboratory receiver can reconcile a batch.', 403);
  const id = stableId('batch', member.orgId, batchId);
  const version = (await store.get('batches', id))?.version ?? 0;
  const samples = await store.listBatch(member.orgId, batchId);
  if (samples.length > 100) throw new DomainError('BATCH_TOO_LARGE', 'This pilot supports at most 100 registered samples per batch.', 400);
  const possible = samples.filter(sample => sample.status === 'in_transit' && sample.pendingHandoffId);
  const pairs = await Promise.all(possible.map(async sample => ({ sample,
    handoff: await store.get('handoffs', sample.pendingHandoffId!) })));
  const items = pairs.filter((pair): pair is BatchManifest['items'][number] => !!pair.handoff &&
    pair.handoff.orgId === member.orgId && pair.handoff.toUserId === member.id && pair.handoff.status === 'offered' &&
    pair.handoff.sampleId === pair.sample.id && pair.handoff.fromUserId === pair.sample.custodianId)
    .sort((a,b) => a.sample.id.localeCompare(b.sample.id));
  if (((await store.get('batches', id))?.version ?? 0) !== version)
    throw new DomainError('STALE_MANIFEST', 'The batch changed while loading. Refresh its manifest.');
  if (!items.length) throw new DomainError('NO_OFFERED_SAMPLES', 'No samples in this batch are currently offered to you.', 404);
  if (items.length > 20) throw new DomainError('RECEIPT_TOO_LARGE', 'Receive at most 20 offered samples in one manifest.', 400);
  return { batchId, version, items };
}
export async function reconcileBatch(store: Store, member: Membership, command: Extract<Command, { kind: 'reconcile_batch' }>,
  opId: string, digest: string, now: () => Date): Promise<CommandResult> {
  const manifest = await loadBatchManifest(store, member, command.batchId);
  if (manifest.version !== command.batchVersion || manifest.items.length !== command.expected.length ||
      manifest.items.some(({sample}) => !command.expected.some(item => item.sampleId === sample.id && item.version === sample.version)))
    throw new DomainError('STALE_MANIFEST', 'The expected manifest changed. Refresh before confirming receipt.');
  const anchor = manifest.items.find(item => item.sample.id === command.sampleId);
  if (!anchor || anchor.sample.version !== command.expectedVersion)
    throw new DomainError('STALE_MANIFEST', 'The receipt no longer matches the sample revision.');
  const comparison = reconcileManifest(manifest.items.map(item => item.sample.id), command.scannedIds);
  const received = new Set(comparison.received);
  const timestamp = now().toISOString();
  const receiptId = stableId('batch-receipt', member.orgId, member.id, command.operationId);
  const details: BatchReceipt['details'] = { scannedIds: command.scannedIds, missing: comparison.missing,
    unexpected: comparison.unexpected, duplicateScans: comparison.duplicateScans, items: [] };
  const writes: Write[] = [];
  let result: CommandResult | undefined;
  for (const { sample, handoff } of manifest.items) {
    if (sample.version === Number.MAX_SAFE_INTEGER) throw new DomainError('VERSION_LIMIT', 'Sample revision limit reached.');
    const accepted = received.has(sample.id);
    const updated = { ...sample, version: sample.version + 1,
      ...(accepted ? { status: 'received' as const, custodianId: member.id, pendingHandoffId: null } : {}) };
    const eventId = stableId('revision', member.orgId, sample.id, updated.version);
    writes.push({ table: 'events', action: 'create', record: { id: eventId, orgId: member.orgId, sampleId: sample.id,
      version: updated.version, kind: accepted ? 'receipt_accepted' : 'receipt_missing', actorId: member.id,
      fromCustodianId: sample.custodianId, toCustodianId: updated.custodianId, capturedAt: timestamp, recordedAt: timestamp,
      note: (accepted ? 'Accepted in batch receipt ' : 'Missing at batch receipt; custody unchanged. Receipt ') + receiptId } },
      { table: 'samples', action: 'update', record: updated });
    if (accepted) writes.push({ table: 'handoffs', action: 'update', record: { ...handoff, status: 'accepted', acceptedAt: timestamp } });
    details.items.push({ sampleId: sample.id, label: sample.label, versionBefore: sample.version, versionAfter: updated.version,
      fromCustodianId: sample.custodianId, toCustodianId: updated.custodianId, outcome: accepted ? 'received' : 'missing' });
    if (sample.id === command.sampleId) result = { operationId: command.operationId, sampleId: sample.id, version: updated.version,
      status: updated.status, custodianId: updated.custodianId, assignedCourierId: updated.assignedCourierId,
      pendingHandoffId: updated.pendingHandoffId, eventId, receiptId };
  }
  const record: BatchReceiptRecord = { id: receiptId, orgId: member.orgId, batchId: command.batchId, actorId: member.id,
    recordedAt: timestamp, status: comparison.missing.length || comparison.unexpected.length || comparison.duplicateScans.length ? 'discrepancy' : 'matched',
    expectedCount: manifest.items.length, receivedCount: comparison.received.length, missingCount: comparison.missing.length,
    unexpectedCount: comparison.unexpected.length, duplicateCount: comparison.duplicateScans.length, detailsJson: JSON.stringify(details) };
  if (record.detailsJson.length > 16000) throw new DomainError('RECEIPT_TOO_LARGE', 'The receipt exceeds the pilot record limit.', 400);
  writes.push({ table: 'batch_receipts', action: 'create', record },
    { table: 'operations', action: 'create', record: { id: opId, orgId: member.orgId, actorId: member.id,
      sampleId: command.sampleId, fingerprint: digest, resultJson: JSON.stringify(result!) } },
    ...await batchGuard(store, member.orgId, command.batchId, command.kind, command.batchVersion));
  try { await store.commit(writes); }
  catch (error) {
    if (!(error instanceof StorageConflict)) throw error;
    const receipt = await store.get('operations', opId);
    if (receipt) {
      if (receipt.fingerprint !== digest) throw new DomainError('OPERATION_ID_REUSED', 'Use a new operation ID for a changed request.');
      return JSON.parse(receipt.resultJson) as CommandResult;
    }
    throw new DomainError('CONFLICT', 'Another action changed this batch. Refresh its manifest before trying again.');
  }
  return result!;
}
