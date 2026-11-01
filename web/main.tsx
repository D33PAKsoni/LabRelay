import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Check, CheckCircle2, ChevronRight, Circle, ClipboardList,
  Clock3, FlaskConical, History as HistoryIcon, Layers3, Leaf, LogOut, MapPin, Menu, Plus, RefreshCw,
  Search, ShieldCheck, Truck, Wifi, WifiOff, X, AlertCircle, ArrowLeft, Send, PackageCheck } from 'lucide-react';
import { api, ApiError, type LiveStatus } from './api';
import { refreshLoop } from '../src/realtime/refresh';
import type { Identity } from './api';
import type { History, Workspace } from '../src/product';
import type { Command, Sample } from '../src/domain/types';
import { Outbox, QueueDatabase } from '../src/offline/outbox';
import type { OutboxItem } from '../src/offline/outbox';
import './style.css';
import './receipts.css';
import { BatchReceiving } from './batch-receiving';
import { NearbyCollections, formatDistance } from './nearby-collections';
import type { NearbySites } from '../src/domain/geo';

const queue = new Outbox(new QueueDatabase('labrelay-product-outbox-v1'));
const uid = () => crypto.randomUUID().replaceAll('-', '');
const statusLabel = { ready: 'Ready for pickup', assigned: 'Pickup assigned', in_transit: 'In transit', received: 'Received at lab' };
const roleLabel = { collector: 'Field collector', courier: 'Courier', receiver: 'Lab receiver' };
const eventLabel: Record<string, string> = { register_sample: 'Sample registered', claim: 'Pickup assigned',
  offer_handoff: 'Handoff offered', accept_handoff: 'Custody accepted', observe: 'Handling observation', reconcile_batch: 'Batch receipt', receipt_missing: 'Missing at batch receipt', receipt_accepted: 'Accepted in batch receipt' };
const prettyPerson = (id: string) => {
  if (/collector$/.test(id)) return 'Field collector';
  if (/receiver$/.test(id)) return 'Lab receiver';
  const match = id.match(/courier_(\d+)$/);
  return match ? 'Courier ' + String(Number(match[1]) + 1).padStart(2, '0') : id;
};
const time = (value: string) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const cacheKey = (id: string) => 'labrelay-workspace:' + id;
const historyKey = (id: string, sample: string) => 'labrelay-history:' + id + ':' + sample;
function cached<T>(key: string): T | null { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } }
function remember(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota: server data remains authoritative */ } }
function Badge({ sample }: { sample: Sample }) {
  return <span className={'badge ' + (sample.pendingHandoffId ? 'pending' : sample.status)}><span/>{sample.pendingHandoffId ? 'Awaiting acceptance' : statusLabel[sample.status]}</span>;
}
function App() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [screen, setScreen] = useState<'dispatch' | 'handoff' | 'history'>('dispatch');
  const [selected, setSelected] = useState('');
  const [batchMode, setBatchMode] = useState(false);
  const [history, setHistory] = useState<History | null>(null);
  const [historyError, setHistoryError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [nearby, setNearby] = useState<NearbySites | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [cachedView, setCachedView] = useState(false);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [register, setRegister] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [liveStatus,setLiveStatus]=useState<LiveStatus>('connecting');
  const [liveEpoch,setLiveEpoch]=useState(0);
  const [historyEpoch,setHistoryEpoch]=useState(0);
  const [authNotice,setAuthNotice]=useState('');
  const workspaceRequest=useRef(0);
  const workspaceOrg=useRef<string|null>(null);
  const identityRef = useRef<Identity | null>(null);
  const historyRequest = useRef(0);
  const selectedSample = workspace?.samples.find(sample => sample.id === selected);
  const pending = items.filter(item => item.state === 'pending' || item.state === 'needs_review');
  const pendingForSample = pending.some(item => item.command.sampleId === selected);
  const name = (id: string) => id === identity?.id ? 'You · ' + prettyPerson(id) : prettyPerson(id);

  async function reload(person = identityRef.current) {
    if (!person) return;
    const request=++workspaceRequest.current;
    setError('');
    try {
      const data = await api.workspace();
      if (identityRef.current?.id !== person.id || request!==workspaceRequest.current) return;
      if(data.member.id!==person.id)throw new ApiError('UNAUTHENTICATED','Sign in again.',401);
      const previousOrg=workspaceOrg.current??cached<Workspace>(cacheKey(person.id))?.member?.orgId;
      if(previousOrg&&previousOrg!==data.member.orgId){
        setNearby(null);setSelected('');setHistory(null);++historyRequest.current;
        for(const key of Object.keys(localStorage))if(key.startsWith('labrelay-history:'+person.id+':'))localStorage.removeItem(key);
      }
      workspaceOrg.current=data.member.orgId;setHistoryEpoch(value=>value+1);setAuthNotice('');
      setWorkspace(data); setCachedView(false); remember(cacheKey(person.id), data);
      remember('labrelay-last-identity', person);
    } catch (e) {
      if (identityRef.current?.id !== person.id) return;
      if(e instanceof ApiError && [401,403].includes(e.status)){
        api.stopUpdates();++workspaceRequest.current;++historyRequest.current;identityRef.current=null;
        setWorkspace(null);setHistory(null);setNearby(null);setItems([]);setSelected('');
        for(const key of Object.keys(localStorage))if(key===cacheKey(person.id)||key.startsWith('labrelay-history:'+person.id+':'))localStorage.removeItem(key);
        localStorage.removeItem('labrelay-last-identity');
        try{await api.signOut();}catch{/* Expired sessions may already be closed. */}
        setIdentity(null);setAuthNotice('Your session or workspace access changed. Sign in again.');return;
      }
      if (!navigator.onLine) {
        const saved = cached<Workspace>(cacheKey(person.id));
        if (saved) { setWorkspace(saved); setCachedView(true); }
        else setError('This workspace is not available offline yet. Connect and refresh once.');
      } else setError(e instanceof Error ? e.message : 'Could not load the workspace.');
    }
    const queued=await queue.list(person.id);if(identityRef.current?.id===person.id)setItems(queued);
  }
  async function sync(person = identityRef.current) {
    if (!person || !navigator.onLine || identityRef.current?.id!==person.id) return;
    setSyncing(true);
    try {
    await queue.sync(person.id, async command => {
      try { return { ok: true, result: await api.command(command) }; }
      catch (e) { return { ok: false, ...(e instanceof ApiError ? { code: e.code, status: e.status } : {}) }; }
    });
    if (identityRef.current?.id !== person.id) return;
    const rows = await queue.list(person.id); setItems(rows);
    await reload(person);
    } finally { setSyncing(false); }
  }
  async function start() {
    api.stopUpdates();++workspaceRequest.current;++historyRequest.current;identityRef.current=null;workspaceOrg.current=null;setSelected('');setHistory(null);
    setLoading(true); setWorkspace(null); setError(''); setNearby(null);
    let person: Identity;
    try { person = await api.me(); }
    catch {
      const last = cached<Identity>('labrelay-last-identity');
      if (!navigator.onLine && last && cached<Workspace>(cacheKey(last.id))) {
        person = last;
      } else { setIdentity(null); identityRef.current = null; setLoading(false); return; }
    }
    setIdentity(person); identityRef.current = person;
    await reload(person);
    if (navigator.onLine) await sync(person);
    setLoading(false);
  }
  useEffect(() => {
    void start();
    const on = () => { setOnline(true); void sync(); };
    const off = () => { setOnline(false); setCachedView(true); };
    addEventListener('online', on); addEventListener('offline', off);
    return () => { removeEventListener('online', on); removeEventListener('offline', off); };
  }, []);
  useEffect(()=>{
    if(!identity||!workspace?.live||!online)return;
    const person=identity;let disposed=false;
    const loop=refreshLoop(async()=>{if(!disposed&&identityRef.current?.id===person.id)await reload(person);});
    const stop=api.watch(workspace,()=>loop.notify(),status=>{if(!disposed)setLiveStatus(status);});
    const focus=()=>loop.notify();addEventListener('focus',focus);
    return ()=>{disposed=true;loop.dispose();stop();removeEventListener('focus',focus);};
  },[identity?.id,workspace?.live?.rowId,workspace?.member.orgId,online,liveEpoch]);
  useEffect(() => {
    const request = ++historyRequest.current;
    if (!identity || !selected || !workspace) { setHistory(null); return; }
    setHistory(null); setHistoryError('');
    if (!online) { setHistory(cached<History>(historyKey(identity.id, selected))); return; }
    api.history(selected).then(value => {
      if (request !== historyRequest.current || identityRef.current?.id!==identity.id) return;
      setHistory(value); remember(historyKey(identity.id, selected), value);
    }).catch(e => { if (request === historyRequest.current) setHistoryError(e instanceof Error ? e.message : 'History unavailable.'); });
  }, [selected, identity?.id, online, selectedSample?.version, screen, historyEpoch]);

  async function send(command: Command) {
    const person = identityRef.current;
    if (!person || busy || syncing) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await queue.enqueue(person.id, command);
      if (command.kind === 'register_sample') setRegister(false);
      if (navigator.onLine) await sync(person);
      if(identityRef.current?.id!==person.id)return;const rows = await queue.list(person.id);if(identityRef.current?.id!==person.id)return;setItems(rows);
      const outcome = rows.find(row => row.command.operationId === command.operationId);
      if (outcome?.state === 'synced') {
        setMessage(command.kind === 'register_sample' ? 'Sample registered. You retain confirmed custody.' : command.kind === 'reconcile_batch' ? 'Batch receipt saved and confirmed by the server.' : 'Saved and confirmed by the server.');
        if (command.kind === 'register_sample') { setSelected(command.sampleId); setRegister(false); }
      } else if (outcome?.state === 'needs_review') {
        setError('This action needs review. Refresh the sample history; confirmed custody has not been overwritten.');
      } else setMessage('Saved on this device · pending sync. The server has not confirmed this action.');
      return outcome;
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); }
    finally { setBusy(false); }
  }
  const act = (kind: 'claim' | 'offer_handoff' | 'accept_handoff', extra: object = {}) => {
    if (!selectedSample) return;
    void send({ kind, sampleId: selectedSample.id, operationId: uid(), expectedVersion: selectedSample.version, ...extra } as Command);
  };
  function open(sample: Sample, next: 'handoff' | 'history') { setBatchMode(false); setSelected(sample.id); setScreen(next); setMessage(''); setError(''); }
  async function signOut() {
    try { await api.signOut(); identityRef.current = null; setIdentity(null); setWorkspace(null); setItems([]); setHistory(null);
      localStorage.removeItem('labrelay-last-identity'); }
    catch { setLiveEpoch(value=>value+1);setError('Could not sign out. Reconnect and try again.'); }
  }
  if (loading) return <main className="loading"><FlaskConical size={32}/><p>Opening your field workspace…</p></main>;
  if (!identity) return <>{authNotice&&<div className="notice warning" role="alert">{authNotice}</div>}<Login onSuccess={start}/></>;
  const samples = workspace?.samples || [];
  const distanceBySite = new Map((nearby?.sites || []).map(item => [item.site.id, item.distanceMeters]));
  const filtered = samples.filter(sample => (!nearby || distanceBySite.has(sample.siteId)) && (filter === 'all' || sample.status === filter) &&
    [sample.id, sample.label, sample.batchId, workspace?.sites.find(site => site.id === sample.siteId)?.name || ''].join(' ').toLowerCase().includes(query.toLowerCase()));
  if (nearby) filtered.sort((a,b) => distanceBySite.get(a.siteId)! - distanceBySite.get(b.siteId)! || a.id.localeCompare(b.id));
  const currentHandoff = workspace?.handoffs.find(handoff => handoff.id === selectedSample?.pendingHandoffId);
  const receivers = workspace?.members.filter(member => member.role === 'receiver') || [];
  const canOffer = selectedSample && selectedSample.custodianId === identity.id && !selectedSample.pendingHandoffId &&
    ((workspace?.member.role === 'collector' && selectedSample.status === 'assigned') ||
     (workspace?.member.role === 'courier' && selectedSample.status === 'in_transit'));
  const activeView = screen === 'dispatch' ? 'Dispatch' : screen === 'handoff' ? batchMode ? 'Batch receipt' : 'Handoff' : 'Sample history';
  return <div className="app-shell">
    <aside className={'sidebar ' + (mobileNav ? 'is-open' : '')}>
      <a className="brand" href={api.preview ? '/?preview=1' : '/'}><div className="brand-mark"><FlaskConical size={23}/></div><span>LabRelay<span className="brand-dot">.</span><small>FIELD → LAB</small></span></a>
      <div className="workspace-label"><span className="workspace-icon"><Leaf size={17}/></span><span>Water testing<small>Sample operations</small></span><span className="workspace-chevron">⌄</span></div>
      <div className="nav-label">WORKSPACE</div>
      <nav aria-label="Main navigation">{([
        ['dispatch', Layers3, 'Dispatch'], ['handoff', ArrowDownLeft, 'Handoff'], ['history', HistoryIcon, 'Sample history'],
      ] as const).map(([key, Icon, label]) => <button key={key} className={screen === key ? 'active' : ''} onClick={() => { setScreen(key); setMobileNav(false); }}>
        <Icon size={19}/>{label}{key === 'handoff' && <span className="nav-count">{samples.filter(s => s.pendingHandoffId).length}</span>}
      </button>)}</nav>
      <div className="sidebar-note"><ShieldCheck size={22}/><strong>Every handoff accounted for.</strong><p>Custody changes only when the intended receiver accepts.</p></div>
      <div className="profile"><div className="avatar">{workspace?.member.role === 'collector' ? 'FC' : workspace?.member.role === 'courier' ? 'C1' : 'LR'}</div><div><strong>{identity.name}</strong><small>{workspace ? roleLabel[workspace.member.role] : 'Membership required'}</small></div>
        {!api.preview && <button className="icon-button" aria-label="Sign out" disabled={busy || syncing} onClick={() => void signOut()}><LogOut size={17}/></button>}</div>
    </aside>
    <div className="page-column">
      <header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(!mobileNav)}><Menu size={20}/></button><span>Workspace</span><ChevronRight size={14}/><strong>{activeView}</strong></div>
        <div className="topbar-right">{api.preview && <label className="preview-picker">Local preview<select aria-label="Preview role" disabled={busy || syncing} value={identity.id} onChange={async event => {
          api.switchActor?.(event.target.value); setSelected(''); setHistory(null); setBatchMode(false); setScreen('dispatch'); setQuery(''); setFilter('all'); setMessage(''); await start();
        }}><option value="collector">Collector</option><option value="courier_0">Courier</option><option value="receiver">Lab receiver</option></select></label>}
        {workspace&&<span className={'live-state '+(!online?'paused':liveStatus)} aria-label="Update status"><span/>{!online?'Updates paused':liveStatus==='live'?'Live updates':liveStatus==='connecting'?'Connecting updates':'Updates reconnecting'}</span>}
        <span className={'connection ' + (!online ? 'offline' : '')}>{online ? <Wifi size={15}/> : <WifiOff size={15}/>}<span>{online ? 'Connected' : 'Offline'}</span></span></div>
      </header>
      <main className="main">
        {api.preview && <div className="preview-banner"><FlaskConical size={15}/><span>Fictional data · local preview. Changes here do not reach Appwrite.</span></div>}
        {(!online || cachedView) && <div className="notice warning"><WifiOff size={18}/><span>Showing the last saved workspace. Only observations can be saved offline; custody actions require a connection.</span></div>}
        {message && <div className="notice success" role="status"><CheckCircle2 size={18}/>{message}<button aria-label="Dismiss message" onClick={() => setMessage('')}><X size={16}/></button></div>}
        {error && <div className="notice danger" role="alert"><AlertCircle size={18}/>{error}<button onClick={() => void reload()}>Refresh</button></div>}
        <section className="page-heading"><div><div className="eyebrow">FIELD OPERATIONS <span/> {new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date())}</div>
          <h1>{screen === 'dispatch' ? 'A clear path from field to lab.' : screen === 'handoff' ? batchMode ? 'Check the batch. Keep the trail.' : 'Make the next handoff count.' : 'The story behind every sample.'}</h1>
          <p>{screen === 'dispatch' ? 'Know what’s ready, who has it, and what needs to happen next.' : screen === 'handoff' ? batchMode ? 'Record what arrived, flag what didn’t, and preserve the confirmed custodian.' : 'Confirm possession together. Keep the chain of custody clear.' : 'Follow the confirmed custody trail, one recorded event at a time.'}</p></div>
          {workspace?.member.role === 'collector' && <button className="button primary" disabled={!online || busy} onClick={() => setRegister(true)}><Plus size={17}/>Register sample</button>}
          {workspace?.member.role === 'receiver' && <button className="button secondary" disabled={busy || syncing} onClick={() => {setBatchMode(screen === 'handoff' ? !batchMode : true); setScreen('handoff');}}><PackageCheck size={17}/>{batchMode && screen === 'handoff' ? 'Single sample' : 'Receive batch'}</button>}
        </section>
        {pending.length > 0 && <section className="outbox" aria-label="Pending actions"><div><Clock3 size={20}/><strong>{pending.length} action{pending.length === 1 ? '' : 's'} saved on this device</strong><span>Not yet confirmed</span></div>
          {pending.map(item => <div className="outbox-row" key={item.key}><span>{item.command.kind === 'reconcile_batch' ? item.command.batchId : item.command.sampleId} · {eventLabel[item.command.kind]}</span><strong>{item.state === 'needs_review' ? 'Needs review · ' + item.errorCode : 'Pending sync'}</strong>
            <button className="text-button" onClick={() => { if(item.command.kind === 'reconcile_batch'){setBatchMode(true);setScreen('handoff');}else{setBatchMode(false);setSelected(item.command.sampleId);setScreen('history');} }}>Review history<ArrowRight size={14}/></button>
            {item.state === 'needs_review' && <button className="text-button" onClick={async () => {
              await queue.archiveRejected(identity.id, item.key); setItems(await queue.list(identity.id));
              setMessage('Rejected action archived locally. Review the current sample before recording a new action.');
            }}>Archive rejected action</button>}</div>)}
          <button className="button secondary compact" disabled={!online || busy || pending.some(row => row.state === 'needs_review')} onClick={() => void sync()}><RefreshCw size={15}/>Retry original requests</button></section>}
        {workspace && screen === 'dispatch' && <>
          <section className="metrics" aria-label="Sample summary">
            <Metric label="Ready for pickup" count={samples.filter(s => s.status === 'ready').length} detail="Awaiting a courier" Icon={ClipboardList} tone="sand"/>
            <Metric label="On the move" count={samples.filter(s => s.status === 'assigned' || s.status === 'in_transit').length} detail="Assignment through delivery" Icon={Truck} tone="mint"/>
            <Metric label="Received at lab" count={samples.filter(s => s.status === 'received').length} detail="Receipt acknowledged" Icon={PackageCheck} tone="lilac"/>
          </section>
          <NearbyCollections key={identity.id+":"+workspace.member.orgId} sites={workspace.sites} online={online} applied={nearby} onApply={setNearby}/>
          <div className="content-grid"><section className="panel sample-panel"><div className="panel-heading"><div><h2>Sample dispatch <span>{samples.length}</span></h2><p>The next step for every collection.</p></div><button className="icon-button" aria-label="Refresh workspace" disabled={!online || busy} onClick={() => void reload()}><RefreshCw size={17}/></button></div>
            <div className="table-tools"><label className="search"><Search size={17}/><input aria-label="Search samples" placeholder="Search sample, batch, or site…" value={query} onChange={e => setQuery(e.target.value)}/></label>
              <select aria-label="Filter sample status" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All statuses</option><option value="ready">Ready for pickup</option><option value="assigned">Pickup assigned</option><option value="in_transit">In transit</option><option value="received">Received at lab</option></select></div>
            <div className="table-scroll"><table><thead><tr><th>Sample / collection site</th><th>Status</th>{nearby && <th>Site distance</th>}<th>Confirmed custodian</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>{filtered.map(sample => <tr key={sample.id}><td><button className="sample-link" onClick={() => open(sample, 'history')}><span className="sample-icon"><FlaskConical size={19}/></span><span><strong>{sample.label}</strong><small>{sample.id} <i>·</i> {workspace.sites.find(site => site.id === sample.siteId)?.name || sample.siteId}</small></span></button></td><td><Badge sample={sample}/></td>{nearby && <td className="collection-distance">{formatDistance(distanceBySite.get(sample.siteId)!)}</td>}<td><span className="person-dot"/>{name(sample.custodianId)}</td><td><button className="row-action" aria-label={'Open handoff for ' + sample.id} onClick={() => open(sample, 'handoff')}><ArrowUpRight size={19}/></button></td></tr>)}</tbody></table></div>
            {filtered.length === 0 && <div className="empty"><FlaskConical size={30}/><h3>{samples.length ? 'No matching samples' : 'The next collection starts here'}</h3><p>{samples.length ? 'Try another search, status or distance filter.' : 'A collector can register the first sample for pickup.'}</p></div>}
            <div className="table-footer"><span>{filtered.length} of {samples.length} samples</span><span><ShieldCheck size={13}/>Server-confirmed custody</span></div>
            {workspace.truncated && <p className="small-note">Showing the most recent 100 samples. Narrower pagination is needed for larger operations.</p>}
          </section><aside className="dispatch-aside"><section className="field-card"><span className="label-pill"><Circle size={9}/>THE HANDOFF RULE</span><h2>Assigned isn’t<br/>handed over.</h2><p>Claiming a pickup reserves the task. The sample stays with its collector until both people confirm the transfer.</p><div className="mini-journey"><span><Leaf size={18}/>Collect</span><ChevronRight size={15}/><span><Truck size={18}/>Carry</span><ChevronRight size={15}/><span><FlaskConical size={18}/>Receive</span></div></section>
            <section className="panel attention"><div className="mini-title"><Clock3 size={17}/><h3>Waiting for acceptance</h3></div><strong className="attention-number">{samples.filter(s => s.pendingHandoffId).length.toString().padStart(2, '0')}</strong><p>A sender has offered custody. The intended receiver takes the next step.</p><button className="text-button" onClick={() => setScreen('handoff')}>View handoffs<ArrowRight size={15}/></button></section>
            <div className="site-caption"><MapPin size={15}/><span>{workspace.sites.length} collection site{workspace.sites.length === 1 ? '' : 's'} in your organization</span></div>
          </aside></div>
        </>}
        {workspace && screen === 'handoff' && batchMode && <BatchReceiving workspace={workspace} online={online} busy={busy || syncing} items={items} name={name} onSubmit={send} onHistory={id => {setBatchMode(false);setSelected(id);setScreen('history');}}/>}
        {workspace && screen !== 'dispatch' && !(screen === 'handoff' && batchMode) && <div className="detail-layout"><section className="panel detail-picker"><div className="panel-heading"><div><h2>Choose a sample</h2><p>Keep the physical label nearby.</p></div></div><label className="search"><Search size={17}/><input aria-label="Find a sample" placeholder="Sample ID or label…" value={query} onChange={e => setQuery(e.target.value)}/></label><div className="sample-options">{samples.filter(s => [s.label, s.id].join(' ').toLowerCase().includes(query.toLowerCase())).map(sample => <button key={sample.id} className={sample.id === selected ? 'selected' : ''} onClick={() => setSelected(sample.id)}><span className="sample-icon"><FlaskConical size={18}/></span><span><strong>{sample.label}</strong><small>{sample.id}</small><Badge sample={sample}/></span><ChevronRight size={16}/></button>)}</div></section>
          {selectedSample ? <div className="detail-main"><section className="panel specimen"><div className="specimen-top"><span className="sample-icon large"><FlaskConical size={29}/></span><div><div className="eyebrow">SAMPLE RECORD <span/> REVISION {selectedSample.version}</div><h2>{selectedSample.label}</h2><p>{selectedSample.id} <span>·</span> {selectedSample.batchId}</p></div><Badge sample={selectedSample}/></div>
            <div className="specimen-meta"><div><span>COLLECTION SITE</span><strong><MapPin size={15}/>{workspace.sites.find(site => site.id === selectedSample.siteId)?.name || selectedSample.siteId}</strong></div><div><span>CONFIRMED CUSTODIAN</span><strong><ShieldCheck size={15}/>{name(selectedSample.custodianId)}</strong></div></div>
            <div className="journey-track">{(['ready','assigned','in_transit','received'] as const).map((status, i) => { const step = ['ready','assigned','in_transit','received'].indexOf(selectedSample.status); return <div key={status} className={i <= step ? 'done' : ''}><span>{i < step ? <Check size={13}/> : i + 1}</span><strong>{['Collected','Assigned','In transit','At the lab'][i]}</strong></div>; })}</div>
          </section>
          {screen === 'handoff' && <section className="panel action-panel"><div className="section-kicker">NEXT CUSTODY STEP</div>
            {selectedSample.status === 'received' ? <><div className="action-icon"><CheckCircle2 size={26}/></div><h2>Receipt confirmed.</h2><p>The laboratory receiver has acknowledged this sample. The recorded custody trail is available in its history.</p></> :
            currentHandoff ? <><div className="action-icon amber"><ArrowDownLeft size={26}/></div><h2>{currentHandoff.toUserId === identity.id ? 'Ready to accept this sample?' : 'Waiting for the receiver.'}</h2><p><strong>{name(currentHandoff.fromUserId)}</strong> offered custody to <strong>{name(currentHandoff.toUserId)}</strong>. Match the physical sample ID and seal before confirming possession.</p>
              {currentHandoff.toUserId === identity.id ? <button className="button primary" disabled={!online || busy || pendingForSample} onClick={() => act('accept_handoff', { handoffId: currentHandoff.id })}><CheckCircle2 size={18}/>I have this sample · accept custody</button> : <div className="quiet-box"><Clock3 size={17}/>Only the intended receiver can accept this handoff.</div>}</> :
            selectedSample.status === 'ready' ? <><div className="action-icon"><Truck size={26}/></div><h2>A pickup is ready.</h2><p>Claim the task to reserve this pickup. The collector remains the confirmed custodian until an offered handoff is accepted.</p>{workspace.member.role === 'courier' ? <button className="button primary" disabled={!online || busy || pendingForSample} onClick={() => act('claim')}><Truck size={18}/>Claim pickup</button> : <div className="quiet-box">A courier can claim this sample from dispatch.</div>}</> :
            canOffer ? <OfferForm key={selectedSample.id + ':' + selectedSample.version} sample={selectedSample} receivers={receivers} disabled={!online || busy || pendingForSample} onOffer={toUserId => act('offer_handoff', { toUserId })}/> :
            <><div className="action-icon"><ShieldCheck size={26}/></div><h2>With the confirmed custodian.</h2><p>{name(selectedSample.custodianId)} must offer the next handoff. Assignment alone does not transfer possession.</p></>}
            <button className="text-button history-shortcut" onClick={() => setScreen('history')}>Inspect the custody history<ArrowRight size={15}/></button>
          </section>}
          {screen === 'history' && <section className="panel history-panel"><div className="panel-heading"><div><h2>Chain of custody</h2><p>Accepted records, in revision order.</p></div><HistoryIcon size={21}/></div>
            {historyError && <div className="notice danger" role="alert">{historyError}</div>}
            {!history && !historyError && <div className="empty"><Clock3 size={24}/><p>{online ? 'Loading the recorded trail…' : 'No history saved for offline viewing yet.'}</p></div>}
            {history && <ol className="timeline">{history.events.map(event => <li key={event.id}><div className={'timeline-dot ' + (event.kind === 'receipt_missing' ? 'missing' : '')}>{event.kind === 'observe' ? <ClipboardList size={15}/> : <Check size={15}/>}</div><div><div className="event-title"><strong>{eventLabel[event.kind]}</strong><span>REV {event.version}</span></div><p>{event.fromCustodianId !== event.toCustodianId ? name(event.fromCustodianId) + ' → ' + name(event.toCustodianId) : name(event.actorId)}</p>{event.note && <blockquote>{event.note}</blockquote>}<time>{time(event.recordedAt)}</time>{event.capturedAt !== event.recordedAt && <small className="capture-time">Observed {time(event.capturedAt)}</small>}</div></li>)}</ol>}
            {history?.events.length === 0 && <div className="empty"><p>No history events have been recorded.</p></div>}
            {history?.truncated && <p className="small-note">Showing the latest 100 events.</p>}
          </section>}
          {selectedSample.custodianId === identity.id && <ObservationForm key={selectedSample.id + ':' + selectedSample.version} disabled={busy || pendingForSample} offline={!online} onSave={note => void send({ kind: 'observe', sampleId: selectedSample.id, expectedVersion: selectedSample.version, operationId: uid(), note, capturedAt: new Date().toISOString() })}/>}
          </div> : <section className="panel empty detail-empty"><FlaskConical size={42}/><h2>Select a sample to continue</h2><p>Its status, current custodian, and next action will appear here.</p></section>}
        </div>}
        {!workspace && !error && <div className="empty"><p>Loading the workspace…</p></div>}
        <footer className="page-footer"><span><FlaskConical size={14}/>LabRelay <i>·</i> From collection to confirmation.</span><span>Custody reflects acknowledged records.</span></footer>
      </main>
    </div>
    {register && workspace && <Registration workspace={workspace} busy={busy || !online} onClose={() => setRegister(false)} onRegister={command => void send(command)}/>}
  </div>;
}
function Metric({ label, count, detail, Icon, tone }: { label: string; count: number; detail: string; Icon: typeof Truck; tone: string }) {
  return <div className="metric"><div className="metric-top"><span>{label}</span><span className={'metric-icon ' + tone}><Icon size={20}/></span></div><strong>{count.toString().padStart(2, '0')}</strong><p>{detail}</p></div>;
}
function OfferForm({ sample, receivers, disabled, onOffer }: { sample: Sample; receivers: Workspace['members']; disabled: boolean; onOffer(id: string): void }) {
  const [recipient, setRecipient] = useState(sample.status === 'assigned' ? sample.assignedCourierId || '' : receivers[0]?.id || '');
  return <><div className="action-icon"><Send size={26}/></div><h2>Offer the next handoff.</h2><p>Hand the physical sample to the intended receiver. Your custody remains confirmed until they accept.</p><form onSubmit={e => { e.preventDefault(); if (recipient) onOffer(recipient); }}><label className="field-label" htmlFor="recipient">Intended receiver</label><select id="recipient" value={recipient} onChange={e => setRecipient(e.target.value)} required>{sample.status === 'assigned' ? <option value={sample.assignedCourierId || ''}>{prettyPerson(sample.assignedCourierId || '')}</option> : receivers.map(receiver => <option key={receiver.id} value={receiver.id}>{prettyPerson(receiver.id)}</option>)}</select><button className="button primary" disabled={disabled || !recipient}><ArrowUpRight size={18}/>Offer handoff</button></form></>;
}
function ObservationForm({ disabled, offline, onSave }: { disabled: boolean; offline: boolean; onSave(note: string): void }) {
  const [note, setNote] = useState('');
  return <section className="panel observation"><h3><ClipboardList size={18}/>Handling note</h3><p>Record what you observed while this sample is in your custody.</p><form onSubmit={e => { e.preventDefault(); if (note.trim()) onSave(note.trim()); }}><label className="sr-only" htmlFor="note">Handling observation</label><textarea id="note" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Seal intact at pickup; label matches the manifest." maxLength={500} required/><div><span>{note.length}/500 {offline && '· Saved locally until reconnected'}</span><button className="button secondary" disabled={disabled || !note.trim()}><Plus size={16}/>{offline ? 'Save pending observation' : 'Record observation'}</button></div></form></section>;
}
function Registration({ workspace, busy, onClose, onRegister }: { workspace: Workspace; busy: boolean; onClose(): void; onRegister(command: Command): void }) {
  const [operationId] = useState(uid);
  const [sampleId, setSampleId] = useState('water_' + uid().slice(0, 8));
  const [label, setLabel] = useState('');
  const [batch, setBatch] = useState('batch_' + new Date().toISOString().slice(0, 10).replaceAll('-', ''));
  const [site, setSite] = useState(workspace.sites[0]?.id || '');
  const title = useRef<HTMLInputElement>(null);
  useEffect(() => { title.current?.focus(); const listener = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); }; addEventListener('keydown', listener); return () => removeEventListener('keydown', listener); }, [busy]);
  return <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="register-heading"><button className="modal-close icon-button" aria-label="Close registration" disabled={busy} onClick={onClose}><X size={20}/></button><div className="action-icon"><FlaskConical size={25}/></div><div className="eyebrow">NEW COLLECTION</div><h2 id="register-heading">Register a sample.</h2><p>You’ll be its first confirmed custodian.</p><form onSubmit={e => { e.preventDefault(); onRegister({ kind: 'register_sample', sampleId, expectedVersion: 0, operationId, label, batchId: batch, siteId: site }); }}>
    <label>Sample label<input ref={title} value={label} onChange={e => setLabel(e.target.value)} maxLength={120} required placeholder="e.g. River water · north bank"/></label>
    <label>Sample ID<input aria-label="Sample ID" value={sampleId} onChange={e => setSampleId(e.target.value)} pattern="[A-Za-z0-9][A-Za-z0-9_.-]{0,35}" maxLength={36} required/><small>Match this ID to the physical label.</small></label>
    <div className="form-grid"><label>Batch ID<input value={batch} onChange={e => setBatch(e.target.value)} pattern="[A-Za-z0-9][A-Za-z0-9_.-]{0,35}" maxLength={36} required/></label><label>Collection site<select value={site} onChange={e => setSite(e.target.value)} required>{workspace.sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label></div>
    <div className="quiet-box"><ShieldCheck size={17}/>This registers collection. No handoff is implied.</div><button className="button primary full" disabled={busy || !site}>Register sample<ArrowRight size={17}/></button></form></section></div>;
}
function Login({ onSuccess }: { onSuccess(): Promise<void> }) {
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  return <div className="login"><section className="login-story"><a className="brand" href="/"><div className="brand-mark"><FlaskConical size={25}/></div><span>LabRelay<span className="brand-dot">.</span><small>FIELD → LAB</small></span></a><div><div className="eyebrow">COLLECT. CARRY. CONFIRM.</div><h1>Every sample.<br/>A clear custody trail.</h1><p>Accountable handoffs from collection site to laboratory, even when field connectivity gets in the way.</p><div className="login-rule"><ShieldCheck size={23}/><span>Assignment reserves the task.<br/><strong>Acceptance transfers custody.</strong></span></div></div><small>Built for a focused water-testing workflow.</small></section><main className="login-form"><div className="login-card"><div className="eyebrow">YOUR FIELD WORKSPACE</div><h2>Welcome back.</h2><p>Sign in with your organization’s LabRelay account.</p><form onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { await api.signIn(email, password); await onSuccess(); } catch { setError('Sign-in failed. Check your email and password, connection, and project setup.'); } finally { setBusy(false); } }}>
    <label>Email address<input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@your-laboratory.org"/></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required/></label>{error && <p role="alert" className="login-error">{error}</p>}<button className="button primary full" disabled={busy}>{busy ? 'Signing in…' : 'Open workspace'}<ArrowRight size={17}/></button></form><div className="quiet-box"><ShieldCheck size={17}/>Your role and organization are managed by your administrator.</div>
    {import.meta.env.DEV && <a className="text-button preview-link" href="/?preview=1">Explore the fictional local preview<ArrowRight size={15}/></a>}</div></main></div>;
}
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(() => navigator.serviceWorker.ready).then(async registration => {
    const urls = [location.href, location.origin + '/', ...performance.getEntriesByType('resource').map(entry => entry.name)]
      .filter(url => { const parsed = new URL(url); return parsed.origin === location.origin && !parsed.pathname.startsWith('/__preview'); });
    const channel = new MessageChannel();
    channel.port1.onmessage = () => { (window as unknown as { __labrelayShellReady: boolean }).__labrelayShellReady = true; };
    registration.active?.postMessage({ type: 'CACHE_SHELL', urls }, [channel.port2]);
  }).catch(() => { /* Local queue remains durable even if offline shell caching is unavailable. */ });
}
createRoot(document.getElementById('root')!).render(<App/>);


