import { DomainError } from './errors.js';

export function reconcileManifest(expectedIds: string[], scannedIds: string[]) {
  if (new Set(expectedIds).size !== expectedIds.length)
    throw new DomainError('INVALID_MANIFEST', 'The expected manifest contains duplicate sample IDs.', 400);
  const expected = new Set(expectedIds), scanned = new Set(scannedIds);
  const seen = new Set<string>(), duplicateScans = new Set<string>();
  for (const id of scannedIds) { if (seen.has(id)) duplicateScans.add(id); seen.add(id); }
  return { received: expectedIds.filter(id => scanned.has(id)),
    missing: expectedIds.filter(id => !scanned.has(id)),
    unexpected: [...scanned].filter(id => !expected.has(id)), duplicateScans: [...duplicateScans] };
}
