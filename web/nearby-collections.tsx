import { useEffect, useRef, useState } from 'react';
import { ArrowRight, MapPin, Navigation, X } from 'lucide-react';
import { api } from './api';
import type { Site } from '../src/domain/types';
import type { NearbySites } from '../src/domain/geo';
import './nearby.css';

export function formatDistance(meters: number) {
  return meters < 1000 ? Math.round(meters) + ' m' : (meters / 1000).toFixed(1) + ' km';
}
interface Props { sites: Site[]; online: boolean; applied: NearbySites | null; onApply(value: NearbySites | null): void }
export function NearbyCollections({ sites, online, applied, onApply }: Props) {
  const [origin, setOrigin] = useState(applied?.origin.id || sites[0]?.id || '');
  const [radius, setRadius] = useState(String((applied?.radiusMeters || 5000) / 1000));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, []);
  useEffect(() => {
    if (!online) { request.current++; setLoading(false); onApply(null); }
  }, [online]);
  function change(update: () => void) { request.current++; setLoading(false); setError(''); onApply(null); update(); }
  async function find() {
    if (!online || !origin) return;
    const token = ++request.current;
    setLoading(true); setError(''); onApply(null);
    try { const result = await api.nearbySites({ originSiteId: origin, radiusKm: Number(radius) });
      if (token === request.current) onApply(result);
    } catch (e) { if (token === request.current) setError(e instanceof Error ? e.message : 'Nearby sites could not be loaded.'); }
    finally { if (token === request.current) setLoading(false); }
  }
  return <section className="panel nearby-panel" aria-label="Nearby collections">
    <div className="nearby-heading"><div className="nearby-title"><span className="nearby-icon"><Navigation size={20}/></span><div><h2>Nearby collections</h2><p>Focus dispatch around a collection site.</p></div></div>
      {applied && <button className="text-button" onClick={() => change(() => {})}><X size={14}/>Clear distance filter</button>}</div>
    <div className="nearby-controls"><label>Reference collection site<select aria-label="Reference collection site" value={origin} disabled={!online} onChange={e => change(() => setOrigin(e.target.value))}>
      {!sites.length && <option value="">No collection sites available</option>}{sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
      <label>Search radius<select aria-label="Search radius" value={radius} disabled={!online} onChange={e => change(() => setRadius(e.target.value))}>{[0.5,1,5,10,25,50,100].map(km => <option key={km} value={km}>{km} km</option>)}</select></label>
      <button className="button primary" disabled={!online || !origin || loading} onClick={() => void find()}>{loading ? 'Finding sites...' : 'Find nearby sites'}<ArrowRight size={15}/></button></div>
    {error && <p className="nearby-error" role="alert">{error}</p>}
    {!online && <p className="nearby-note">Nearby search requires a connection. Showing all loaded samples.</p>}
    {applied && <div className="nearby-results" role="status"><p><strong>{applied.sites.length} collection site{applied.sites.length === 1 ? '' : 's'}</strong> within {applied.radiusMeters / 1000} km of {applied.origin.name}. Showing loaded samples at these sites.</p>
      <ul aria-label="Nearby sites by distance">{applied.sites.slice(0,5).map(({site,distanceMeters}) => <li key={site.id}><MapPin size={13}/><span>{site.name}</span><strong>{formatDistance(distanceMeters)}</strong></li>)}</ul>
      {applied.sites.length > 5 && <small>And {applied.sites.length - 5} more matching sites.</small>}</div>}
    <p className="nearby-footnote">Approximate straight-line distance between collection sites. Samples are sorted nearest first when the filter is active.</p>
  </section>;
}
