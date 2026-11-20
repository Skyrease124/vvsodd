// One browsing location for Home, its parcel map, weather and camera suggestions.
(function () {
  'use strict';
  const RECENT = 'ppa_home_area_v1';
  const coordinates = (lat, lng) => typeof lat === 'number' && typeof lng === 'number' &&
    lat >= 18 && lat <= 72 && lng >= -180 && lng <= -60;
  function normalize(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const state = /^[A-Z]{2}$/.test(raw.state || '') ? raw.state : '';
    const county = state && /^[\w-]{2,65}$/.test(raw.county || '') && raw.county.startsWith(state + '-') ? raw.county : '';
    const point = coordinates(raw.lat, raw.lng);
    if (!state && !point) return null;
    const parcel = county && typeof raw.parcel === 'string' ? raw.parcel.slice(0, 90) : '';
    return { state, county, parcel, label: typeof raw.label === 'string' ? raw.label.slice(0, 90) : '',
      lat: point ? raw.lat : null, lng: point ? raw.lng : null };
  }
  function mapPath(area, base = '/map/') {
    const q = new URLSearchParams(base.split('?')[1] || '');
    if (area?.county) { q.set('c', area.county); if (area.parcel) q.set('p', area.parcel); }
    else if (area?.state) q.set('s', area.state);
    const point = !area?.county && coordinates(area?.lat, area?.lng) ? '#' + new URLSearchParams({lat:area.lat,lng:area.lng}) : '';
    return base.split('?')[0] + (q.size ? '?' + q : '') + point;
  }
  function countyArea(dataset, record) {
    const point = record?.cx;
    const box = dataset.bb;
    const lat = point?.[1] ?? (box ? (box[1] + box[3]) / 2 : null);
    const lng = point?.[0] ?? (box ? (box[0] + box[2]) / 2 : null);
    return normalize({ state: dataset.state, county: dataset.id, parcel: record ? String(record.p) : '',
      label: dataset.county + ', ' + dataset.state, lat, lng });
  }
  if (typeof module === 'object' && module.exports) { module.exports = { normalize, mapPath, countyArea, coordinates }; return; }

  const get = key => { try { return localStorage.getItem(key); } catch (e) { return null; } };
  const put = (key, value) => { try { if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch (e) { /* optional storage */ } };
  let recent = null;
  try { recent = normalize(JSON.parse(get(RECENT) || 'null')); } catch (e) { /* invalid stored data */ }
  let chosen = null, regional = null, revision = 0;
  const listeners = new Set();
  const current = () => recent || chosen || regional;
  const emit = source => { for (const listener of listeners) listener(current(), source); };
  const preferredState = get('ppa_state');
  if (/^[A-Z]{2}$/.test(preferredState || '')) chosen = normalize({ state: preferredState, label: preferredState });
  let regionRequest, legacyRequest;
  function restore() {
    if (!legacyRequest) {
      let old; const startedAt = revision;
      try {
        const url = new URL(JSON.parse(get('ppa_recent_map') || 'null')?.url || '/', location.origin);
        if (url.origin === location.origin && url.pathname === '/map/' && url.searchParams.get('c')) old = url.searchParams;
      } catch (e) { /* ignore invalid URLs */ }
      legacyRequest = old ? fetch('/map/index.json').then(r => r.ok ? r.json() : null).then(data => {
        const dataset = data?.datasets.find(d => d.id === old.get('c'));
        if (dataset && !recent && revision === startedAt) {
          const p = old.get('p');
          const area = countyArea(dataset);
          recent = normalize({...area, parcel:p});
          put(RECENT, JSON.stringify(recent));
        }
        return recent;
      }).catch(() => recent) : Promise.resolve(null);
    }
    return legacyRequest;
  }
  async function ready() { return recent || await restore() || await region(); }
  function region() {
    if (!regionRequest) regionRequest = fetch('/.netlify/functions/where?regional=1')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        regional = normalize(data && { ...data, label: [data.city, data.state].filter(Boolean).join(', ') });
        if (chosen && !coordinates(chosen.lat, chosen.lng) && regional?.state === chosen.state) chosen = regional;
        if (!recent) emit('regional');
        return current();
      }).catch(() => current());
    return regionRequest;
  }
  async function useDevice() {
    if (!navigator.geolocation) throw new Error('Location is unavailable on this device.');
    const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, {timeout:10000}));
    // Align the widgets to a neighborhood, and keep device coordinates out of storage.
    const lat = Math.round(position.coords.latitude * 100) / 100, lng = Math.round(position.coords.longitude * 100) / 100;
    if (!coordinates(lat, lng)) throw new Error('Your position is outside the supported map area.');
    const state = await fetch('/.netlify/functions/where?' + new URLSearchParams({lat,lon:lng})).then(r => r.ok ? r.json() : null).catch(() => null);
    revision++; recent = null; put(RECENT, null); put('ppa_recent_map',null); legacyRequest = Promise.resolve(null);
    chosen = normalize({ state: state?.state, label: state?.name || 'Near me', lat, lng });
    emit('chosen');
    return chosen;
  }
  window.ppaLocation = {
    get: current, ready, countyArea, mapPath, coordinates,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    browse(value) {
      const next = normalize(value);
      if (!next) return;
      revision++; recent = next;
      put(RECENT, JSON.stringify(recent));
      emit('browse');
    },
    useDevice
  };
})();
