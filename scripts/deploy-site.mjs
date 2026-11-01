import { AppwriteException, Sites, Project, Framework, BuildRuntime, Adapter } from 'node-appwrite';
import {InputFile} from 'node-appwrite/file';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {config,marker,safeFailure} from '../dist/scripts/config.js';
const siteId='labrelay-web',description='LabRelay production frontend v1';
try{
 const c=config();if((await c.db.get({databaseId:c.databaseId})).description!==marker)throw Error('Unexpected project/database ownership.');
 const sites=new Sites(c.client),project=new Project(c.client);
 // Check both capabilities before creating resources.
 await sites.list({total:false});await project.listPlatforms({total:false});
 let site;
 try{site=await sites.get({siteId});if(site.description!==description)throw Error('Site ID belongs to another application.');}
 catch(e){if(!(e instanceof AppwriteException&&e.code===404))throw e;
 site=await sites.create({siteId,name:'LabRelay',framework:Framework.Other,buildRuntime:BuildRuntime.Static1,adapter:Adapter.Static,
 enabled:true,logging:true,installCommand:'',buildCommand:'',outputDirectory:'.',fallbackFile:'index.html',scopes:[],description});}
 if(process.argv.includes('--prepare-only')){console.log('Sites access and ownership verified.');process.exit(0);}
 execFileSync('tar',['-czf','.local/labrelay-web.tar.gz','-C','dist/web','.']);
 const archive=await readFile('.local/labrelay-web.tar.gz');
 let pending;try{pending=JSON.parse(await readFile('.local/site-deployment.json','utf8'));}catch{}
 let deployment;
 if(pending?.siteId===siteId&&!process.argv.includes('--new'))deployment=await sites.getDeployment({siteId,deploymentId:pending.deploymentId});
 else{deployment=await sites.createDeployment({siteId,code:InputFile.fromPath('.local/labrelay-web.tar.gz','labrelay-web.tar.gz'),activate:true,installCommand:'',buildCommand:'',outputDirectory:'.'});
 await writeFile('.local/site-deployment.json',JSON.stringify({siteId,deploymentId:deployment.$id,archiveSha256:createHash('sha256').update(archive).digest('hex')},null,2));}
 console.log('Deployment: '+deployment.$id);
 for(let attempt=0;attempt<60;attempt++){
 deployment=await sites.getDeployment({siteId,deploymentId:deployment.$id});
 if(['ready','active'].includes(deployment.status))break;
 if(deployment.status==='failed')throw Error('Site build failed; inspect Appwrite build logs before retrying.');
 if(attempt===59)throw Error('Build remains pending; resume this script to inspect the saved deployment.');
 await new Promise(resolve=>setTimeout(resolve,3000));}
 site=await sites.get({siteId});if(site.deploymentId!==deployment.$id)await sites.updateSiteDeployment({siteId,deploymentId:deployment.$id});
 const report={at:new Date().toISOString(),projectId:c.projectId,siteId,deploymentId:deployment.$id,status:deployment.status,
 archiveSha256:JSON.parse(await readFile('.local/site-deployment.json','utf8')).archiveSha256,hostname:process.env.APPWRITE_SITE_HOSTNAME||null,verification:'Domain sign-in and Realtime verification pending.'};
 if(report.hostname){
 if(!/^[a-z0-9.-]+$/.test(report.hostname)||report.hostname.includes('..'))throw Error('Use an exact valid hostname.');
 const platforms=await project.listPlatforms();if(!platforms.platforms.some(platform=>platform.hostname===report.hostname))await project.createWebPlatform({platformId:'labrelay_hosted',name:'LabRelay hosted frontend',hostname:report.hostname});
 }
 await writeFile('reports/site-deployment.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch(e){console.error(safeFailure(e));process.exitCode=1;}
