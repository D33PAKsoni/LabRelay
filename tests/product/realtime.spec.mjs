import {test,expect} from '@playwright/test';
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,5);
async function open(page){await page.goto('/?preview=1');await expect(page.getByText('Live updates',{exact:true})).toBeVisible();}
async function register(request,id){const result=await request.post('/__preview/commands',{headers:{'x-preview-actor':'collector'},data:{kind:'register_sample',operationId:'reg_'+id,sampleId:id,expectedVersion:0,label:'Live collection '+id,batchId:'live_'+id,siteId:'north_bank'}});expect(result.status()).toBe(200);}
test('another client registration and observation automatically refresh workspace and selected history',async({page,request})=>{
  await open(page);const id='live_'+uid();await register(request,id);
  await expect(page.getByRole('button',{name:'Open handoff for '+id,exact:true})).toBeVisible();
  await page.getByRole('button',{name:new RegExp('Live collection '+id)}).click();
  await expect(page.locator('.timeline li')).toHaveCount(1);
  const result=await request.post('/__preview/commands',{headers:{'x-preview-actor':'collector'},data:{kind:'observe',operationId:'obs_'+id,sampleId:id,expectedVersion:0,note:'Seal checked by another client.',capturedAt:new Date().toISOString()}});expect(result.status()).toBe(200);
  await expect(page.locator('.timeline li')).toHaveCount(2);
  await expect(page.getByText('Seal checked by another client.',{exact:true})).toBeVisible();
  await page.screenshot({path:'reports/realtime-history.png',fullPage:true});
});
test('lost connection pauses live updates and reconnect reloads a change missed offline',async({page,context,request})=>{
  await open(page);await context.setOffline(true);await expect(page.getByText('Updates paused',{exact:true})).toBeVisible();
  const id='offline_live_'+uid();await register(request,id);
  await expect(page.getByRole('button',{name:'Open handoff for '+id,exact:true})).toHaveCount(0);
  await context.setOffline(false);await expect(page.getByText('Live updates',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Open handoff for '+id,exact:true})).toBeVisible();
});
test('an authorization rejection clears cached workspace and history and stops live refresh',async({page,request})=>{
  await open(page);const id='deny_live_'+uid();await register(request,id);
  await page.getByRole('button',{name:new RegExp('Live collection '+id)}).click();await expect(page.locator('.timeline li')).toHaveCount(1);
  await expect.poll(()=>page.evaluate(id=>localStorage.getItem('labrelay-history:collector:'+id),id)).not.toBeNull();
  await page.route('**/__preview/workspace',route=>route.fulfill({status:403,contentType:'application/json',body:JSON.stringify({error:'FORBIDDEN',message:'Access changed.'})}));
  await register(request,'trigger_'+uid());
  await expect(page.getByRole('heading',{name:'Welcome back.'})).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('workspace access changed');
  expect(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k==='labrelay-workspace:collector'||k.startsWith('labrelay-history:collector:')))).toEqual([]);
  await expect(page.getByLabel('Update status')).toHaveCount(0);
});
test('a late refresh from the previous identity cannot replace the new workspace',async({page,request})=>{
  await open(page);let release;const gate=new Promise(resolve=>{release=resolve;});let arrived;const pending=new Promise(resolve=>{arrived=resolve;});
  await page.route('**/__preview/workspace',async route=>{
    if(route.request().headers()['x-preview-actor']!=='collector'){await route.continue();return;}
    const response=await route.fetch();const body=await response.json();body.samples=[];arrived();await gate;await route.fulfill({response,json:body});
  });
  const id='switch_live_'+uid();await register(request,id);await pending;
  await page.getByLabel('Preview role').selectOption('courier_0');
  await expect(page.getByLabel('Preview role')).toHaveValue('courier_0');
  release();await expect(page.getByRole('button',{name:'Open handoff for '+id,exact:true})).toBeVisible();
  await expect(page.getByText('Live updates',{exact:true})).toBeVisible();
});
test('a changed organization clears the previous distance filter and cached history',async({page,request})=>{
  await page.addInitScript(()=>{localStorage.setItem('labrelay-workspace:collector',JSON.stringify({member:{orgId:'previous_org'}}));localStorage.setItem('labrelay-history:collector:old_sample','{}');});
  await open(page);expect(await page.evaluate(()=>localStorage.getItem('labrelay-history:collector:old_sample'))).toBeNull();await page.getByLabel('Reference collection site',{exact:true}).selectOption('north_bank');
  await page.getByRole('button',{name:'Find nearby sites',exact:true}).click();await expect(page.getByRole('columnheader',{name:'Site distance'})).toBeVisible();
  await page.route('**/__preview/workspace',async route=>{const response=await route.fetch();const body=await response.json();body.member.orgId='new_org';body.members=[body.member];body.samples=[];body.sites=[];body.handoffs=[];body.receipts=[];await route.fulfill({response,json:body});});
  await register(request,'move_org_'+uid());
  await expect(page.getByRole('heading',{name:'The next collection starts here'})).toBeVisible();
  await expect(page.getByRole('columnheader',{name:'Site distance'})).toHaveCount(0);
  await expect(page.getByLabel('Nearby sites by distance')).toHaveCount(0);
});

