# Nearby collection sites - 28 October 2026

Dispatch can filter loaded samples by collection-site distance. Choose a reference site, select a radius, and run **Find nearby sites**. The sample table then includes **Site distance** and sorts matching samples nearest first. Search and status filters continue to apply. Summary cards retain the whole loaded workspace's counts.

## Use the filter

1. Open Dispatch after signing in.
2. Under **Nearby collections**, select a **Reference collection site** from your organization.
3. Choose a **Search radius** and run **Find nearby sites**.
4. Review matching sites and approximate straight-line distances. The reference site is included at zero distance. The list shows the first five sites; the sample filter uses every matching site.
5. Change either input to clear the previous filter, or choose **Clear distance filter** to restore all loaded samples.

The origin is a registered collection site. This feature does not request device location. Distances describe collection sites; they do not track a sample or courier, provide road distances, or estimate travel time.

New searches require connectivity. Going offline clears the distance filter and shows the loaded workspace, with its existing offline label. Nearby responses are held in memory and are not saved as a location-search history. Late responses cannot reapply a changed search or carry a filter into another signed-in identity.

## Authorized API

`POST /sites/nearby` accepts exactly:

```json
{"originSiteId":"YOUR_COLLECTION_SITE_ID","radiusKm":1}
```

The Function verifies the caller's JWT and active membership. It loads the origin site and verifies its organization, then combines the caller's organization with a spatial distance query on the indexed `sites.location` point column. Role or organization fields from the browser are rejected. An absent origin and an origin belonging to another organization both return the same 404 response. All three active roles may search their own organization's sites.

The response contains the authorized origin, radius in meters, matching site records with approximate great-circle distance in meters, and the server check time. Sites are ordered by distance, with site ID as a deterministic tie-breaker. The API does not mutate custody, samples, handoffs or audit events.

The implementation uses Appwrite's `[longitude, latitude]` point order and explicitly requests meter units. The database's spatial query determines radius membership; the displayed distance uses the mean-Earth-radius great-circle approximation. Near a radius boundary, displayed rounding and the database's measurement may differ slightly. See the primary [Appwrite geo-query documentation](https://appwrite.io/docs/products/databases/tablesdb/geo-queries) and [query reference](https://appwrite.io/docs/products/databases/tablesdb/queries).

## Pilot limits

- API radius: 0.1 to 100 km. The product offers 0.5, 1, 5, 10, 25, 50 and 100 km.
- At most 200 matching sites. More matches return an explicit request to narrow the radius; a partial page is never presented as the nearest set.
- The reference-site picker and sample table use the existing workspace's first 100 sites and latest 100 samples. The workspace's truncation notice remains visible when applicable. Matching sites with no loaded samples still appear in the query result.
- Nearby results require an explicit search. Workspace records refresh through authorized Realtime; rerun the distance query to recalculate its site result.

## Check commands

```powershell
npm test
npm run test:product
npm run test:nearby:live
npm run test:nearby:hosted
npm run test:cloud-ui
npm run build:web
```

The live checks use only fictional sites and existing development identities. Their reports include no passwords, API keys or JWTs. Current deployment and verification evidence are in [NEARBY_SITES_STATUS.md](../reports/NEARBY_SITES_STATUS.md) and [NEARBY_VERIFICATION.json](../reports/NEARBY_VERIFICATION.json).

