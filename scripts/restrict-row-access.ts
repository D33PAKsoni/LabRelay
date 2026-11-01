import { mkdir, writeFile } from 'node:fs/promises';
import { Query } from 'node-appwrite';
import { config, marker, safeFailure } from './config.js';
import { schema } from './schema.js';
try {
  const c=config();if((await c.db.get({databaseId:c.databaseId})).description!==marker)throw Error('Refusing to migrate an unowned database.');
  const results:{table:string;checked:number;restricted:number}[]=[];
  for(const definition of schema.filter(table=>table.id!=='live_updates')) {
    const table=await c.db.getTable({databaseId:c.databaseId,tableId:definition.id});
    if(!table.rowSecurity||table.$permissions.length)throw Error('Unexpected table permissions.');
    let cursor:string|undefined,checked=0,restricted=0;
    for(;;){
      const page=await c.db.listRows({databaseId:c.databaseId,tableId:definition.id,queries:[Query.limit(100),Query.orderAsc('$id'),...(cursor?[Query.cursorAfter(cursor)]:[])]});
      for(let offset=0;offset<page.rows.length;offset+=8)await Promise.all(page.rows.slice(offset,offset+8).map(async row=>{
        checked++;if(row.$permissions.length){await c.db.updateRow({databaseId:c.databaseId,tableId:definition.id,rowId:row.$id,data:{},permissions:[]});restricted++;}
      }));
      if(page.rows.length<100)break;cursor=page.rows.at(-1)!.$id;
    }
    results.push({table:definition.id,checked,restricted});console.log('Restricted legacy grants: '+definition.id+' ('+restricted+'/'+checked+').');
  }
  await mkdir('reports',{recursive:true});await writeFile('reports/realtime-permission-migration.json',JSON.stringify({at:new Date().toISOString(),projectId:c.projectId,databaseId:c.databaseId,scope:'Removed direct browser access to business records; application data unchanged.',results},null,2)+'\n');
} catch(e){console.error(safeFailure(e));process.exitCode=1;}
