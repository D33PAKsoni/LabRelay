import {Proxy,Project,Query} from 'node-appwrite';
import {readFile,writeFile} from 'node:fs/promises';
import {config,safeFailure} from '../dist/scripts/config.js';
const domain='labrelay.appwrite.network',siteId='labrelay-web';
try{
 const c=config(),proxy=new Proxy(c.client),project=new Project(c.client);
 const matches=await proxy.listRules({queries:[Query.equal('domain',domain)]});
 let rule=matches.rules.find(rule=>rule.domain===domain);
 if(rule&&rule.deploymentResourceId!==siteId)throw Error('Hostname is already attached to another resource. Do not change it.');
 if(!rule)rule=await proxy.createSiteRule({domain,siteId});
 const platforms=await project.listPlatforms();
 if(!platforms.platforms.some(platform=>platform.hostname===domain))await project.createWebPlatform({platformId:'labrelay_hosted',name:'LabRelay hosted frontend',hostname:domain});
 const report=JSON.parse(await readFile('reports/site-deployment.json','utf8'));
 Object.assign(report,{hostname:domain,url:'https://'+domain,domainRuleId:rule.$id,domainStatus:rule.status,verification:'Domain attached; production browser verification pending.'});
 await writeFile('reports/site-deployment.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({url:report.url,domainStatus:rule.status,platformRegistered:true}));
}catch(e){const missing=String(e.message).match(/missing scopes \(([^)]+)\)/);console.error(missing?'Appwrite requires routing scopes: '+missing[1]:safeFailure(e));process.exitCode=1;}

