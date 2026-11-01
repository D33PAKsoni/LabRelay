import { Functions, ProjectKeyScopes, Role, Runtime, AppwriteException } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';
import { config, safeFailure } from '../dist/scripts/config.js';
import { writeFile } from 'node:fs/promises';
const FUNCTION_ID = 'labrelay_api';
const DESCRIPTION = 'LabRelay authenticated sample workflow v2';
try {
  const c = config();
  const functions = new Functions(c.client);
  try { await functions.list({ total: false }); }
  catch (error) {
    if (error instanceof AppwriteException && [401,403].includes(error.code))
      throw new Error('Deployment access required: the development key needs functions.read and functions.write. Update its scopes in Appwrite Console; keep the key in .env.');
    throw error;
  }
  if (process.argv.includes('--check')) { console.log('PASS: Function read scope is available; no cloud resources changed.'); process.exit(0); }
  const options = { name: 'LabRelay API', runtime: Runtime.Node22, execute: [Role.users()], events: [], schedule: '',
    timeout: 60, enabled: true, logging: true, entrypoint: 'function.mjs',
    commands: 'npm ci --omit=dev --ignore-scripts --no-audit --no-fund',
    scopes: [ProjectKeyScopes.RowsRead, ProjectKeyScopes.RowsWrite], description: DESCRIPTION };
  try { await functions.create({ functionId: FUNCTION_ID, ...options }); }
  catch (error) {
    if (!(error instanceof AppwriteException && error.code === 409)) throw error;
    const existing = await functions.get({ functionId: FUNCTION_ID });
    if (existing.description !== DESCRIPTION) throw new Error('Refusing to modify an unrelated function at labrelay_api.');
    await functions.update({ functionId: FUNCTION_ID, ...options });
  }
  const vars = await functions.listVariables({ functionId: FUNCTION_ID });
  const variable = vars.variables.find(variable => variable.key === 'APPWRITE_DATABASE_ID');
  if (variable) {
    if (variable.value !== c.databaseId) throw new Error('Existing Function points to another database; review before deployment.');
  } else await functions.createVariable({ functionId: FUNCTION_ID, variableId: 'database_id', key: 'APPWRITE_DATABASE_ID', value: c.databaseId, secret: false });
  const deployment = await functions.createDeployment({ functionId: FUNCTION_ID,
    code: InputFile.fromPath('.local/labrelay-function.tar.gz', 'labrelay-function.tar.gz'), activate: true,
    entrypoint: options.entrypoint, commands: options.commands });
  await writeFile('.local/function-deployment.json', JSON.stringify({ functionId: FUNCTION_ID, deploymentId: deployment.$id, projectId: c.projectId }, null, 2));
  console.log('Uploaded deployment ' + deployment.$id + '.');
  for (let attempt = 0; attempt < 90; attempt++) {
    const current = await functions.getDeployment({ functionId: FUNCTION_ID, deploymentId: deployment.$id });
    if (current.status === 'ready') {
      const active = await functions.get({ functionId: FUNCTION_ID });
      if (active.deploymentId !== current.$id) await functions.updateDeployment({ functionId: FUNCTION_ID, deploymentId: current.$id });
      await writeFile('reports/function-deployment.json', JSON.stringify({ at: new Date().toISOString(), projectId: c.projectId,
        functionId: FUNCTION_ID, deploymentId: current.$id, status: current.status, runtime: options.runtime,
        execute: options.execute, scopes: options.scopes }, null, 2));
      console.log('PASS: hosted LabRelay Function is ready and active. Run npm run test:hosted next.'); process.exit(0);
    }
    if (current.status === 'failed') throw new Error('Function build failed. Inspect its build log in Appwrite Console.');
    if (attempt % 6 === 0) console.log('Function build status: ' + current.status);
    await new Promise(resolve => setTimeout(resolve, 4000));
  }
  throw new Error('Function build is still pending; inspect .local/function-deployment.json before retrying.');
} catch (error) { console.error(safeFailure(error)); process.exitCode = 1; }
