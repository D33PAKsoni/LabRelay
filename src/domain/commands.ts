import { DomainError } from './errors.js';
import type { Command } from './types.js';

const invalid = (message: string): never => { throw new DomainError('INVALID_COMMAND', message, 400); };
const identifier = (v: unknown, name: string): string => {
  if (typeof v !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,35}$/.test(v))
    invalid(`${name} must be a 1–36 character identifier.`);
  return v as string;
};
export function parseCommand(input: unknown): Command {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) invalid('Expected an object.');
  const x = input as Record<string, unknown>;
  const base = { operationId: identifier(x.operationId, 'operationId'),
    sampleId: identifier(x.sampleId, 'sampleId'), expectedVersion: x.expectedVersion as number };
  if (!Number.isSafeInteger(base.expectedVersion) || base.expectedVersion < 0) invalid('expectedVersion must be a nonnegative safe integer.');
  const allowed = ['kind', 'operationId', 'sampleId', 'expectedVersion'];
  let result: Command;
  switch (x.kind) {
    case 'reconcile_batch': {
      allowed.push('batchId', 'batchVersion', 'expected', 'scannedIds');
      const batchId = identifier(x.batchId, 'batchId');
      if (!Number.isSafeInteger(x.batchVersion) || (x.batchVersion as number) < 0) invalid('batchVersion must be a nonnegative safe integer.');
      if (!Array.isArray(x.expected) || !x.expected.length || x.expected.length > 20) invalid('The manifest must contain 1–20 expected samples.');
      const expected = (x.expected as unknown[]).map(item => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return invalid('Invalid expected sample.');
        const row = item as Record<string, unknown>;
        if (Object.keys(row).some(key => !['sampleId', 'version'].includes(key)) || !Number.isSafeInteger(row.version) || (row.version as number) < 0)
          return invalid('Expected sample revisions must be nonnegative safe integers.');
        return { sampleId: identifier(row.sampleId, 'expected.sampleId'), version: row.version as number };
      }).sort((a,b) => a.sampleId.localeCompare(b.sampleId));
      if (new Set(expected.map(item => item.sampleId)).size !== expected.length) invalid('The expected manifest must not contain duplicate IDs.');
      if (!expected.some(item => item.sampleId === base.sampleId && item.version === base.expectedVersion)) invalid('The receipt anchor must match its manifest.');
      if (!Array.isArray(x.scannedIds) || x.scannedIds.length > 60) invalid('Provide at most 60 scans.');
      result = { ...base, kind: 'reconcile_batch', batchId, batchVersion: x.batchVersion as number, expected,
        scannedIds: (x.scannedIds as unknown[]).map(id => identifier(id, 'scannedIds')) };
      break;
    }
    case 'register_sample':
      allowed.push('label', 'batchId', 'siteId');
      if (base.expectedVersion !== 0) invalid('New samples must start at revision zero.');
      if (typeof x.label !== 'string' || !x.label.trim() || x.label.length > 120) invalid('label must contain 1–120 characters.');
      result = { ...base, kind: 'register_sample', label: (x.label as string).trim(),
        batchId: identifier(x.batchId, 'batchId'), siteId: identifier(x.siteId, 'siteId') };
      break;
    case 'claim': result = { ...base, kind: 'claim' }; break;
    case 'offer_handoff':
      allowed.push('toUserId'); result = { ...base, kind: 'offer_handoff', toUserId: identifier(x.toUserId, 'toUserId') }; break;
    case 'accept_handoff':
      allowed.push('handoffId'); result = { ...base, kind: 'accept_handoff', handoffId: identifier(x.handoffId, 'handoffId') }; break;
    case 'observe': {
      allowed.push('note', 'capturedAt');
      if (typeof x.note !== 'string' || x.note.trim().length < 1 || x.note.length > 500) invalid('note must contain 1–500 characters.');
      if (typeof x.capturedAt !== 'string' || x.capturedAt.length > 40 ||
        !/(Z|[+-]\d{2}:\d{2})$/.test(x.capturedAt) || !Number.isFinite(Date.parse(x.capturedAt)))
        invalid('capturedAt must be an ISO timestamp with a time zone.');
      result = { ...base, kind: 'observe', note: (x.note as string).trim(), capturedAt: new Date(x.capturedAt as string).toISOString() }; break;
    }
    default: return invalid('Unknown command kind.');
  }
  if (Object.keys(x).some(key => !allowed.includes(key))) invalid('Unexpected command fields. Identity and role are server-derived.');
  return result;
}
