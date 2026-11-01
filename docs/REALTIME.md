# Authorized Realtime updates - 29 October 2026

The workspace, pending handoffs, recent receipts and selected sample history refresh automatically when another client commits a command. A small status in the header shows **Live updates**, connection setup/recovery, or **Updates paused** while offline. Updates refresh server-confirmed records without submitting drafts or replaying rejected commands.

## Authorization model

Business records are read and changed through the authenticated Function. Each refresh verifies the current JWT and active membership, then scopes records to that membership's organization. Business rows have no direct browser grants. The adapter writes private rows on both create and update; the migration removed the older per-user read grants from existing records.

A tenth table, `live_updates`, holds one refresh signal per user. Its only application fields are a random token and server timestamp. Each signal row grants read access only to its own user and no browser mutation access. `GET /workspace` returns the authorized feed descriptor after checking membership and ensuring that user's signal row exists. The browser subscribes to that exact row, after sign-in.

A committed command sends new signals to active members of the affected organization. The client treats a signal only as a request to read the Function again. It does not apply WebSocket payloads to custody or history. The signal contains no sample, organization, membership, location, observation or receipt data. Permission-based delivery and session handling follow the primary [Appwrite Realtime authentication documentation](https://appwrite.io/docs/apis/realtime/authentication) and [subscription reference](https://appwrite.io/docs/apis/realtime/subscribe).

## Lifecycle and consistency

- Subscription setup happens after the authorized workspace read. A fresh read when the connection opens closes the initial read/subscribe gap.
- Signals within 200 ms are coalesced. Only one live refresh runs at a time; changes arriving during it schedule a follow-up.
- A 30-second authorized refresh and window-focus refresh recover missed signals, administrator changes and unavailable notification delivery.
- Offline mode closes the live connection. Reconnection reads current server state. The existing offline observation queue retains its own confirmation/review rules.
- Sign-out, identity changes, organization changes and component cleanup dispose subscriptions, timers and pending callbacks. Responses from an older identity or request cannot overwrite newer state.
- A 401/403 workspace response clears that actor's workspace/history cache, selection and distance filter, closes live updates, attempts to end the app session and returns to sign-in. Rejected/pending queue entries remain actor-separated for review.
- An organization change clears earlier history/filter context, including earlier cached history when the next login detects the changed organization.

Membership revocation is detected at the next authorized read: normally within 30 seconds while the app is active and online, plus request latency. A quiet WebSocket does not independently prove current membership. Offline snapshots already stored on a device remain subject to the existing offline policy until online authorization can be checked; this feature cannot remotely erase previously downloaded data from a disconnected device.

Receipts and custody changes commit atomically as before. Signals are published after that transaction. A notification failure does not turn a committed command into a failed mutation; periodic refresh recovers it. Replays may send another harmless invalidation, while the operation receipt still prevents duplicate custody writes. Loaded receiving manifests retain their exact revisions and require refresh/review if another command changed them.

## Deployment and migration

```powershell
npm run appwrite:bootstrap
npm run deploy:function
npm run appwrite:restrict-rows
npm run build:web
```

Run the restriction migration only against the marked LabRelay development database. It validates ownership and table security, pages through business rows and removes direct grants without changing application fields. The deploy-first order ensures new commands already create private rows. `reports/realtime-permission-migration.json` records the completed migration.

Notification fanout supports at most 100 active members in one organization. Larger organizations require a reviewed scaling/pagination strategy; periodic authorized reads still recover changes.

The Function retains only `rows.read` and `rows.write` dynamic scopes. This phase needs no additional API-key scopes. The frontend uses the session established by the normal Appwrite sign-in form. The fictional preview models invalidation with a development-only event stream and clearly labels its separate memory backend.

## Verification

```powershell
npm test
npm run test:product
npm run test:live
npm run test:product:live
npm run test:batch:live
npm run test:hosted
npm run test:batch:hosted
npm run test:nearby:hosted
npm run test:cloud-ui
```

The browser suite exercises two signed-in accounts receiving updates without pressing Refresh, automatic selected-history updates, connection cleanup, real membership revocation, owner-only WebSocket delivery with a positive authentication control, and denied direct business-row reads. It revokes only the fictional sessions it creates and restores the temporary membership change.

The browser security probe is a test bundle under `dist/browser`, loaded only by development checks. It is not included in the production frontend or Function archive. No API key or credential is bundled. See [REALTIME_STATUS.md](../reports/REALTIME_STATUS.md) and [REALTIME_VERIFICATION.json](../reports/REALTIME_VERIFICATION.json) for final evidence.

