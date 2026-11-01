import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppwriteException, type TablesDB } from 'node-appwrite';
import { distanceMeters, parseNearbyQuery } from '../../src/domain/geo.js';
import { readNearbySites } from '../../src/nearby.js';
import { DomainError } from '../../src/domain/errors.js';
const member = { id: 'courier', orgId: 'org_a', role: 'courier' as const, active: true };
const origin = { $id: 'origin', orgId: 'org_a', name: 'Reference', location: [78.4744,17.385] };
function database(rows: object[] = [], total = rows.length, site = origin) {
  const calls: Record<string, any>[] = [];
  const db = { async getRow() { return site; }, async listRows(args: Record<string, any>) { calls.push(args); return { rows, total }; } } as unknown as TablesDB;
  return { db, calls };
}
const input = { originSiteId: 'origin', radiusKm: 1 };

test('nearby query validates bounds and rejects organization/role injection and ambiguous inputs', () => {
  for (const value of [null, [], {}, { ...input, orgId:'org_b' }, { ...input, role:'receiver' }, { ...input, radiusKm:'1' },
    { ...input, radiusKm:NaN }, { ...input, radiusKm:Infinity }, { ...input, radiusKm:0 }, { ...input, radiusKm:100.1 }, { ...input, originSiteId:'../secret' }])
    assert.throws(() => parseNearbyQuery(value), e => e instanceof DomainError && e.status === 400);
  assert.deepEqual(parseNearbyQuery(input),input);
  assert.equal(parseNearbyQuery({...input,radiusKm:0.1}).radiusKm,0.1);
  assert.equal(parseNearbyQuery({...input,radiusKm:100}).radiusKm,100);
});
test('great-circle distances use longitude/latitude and remain stable at poles, antimeridian and antipodes', () => {
  assert.equal(distanceMeters([78,17],[78,17]),0);
  assert(Math.abs(distanceMeters([0,0],[0,1])-111195)<2);
  assert(Math.abs(distanceMeters([0,60],[1,60])-55597)<4);
  assert(Math.abs(distanceMeters([179.9,0],[-179.9,0])-22239)<2);
  assert(Number.isFinite(distanceMeters([0,0],[180,0])));
  assert(distanceMeters([0,90],[90,90])<0.001);
  assert.throws(() => distanceMeters([181,0],[0,0]));
});
test('nearby adapter passes the active organization, point and explicit meter units to spatial query', async () => {
  const {db,calls} = database([origin]);
  const result = await readNearbySites(db,'test',member,input);
  const queries = calls[0]!.queries.map((q:string)=>JSON.parse(q));
  assert(queries.some((q:any)=>q.method==='equal' && q.attribute==='orgId' && q.values[0]==='org_a'));
  assert(queries.some((q:any)=>q.method==='distanceLessThan' && q.attribute==='location' && JSON.stringify(q.values[0])===JSON.stringify([[78.4744,17.385],1000,true])));
  assert.equal(result.origin.id,'origin'); assert.equal(result.radiusMeters,1000);
});
test('nearby results are sorted by distance with deterministic ties and defensively exclude foreign rows', async () => {
  const {db}=database([{...origin,$id:'z',location:[78.478,17.385]}, {...origin,$id:'other',orgId:'org_b'}, {...origin,$id:'b'}, {...origin,$id:'a'}]);
  const result = await readNearbySites(db,'test',member,input);
  assert.deepEqual(result.sites.map(item=>item.site.id),['a','b','z']);
  assert(result.sites[2]!.distanceMeters>300);
});
test('foreign and missing origins both return 404 before any spatial query', async () => {
  const foreign=database([],0,{...origin,orgId:'org_b'});
  await assert.rejects(readNearbySites(foreign.db,'test',member,input),e=>e instanceof DomainError && e.status===404);
  assert.equal(foreign.calls.length,0);
  const missing={async getRow(){throw new AppwriteException('missing',404,'row_not_found');}} as unknown as TablesDB;
  await assert.rejects(readNearbySites(missing,'test',member,input),e=>e instanceof DomainError && e.status===404);
});
test('overflow refuses to label a partial page as nearest-first results', async () => {
  const {db}=database([origin],201);
  await assert.rejects(readNearbySites(db,'test',member,input),e=>e instanceof DomainError && e.code==='NEARBY_RESULT_LIMIT' && e.status===422);
});
test('empty nearby result is explicit and malformed stored locations fail without invented distances', async () => {
  const empty=await readNearbySites(database().db,'test',member,input);
  assert.deepEqual(empty.sites,[]);
  await assert.rejects(readNearbySites(database([],0,{...origin,location:[200,90]}).db,'test',member,input),e=>e instanceof DomainError && e.code==='SITE_LOCATION_UNAVAILABLE');
});

