export type Role = 'collector' | 'courier' | 'receiver';
export type Status = 'ready' | 'assigned' | 'in_transit' | 'received';
export interface Membership { id: string; orgId: string; role: Role; active: boolean }
export interface Sample {
  id: string; orgId: string; label: string; batchId: string; siteId: string;
  status: Status; custodianId: string; assignedCourierId: string | null;
  pendingHandoffId: string | null; version: number;
}
export interface Handoff {
  id: string; orgId: string; sampleId: string; fromUserId: string; toUserId: string;
  status: 'offered' | 'accepted'; offeredAt: string; acceptedAt: string | null;
}
export interface CustodyEvent {
  id: string; orgId: string; sampleId: string; version: number; kind: Command['kind'] | 'receipt_missing' | 'receipt_accepted';
  actorId: string; fromCustodianId: string; toCustodianId: string;
  capturedAt: string; recordedAt: string; note: string;
}
export interface CommandResult {
  operationId: string; sampleId: string; version: number; status: Status;
  custodianId: string; assignedCourierId: string | null; pendingHandoffId: string | null;
  eventId: string; receiptId?: string;
}
export interface OperationReceipt {
  id: string; orgId: string; actorId: string; sampleId: string;
  fingerprint: string; resultJson: string;
}
export interface Site { id: string; orgId: string; name: string; location: number[] }
export interface Batch { id: string; orgId: string; batchId: string; version: number }
export interface BatchChange extends Batch { kind: string }
export interface BatchManifest { batchId: string; version: number; items: { sample: Sample; handoff: Handoff }[] }
export interface ReceiptDetails {
  scannedIds: string[]; missing: string[]; unexpected: string[]; duplicateScans: string[];
  items: { sampleId: string; label: string; versionBefore: number; versionAfter: number;
    fromCustodianId: string; toCustodianId: string; outcome: 'received' | 'missing' }[];
}
export interface BatchReceiptRecord {
  id: string; orgId: string; batchId: string; actorId: string; recordedAt: string; status: 'matched' | 'discrepancy';
  expectedCount: number; receivedCount: number; missingCount: number; unexpectedCount: number; duplicateCount: number; detailsJson: string;
}
export interface BatchReceipt extends Omit<BatchReceiptRecord, 'detailsJson'> { details: ReceiptDetails }
export interface LiveUpdate { id: string; token: string; changedAt: string }
export interface Tables {
  live_updates: LiveUpdate;
  samples: Sample; handoffs: Handoff; events: CustodyEvent;
  operations: OperationReceipt; memberships: Membership; sites: Site;
  batches: Batch; batch_changes: BatchChange; batch_receipts: BatchReceiptRecord;
}
export type TableName = keyof Tables;
export type StoredRecord = Tables[TableName];
export type Write = { table: TableName; action: 'create' | 'update'; record: StoredRecord };
export interface Store {
  get<K extends TableName>(table: K, id: string): Promise<Tables[K] | null>;
  listBatch(orgId: string, batchId: string): Promise<Sample[]>;
  commit(writes: Write[]): Promise<void>;
}
interface BaseCommand { operationId: string; sampleId: string; expectedVersion: number }
export type Command =
  | BaseCommand & { kind: 'reconcile_batch'; batchId: string; batchVersion: number; expected: { sampleId: string; version: number }[]; scannedIds: string[] }
  | BaseCommand & { kind: 'register_sample'; label: string; batchId: string; siteId: string }
  | BaseCommand & { kind: 'claim' }
  | BaseCommand & { kind: 'offer_handoff'; toUserId: string }
  | BaseCommand & { kind: 'accept_handoff'; handoffId: string }
  | BaseCommand & { kind: 'observe'; note: string; capturedAt: string };
