import { test, expect } from '@playwright/test';
async function open(page) {
  await page.goto('/?preview=1');
  await expect(page.getByRole('heading',{name:'A clear path from field to lab.'})).toBeVisible();
  await page.getByLabel('Reference collection site',{exact:true}).selectOption('north_bank');
}
const sample = (page,id) => page.getByRole('button',{name:'Open handoff for '+id,exact:true});
async function find(page,radius='0.5') {
  await page.getByLabel('Search radius',{exact:true}).selectOption(radius);
  await page.getByRole('button',{name:'Find nearby sites',exact:true}).click();
  await expect(page.getByRole('columnheader',{name:'Site distance'})).toBeVisible();
}
test('nearby sites filter and sort dispatch while composing with status and text filters',async({page})=>{
  await open(page); await find(page);
  await expect(page.getByLabel('Nearby sites by distance')).toContainText('0 m');
  await expect(sample(page,'WTR_0041')).toBeVisible();
  await expect(sample(page,'WTR_0042')).toHaveCount(0); await expect(sample(page,'WTR_0046')).toHaveCount(0);
  await page.getByLabel('Search radius',{exact:true}).selectOption('1');
  await expect(page.getByRole('columnheader',{name:'Site distance'})).toHaveCount(0);
  await page.getByRole('button',{name:'Find nearby sites',exact:true}).click();
  await expect(page.getByLabel('Nearby sites by distance').locator('li')).toHaveCount(2);
  await expect(sample(page,'WTR_0042')).toBeVisible(); await expect(sample(page,'WTR_0046')).toHaveCount(0);
  const distances = await page.locator('.collection-distance').allTextContents();
  const meters = distances.map(text=>parseFloat(text)*(text.endsWith('km')?1000:1));
  expect(meters).toEqual([...meters].sort((a,b)=>a-b));
  await page.getByLabel('Filter sample status').selectOption('ready');
  await expect(sample(page,'WTR_0043')).toHaveCount(0);
  await page.getByLabel('Search samples').fill('WTR_0041');
  await expect(page.locator('.sample-panel tbody tr')).toHaveCount(1);
  await page.getByLabel('Search samples').fill(''); await page.getByLabel('Filter sample status').selectOption('all');
  await page.screenshot({path:'reports/nearby-dispatch.png',fullPage:true});
  await page.getByRole('button',{name:'Clear distance filter'}).click();
  await expect(sample(page,'WTR_0046')).toBeVisible();
});
test('failed nearby query shows an actionable error and leaves unfiltered dispatch usable',async({page})=>{
  await open(page);
  await page.route('**/__preview/sites/nearby',route=>route.fulfill({status:422,contentType:'application/json',body:JSON.stringify({error:'NEARBY_RESULT_LIMIT',message:'More than 200 sites match. Choose a smaller radius.'})}));
  await page.getByRole('button',{name:'Find nearby sites',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Choose a smaller radius.');
  await expect(sample(page,'WTR_0046')).toBeVisible();
  await expect(page.getByRole('columnheader',{name:'Site distance'})).toHaveCount(0);
});
test('late nearby response cannot reapply a changed reference or leak into another actor',async({page})=>{
  await open(page);
  let release; const gate = new Promise(resolve=>{release=resolve;});
  let arrived; const pending = new Promise(resolve=>{arrived=resolve;});
  await page.route('**/__preview/sites/nearby',async route=>{const response=await route.fetch();arrived();await gate;await route.fulfill({response});});
  await page.getByRole('button',{name:'Find nearby sites',exact:true}).click(); await pending;
  await page.getByLabel('Reference collection site',{exact:true}).selectOption('upland_point');
  release(); await expect(page.getByRole('button',{name:'Find nearby sites',exact:true})).toBeEnabled();
  await expect(page.getByRole('columnheader',{name:'Site distance'})).toHaveCount(0);
  await page.unroute('**/__preview/sites/nearby');
  await find(page,'1'); await expect(sample(page,'WTR_0046')).toBeVisible();
  await expect(sample(page,'WTR_0041')).toHaveCount(0);
  await page.getByLabel('Preview role').selectOption('courier_0');
  await expect(sample(page,'WTR_0041')).toBeVisible();
  await expect(page.getByRole('columnheader',{name:'Site distance'})).toHaveCount(0);
});
test('mobile distance filter fits the page and clears when the connection is lost',async({page,context})=>{
  await page.setViewportSize({width:390,height:844}); await open(page);await find(page,'1');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({path:'reports/nearby-dispatch-mobile.png',fullPage:true});
  await context.setOffline(true);
  await expect(page.getByText('Nearby search requires a connection. Showing all loaded samples.')).toBeVisible();
  await expect(page.getByRole('button',{name:'Find nearby sites',exact:true})).toBeDisabled();
  await expect(sample(page,'WTR_0046')).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByRole('button',{name:'Find nearby sites',exact:true})).toBeEnabled();
  await expect(page.getByRole('columnheader',{name:'Site distance'})).toHaveCount(0);
});
