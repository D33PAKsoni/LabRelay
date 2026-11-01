import { Query, type TablesDB } from 'node-appwrite';
import { AppwriteStore, unpack } from './adapters/appwrite.js';
import { DomainError } from './domain/errors.js';
import { nearbyResult, parseNearbyQuery, validPoint } from './domain/geo.js';
import type { Membership } from './domain/types.js';

export async function readNearbySites(db: TablesDB, databaseId: string, member: Membership, input: unknown) {
  const query = parseNearbyQuery(input);
  const origin = await new AppwriteStore(db, databaseId, async () => []).get('sites', query.originSiteId);
  if (!origin || origin.orgId !== member.orgId) throw new DomainError('SITE_NOT_FOUND', 'Reference collection site not found.', 404);
  if (!validPoint(origin.location)) throw new DomainError('SITE_LOCATION_UNAVAILABLE', 'This site has no usable location.', 422);
  const rows = await db.listRows({ databaseId, tableId: 'sites', queries: [
    Query.equal('orgId', member.orgId), Query.distanceLessThan('location', origin.location, query.radiusKm * 1000, true),
    Query.orderAsc('$id'), Query.limit(201),
  ] });
  // Sorting a partial page would falsely claim that it contains the nearest sites.
  if (rows.total > 200) throw new DomainError('NEARBY_RESULT_LIMIT', 'More than 200 sites match. Choose a smaller radius.', 422);
  return nearbyResult(origin, rows.rows.map(row => unpack<'sites'>(row)), query.radiusKm);
}
