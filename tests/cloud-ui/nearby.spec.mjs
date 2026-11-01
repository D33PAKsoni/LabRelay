import { readFile } from 'node:fs/promises';
import { AppwriteException } from 'node-appwrite';
import { test, expect } from '@playwright/test';
import { config, marker } from '../../dist/scripts/config.js';
import { AppwriteStore } from '../../dist/src/adapters/appwrite.js';
import { LabRelayService } from '../../dist/src/domain/service.js';

test('hosted nearby search filters real dispatch by collection-site distance',async({browser})=>{
  process.loadEnvFile('.env'); const c=config();
  expect((await c.db.get({databaseId:c.databaseId})).description).toBe(marker);
  const {accounts}=JSON.parse(await readFile('.local/demo-accounts.json','utf8'));
  const collector=accounts.find(a=>a.role==='collector');
  const courier=accounts.find(a=>a.role==='courier');
  for(const site of [
    {id:'lrdemo_geo_near',name:'Fictional canal collection site',location:[78.478,17.385]},
    {id:'lrdemo_geo_far',name:'Fictional distant reservoir',location:[78.6,17.5]},
  ]) {
    const {id,...data}=site;
    try{await c.db.createRow({databaseId:c.databaseId,tableId:'sites',rowId:id,data:{...data,orgId:'lrdemo_org'},permissions:[]});}
    catch(e){if(!(e instanceof AppwriteException && e.code===409))throw e;const row=await c.db.getRow({databaseId:c.databaseId,tableId:'sites',rowId:id});expect(row.orgId).toBe('lrdemo_org');expect(row.name).toBe(site.name);expect(row.location).toEqual(site.location);}
  }
  const service=new LabRelayService(new AppwriteStore(c.db,c.databaseId,async org=>org==='lrdemo_org'?accounts.map(a=>a.id):[]));
  const tag=Date.now().toString(36),near='geo_near_'+tag,far='geo_far_'+tag;
  for(const [sampleId,siteId,label] of [[near,'lrdemo_geo_near','Fictional nearby canal collection'],[far,'lrdemo_geo_far','Fictional distant reservoir collection']])
    await service.execute(collector.id,{kind:'register_sample',sampleId,siteId,label,batchId:'geo_'+tag,operationId:'reg_'+sampleId,expectedVersion:0});
  const context=await browser.newContext({baseURL:'http://127.0.0.1:5173',viewport:{width:1440,height:1000}});
  const page=await context.newPage();
  try {
    await page.goto('/');
    try {await page.getByLabel('Email address').fill(courier.email);await page.getByLabel('Password',{exact:true}).fill(courier.password);await page.getByRole('button',{name:'Open workspace'}).click();}
    catch{throw new Error('Could not submit fictional courier sign-in.');}
    await expect(page.getByRole('heading',{name:'A clear path from field to lab.'})).toBeVisible();
    await expect(page.getByLabel('Preview role')).toHaveCount(0);
    await page.getByLabel('Reference collection site',{exact:true}).selectOption('lrdemo_north_bank');
    await page.getByLabel('Search radius',{exact:true}).selectOption('1');
    await page.getByRole('button',{name:'Find nearby sites',exact:true}).click();
    await expect(page.getByLabel('Nearby sites by distance').locator('li')).toHaveCount(2);
    await expect(page.getByRole('button',{name:'Open handoff for '+near,exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Open handoff for '+far,exact:true})).toHaveCount(0);
    await expect(page.getByRole('row').filter({hasText:near})).toContainText('382 m');
    await page.getByLabel('Search samples').fill('Fictional nearby canal collection');
    await page.screenshot({path:'reports/hosted-nearby-dispatch.png',fullPage:true});
    await page.getByLabel('Search samples').fill('');
    await page.getByLabel('Search radius',{exact:true}).selectOption('50');
    await page.getByRole('button',{name:'Find nearby sites',exact:true}).click();
    await expect(page.getByRole('button',{name:'Open handoff for '+far,exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Clear distance filter'}).click();
    await expect(page.getByRole('columnheader',{name:'Site distance'})).toHaveCount(0);
  } finally {
    if(await page.getByRole('button',{name:'Sign out',exact:true}).isVisible()) {
      await page.getByRole('button',{name:'Sign out',exact:true}).click();
      await expect(page.getByRole('heading',{name:'Welcome back.'})).toBeVisible();
    }
    await context.close();
  }
});

