import type { Plugin } from 'vite';
import { MemoryStore } from '../src/adapters/memory.js';
import { LabRelayService, stableId } from '../src/domain/service.js';
import { openReceipt } from '../src/domain/batch.js';
import { DomainError } from '../src/domain/errors.js';
import { distanceMeters, nearbyResult, parseNearbyQuery } from '../src/domain/geo.js';
import type { Membership, Sample } from '../src/domain/types.js';

export function previewPlugin(): Plugin {
  return { name: 'labrelay-development-preview', configureServer(server) {
    const store = new MemoryStore();
    const streams=new Map<string,Set<import('node:http').ServerResponse>>();
    const publish=()=>{for(const connections of streams.values())for(const response of connections)response.write('data: {}\n\n');};
    const people: Membership[] = [
      { id: 'collector', orgId: 'preview_org', role: 'collector', active: true },
      { id: 'courier_0', orgId: 'preview_org', role: 'courier', active: true },
      { id: 'receiver', orgId: 'preview_org', role: 'receiver', active: true },
    ];
    people.forEach(person => store.seed('memberships', person));
    store.seed('sites', { id: 'north_bank', orgId: 'preview_org', name: 'North bank · river station', location: [78.4744, 17.385] });
    store.seed('sites', { id: 'canal_point', orgId: 'preview_org', name: 'Canal outlet · station 02', location: [78.481, 17.391] });
    store.seed('sites', { id: 'upland_point', orgId: 'preview_org', name: 'Upland reservoir - station 03', location: [78.66,17.56] });
    const service = new LabRelayService(store);
    const ready = (async () => {
      for (const [id, label, siteId, steps] of [
        ['WTR_0041', 'River water · north bank', 'north_bank', 0],
        ['WTR_0042', 'Canal outlet · morning collection', 'canal_point', 1],
        ['WTR_0043', 'River water · downstream', 'north_bank', 3],
        ['WTR_0044', 'Canal outlet · repeat sample', 'canal_point', 4],
        ['WTR_0045', 'River water · laboratory repeat', 'north_bank', 4],
        ['WTR_0046', 'Reservoir water - upland collection', 'upland_point', 0],
      ] as const) {
        await service.execute('collector', { kind: 'register_sample', sampleId: id, operationId: 'seed_' + id,
          expectedVersion: 0, label, siteId, batchId: 'BATCH_20261028' });
        if (steps > 0) await service.execute('courier_0', { kind: 'claim', sampleId: id, operationId: 'claim_' + id, expectedVersion: 0 });
        if (steps >= 3) {
          const offer = await service.execute('collector', { kind: 'offer_handoff', sampleId: id, operationId: 'offer_' + id, expectedVersion: 1, toUserId: 'courier_0' });
          await service.execute('courier_0', { kind: 'accept_handoff', sampleId: id, operationId: 'accept_' + id, expectedVersion: 2, handoffId: offer.pendingHandoffId });
        }
        if (steps >= 4) await service.execute('courier_0', { kind: 'offer_handoff', sampleId: id, operationId: 'lab_' + id, expectedVersion: 3, toUserId: 'receiver' });
      }
    })();
    server.middlewares.use('/__preview', async (req, res) => {
      const respond = (status: number, body: unknown) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
      try {
        await ready;
        const url=new URL(req.url||'/', 'http://localhost');
        const actor = String(req.headers['x-preview-actor'] || (url.pathname==='/updates'?url.searchParams.get('actor'):'') || '');
        if (!people.some(person => person.id === actor)) return respond(401, { error: 'UNAUTHENTICATED' });
        const member = await service.member(actor);
        const path = url.pathname;
        if(req.method==='GET'&&path==='/updates'){
          res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive'});res.write(': ready\n\n');
          const connections=streams.get(actor)||new Set();connections.add(res);streams.set(actor,connections);
          const heartbeat=setInterval(()=>res.write(': keepalive\n\n'),15000);
          res.on('close',()=>{clearInterval(heartbeat);connections.delete(res);if(!connections.size)streams.delete(actor);});return;
        }
        if (req.method === 'GET' && path === '/workspace') return respond(200, { live:{databaseId:'preview',tableId:'live_updates',rowId:actor}, member,
          members: people.map(({ id, role }) => ({ id, role })), samples: store.list('samples').filter(row => row.orgId === member.orgId),
          receipts: store.list('batch_receipts').filter(row => row.orgId === member.orgId).sort((a,b)=>b.recordedAt.localeCompare(a.recordedAt)).slice(0,20).map(openReceipt), receiptsTruncated: false,
          sites: store.list('sites').filter(row => row.orgId === member.orgId), handoffs: store.list('handoffs').filter(row => row.orgId === member.orgId && row.status === 'offered'), truncated: false });
        const batchPath = path.match(/^\/batches\/([A-Za-z0-9_.-]+)\/manifest$/);
        if (req.method === 'GET' && batchPath) return respond(200, await service.batchManifest(actor, batchPath[1]!));
        const receiptPath = path.match(/^\/receipts\/([A-Za-z0-9_.-]+)$/);
        if (req.method === 'GET' && receiptPath) return respond(200, await service.readReceipt(actor, receiptPath[1]!));
        const history = path.match(/^\/samples\/([A-Za-z0-9_.-]+)\/history$/);
        if (req.method === 'GET' && history) {
          const sample = await service.read(actor, history[1]!);
          return respond(200, { sample, events: store.list('events').filter(event => event.sampleId === sample.id).sort((a,b) => a.version - b.version), truncated: false });
        }
        if (req.method === 'POST' && path === '/sites/nearby') {
          let body = ''; for await (const chunk of req) { body += String(chunk); if (body.length > 2048) return respond(413, { error: 'TOO_LARGE' }); }
          const query = parseNearbyQuery(JSON.parse(body));
          const origin = await store.get('sites', query.originSiteId);
          if (!origin || origin.orgId !== member.orgId) throw new DomainError('SITE_NOT_FOUND', 'Reference collection site not found.', 404);
          const matches = store.list('sites').filter(site => site.orgId === member.orgId && distanceMeters(origin.location, site.location) < query.radiusKm * 1000);
          return respond(200, nearbyResult(origin, matches, query.radiusKm));
        }
        if (req.method === 'POST' && path === '/commands') {
          let body = ''; for await (const chunk of req) { body += String(chunk); if (body.length > 8192) return respond(413, { error: 'TOO_LARGE' }); }
          const result=await service.execute(actor, JSON.parse(body));publish();return respond(200,result);
        }
        return respond(404, { error: 'NOT_FOUND' });
      } catch (error) {
        return respond(error instanceof DomainError ? error.status : 500, { error: error instanceof DomainError ? error.code : 'PREVIEW_ERROR',
          message: error instanceof DomainError ? error.message : 'The local preview could not complete the request.' });
      }
    });
  } };
}
