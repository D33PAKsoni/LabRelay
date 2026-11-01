import { test, expect } from '@playwright/test';
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
async function fixture(request) {
  const batchId='receipt_'+uid(), ids=['a_'+uid(),'b_'+uid()];
  async function call(actor,body) {
    const response=await request.post('/__preview/commands',{headers:{'x-preview-actor':actor},data:{operationId:uid(),...body}});
    expect(response.status(),await response.text()).toBe(200);return response.json();
  }
  for(const sampleId of ids){
    await call('collector',{kind:'register_sample',sampleId,expectedVersion:0,label:'Fictional batch '+sampleId,batchId,siteId:'north_bank'});
    await call('courier_0',{kind:'claim',sampleId,expectedVersion:0});
    const offer=await call('collector',{kind:'offer_handoff',sampleId,expectedVersion:1,toUserId:'courier_0'});
    await call('courier_0',{kind:'accept_handoff',sampleId,expectedVersion:2,handoffId:offer.pendingHandoffId});
    await call('courier_0',{kind:'offer_handoff',sampleId,expectedVersion:3,toUserId:'receiver'});
  }
  return {batchId,ids,call};
}
async function openReceipt(page,batchId) {
  await page.goto('/?preview=1');
  await page.getByLabel('Preview role').selectOption('receiver');
  await expect(page.getByRole('heading',{name:'A clear path from field to lab.'})).toBeVisible();
  await page.getByRole('button',{name:'Receive batch',exact:true}).click();
  await page.getByLabel('Batch offered to you').selectOption(batchId);
  await page.getByRole('button',{name:'Load manifest',exact:true}).click();
  await expect(page.getByRole('table',{name:'Expected receipt manifest'})).toBeVisible();
}
test('partial receipt persists discrepancy details and missing custody across refresh',async({page,request})=>{
  const {batchId,ids}=await fixture(request);
  await openReceipt(page,batchId);
  await page.getByLabel('Scanned sample IDs').fill(ids[0]+'\n'+ids[0]+'\nunknown_scan');
  await page.getByRole('button',{name:'Accept 1 & record receipt',exact:true}).click();
  const report=page.getByRole('region',{name:'Saved batch receipt'});
  await expect(report.getByRole('heading',{name:'Discrepancies recorded.'})).toBeVisible();
  await expect(report.getByRole('row').filter({hasText:ids[1]})).toContainText('Courier 01');
  await expect(report.getByRole('row').filter({hasText:ids[1]})).toContainText('Missing · custody unchanged');
  await expect(report.getByText('unknown_scan',{exact:true})).toBeVisible();
  await expect(report.getByRole('heading',{name:'Repeated scans'})).toBeVisible();
  await page.screenshot({path:'reports/batch-receipt.png',fullPage:true});
  await page.reload();
  await page.getByRole('button',{name:'Receive batch',exact:true}).click();
  await page.locator('.recent-receipts button').filter({hasText:batchId}).first().click();
  await expect(page.getByRole('region',{name:'Saved batch receipt'})).toContainText('Missing · custody unchanged');
  const workspace=await (await request.get('/__preview/workspace',{headers:{'x-preview-actor':'receiver'}})).json();
  expect(workspace.samples.find(sample=>sample.id===ids[1]).custodianId).toBe('courier_0');
  expect(workspace.samples.find(sample=>sample.id===ids[1]).status).toBe('in_transit');
  expect(workspace.samples.find(sample=>sample.id===ids[0]).custodianId).toBe('receiver');
});
test('a lost receipt acknowledgment retries the original request without duplicate records',async({page,request})=>{
  const {batchId,ids}=await fixture(request);
  await openReceipt(page,batchId);
  let lost=false;
  await page.route('**/__preview/commands',async route=>{
    if(!lost&&route.request().postDataJSON()?.kind==='reconcile_batch'){
      lost=true;await route.fetch();await route.abort('failed');
    }else await route.continue();
  });
  await page.getByLabel('Scanned sample IDs').fill(ids[0]);
  await page.getByRole('button',{name:'Accept 1 & record receipt',exact:true}).click();
  await expect(page.getByRole('region',{name:'Pending actions'})).toContainText('Pending sync');
  await page.getByRole('button',{name:'Retry original requests'}).click();
  await expect(page.getByRole('region',{name:'Pending actions'})).toHaveCount(0);
  await expect(page.getByRole('region',{name:'Saved batch receipt'})).toContainText('Discrepancies recorded.');
  const workspace=await (await request.get('/__preview/workspace',{headers:{'x-preview-actor':'receiver'}})).json();
  expect(workspace.receipts.filter(receipt=>receipt.batchId===batchId)).toHaveLength(1);
});
test('stale receipt review leaves all custody unchanged and reports no accepted receipt',async({page,request})=>{
  const {batchId,ids,call}=await fixture(request);
  await openReceipt(page,batchId);
  await call('courier_0',{kind:'observe',sampleId:ids[1],expectedVersion:4,note:'Rechecked before receipt',capturedAt:new Date().toISOString()});
  await page.getByLabel('Scanned sample IDs').fill(ids.join('\n'));
  await page.getByRole('button',{name:'Accept 2 & record receipt',exact:true}).click();
  await expect(page.getByRole('region',{name:'Pending actions'})).toContainText('Needs review');
  const workspace=await (await request.get('/__preview/workspace',{headers:{'x-preview-actor':'receiver'}})).json();
  expect(workspace.receipts.filter(receipt=>receipt.batchId===batchId)).toHaveLength(0);
  expect(workspace.samples.filter(sample=>ids.includes(sample.id)).every(sample=>sample.custodianId==='courier_0')).toBe(true);
});
test('matching receipts close only their offered manifest',async({page,request})=>{
  const {batchId,ids}=await fixture(request);
  await openReceipt(page,batchId);
  await page.getByLabel('Scanned sample IDs').fill(ids.join('\n'));
  await page.getByRole('button',{name:'Accept 2 & record receipt',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Manifest matched.'})).toBeVisible();
  const report=page.getByRole('region',{name:'Saved batch receipt'});
  await expect(report.getByRole('row').filter({hasText:ids[0]})).toContainText('Accepted at lab');
  await expect(report.getByRole('row').filter({hasText:ids[1]})).toContainText('Accepted at lab');
  const response=await request.get('/__preview/batches/'+batchId+'/manifest',{headers:{'x-preview-actor':'receiver'}});
  expect(response.status()).toBe(404);
});
test('mobile receipt review fits the viewport and cannot submit offline or accidentally empty',async({page,context,request})=>{
  const {batchId,ids}=await fixture(request);
  await page.setViewportSize({width:390,height:844});
  await openReceipt(page,batchId);
  await expect(page.getByRole('button',{name:'Record missing samples',exact:true})).toBeDisabled();
  await page.getByLabel('Scanned sample IDs').fill(ids[0]+'\n'+ids[0]+'\nunexpected_id');
  await expect(page.getByRole('button',{name:'Accept 1 & record receipt',exact:true})).toBeEnabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'reports/batch-receipt-mobile.png',fullPage:true});
  await context.setOffline(true);
  await expect(page.getByRole('button',{name:'Accept 1 & record receipt',exact:true})).toBeDisabled();
  await context.setOffline(false);
});
