# Appwrite setup and live verification

**Current local project:** setup and live verification are complete, and the authenticated Function is deployed. Use PRODUCT_AND_DEPLOYMENT.md and ../reports/LOCAL_HANDOFF.md to continue. The fresh-project bootstrap instructions below remain reproducible.

This guide completes the account-dependent portion of the first day. No cloud project has been created by this package.

1. Sign in to your Appwrite account and create a new **LabRelay** development project on the Free plan. Keep production projects separate. Save its exact API endpoint and project ID.
2. Create a short-lived development API key for this project. The bootstrap needs database/table/column/index read and write scopes, row read/write, and user read/write. The live runner additionally needs `sessions.write` for its fictional test sessions. Do not give the key key-management scopes.
3. Copy `.env.example` to `.env` and enter the endpoint, project ID and key locally. Retain `APPWRITE_DATABASE_ID=labrelay_spike`.
4. Run the commands below. The first command checks connectivity without changing data. The second creates only the marked test resources. The third creates new fictional samples and runs the real checks.

```powershell
npm ci
npm run appwrite:doctor
npm run appwrite:bootstrap
npm run test:live
```

The current documented scope names are:

```text
databases.read  databases.write
tables.read     tables.write
columns.read    columns.write
indexes.read    indexes.write
rows.read       rows.write
users.read      users.write
sessions.write
```

Source: [Appwrite's API key documentation](https://appwrite.io/docs/partners/project/api-keys), checked 27 October 2026. Transaction API scope behavior must be verified against the chosen project; use the Console's scope descriptions if its catalog differs. Avoid assuming the development key's broad setup scopes belong on the deployed Function.

## Expected live checks

| Check | Required evidence |
|---|---|
| Ten simultaneous claims | One success, nine conflicts, one history event, collector retains custody |
| Duplicate operation | Equal responses and one history event |
| Organization isolation | Each test user can read its own organization; the other organization is denied |
| Direct mutation restriction | A readable sample cannot be rewritten by a client JWT |
| Stale observation | Conflict with no state overwrite |
| Atomic rollback | A later duplicate-key failure rolls back an earlier staged update |
| Complete handoff journey | Sender and intended receiver acknowledgment for both legs; receiver holds final custody |

Inspect `reports/cloud-results.json`. All seven checks must pass. The runner executes `src/function.ts` locally while using real Appwrite Auth and TablesDB; it is not a test of a deployed Function URL or platform header injection.

The bootstrap creates 13 passwordless fictional users named `LabRelay test ...`, membership records, one fictional sampling site and schema/index resources. The live runner temporarily creates sessions using the admin SDK and revokes them in its `finally` block. JWTs and session secrets are never logged or saved. Fictional sample and event rows remain in the isolated database for inspection.

## Deploy the Function after the spike

The configured root is this project folder. Use a currently available Node runtime at least 22.12, build with `npm ci && npm run build`, and use entrypoint `dist/src/function.js`. Set `APPWRITE_DATABASE_ID`. The platform provides the project ID, API endpoint and execution key; the function also accepts the equivalent endpoint/project environment variables for local verification.

Limit execution to authenticated users. The implementation verifies the user JWT with Appwrite Account and resolves organization/role using the server-managed membership table. Its database key needs row read/write and access to transaction endpoints, rather than schema or user-management permissions. Verify the current Console scopes. Call through the SDK execution endpoint with the caller's session. Hosted execution, Realtime subscriptions and the final frontend are day-two tasks.

## Troubleshooting

- **Configuration required:** edit `.env`; never paste the secret into chat.
- **401/403:** check endpoint/project/key scopes. A denied cross-organization read is expected only inside its specific negative test, after an own-organization read succeeds.
- **Schema not ready:** inspect the named table/index in Console. The script waits for readiness and stops on a failure.
- **An existing database is refused:** use a fresh `labrelay_...` database ID. Do not remove the ownership guard.
- **Quota reached:** inspect usage and reduce test resources. Do not upgrade to paid compute automatically.
- **A live check fails:** retain its report and fix the failure before calling the cloud spike successful.
