# Nearby-site phase - 28 October 2026

**Historical phase snapshot:** authorized Realtime and private business-row access are now implemented. See [REALTIME_STATUS.md](REALTIME_STATUS.md) and [REALTIME_VERIFICATION.json](REALTIME_VERIFICATION.json) for current verification and deployment.

**Complete:** Dispatch now offers an organization-authorized collection-site distance filter. The updated authenticated Appwrite Function is deployed and verified. A real browser selected a 1 km radius, included a fictional collection 382 m away, excluded a distant reservoir, widened the radius successfully and cleared the filter.

## Verification in this phase

| Evidence | Passing checks |
|---|---:|
| Unit and adapter contracts, including seven geographic/authorization cases | 42 |
| Product browser scenarios, including four nearby cases | 15 |
| Nearby routes against real Appwrite Auth and spatial queries | 4 |
| Deployed nearby endpoint with real JWTs | 4 |
| Deployed product custody regression | 4 |
| Deployed batch receipt regression | 5 |
| Real-browser hosted custody, batch receipt and nearby journeys | 3 |
| **Total executed in this phase** | **77** |

All listed checks pass. Earlier diagnostic browser and locally invoked cloud reports remain as prior-phase evidence and are not included in this phase's total. The frontend production build succeeds; its JavaScript bundle is 506 KB (147 KB gzip). Vite retains the earlier chunk-size and icon-library directive warnings.

The final cloud audit confirms deployment `6ae22bb1518f572b571d` is active and ready on Node.js 22. Function execution is restricted to `users`, with `rows.read` and `rows.write` dynamic scopes. All nine tables retain row security and no table-wide client grants. All sixteen fictional users have zero remaining sessions. [NEARBY_VERIFICATION.json](NEARBY_VERIFICATION.json) records these checks and the deployed archive hash.

## Product behavior and limits

Choose a reference collection site and radius in Dispatch. The server derives the organization from active membership, checks origin ownership and queries the indexed geographic column in meters. Missing and foreign origins produce the same 404. Client-supplied organization or role fields are rejected.

The sample table shows approximate straight-line site distance and sorts nearest first. Text/status filters combine with the distance filter. Changing inputs, changing identity or losing connectivity clears the previous result; late responses are ignored. No device-location prompt is used.

The API accepts 0.1-100 km and at most 200 matching sites. Overflow asks for a smaller radius. The existing workspace limit of 100 sites and 100 samples still applies to its picker/table. The first five matching sites are listed, while all matching sites participate in filtering. See [NEARBY_SITES.md](../docs/NEARBY_SITES.md) for the contract and distance semantics.

[Hosted Dispatch screenshot](hosted-nearby-dispatch.png) records the verified UI result. The frontend continues to run locally against the hosted API.

Next: authorized Realtime updates, then frontend publication to Appwrite Sites. Organizer eligibility clarification, user interviews, licensing and submission materials remain open. No external messages were sent.

