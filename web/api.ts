import { Account, Client, ExecutionMethod, Functions, Realtime } from 'appwrite';
import type { BatchManifest, BatchReceipt, Command, CommandResult } from '../src/domain/types';
import type { History, Workspace } from '../src/product';
import type { NearbySiteQuery, NearbySites } from '../src/domain/geo';

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
}
export interface Identity { id: string; name: string }
export type LiveStatus = 'connecting' | 'live' | 'reconnecting';
export interface Transport {
  watch(workspace: Workspace, changed:()=>void, status:(value:LiveStatus)=>void):()=>void;
  stopUpdates():void;
  preview: boolean;
  me(): Promise<Identity>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  workspace(): Promise<Workspace>;
  nearbySites(query: NearbySiteQuery): Promise<NearbySites>;
  batchManifest(batchId: string): Promise<BatchManifest>;
  receipt(id: string): Promise<BatchReceipt>;
  history(id: string): Promise<History>;
  command(command: Command): Promise<CommandResult>;
  switchActor?(id: string): void;
}
export const config = {
  endpoint: import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://fra.cloud.appwrite.io/v1',
  projectId: import.meta.env.VITE_APPWRITE_PROJECT_ID || '6ae20a1500011bd3e5da',
  functionId: import.meta.env.VITE_APPWRITE_FUNCTION_ID || 'labrelay_api',
};
const fail = (status: number, value: Record<string, unknown>): never => {
  throw new ApiError(String(value.error || 'REQUEST_FAILED'), String(value.message || 'Could not complete this request. Please try again.'), status);
};
class CloudTransport implements Transport {
  preview = false;
  private client = new Client().setEndpoint(config.endpoint).setProject(config.projectId);
  private stop=()=>{};
  stopUpdates(){this.stop();this.stop=()=>{};}
  private account = new Account(this.client);
  private functions = new Functions(this.client);
  async me() { const user = await this.account.get(); return { id: user.$id, name: user.name || user.email }; }
  async signIn(email: string, password: string) { this.stopUpdates(); await this.account.createEmailPasswordSession({ email, password }); }
  async signOut() { this.stopUpdates(); await this.account.deleteSession({ sessionId: 'current' }); }
  watch(workspace:Workspace,changed:()=>void,status:(value:LiveStatus)=>void) {
    this.stopUpdates();let disposed=false;
    const feed=workspace.live;
    if(!feed||feed.rowId!==workspace.member.id||feed.tableId!=='live_updates') {status('reconnecting');return ()=>{};}
    const realtime=new Realtime(this.client);
    const report=(value:LiveStatus)=>{if(!disposed)status(value);};
    realtime.onError(()=>report('reconnecting'));realtime.onClose(()=>report('reconnecting'));
    realtime.onOpen(()=>{if(!disposed){report('live');changed();}});
    report('connecting');
    void realtime.subscribe('tablesdb.'+feed.databaseId+'.tables.live_updates.rows.'+feed.rowId,()=>{if(!disposed)changed();})
      .then(subscription=>{if(disposed){void subscription.unsubscribe();void realtime.disconnect();return;}report('live');changed();})
      .catch(()=>report('reconnecting'));
    const stop=()=>{if(disposed)return;disposed=true;void realtime.disconnect();};this.stop=stop;return stop;
  }
  private async request<T>(path: string, body?: unknown): Promise<T> {
    const execution = await this.functions.createExecution({ functionId: config.functionId, async: false,
      xpath: path, method: body !== undefined ? ExecutionMethod.POST : ExecutionMethod.GET,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    let value: Record<string, unknown>;
    try { value = JSON.parse(execution.responseBody); }
    catch { throw new ApiError('INVALID_RESPONSE', 'The server result could not be confirmed. Retry the original request.', 503); }
    if (execution.responseStatusCode < 200 || execution.responseStatusCode >= 300) fail(execution.responseStatusCode, value);
    return value as T;
  }
  workspace() { return this.request<Workspace>('/workspace'); }
  nearbySites(query: NearbySiteQuery) { return this.request<NearbySites>('/sites/nearby', query); }
  batchManifest(batchId: string) { return this.request<BatchManifest>('/batches/' + encodeURIComponent(batchId) + '/manifest'); }
  receipt(id: string) { return this.request<BatchReceipt>('/receipts/' + encodeURIComponent(id)); }
  history(id: string) { return this.request<History>('/samples/' + encodeURIComponent(id) + '/history'); }
  command(command: Command) { return this.request<CommandResult>('/commands', command); }
}
const previewPeople: Record<string, string> = { collector: 'Field collector', courier_0: 'Courier 01', receiver: 'Laboratory receiver' };
class PreviewTransport implements Transport {
  preview = true;
  private stop=()=>{};
  stopUpdates(){this.stop();this.stop=()=>{};}
  watch(_workspace:Workspace,changed:()=>void,status:(value:LiveStatus)=>void) {
    this.stopUpdates();let disposed=false;status('connecting');
    const stream=new EventSource('/__preview/updates?actor='+encodeURIComponent(this.actor));
    stream.onopen=()=>{if(!disposed){status('live');changed();}};
    stream.onmessage=()=>{if(!disposed)changed();};
    stream.onerror=()=>{if(!disposed)status('reconnecting');};
    const stop=()=>{disposed=true;stream.close();};this.stop=stop;return stop;
  }
  private actor = localStorage.getItem('labrelay-preview-actor') || 'collector';
  switchActor(id: string) {
    this.stopUpdates();
    if (!previewPeople[id]) throw new Error('Unknown preview identity.');
    this.actor = id; localStorage.setItem('labrelay-preview-actor', id);
  }
  async me() { return { id: this.actor, name: previewPeople[this.actor] || this.actor }; }
  async signIn() {}
  async signOut() {}
  private async request<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch('/__preview' + path, { method: body !== undefined ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', 'x-preview-actor': this.actor },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    const value = await response.json();
    if (!response.ok) fail(response.status, value);
    return value;
  }
  workspace() { return this.request<Workspace>('/workspace'); }
  nearbySites(query: NearbySiteQuery) { return this.request<NearbySites>('/sites/nearby', query); }
  batchManifest(batchId: string) { return this.request<BatchManifest>('/batches/' + encodeURIComponent(batchId) + '/manifest'); }
  receipt(id: string) { return this.request<BatchReceipt>('/receipts/' + encodeURIComponent(id)); }
  history(id: string) { return this.request<History>('/samples/' + encodeURIComponent(id) + '/history'); }
  command(command: Command) { return this.request<CommandResult>('/commands', command); }
}
export const api: Transport = import.meta.env.DEV && new URLSearchParams(location.search).get('preview') === '1'
  ? new PreviewTransport() : new CloudTransport();
