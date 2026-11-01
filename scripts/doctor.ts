import { config, safeFailure } from './config.js';
try {
  const c = config();
  await c.db.list({ total: false });
  console.log('PASS: Appwrite endpoint and database API key scope are reachable. No data changed.');
  console.log('Next: npm run appwrite:bootstrap, then npm run test:live.');
} catch (error) { console.error(safeFailure(error)); process.exitCode = 1; }
