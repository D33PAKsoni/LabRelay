# Appwrite Sites deployment

Production: https://labrelay.appwrite.network

Hosting is complete and verified. See [SITE_HOSTING_STATUS.md](../reports/SITE_HOSTING_STATUS.md). Site ID: labrelay-web; active deployment: 6ae33994c83334191154.

## Deploy another frontend version

Build and deploy with the existing development key kept in the ignored root .env:

```powershell
npm run build:web
node --env-file-if-exists=.env scripts/deploy-site.mjs --new
```

The script archives only dist/web. Root environment files, demo credentials, tests and server code are excluded. A normal rerun without --new resumes the recorded deployment. Keep the existing domain route pointing to the active deployment.

The exact deployment/routing scope requirements are sites.read, sites.write, platforms.read, platforms.write, rules.read and rules.write. Appwrite's routing endpoint explicitly requires rules scopes; domains scopes alone do not authorize it. These permissions belong only to the local deployment key, never the browser. The Function still receives rows.read and rows.write only.

For domain/platform inspection or restoring this approved domain route:

```powershell
node --env-file-if-exists=.env scripts/attach-site-domain.mjs
```

The helper refuses to take over a domain attached to another resource. The hostname labrelay.appwrite.network was explicitly chosen by the user.

## Verify production

```powershell
$env:LABRELAY_SITE_URL='https://labrelay.appwrite.network'
npm run test:site
```

The test reads ignored fictional account credentials locally, verifies two-user sign-in and Realtime, checks socket closure on sign-out, revokes its test sessions and saves a post-login screenshot. Set LABRELAY_BROWSER_EXECUTABLE when the default Playwright Chromium is not installed.

Only public browser endpoint/project/Function identifiers belong in the frontend. Never place a server API key in a VITE_ variable. Registered membership is required to view records.
