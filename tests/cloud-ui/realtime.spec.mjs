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
  const context=await browser.newContext({baseURL:'http://127.0.0.1:5173',viewport:{width:1440,height:1000}});
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
    await collector.page.screenshot({path:'reports/hosted-realtime-history.png',fullPage:true});
    for(const client of clients){await client.page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(client.page.getByRole('heading',{name:'Welcome back.'})).toBeVisible();await expect.poll(()=>client.sockets.length>0&&client.sockets.every(socket=>socket.isClosed())).toBe(true);}
  }finally{for(const client of clients)await cleanup(client);}
});
test('real membership revocation clears the workspace and its cache without receiving a business payload',async({browser})=>{
  const client=await login(browser,'courier');const actor=client.account.id;
  try{
    await c.db.updateRow({databaseId:c.databaseId,tableId:'memberships',rowId:actor,data:{active:false}});
    await expect(client.page.getByRole('heading',{name:'Welcome back.'})).toBeVisible({timeout:45000});
    await expect(client.page.getByRole('alert')).toContainText('workspace access changed');
    expect(await client.page.evaluate(id=>localStorage.getItem('labrelay-workspace:'+id),actor)).toBeNull();
    const feed=await c.db.getRow({databaseId:c.databaseId,tableId:'live_updates',rowId:actor});expect(feed.$permissions).toEqual([]);
    await expect.poll(()=>client.sockets.every(socket=>socket.isClosed())).toBe(true);
  }finally{await c.db.updateRow({databaseId:c.databaseId,tableId:'memberships',rowId:actor,data:{active:true}});await cleanup(client);}
});
test('real websocket permissions isolate per-user signals and direct business-row reads remain closed',async({browser})=>{
  const sessions=[],contexts=[];
  try{
    const users=[{id:'lrtest_collector',orgId:'lr_org_a',role:'collector'},{id:'lrtest_outsider',orgId:'lr_org_b',role:'courier'}];
    const probes=[];
    for(const user of users){
      const session=await c.users.createSession({userId:user.id});sessions.push({userId:user.id,sessionId:session.$id});
      const jwt=(await c.users.createJWT({userId:user.id,sessionId:session.$id,duration:900})).jwt;
      await ensureLiveFeed(c.db,c.databaseId,{...user,active:true});
      const db=new TablesDB(new Client().setEndpoint(c.endpoint).setProject(c.projectId).setJWT(jwt));
      expect((await db.getRow({databaseId:c.databaseId,tableId:'live_updates',rowId:user.id})).$id).toBe(user.id);
      const forbidden=user.id==='lrtest_collector'?'lrtest_outsider':'lrtest_collector';
      await assertDenied(db.getRow({databaseId:c.databaseId,tableId:'live_updates',rowId:forbidden}));
      await assertDenied(db.getRow({databaseId:c.databaseId,tableId:'sites',rowId:'lr_site_001'}));
      const context=await browser.newContext();contexts.push(context);const page=await context.newPage();await page.goto('http://127.0.0.1:5173/');
      const moduleUrl='/@fs/'+resolve('dist/browser/live-harness.js').replaceAll('\\','/');
      const own='tablesdb.'+c.databaseId+'.tables.live_updates.rows.'+user.id;
      const other='tablesdb.'+c.databaseId+'.tables.live_updates.rows.lrtest_collector';
      await page.evaluate(async({moduleUrl,endpoint,project,jwt,channels})=>{const module=await import(moduleUrl);window.liveProbe=await module.probe(endpoint,project,jwt,channels);},{moduleUrl,endpoint:c.endpoint,project:c.projectId,jwt,channels:[...new Set([own,other])]});
      probes.push(page);
    }
    await publishChange(c.db,c.databaseId,'lr_org_a');await expect.poll(()=>probes[0].evaluate(()=>window.liveProbe.events.length)).toBeGreaterThan(0);
    await publishChange(c.db,c.databaseId,'lr_org_b');await expect.poll(()=>probes[1].evaluate(()=>window.liveProbe.events.length)).toBeGreaterThan(0);
    await new Promise(resolve=>setTimeout(resolve,1000));
    for(let index=0;index<probes.length;index++){
      const events=await probes[index].evaluate(()=>window.liveProbe.events);
      expect(events.every(event=>event.id===users[index].id)).toBe(true);expect(events.every(event=>JSON.stringify(event.keys)===JSON.stringify(['changedAt','token']))).toBe(true);
      await probes[index].evaluate(()=>window.liveProbe.close());
    }
  }finally{for(const context of contexts)await context.close();for(const session of sessions)await c.users.deleteSession(session);}
});
async function assertDenied(promise){try{await promise;throw Error('Unexpected direct read access.');}catch(e){expect(e instanceof AppwriteException&&[401,403,404].includes(e.code)).toBe(true);}}

