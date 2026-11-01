import { MemoryStore } from '../../src/adapters/memory.js';
import { LabRelayService } from '../../src/domain/service.js';
import type { Sample } from '../../src/domain/types.js';

export const fixedTime = '2026-10-27T12:00:00.000Z';
export function fixture() {
  const store = new MemoryStore();
  store.seed('memberships', { id: 'collector', orgId: 'org_a', role: 'collector', active: true });
  store.seed('memberships', { id: 'receiver', orgId: 'org_a', role: 'receiver', active: true });
  for (let n = 0; n < 10; n++) store.seed('memberships', { id: `courier_${n}`, orgId: 'org_a', role: 'courier', active: true });
  store.seed('memberships', { id: 'outsider', orgId: 'org_b', role: 'courier', active: true });
  store.seed('memberships', { id: 'disabled', orgId: 'org_a', role: 'courier', active: false });
  const sample: Sample = { id: 'water_001', orgId: 'org_a', label: 'Water sample 001', batchId: 'batch_001',
    siteId: 'site_001', status: 'ready', custodianId: 'collector', assignedCourierId: null, pendingHandoffId: null, version: 0 };
  store.seed('samples', sample);
  return { store, sample, service: new LabRelayService(store, () => new Date(fixedTime)) };
}
