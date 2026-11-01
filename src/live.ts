import { randomUUID } from 'node:crypto';
import { AppwriteException, Permission, Query, Role, type TablesDB } from 'node-appwrite';
import type { Membership } from './domain/types.js';
export interface LiveFeed { databaseId: string; tableId: 'live_updates'; rowId: string }
export async function ensureLiveFeed(db: TablesDB, databaseId: string, member: Membership): Promise<LiveFeed> {
  const args={databaseId,tableId:'live_updates',rowId:member.id};
  try { const row=await db.getRow(args);
    if (row.$permissions.length!==1 || row.$permissions[0]!==Permission.read(Role.user(member.id)))
      await db.updateRow({...args,data:{},permissions:[Permission.read(Role.user(member.id))]});
  } catch(e) { if(!(e instanceof AppwriteException && e.code===404))throw e;
    try { await db.createRow({...args,data:{token:randomUUID(),changedAt:new Date().toISOString()},permissions:[Permission.read(Role.user(member.id))]}); }
    catch(error) { if(!(error instanceof AppwriteException && error.code===409))throw error; }
  }
  return {databaseId,tableId:'live_updates',rowId:member.id};
}
export async function revokeLiveFeed(db:TablesDB,databaseId:string,actorId:string) {
  try {await db.updateRow({databaseId,tableId:'live_updates',rowId:actorId,data:{},permissions:[]});}
  catch(e) {if(!(e instanceof AppwriteException && e.code===404))throw e;}
}
// Signals contain no sample, event, organization, membership or receipt data.
export async function publishChange(db:TablesDB,databaseId:string,orgId:string) {
  const members=await db.listRows({databaseId,tableId:'memberships',queries:[Query.equal('orgId',orgId),Query.equal('active',true),Query.limit(100)]});
  if(members.total>100)throw new Error('Live notification fanout exceeds pilot scope.');
  const data={token:randomUUID(),changedAt:new Date().toISOString()};
  for(let offset=0;offset<members.rows.length;offset+=8) {
    const outcomes=await Promise.allSettled(members.rows.slice(offset,offset+8).map(async member=>{
      const args={databaseId,tableId:'live_updates',rowId:member.$id};
      try {await db.updateRow({...args,data,permissions:[Permission.read(Role.user(member.$id))]});}
      catch(e) {if(!(e instanceof AppwriteException && e.code===404))throw e;
        try{await db.createRow({...args,data,permissions:[Permission.read(Role.user(member.$id))]});}
        catch(error){if(!(error instanceof AppwriteException && error.code===409))throw error;await db.updateRow({...args,data,permissions:[Permission.read(Role.user(member.$id))]});}
      }
    }));
    if(outcomes.some(result=>result.status==='rejected'))throw new Error('Some live notifications were not delivered.');
  }
}
