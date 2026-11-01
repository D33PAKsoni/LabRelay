import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { config } from '../../dist/scripts/config.js';
import { AppwriteStore } from '../../dist/src/adapters/appwrite.js';
import { LabRelayService } from '../../dist/src/domain/service.js';

test('hosted batch receipt persists missing, unexpected and duplicate scans with unchanged missing custody',async({browser})=>{
  test.setTimeout(300000);
  process.loadEnvFile('.env');
  const c=config();
  const {accounts}=JSON.parse(await readFile('.local/demo-accounts.json','utf8'));
  const collector=accounts.find(account=>account.role==='collector');
  const courier=accounts.find(account=>account.role==='courier');
  const receiver=accounts.find(account=>account.role==='receiver');
  const store=new AppwriteStore(c.db,c.databaseId,async orgId=>orgId==='lrdemo_org'?accounts.map(account=>account.id):[]);
  const service=new LabRelayService(store);
  const tag=Date.now().toString(36),batchId='br_'+tag,ids=['br_a_'+tag,'br_b_'+tag];
  for(const [index,sampleId] of ids.entries()){
    await service.execute(collector.id,{kind:'register_sample',sampleId,expectedVersion:0,operationId:'reg_'+sampleId,
      label:'Fictional batch sample '+(index?'B':'A'),batchId,siteId:'lrdemo_north_bank'});
    await service.execute(courier.id,{kind:'claim',sampleId,expectedVersion:0,operationId:'claim_'+sampleId});
    const offer=await service.execute(collector.id,{kind:'offer_handoff',sampleId,expectedVersion:1,operationId:'offer_'+sampleId,toUserId:courier.id});
    await service.execute(courier.id,{kind:'accept_handoff',sampleId,expectedVersion:2,operationId:'accept_'+sampleId,handoffId:offer.pendingHandoffId});
    await service.execute(courier.id,{kind:'offer_handoff',sampleId,expectedVersion:3,operationId:'lab_'+sampleId,toUserId:receiver.id});
  }
  const context=await browser.newContext({baseURL:'http://127.0.0.1:5173',viewport:{width:1440,height:1000}});
  const page=await context.newPage();
  try{
    await page.goto('/');
    await expect(page.getByRole('heading',{name:'Welcome back.'})).toBeVisible();
    try{
      await page.getByLabel('Email address').fill(receiver.email);
      await page.getByLabel('Password',{exact:true}).fill(receiver.password);
      await page.getByRole('button',{name:'Open workspace'}).click();
    }catch{throw new Error('Could not submit fictional receiver sign-in.');}
    await expect(page.getByRole('heading',{name:'A clear path from field to lab.'})).toBeVisible();
    await page.getByRole('button',{name:'Receive batch',exact:true}).click();
    await page.getByLabel('Batch offered to you').selectOption(batchId);
    await page.getByRole('button',{name:'Load manifest',exact:true}).click();
    await expect(page.getByRole('table',{name:'Expected receipt manifest'})).toContainText(ids[1]);
    await page.getByLabel('Scanned sample IDs').fill(ids[0]+'\n'+ids[0]+'\nunexpected_'+tag);
    await page.getByRole('button',{name:'Accept 1 & record receipt',exact:true}).click();
    const report=page.getByRole('region',{name:'Saved batch receipt'});
    await expect(report.getByRole('heading',{name:'Discrepancies recorded.'})).toBeVisible();
    const missing=report.getByRole('row').filter({hasText:ids[1]});
    await expect(missing).toContainText('Missing · custody unchanged');
    await expect(missing).toContainText('Courier 01');
    await expect(report.getByText('unexpected_'+tag,{exact:true})).toBeVisible();
    await expect(report.getByRole('heading',{name:'Repeated scans'})).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading',{name:'A clear path from field to lab.'})).toBeVisible();
    await page.getByRole('button',{name:'Receive batch',exact:true}).click();
    await page.locator('.recent-receipts button').filter({hasText:batchId}).first().click();
    await expect(page.getByRole('region',{name:'Saved batch receipt'})).toContainText('Missing · custody unchanged');
    await page.screenshot({path:'reports/hosted-batch-receipt.png',fullPage:true});
    const received=await service.read(receiver.id,ids[0]);
    const absent=await service.read(receiver.id,ids[1]);
    expect(received.status).toBe('received');expect(received.custodianId).toBe(receiver.id);
    expect(absent.status).toBe('in_transit');expect(absent.custodianId).toBe(courier.id);
    expect((await store.get('handoffs',absent.pendingHandoffId)).status).toBe('offered');
    await page.getByRole('button',{name:'Sign out',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Welcome back.'})).toBeVisible();
  }finally{await context.close();}
});
