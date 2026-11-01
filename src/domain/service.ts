import { createHash } from 'node:crypto';
import { DomainError, StorageConflict } from './errors.js';
import { parseCommand } from './commands.js';
import { batchGuard, loadBatchManifest, openReceipt, reconcileBatch } from './batch.js';
import { stableId } from './ids.js';
export { stableId } from './ids.js';
import type { Command, CommandResult, Handoff, Membership, OperationReceipt, Sample, Store, Write } from './types.js';

const fingerprint = (command: Command): string =>
  createHash('sha256').update(JSON.stringify(Object.keys(command).sort().map(k => [k, command[k as keyof Command]]))).digest('hex');
const deny = (message = 'This action is not allowed for your account.'): never => {
  throw new DomainError('FORBIDDEN', message, 403);
};
const notFound = (): never => { throw new DomainError('NOT_FOUND', 'Sample not found.', 404); };

export class LabRelayService {
  constructor(private store: Store, private now: () => Date = () => new Date()) {}

  async member(actorId: string): Promise<Membership> {
    const member = await this.store.get('memberships', actorId);
    if (!member?.active) deny();
    return member!;
  }
  async read(actorId: string, sampleId: string): Promise<Sample> {
    const member = await this.member(actorId);
    const sample = await this.store.get('samples', sampleId);
    if (!sample || sample.orgId !== member.orgId) notFound();
    return sample!;
  }
  async batchManifest(actorId: string, batchId: string) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,35}$/.test(batchId)) throw new DomainError('INVALID_COMMAND', 'Invalid batch ID.', 400);
    return loadBatchManifest(this.store, await this.member(actorId), batchId);
  }
  async readReceipt(actorId: string, id: string) {
    const member = await this.member(actorId);
    const receipt = await this.store.get('batch_receipts', id);
    if (!receipt || receipt.orgId !== member.orgId) throw new DomainError('NOT_FOUND', 'Receipt not found.', 404);
    return openReceipt(receipt);
  }
  private replay(receipt: OperationReceipt, digest: string): CommandResult {
    if (receipt.fingerprint !== digest)
      throw new DomainError('OPERATION_ID_REUSED', 'Use a new operation ID for a changed request.');
    return JSON.parse(receipt.resultJson) as CommandResult;
  }

  private async register(actorId: string, member: Membership, command: Extract<Command, { kind: 'register_sample' }>,
    opId: string, digest: string): Promise<CommandResult> {
    if (member.role !== 'collector') deny('Only a collector may register a sample.');
    const site = await this.store.get('sites', command.siteId);
    if (!site || site.orgId !== member.orgId) throw new DomainError('SITE_NOT_FOUND', 'Choose a collection site in your organization.', 404);
    if (await this.store.get('samples', command.sampleId)) throw new DomainError('SAMPLE_EXISTS', 'That sample ID is already registered.');
    const sample: Sample = { id: command.sampleId, orgId: member.orgId, label: command.label, batchId: command.batchId,
      siteId: command.siteId, status: 'ready', custodianId: actorId, assignedCourierId: null, pendingHandoffId: null, version: 0 };
    const eventId = stableId('revision', member.orgId, sample.id, 0);
    const timestamp = this.now().toISOString();
    const result: CommandResult = { operationId: command.operationId, sampleId: sample.id, version: 0,
      status: sample.status, custodianId: actorId, assignedCourierId: null, pendingHandoffId: null, eventId };
    try {
      await this.store.commit([
        ...await batchGuard(this.store, member.orgId, command.batchId, command.kind),
        { table: 'samples', action: 'create', record: sample },
        { table: 'events', action: 'create', record: { id: eventId, orgId: member.orgId, sampleId: sample.id, version: 0,
          kind: 'register_sample', actorId, fromCustodianId: actorId, toCustodianId: actorId,
          capturedAt: timestamp, recordedAt: timestamp, note: 'Sample registered at collection.' } },
        { table: 'operations', action: 'create', record: { id: opId, orgId: member.orgId, actorId, sampleId: sample.id,
          fingerprint: digest, resultJson: JSON.stringify(result) } },
      ]);
    } catch (error) {
      if (!(error instanceof StorageConflict)) throw error;
      const receipt = await this.store.get('operations', opId);
      if (receipt) return this.replay(receipt, digest);
      if (await this.store.get('samples', command.sampleId)) throw new DomainError('SAMPLE_EXISTS', 'That sample ID was registered by another request.');
      throw new DomainError('CONFLICT', 'This batch changed during registration. Refresh and retry the original request.');
    }
    return result;
  }

  async execute(actorId: string, input: unknown): Promise<CommandResult> {
    const command = parseCommand(input);
    const member = await this.member(actorId);
    const opId = stableId('operation', member.orgId, actorId, command.operationId);
    const digest = fingerprint(command);
    const previous = await this.store.get('operations', opId);
    if (previous) return this.replay(previous, digest);
    if (command.kind === 'register_sample') return this.register(actorId, member, command, opId, digest);
    if (command.kind === 'reconcile_batch') return reconcileBatch(this.store, member, command, opId, digest, this.now);
    const sample = await this.read(actorId, command.sampleId);
    if (sample.version !== command.expectedVersion)
      throw new DomainError('STALE_VERSION', 'This sample changed. Review its current history before trying again.');
    if (sample.version === Number.MAX_SAFE_INTEGER) throw new DomainError('VERSION_LIMIT', 'Sample revision limit reached.');
    const timestamp = this.now().toISOString();
    const updated: Sample = { ...sample, version: sample.version + 1 };
    const extra: Write[] = [];
    switch (command.kind) {
      case 'claim': {
        if (member.role !== 'courier') deny();
        if (sample.status !== 'ready' || sample.assignedCourierId || sample.pendingHandoffId)
          throw new DomainError('ALREADY_ASSIGNED', 'This pickup is no longer available.');
        updated.status = 'assigned'; updated.assignedCourierId = actorId;
        // Assignment does not change physical custody.
        break;
      }
      case 'offer_handoff': {
        if (sample.custodianId !== actorId) deny('Only the confirmed custodian may offer a handoff.');
        if (sample.pendingHandoffId) throw new DomainError('HANDOFF_PENDING', 'A handoff is already awaiting confirmation.');
        const recipient = await this.member(command.toUserId);
        if (recipient.orgId !== sample.orgId || recipient.id === actorId) deny('Choose a recipient from this organization.');
        const toCourier = sample.status === 'assigned' && member.role === 'collector' &&
          recipient.role === 'courier' && recipient.id === sample.assignedCourierId;
        const toLab = sample.status === 'in_transit' && member.role === 'courier' && recipient.role === 'receiver';
        if (!toCourier && !toLab) throw new DomainError('INVALID_TRANSITION', 'This handoff does not match the sample journey.');
        const handoff: Handoff = { id: stableId('handoff', sample.id, updated.version), orgId: sample.orgId,
          sampleId: sample.id, fromUserId: actorId, toUserId: recipient.id, status: 'offered',
          offeredAt: timestamp, acceptedAt: null };
        updated.pendingHandoffId = handoff.id;
        extra.push({ table: 'handoffs', action: 'create', record: handoff });
        break;
      }
      case 'accept_handoff': {
        const handoff = await this.store.get('handoffs', command.handoffId);
        if (!handoff || handoff.orgId !== member.orgId || handoff.toUserId !== actorId) deny();
        if (sample.pendingHandoffId !== handoff!.id || handoff!.status !== 'offered' ||
            handoff!.sampleId !== sample.id || handoff!.fromUserId !== sample.custodianId)
          throw new DomainError('HANDOFF_CHANGED', 'This handoff is no longer available for confirmation.');
        if (member.role !== 'courier' && member.role !== 'receiver') deny();
        if (member.role === 'courier' && (sample.status !== 'assigned' || sample.assignedCourierId !== actorId)) deny();
        if (member.role === 'receiver' && sample.status !== 'in_transit') deny();
        updated.custodianId = actorId; updated.pendingHandoffId = null;
        updated.status = member.role === 'courier' ? 'in_transit' : 'received';
        extra.push({ table: 'handoffs', action: 'update', record: { ...handoff!, status: 'accepted', acceptedAt: timestamp } });
        break;
      }
      case 'observe': {
        if (sample.custodianId !== actorId) deny('Only the confirmed custodian can record a handling observation.');
        if (Date.parse(command.capturedAt) > this.now().getTime() + 5 * 60_000)
          throw new DomainError('CLOCK_AHEAD', 'The observation time is more than five minutes ahead of the server.', 400);
        // Client observation time and server acceptance time are stored separately.
        break;
      }
    }
    // A unique event per sample revision is a second concurrency guard. A stale
    // read between validation and transaction staging cannot overwrite a newer revision.
    const eventId = stableId('revision', sample.orgId, sample.id, updated.version);
    const result: CommandResult = { operationId: command.operationId, sampleId: sample.id,
      version: updated.version, status: updated.status, custodianId: updated.custodianId,
      assignedCourierId: updated.assignedCourierId, pendingHandoffId: updated.pendingHandoffId, eventId };
    const writes: Write[] = [
      { table: 'events', action: 'create', record: { id: eventId, orgId: sample.orgId, sampleId: sample.id,
        version: updated.version, kind: command.kind, actorId, fromCustodianId: sample.custodianId,
        toCustodianId: updated.custodianId, capturedAt: command.kind === 'observe' ? command.capturedAt : timestamp,
        recordedAt: timestamp, note: command.kind === 'observe' ? command.note : '' } },
      { table: 'samples', action: 'update', record: updated }, ...extra,
      { table: 'operations', action: 'create', record: { id: opId, orgId: sample.orgId, actorId,
        sampleId: sample.id, fingerprint: digest, resultJson: JSON.stringify(result) } },
    ];
    writes.push(...await batchGuard(this.store, member.orgId, sample.batchId, command.kind));
    try { await this.store.commit(writes); }
    catch (error) {
      if (!(error instanceof StorageConflict)) throw error;
      const committed = await this.store.get('operations', opId);
      if (committed) return this.replay(committed, digest);
      throw new DomainError('CONFLICT', 'Another action changed this sample. Refresh and review before trying again.');
    }
    return result;
  }
}
