import { DomainError } from './errors.js';
import type { Site } from './types.js';

export interface NearbySiteQuery { originSiteId: string; radiusKm: number }
export interface NearbySite { site: Site; distanceMeters: number }
export interface NearbySites {
  origin: Site; radiusMeters: number; sites: NearbySite[]; checkedAt: string;
}
export function parseNearbyQuery(input: unknown): NearbySiteQuery {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new DomainError('INVALID_NEARBY_QUERY', 'Choose a reference collection site and radius.', 400);
  const value = input as Record<string, unknown>;
  if (Object.keys(value).length !== 2 || Object.keys(value).some(key => !['originSiteId', 'radiusKm'].includes(key)) ||
      typeof value.originSiteId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,35}$/.test(value.originSiteId) ||
      typeof value.radiusKm !== 'number' || !Number.isFinite(value.radiusKm) || value.radiusKm < 0.1 || value.radiusKm > 100)
    throw new DomainError('INVALID_NEARBY_QUERY', 'Use a valid reference site and a radius from 0.1 to 100 km.', 400);
  return { originSiteId: value.originSiteId, radiusKm: value.radiusKm };
}
export function validPoint(point: number[]): boolean {
  return point.length === 2 && point.every(Number.isFinite) && Math.abs(point[0]!) <= 180 && Math.abs(point[1]!) <= 90;
}
// Appwrite stores points as longitude, latitude. Distances here are approximate great-circle meters.
export function distanceMeters(a: number[], b: number[]): number {
  if (!validPoint(a) || !validPoint(b)) throw new Error('Invalid collection-site coordinates.');
  const rad = Math.PI / 180;
  const dLat = (b[1]! - a[1]!) * rad, dLon = (b[0]! - a[0]!) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1]! * rad) * Math.cos(b[1]! * rad) * Math.sin(dLon / 2) ** 2;
  return 6371008.8 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
export function nearbyResult(origin: Site, candidates: Site[], radiusKm: number, now = new Date()): NearbySites {
  const sites = candidates.filter(site => site.orgId === origin.orgId)
    .map(site => ({ site, distanceMeters: distanceMeters(origin.location, site.location) }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters || a.site.id.localeCompare(b.site.id));
  return { origin, radiusMeters: radiusKm * 1000, sites, checkedAt: now.toISOString() };
}
