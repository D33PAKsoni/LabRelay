import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AppwriteException, Client, TablesDB } from 'node-appwrite';
import { test,expect } from '@playwright/test';
import { config } from '../../dist/scripts/config.js';
import { ensureLiveFeed,publishChange } from '../../dist/src/live.js';
process.loadEnvFile('.env');
const c=config();
const credentials=async()=>JSON.parse(await readFile('.local/demo-accounts.json','utf8')).accounts;
async function login(browser,role){
  const account=(await credentials()).find(a=>a.role===role);
  const context=await browser.newContext({baseURL:process.env.LABRELAY_SITE_URL,viewport:{width:1440,height:1000}});
  const page=await context.newPage();const sockets=[];page.on('websocket',socket=>{const url=new URL(socket.url());if(url.hostname===new URL(c.endpoint).hostname&&url.pathname.endsWith('/realtime'))sockets.push(socket);});
  await page.goto('/');const sessionResponse=page.waitForResponse(response=>response.url().includes('/account/sessions/email')&&response.request().method()==='POST');
  try{await page.getByLabel('Email address').fill(account.email);await page.getByLabel('Password',{exact:true}).fill(account.password);await page.getByRole('button',{name:'Open workspace'}).click();}
  catch{throw Error('Could not submit fictional realtime sign-in.');}
  const sessionId=(await(await sessionResponse).json()).$id;
  await expect(page.getByText('Live updates',{exact:true})).toBeVisible();
  return {page,context,sockets,account,sessionId};
}
async function cleanup(item){
  try{if(await item.page.getByRole('button',{name:'Sign out',exact:true}).isVisible())await item.page.getByRole('button',{name:'Sign out',exact:true}).click();}
  finally{try{await c.users.deleteSession({userId:item.account.id,sessionId:item.sessionId});}catch(e){if(!(e instanceof AppwriteException&&e.code===404))throw e;}await item.context.close();}
}
test('two authenticated users receive automatic workspace and history updates and sign-out closes their sockets',async({browser})=>{
  const clients=[];
  try{
    const collector=await login(browser,'collector');clients.push(collector);const courier=await login(browser,'courier');clients.push(courier);
    const id='rt_'+Date.now().toString(36),label='Fictional live water collection';
    await collector.page.getByRole('button',{name:'Register sample',exact:true}).click();const dialog=collector.page.getByRole('dialog');
    await dialog.getByLabel('Sample ID',{exact:true}).fill(id);await dialog.getByLabel('Sample label').fill(label);await dialog.getByRole('button',{name:'Register sample',exact:true}).click();
    await expect(collector.page.getByText('Sample registered. You retain confirmed custody.')).toBeVisible();
    await collector.page.getByRole('button',{name:new RegExp(label+' '+id)}).click();await expect(collector.page.locator('.timeline li')).toHaveCount(1);
    await expect(courier.page.getByRole('button',{name:'Open handoff for '+id,exact:true})).toBeVisible();
    await courier.page.getByRole('button',{name:'Open handoff for '+id,exact:true}).click();await courier.page.getByRole('button',{name:'Claim pickup',exact:true}).click();
    await expect(collector.page.locator('.timeline li')).toHaveCount(2);await expect(collector.page.locator('.timeline')).toContainText('Pickup assigned');
    await collector.page.screenshot({path:'reports/production-realtime-history.png',fullPage:true});
    for(const client of clients){await client.page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(client.page.getByRole('heading',{name:'Welcome back.'})).toBeVisible();await expect.poll(()=>client.sockets.length>0&&client.sockets.every(socket=>socket.isClosed())).toBe(true);}
  }finally{for(const client of clients)await cleanup(client);}
});

