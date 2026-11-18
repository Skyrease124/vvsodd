"""Match the Mississippi Secretary of State tax-forfeited land list (ms-forfeited-data.js) to the statewide parcel layers kept by MARIS
(Mississippi Automated Resource Information System, University of Mississippi: MS_West_Parcels / MS_East_Parcels, built from county assessor data).
EXACT parcel-number matches only (PARNO, ALTPARNO, PPIN or CAMA must equal the list's number). No fuzzy matching, so no wrong outlines.
Writes kinvest-liens/liens/states/parcels/ms.json keyed 'County|parcel' with the outline, owner of record, site address, acres, zoning and county value from the layer.
Run: python3 tools/ms-parcels/match.py"""
import json, os, re, time, urllib.request, urllib.parse, datetime, subprocess
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')); S = ROOT + '/kinvest-liens/liens/states/'
UA = {'User-Agent': 'PricePocketAsset research (https://pricepocketasset.com)'}
BASE = 'https://gis.mississippi.edu/server/rest/services/Cadastral/MS_%s_Parcels/MapServer/0/query'
def q(layer, params):
    for a in range(4):
        try:
            d = json.loads(urllib.request.urlopen(urllib.request.Request(BASE % layer, data=urllib.parse.urlencode(params).encode(), headers=UA), timeout=180).read())
            if 'error' in d: raise RuntimeError(d['error'])
            return d
        except Exception:
            if a == 3: raise
            time.sleep(4 * (a + 1))
src = open(S + 'ms-forfeited-data.js').read()
i0 = src.index('const MS_TFL = ') + 15; rows = json.JSONDecoder().raw_decode(src[i0:])[0]
by = {}
for c, pid, mv in rows: by.setdefault(c, []).append(pid)
FIELDS = 'PARNO,ALTPARNO,PPIN,CAMA,OWNNAME,SITEADD,SCITY,GISACRES,TAXACRES,ZONING,TOTVAL,TAXYEAR,CNTYNAME'
out = {}; stats = []
def esc(x): return x.replace("'", "''")
import threading
from concurrent.futures import ThreadPoolExecutor
lock = threading.Lock()
def do(county):
    ids = by[county]; cname = county.upper(); layer = None
    for lay in ('West', 'East'):
        if q(lay, {'where': "CNTYNAME='%s'" % esc(cname), 'returnCountOnly': 'true', 'f': 'json'}).get('count', 0) > 0: layer = lay; break
    if not layer: return (county, len(ids), 0, 'no county layer')
    want = set(ids); local = {}
    for i in range(0, len(ids), 60):
        ch = ids[i:i + 60]; inl = ','.join("'%s'" % esc(x) for x in ch)
        d = q(layer, {'where': "CNTYNAME='%s' AND (PARNO IN (%s) OR ALTPARNO IN (%s) OR PPIN IN (%s) OR CAMA IN (%s))" % (esc(cname), inl, inl, inl, inl), 'outFields': FIELDS, 'returnGeometry': 'true', 'outSR': '4326', 'geometryPrecision': '6', 'f': 'json'})
        for ft in d.get('features', []):
            a = ft['attributes']; g = ft.get('geometry') or {}
            if not g.get('rings'): continue
            cands = [x for x in (a.get('PARNO'), a.get('ALTPARNO'), a.get('PPIN'), a.get('CAMA')) if x and x in want]
            if not cands: continue
            pid = cands[0]; key = county + '|' + pid
            xs = [p[0] for r in g['rings'] for p in r]; ys = [p[1] for r in g['rings'] for p in r]
            rec = local.setdefault(key, {'st': 'matched', 'g': [], 'bb': [min(xs), min(ys), max(xs), max(ys)], 'cid': a.get('PARNO') or pid})
            rec['g'] += [[[round(x, 6), round(y, 6)] for x, y in r] for r in g['rings']]
            b = rec['bb']; rec['bb'] = [min(b[0], min(xs)), min(b[1], min(ys)), max(b[2], max(xs)), max(b[3], max(ys))]
            own = (a.get('OWNNAME') or '').strip(); addr = ' '.join(x for x in [(a.get('SITEADD') or '').strip(), (a.get('SCITY') or '').strip()] if x)
            if own: rec['own'] = own
            if addr: rec['addr'] = addr
            ac = a.get('GISACRES') or a.get('TAXACRES')
            if ac and ac > 0: rec['ac'] = round(ac, 3)
            if a.get('ZONING'): rec['zn'] = {'v': str(a['ZONING']).strip()}
            if a.get('TOTVAL') and a['TOTVAL'] > 0: rec['jv'] = a['TOTVAL']
    with lock:
        out.update(local); print(county, len(ids), len(local), layer, flush=True)
    return (county, len(ids), len(local), layer)
with ThreadPoolExecutor(6) as ex:
    for r in ex.map(do, sorted(by)): stats.append(r)
json.dump({'county': 'Mississippi (MARIS statewide parcels)', 'source': 'https://gis.mississippi.edu/server/rest/services/Cadastral/MS_West_Parcels/MapServer/0 and MS_East_Parcels', 'updated': datetime.date.today().isoformat(), 'p': out}, open(S + 'parcels/ms.json', 'w'), separators=(',', ':'))
tot = sum(s[1] for s in stats); hit = sum(s[2] for s in stats)
print('matched', hit, 'of', tot, 'in', len([s for s in stats if s[2]]), 'of', len(stats), 'counties')
