// Land Information for one parcel, read live from official government map services.
// GET ?county=Palm%20Beach&parcel=74-43-44-04-24-000-0243
// Every field says where it came from and when it was checked. Anything we cannot read from an
// official source comes back as "Not Verified". No owner names or addresses are ever requested.
import * as auth from '../lib/auth.mjs';

const CACHE_DAYS = 30;
const FEMA = 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query';
const NWI = 'https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/rest/services/Wetlands/MapServer/0/query';
const ROADS = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Transportation/MapServer/8/query';
const FEMA_PAGE = 'https://msc.fema.gov/portal/search';
const NWI_PAGE = 'https://www.fws.gov/program/national-wetlands-inventory/wetlands-mapper';

// County connectors. Add a county here to switch Land Information on for it.
const COUNTIES = {
  'Palm Beach': {
    state: 'FL',
    parcels: 'https://services1.arcgis.com/ZWOoUZbtaYePLlPw/ArcGIS/rest/services/Parcels/FeatureServer/0/query',
    idField: 'PARID', fmt: p => p.replace(/-/g, ''),
    record: p => 'https://www.pbcgov.org/papa/Asps/PropertyDetail/PropertyDetail.aspx?parcel=' + p.replace(/-/g, ''),
    recordName: 'Palm Beach County Property Appraiser',
    city: { url: 'https://gis.pbcgov.org/arcgis/rest/services/PZB/MUNICIPALITIES/MapServer/0/query', field: 'MUNINAME', name: 'Palm Beach County Planning, Zoning & Building (city limits map)' },
    landUse: true,
    water: { url: 'https://gis.pbcgov.org/arcgis/rest/services/WUD/WUD_Water_Main/MapServer/0/query', name: 'Palm Beach County Water Utilities (water main map)' },
    zoningPage: 'https://discover.pbcgov.org/pzb/zoning/Pages/default.aspx'
  },
  'Saguache': {
    state: 'CO',
    parcels: 'https://services1.arcgis.com/zH7gQ37AKcpvTX6d/arcgis/rest/services/Saguache_County_Parcels_View/FeatureServer/0/query',
    idField: 'Account', fmt: p => p,
    record: () => 'https://saguachecounty.colorado.gov/departments/treasurer/public-trustee', recordName: 'Saguache County Treasurer',
    zoningPage: 'https://saguachecounty.colorado.gov/'
  },
  'Larimer': {
    state: 'CO',
    parcels: 'https://maps1.larimer.org/arcgis/rest/services/MapServices/Parcels/MapServer/3/query',
    idField: 'PARCELNUM', fmt: p => p,
    record: () => 'https://www.larimer.gov/assessor', recordName: 'Larimer County Assessor',
    zoning: { url: 'https://maps1.larimer.org/arcgis/rest/services/MapServices/LC_Zoning/MapServer/0/query', field: 'ZONING_DISTRICT', name: 'Larimer County zoning map (unincorporated county only)' },
    zoningPage: 'https://www.larimer.gov/planning'
  },
  'Pasco': {
    state: 'FL',
    parcels: 'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query',
    idField: 'CO_NO=61 AND PARCEL_ID', fmt: p => p,
    record: () => 'https://www.pascopa.com/', recordName: 'Pasco County Property Appraiser',
    zoningPage: 'https://pascotaxes.com/'
  },
  'Volusia': {
    state: 'FL',
    parcels: 'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query',
    idField: 'CO_NO=74 AND PARCEL_ID', fmt: p => p,
    record: () => 'https://vcpa.vcgov.org/', recordName: 'Volusia County Property Appraiser',
    zoningPage: 'https://www.vctaxcollector.org/'
  },
  'Santa Rosa': {
    state: 'FL',
    parcels: 'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query',
    idField: 'CO_NO=67 AND PARCEL_ID', fmt: p => p,
    record: () => 'https://srcpa.gov/', recordName: 'Santa Rosa County Property Appraiser',
    zoningPage: 'https://srctc.com/'
  },
  'Walton': {
    state: 'FL',
    parcels: 'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query',
    idField: 'CO_NO=76 AND PARCEL_ID', fmt: p => p.replace(/-/g, ''),
    record: () => 'https://waltonpa.com/', recordName: 'Walton County Property Appraiser',
    zoningPage: 'https://waltontaxcollector.com/'
  },
  'Miami-Dade': {
    state: 'FL',
    parcels: 'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query',
    idField: 'CO_NO=23 AND PARCEL_ID', fmt: p => p.replace(/-/g, ''),
    record: p => 'https://www.miamidade.gov/Apps/PA/propertysearch/#/?folio=' + p.replace(/-/g, ''), recordName: 'Miami-Dade Property Appraiser',
    zoningPage: 'https://www.miamidade.gov/'
  },
  'Bay': {
    state: 'FL',
    parcels: 'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query',
    idField: 'CO_NO=13 AND PARCEL_ID', fmt: p => p.replace(/-/g, ''),
    record: () => 'https://baypa.net/', recordName: 'Bay County Property Appraiser',
    zoningPage: 'https://www.baycountyfl.gov/'
  },
  'Alachua': {
    state: 'FL',
    parcels: 'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query',
    idField: 'CO_NO=11 AND PARCEL_ID', fmt: p => p,
    record: () => 'https://www.acpafl.org/', recordName: 'Alachua County Property Appraiser',
    zoningPage: 'https://growth-management.alachuacounty.us/'
  },
  'Manatee': {
    state: 'FL',
    parcels: 'https://www.mymanatee.org/gisits/rest/services/opendata/General/FeatureServer/0/query',
    idField: 'PARCEL_ID', fmt: p => p,
    record: () => 'https://www.manateepao.gov/', recordName: 'Manatee County Property Appraiser',
    zoning: { url: 'https://www.mymanatee.org/gisits/rest/services/opendata/General/FeatureServer/0/query', field: 'ZONING', name: 'Manatee County parcel map (zoning field)' },
    zoningPage: 'https://www.mymanatee.org/'
  },
  'Leon': {
    state: 'FL',
    parcels: 'https://intervector.leoncountyfl.gov/intervector/rest/services/MapServices/TLC_OverlayParcel_D_WM/MapServer/0/query',
    idField: 'TAXID', fmt: p => p,
    record: () => 'https://www.leonpa.gov/', recordName: 'Leon County Property Appraiser',
    zoning: { url: 'https://intervector.leoncountyfl.gov/intervector/rest/services/MapServices/TLC_OverlayZoning_D_WM/MapServer/0/query', field: 'ZONING', name: 'Tallahassee-Leon County zoning map' },
    zoningPage: 'https://www.leoncountyfl.gov/'
  },
  'Coconino': {
    state: 'AZ',
    parcels: 'https://services1.arcgis.com/Rlvx5g8pKeK13apH/arcgis/rest/services/Coconino_County_Parcels_Open_Data/FeatureServer/0/query',
    idField: 'APN', fmt: p => p,
    record: () => 'https://www.coconino.az.gov/DocumentCenter/View/70663/2026-ACCT-BAL-EXTRACT-WEBSITE', recordName: 'Coconino County Treasurer',
    zoning: { url: 'https://services1.arcgis.com/Rlvx5g8pKeK13apH/arcgis/rest/services/County_Zoning/FeatureServer/0/query', field: 'ZONINGCODE', name: 'Coconino County zoning map (unincorporated county only)' },
    zoningPage: 'https://www.coconino.az.gov/'
  },
  'Pinal': {
    state: 'AZ',
    parcels: 'https://gis.pinal.gov/mapping/rest/services/TaxParcels/FeatureServer/3/query',
    idField: 'PARCELID', fmt: p => p.slice(0, 9),
    record: () => 'https://treasurer.pinal.gov/', recordName: 'Pinal County Treasurer',
    zoning: { url: 'https://gis.pinal.gov/mapping/rest/services/Zoning_2010/MapServer/0/query', field: 'ZONING', name: 'Pinal County zoning map (unincorporated county only)' },
    zoningPage: 'https://www.pinal.gov/301/Planning'
  }
};

const today = () => new Date().toISOString().slice(0, 10);
const NV = (source, url, note) => ({ value: 'Not Verified', verified: false, source: source || '', url: url || '', note: note || '', checked: today() });
const OK = (value, source, url, note) => ({ value, verified: true, source, url: url || '', note: note || '', checked: today() });

async function q(url, params, ms = 15000) {
  const body = new URLSearchParams({ f: 'json', ...params });
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctl.signal });
    const d = await r.json(); if (d.error) throw new Error(d.error.message || 'service error'); return d;
  } finally { clearTimeout(t); }
}
const polyParams = rings => ({ geometry: JSON.stringify({ rings, spatialReference: { wkid: 4326 } }), geometryType: 'esriGeometryPolygon', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'false' });
const ptParams = ([x, y]) => ({ geometry: x + ',' + y, geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'false' });

// Area (acres) and rough size (feet) from a lat/long polygon, using a local flat projection.
function measure(rings) {
  const pts = rings[0]; const lat0 = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const kx = 111320 * Math.cos(lat0 * Math.PI / 180), ky = 110540; // meters per degree
  let area = 0;
  for (const r of rings) { let a = 0; for (let i = 0; i < r.length - 1; i++) a += (r[i][0] * kx) * (r[i + 1][1] * ky) - (r[i + 1][0] * kx) * (r[i][1] * ky); area += a / 2; }
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const w = (Math.max(...xs) - Math.min(...xs)) * kx * 3.28084, h = (Math.max(...ys) - Math.min(...ys)) * ky * 3.28084;
  const cx = xs.reduce((s, v) => s + v, 0) / xs.length, cy = ys.reduce((s, v) => s + v, 0) / ys.length;
  return { acres: Math.abs(area) / 4046.86, w, h, center: [cx, cy] };
}
const thin = rings => rings.map(r => r.length > 300 ? r.filter((_, i) => i % Math.ceil(r.length / 300) === 0 || i === r.length - 1) : r);

async function research(countyName, parcel) {
  const c = COUNTIES[countyName];
  const recordUrl = c ? c.record(parcel) : '';
  const out = { county: countyName, parcel, state: c ? c.state : '', checked: today(), fields: {} };
  const F = out.fields;
  if (!c) {
    for (const k of ['flood', 'wetlands', 'zoning', 'buildable', 'road', 'size', 'water', 'sewer', 'power', 'easements']) F[k] = NV('', '', 'Land Information is not switched on for this county yet.');
    return out;
  }
  // 1. The parcel shape from the county's own parcel map (only the ID is requested: no owner fields).
  let rings = null;
  try {
    const d = await q(c.parcels, { where: c.idField + "='" + c.fmt(parcel).replace(/'/g, '') + "'", outFields: c.idField.split(' ').pop(), returnGeometry: 'true', outSR: '4326' });
    const g = d.features && d.features[0] && d.features[0].geometry; if (g && g.rings && g.rings.length) rings = thin(g.rings);
  } catch (e) { }
  if (!rings) {
    for (const k of ['flood', 'wetlands', 'zoning', 'buildable', 'road', 'size', 'water', 'sewer', 'power', 'easements']) F[k] = NV(c.recordName, recordUrl, 'The county parcel map did not return this parcel, so nothing could be checked automatically.');
    out.matched = false; return out;
  }
  out.matched = true;
  const m = measure(rings);
  F.size = OK('About ' + (m.acres < 0.1 ? Math.round(m.acres * 43560).toLocaleString('en-US') + ' sq ft (' + m.acres.toFixed(3) + ' acres)' : m.acres.toFixed(2) + ' acres') + ', roughly ' + Math.round(m.w) + ' ft by ' + Math.round(m.h) + ' ft',
    countyName + ' County parcel map', recordUrl, 'Measured from the county map outline. The size on the deed or survey is the official one.');

  const tasks = {};
  tasks.flood = q(FEMA, { ...polyParams(rings), outFields: 'FLD_ZONE,ZONE_SUBTY,SFHA_TF' }).then(d => {
    const fs = (d.features || []).map(f => f.attributes); if (!fs.length) return NV('FEMA National Flood Hazard Layer', FEMA_PAGE, 'FEMA has no flood map panel here, or it is not digital.');
    const zones = [...new Set(fs.map(a => a.FLD_ZONE + (a.ZONE_SUBTY && /FLOODWAY/i.test(a.ZONE_SUBTY) ? ' (floodway)' : '')))];
    const high = fs.some(a => a.SFHA_TF === 'T');
    const risk = high ? 'High risk (Special Flood Hazard Area). Flood insurance is usually required with a mortgage, and building rules are stricter.' : zones.some(z => /^X/.test(z) && true) && fs.some(a => /0\.2/.test(a.ZONE_SUBTY || '')) ? 'Moderate risk (0.2% annual chance area).' : zones.every(z => /^X/.test(z)) ? 'Lower risk (outside the 1% annual chance flood area).' : 'See the FEMA map for this zone.';
    return OK('Zone ' + zones.join(', ') + '. ' + risk, 'FEMA National Flood Hazard Layer', FEMA_PAGE, 'Search the parcel address on the FEMA map to see the official panel.');
  });
  tasks.wetlands = q(NWI, { ...polyParams(rings), outFields: 'WETLAND_TYPE,ATTRIBUTE' }).then(d => {
    const fs = (d.features || []).map(f => f.attributes);
    if (!fs.length) return OK('No mapped wetlands on this lot.', 'U.S. Fish & Wildlife Service, National Wetlands Inventory', NWI_PAGE, 'This map is for planning only. A site survey can still find wetlands.');
    return OK('Mapped wetlands touch this lot: ' + [...new Set(fs.map(a => a.WETLAND_TYPE))].join(', ') + '. Wetlands can limit or stop building and may need state or federal permits.', 'U.S. Fish & Wildlife Service, National Wetlands Inventory', NWI_PAGE);
  });
  tasks.road = q(ROADS, { ...polyParams(rings), distance: '20', units: 'esriSRUnit_Meter', outFields: 'NAME' }).then(d => {
    const fs = (d.features || []).map(f => f.attributes);
    if (fs.length) return OK('Appears to touch a mapped road: ' + [...new Set(fs.map(a => a.NAME).filter(Boolean))].slice(0, 3).join(', ') + '. Legal access is not confirmed.', 'U.S. Census Bureau TIGER road map', 'https://tigerweb.geo.census.gov/', 'A road on the map does not prove legal access. Check the plat or survey.');
    return OK('No mapped road within about 65 ft. It may be landlocked.', 'U.S. Census Bureau TIGER road map', 'https://tigerweb.geo.census.gov/', 'Private roads and easements may not be on this map. Check the plat or survey before you buy.');
  });
  if (c.zoning) tasks.zoning = q(c.zoning.url, { ...ptParams(m.center), outFields: c.zoning.field }).then(d => {
    const v = d.features && d.features[0] && d.features[0].attributes[c.zoning.field];
    return v ? OK('County zoning district: ' + v, c.zoning.name, c.zoningPage) : NV(c.zoning.name, c.zoningPage, 'Not in the county zoning map. It may be inside a city, which keeps its own zoning.');
  });
  else if (c.landUse) tasks.zoning = Promise.all([
    q(c.city.url, { ...ptParams(m.center), outFields: c.city.field }).catch(() => null),
    Promise.resolve(null)
  ]).then(([ci, lu]) => {
    let city = ci && ci.features && ci.features[0] && ci.features[0].attributes[c.city.field]; if (city && /unincorp/i.test(city)) city = '';
    const z = NV(c.city.name, c.zoningPage, (city ? 'Inside ' + city + ', which sets its own zoning. Check with the city.' : 'Unincorporated county. The county zoning map is not published as a public data service.'));
    return z;
  });
  if (c.water) tasks.water = q(c.water.url, { ...polyParams(rings), distance: '30', units: 'esriSRUnit_Meter', outFields: 'OBJECTID' }).then(d =>
    (d.features || []).length ? OK('A county water main is mapped within about 100 ft.', c.water.name, '', 'Ask the utility whether a hookup is available and what it costs.') : NV(c.water.name, '', 'No county water main mapped within about 100 ft. The lot may be served by a city utility or need a well.'));

  const keys = Object.keys(tasks), vals = await Promise.allSettled(Object.values(tasks));
  keys.forEach((k, i) => { F[k] = vals[i].status === 'fulfilled' ? vals[i].value : NV('', '', 'The official map service did not answer. Try again later.'); });
  if (!F.zoning) F.zoning = NV('County planning office', c.zoningPage, 'No public zoning map service found for this county yet.');
  if (!F.water) F.water = NV('', '', 'No public water service map found for this county. Ask the local utility.');
  F.sewer = NV('', '', 'No public sewer map service checked. Ask the local utility or the health department (septic).');
  F.power = NV('', '', 'Power company maps are not public. Ask the local electric company.');
  F.buildable = NV('County planning office', c.zoningPage, 'No official buildability ruling is published. Ask the county or city planning office.' + (F.wetlands.verified && /touch/.test(F.wetlands.value) ? ' Mapped wetlands make this more important.' : '') + (F.flood.verified && /High risk/.test(F.flood.value) ? ' A high-risk flood zone adds building rules.' : ''));
  F.easements = NV(c.recordName, recordUrl, 'Easements and deed restrictions are in recorded documents. Check the plat and the county clerk’s official records.');
  return out;
}

const hits = new Map();
export default async (req, context) => {
  const u = new URL(req.url), county = String(u.searchParams.get('county') || '').slice(0, 40), parcel = String(u.searchParams.get('parcel') || '').trim().slice(0, 40);
  const send = (code, body) => new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  if (!county || !/^[A-Za-z0-9 .\-]+$/.test(parcel)) return send(400, { error: 'Missing county or parcel.' });
  const key = 'land_' + county.replace(/\W/g, '') + '_' + parcel.replace(/\W/g, '');
  const cached = await auth.kvGet(key);
  if (cached && cached.checked && (Date.now() - Date.parse(cached.checked)) < CACHE_DAYS * 864e5) return send(200, { ...cached, cached: true });
  const ip = (req.headers.get('x-nf-client-connection-ip') || (context && context.ip) || 'x');
  const now = Date.now(), rec = (hits.get(ip) || []).filter(t => now - t < 3600e3);
  if (rec.length >= 60) return send(429, { error: 'Too many lookups. Please wait a bit.' });
  rec.push(now); hits.set(ip, rec);
  const out = await research(county, parcel);
  if (out.matched) await auth.kvPut(key, out);
  return send(200, out);
};

export { research, COUNTIES };
