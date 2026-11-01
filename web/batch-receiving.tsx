import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, ClipboardCheck, Clock3, PackageCheck, RefreshCw, ShieldCheck } from 'lucide-react';
import { api } from './api';
import type { Workspace } from '../src/product';
import type { BatchManifest, BatchReceipt, Command } from '../src/domain/types';
import type { OutboxItem } from '../src/offline/outbox';
import { reconcileManifest } from '../src/domain/manifest';

interface Props {
  workspace: Workspace; online: boolean; busy: boolean; items: OutboxItem[];
  name(id: string): string;
  onSubmit(command: Command): Promise<OutboxItem | undefined>;
  onHistory(sampleId: string): void;
}
const newId = () => crypto.randomUUID().replaceAll('-', '');
const when = (value: string) => new Intl.DateTimeFormat('en-IN', {dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
export function BatchReceiving({ workspace, online, busy, items, name, onSubmit, onHistory }: Props) {
  const offers = workspace.handoffs.filter(handoff => handoff.status === 'offered' && handoff.toUserId === workspace.member.id);
  const batches = [...new Set(offers.map(handoff => workspace.samples.find(sample=>sample.id===handoff.sampleId)?.batchId)
    .filter((value): value is string => !!value))].sort();
  const [batch, setBatch] = useState(batches[0] || '');
  const [manifest, setManifest] = useState<BatchManifest | null>(null);
  const [scans, setScans] = useState('');
  const [operationId, setOperationId] = useState(newId);
  const [emptyConfirmed, setEmptyConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [receiptId, setReceiptId] = useState('');
  const [receipt, setReceipt] = useState<BatchReceipt | null>(null);
  const request = useRef(0);
  const recent = workspace.receipts || [];
  const scannedIds = scans.split(/[\s,;]+/).map(value=>value.trim()).filter(Boolean);
  const invalid = scannedIds.some(id=>!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,35}$/.test(id)) || scannedIds.length > 60;
  const comparison = reconcileManifest(manifest?.items.map(item=>item.sample.id) || [], scannedIds);
  const matching = new Set(comparison.received);
  const pending = items.find(item => item.command.kind === 'reconcile_batch' && item.command.batchId === batch &&
    (item.state === 'pending' || item.state === 'needs_review'));
  const locked = busy || submitting || !!pending;

  useEffect(()=>{ if (!batch && batches[0]) setBatch(batches[0]); },[batches.join('|'),batch]);
  useEffect(()=>{
    const saved = items.find(item=>item.command.operationId===operationId && item.state==='synced');
    if(saved?.result?.receiptId) setReceiptId(saved.result.receiptId);
  },[items,operationId]);
  useEffect(()=>{
    const token=++request.current;
    setReceipt(null);
    if(!receiptId) return;
    const cached=recent.find(row=>row.id===receiptId);
    if(cached){setReceipt(cached);return;}
    if(!online){setError('Reconnect to load this older receipt.');return;}
    api.receipt(receiptId).then(row=>{if(token===request.current)setReceipt(row);})
      .catch(e=>{if(token===request.current)setError(e instanceof Error?e.message:'Receipt unavailable.');});
  },[receiptId,recent,online]);
  async function load() {
    if(!batch || !online || locked)return;
    setLoading(true);setError('');setReceiptId('');setManifest(null);
    try { const data=await api.batchManifest(batch);setManifest(data);setOperationId(newId());setScans('');setEmptyConfirmed(false); }
    catch(e){setError(e instanceof Error?e.message:'The manifest could not be loaded.');}
    finally{setLoading(false);}
  }
  async function submit() {
    if(!manifest || !online || locked || invalid || (!scannedIds.length&&!emptyConfirmed))return;
    setSubmitting(true);setError('');
    try {
      const first=manifest.items[0]!.sample;
      const outcome=await onSubmit({kind:'reconcile_batch',sampleId:first.id,expectedVersion:first.version,operationId,
        batchId:manifest.batchId,batchVersion:manifest.version,
        expected:manifest.items.map(({sample})=>({sampleId:sample.id,version:sample.version})),scannedIds});
      if(outcome?.state==='synced'&&outcome.result?.receiptId)setReceiptId(outcome.result.receiptId);
      else if(outcome?.state==='needs_review')setError('This receipt needs review. Use the pending-actions panel to inspect or archive the rejected request, then load a fresh manifest.');
      else if(!outcome)setError('The request was not saved. Check the notice above before trying again.');
    } finally{setSubmitting(false);}
  }
  function reset() {setReceiptId('');setReceipt(null);setManifest(null);setScans('');setError('');setEmptyConfirmed(false);}
  return <div className="batch-layout">
    <div className="batch-primary">
      {error&&<div className="notice danger" role="alert"><AlertCircle size={17}/>{error}</div>}
      {!receiptId&&<section className="panel batch-select"><div className="panel-heading"><div><h2><PackageCheck size={20}/>Batch check-in</h2><p>Inspect the physical labels before confirming possession.</p></div></div>
        <div className="batch-select-body"><label htmlFor="receive-batch">Batch offered to you</label><div className="batch-load-row">
          <select id="receive-batch" value={batch} disabled={locked||loading} onChange={event=>{setBatch(event.target.value);setManifest(null);setScans('');setError('');}}>
            {!batches.length&&<option value={batch}>{batch||'No pending laboratory offers'}</option>}
            {batches.map(id=><option value={id} key={id}>{id}</option>)}
            {!!batch&&!batches.includes(batch)&&batches.length>0&&<option value={batch}>{batch} · no offers remain</option>}
          </select><button className="button secondary" disabled={!online||locked||loading||!batches.includes(batch)} onClick={()=>void load()}><RefreshCw size={15}/>{loading?'Loading…':manifest?'Refresh manifest':'Load manifest'}</button></div>
          <p>Only samples currently offered to you belong to this delivery manifest. Other samples in the batch stay in dispatch.</p>
          {!online&&<div className="quiet-box"><Clock3 size={17}/>New receipts require a connection. Saved receipts remain available below.</div>}
          {pending&&<div className="notice warning"><Clock3 size={17}/>{pending.state==='needs_review'?'A previous request needs review. Archive it in the pending-actions panel before starting another.':'A previous receipt is awaiting confirmation. Retry its original request in the panel above.'}</div>}
        </div></section>}
      {receiptId&&!receipt&&<section className="panel empty"><Clock3 size={24}/><p>Loading the saved receipt…</p></section>}
      {receipt&&<section className="panel receipt-report" aria-label="Saved batch receipt">
        <div className="panel-heading"><div><div className="eyebrow">RECORDED CHECK-IN</div><h2>{receipt.status==='matched'?'Manifest matched.':'Discrepancies recorded.'}</h2><p>{receipt.batchId} · {when(receipt.recordedAt)}</p></div>
          <span className={'receipt-seal '+receipt.status}>{receipt.status==='matched'?<CheckCircle2 size={24}/>:<AlertCircle size={24}/>}</span></div>
        <div className="receipt-intro"><ShieldCheck size={17}/><span>Recorded by {name(receipt.actorId)}. Matching samples were accepted once; missing samples retained their confirmed custodian.</span></div>
        <ReceiptCounts expected={receipt.expectedCount} accepted={receipt.receivedCount} missing={receipt.missingCount} unexpected={receipt.unexpectedCount} duplicate={receipt.duplicateCount}/>
        <div className="table-scroll"><table aria-label="Receipt items"><thead><tr><th>Sample</th><th>At this check-in</th><th>Confirmed custodian after check-in</th><th>History</th></tr></thead><tbody>{receipt.details.items.map(item=><tr key={item.sampleId}>
          <td><strong>{item.label}</strong><small>{item.sampleId}</small></td><td><span className={'badge '+(item.outcome==='missing'?'pending':'received')}>{item.outcome==='missing'?'Missing · custody unchanged':'Accepted at lab'}</span></td>
          <td>{name(item.toCustodianId)}</td><td><button className="row-action" aria-label={'History for '+item.sampleId} onClick={()=>onHistory(item.sampleId)}><ArrowRight size={16}/></button></td></tr>)}</tbody></table></div>
        <div className="receipt-footnote">This is the saved snapshot. Later custody changes appear in each sample’s history.</div>
        <Exceptions unexpected={receipt.details.unexpected} duplicates={receipt.details.duplicateScans}/>
        <div className="receipt-bottom"><span>Receipt {receipt.id}</span><button className="button secondary" onClick={reset}>Start another check-in<ArrowRight size={16}/></button></div>
      </section>}
      {manifest&&!receiptId&&<section className="panel batch-scan" aria-label="Batch reconciliation">
        <div className="panel-heading"><div><h2>Match the physical samples</h2><p>{manifest.items.length} expected sample{manifest.items.length===1?'':'s'} · {manifest.batchId}</p></div><ClipboardCheck size={22}/></div>
        <div className="scan-input"><label htmlFor="receipt-scans">Scanned sample IDs</label><textarea id="receipt-scans" value={scans} disabled={locked} onChange={event=>setScans(event.target.value)}
          maxLength={2400} rows={4} placeholder="Scan or paste one sample ID per line. Commas and spaces also work."/>
          <p>Repeated scans are retained as discrepancies. A matching sample can transfer custody only once.</p>
          {invalid&&<p className="scan-error" role="alert">Use at most 60 scans, with 1–36 letters, digits, periods, underscores or hyphens per ID.</p>}
          {!scannedIds.length&&<label className="empty-receipt-confirm"><input type="checkbox" checked={emptyConfirmed} disabled={locked} onChange={event=>setEmptyConfirmed(event.target.checked)}/>No samples arrived in this check-in.</label>}
        </div>
        <ReceiptCounts expected={manifest.items.length} accepted={comparison.received.length} missing={comparison.missing.length} unexpected={comparison.unexpected.length} duplicate={comparison.duplicateScans.length}/>
        <div className="table-scroll"><table aria-label="Expected receipt manifest"><thead><tr><th>Expected sample</th><th>Scan result</th><th>Current confirmed custodian</th></tr></thead><tbody>{manifest.items.map(({sample})=><tr key={sample.id}><td><strong>{sample.label}</strong><small>{sample.id}</small></td>
          <td><span className={'badge '+(matching.has(sample.id)?'in_transit':'pending')}>{matching.has(sample.id)?'Matching scan':'Missing from scans'}</span></td><td>{name(sample.custodianId)}</td></tr>)}</tbody></table></div>
        <Exceptions unexpected={comparison.unexpected} duplicates={comparison.duplicateScans}/>
        <div className="receipt-submit"><div className="quiet-box"><ShieldCheck size={18}/><span>{comparison.missing.length?comparison.missing.length+' missing sample'+(comparison.missing.length===1?'':'s')+' will stay with the recorded custodian.':'Only these matching samples will change custody.'}</span></div>
          <button className="button primary" disabled={!online||locked||loading||invalid||(!scannedIds.length&&!emptyConfirmed)} onClick={()=>void submit()}><CheckCircle2 size={17}/>{submitting?'Recording…':comparison.received.length?'Accept '+comparison.received.length+' & record receipt':'Record missing samples'}</button>
          <p>Accepting confirms physical possession of matching samples. Unexpected IDs do not create or receive a sample.</p></div>
      </section>}
      {!manifest&&!receiptId&&<section className="panel empty batch-empty"><ClipboardCheck size={38}/><h2>A careful receipt closes the loop.</h2><p>Load an offered batch, compare its labels, and record what actually arrived. Missing samples keep their last confirmed custodian.</p></section>}
    </div>
    <aside className="batch-aside"><section className="panel"><div className="panel-heading"><div><h2>Recent receipts</h2><p>Saved for your organization.</p></div></div>
      {!recent.length&&<div className="receipt-none"><Clock3 size={22}/><p>No batch receipts recorded yet.</p></div>}
      <div className="recent-receipts">{recent.map(row=><button className={row.id===receiptId?'selected':''} key={row.id} onClick={()=>{setReceiptId(row.id);setError('');}}>
        <div><strong>{row.batchId}</strong><small>{when(row.recordedAt)}</small></div><span className={'badge '+(row.status==='matched'?'received':'pending')}>{row.status==='matched'?'Matched':'Discrepancy'}</span>
        <p>{row.receivedCount}/{row.expectedCount} accepted · {row.missingCount} missing</p></button>)}</div>
      {workspace.receiptsTruncated&&<p className="small-note">Showing the latest 20 receipts.</p>}</section>
      <div className="batch-guidance"><ShieldCheck size={21}/><strong>A missing scan is not a handoff.</strong><p>The discrepancy is recorded while the sample stays with its last acknowledged custodian. If it arrives later, record another check-in.</p></div>
    </aside>
  </div>;
}
function ReceiptCounts({expected,accepted,missing,unexpected,duplicate}:{expected:number;accepted:number;missing:number;unexpected:number;duplicate:number}) {
  return <div className="receipt-counts" aria-label="Reconciliation counts">{[['Expected',expected],['Matching',accepted],['Missing',missing],['Unexpected',unexpected],['Repeated IDs',duplicate]].map(([label,value])=><div key={label}><span>{label}</span><strong>{String(value).padStart(2,'0')}</strong></div>)}</div>;
}
function Exceptions({unexpected,duplicates}:{unexpected:string[];duplicates:string[]}) {
  return <div className="receipt-exceptions">{unexpected.length>0&&<section><h3><AlertCircle size={15}/>Unexpected IDs</h3><p>Not on this manifest; no custody was transferred for these IDs.</p><div>{unexpected.map(id=><code key={id}>{id}</code>)}</div></section>}
    {duplicates.length>0&&<section><h3><RefreshCw size={15}/>Repeated scans</h3><p>Each matching sample is accepted at most once.</p><div>{duplicates.map(id=><code key={id}>{id}</code>)}</div></section>}</div>;
}
