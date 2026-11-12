"""Match Alabama state-held land (al-state-land-data.js) to official county parcel outlines, for map + satellite previews.
Jefferson County: jccgis.jccal.org BOE/JCParcelsWMS (PARCELID = ADOR id without the 2-digit county code, first 16 digits).
Montgomery County: gis.montgomeryal.gov Parcels (ParcelNo = same 16 digits formatted 'aa bb cc d eee fff.ggg').
Writes kinvest-liens/liens/states/parcels/al-<code>.json: {county, source, updated, p: {ADOR parcel: {st:'matched', g:[rings], bb:[...], cid}}}
Only exact parcel-ID matches are stored. Run: python3 tools/al-parcels/match.py"""
import json, os, sys, time, urllib.request, urllib.parse, datetime
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')); S = ROOT + '/kinvest-liens/liens/states/'
UA = {'User-Agent': 'PricePocketAsset research (https://pricepocketasset.com)'}
SRC = {'01': ('https://jccgis.jccal.org/server/rest/services/BOE/JCParcelsWMS/MapServer/0/query', 'PARCELID', lambda d: d),
       '68': ('https://jccgis.jccal.org/server/rest/services/BOE/JCParcelsWMS/MapServer/0/query', 'PARCELID', lambda d: d),
       '03': ('https://gis.montgomeryal.gov/server/rest/services/Parcels/MapServer/0/query', 'ParcelNo', lambda d: '%s %s %s %s %s %s.%s' % (d[0:2], d[2:4], d[4:6], d[6], d[7:10], d[10:13], d[13:16]))}
def ador_to_county(pid): return pid[2:18] if len(pid) >= 18 and pid[2:18].isdigit() else None
def q(url, params):
    for a in range(4):
        try:
            r = urllib.request.urlopen(urllib.request.Request(url, data=urllib.parse.urlencode(params).encode(), headers=UA), timeout=90); d = json.loads(r.read())
            if 'error' in d: raise RuntimeError(d['error'])
            return d
        except Exception as e:
            if a == 3: raise
            time.sleep(3 * (a + 1))
t = open(S + 'al-state-land-data.js').read(); i = t.index('const AL_STATE_LAND = ') + 22; data = json.JSONDecoder().raw_decode(t[i:])[0]
only = sys.argv[1:] or [c['co'] for c in data]
for c in data:
    if c['co'] not in only: continue
    url, fld, fmt = SRC[c['co']]
    want = {}
    for r in c['rows']:
        d = ador_to_county(r[4] or '')
        if d: want.setdefault(fmt(d), []).append(r[4])
    out, keys = {}, sorted(want)
    for k in range(0, len(keys), 80):
        chunk = keys[k:k + 80]; vals = []
        for v in chunk: vals += ["'%s'" % v, "' %s'" % v]
        d = q(url, {'where': fld + ' IN (' + ','.join(vals) + ')', 'outFields': fld, 'returnGeometry': 'true', 'outSR': '4326', 'geometryPrecision': '6', 'f': 'json'})
        for f in d.get('features', []):
            cid = (f['attributes'].get(fld) or '').strip(); g = f.get('geometry') or {}
            if cid not in want or not g.get('rings'): continue
            xs = [p[0] for r in g['rings'] for p in r]; ys = [p[1] for r in g['rings'] for p in r]
            for ador in want[cid]:
                o = out.setdefault(ador, {'st': 'matched', 'g': [], 'bb': [min(xs), min(ys), max(xs), max(ys)], 'cid': cid})
                o['g'] += [[[round(x, 6), round(y, 6)] for x, y in r] for r in g['rings']]
                b = o['bb']; o['bb'] = [min(b[0], min(xs)), min(b[1], min(ys)), max(b[2], max(xs)), max(b[3], max(ys))]
        print(c['co'], k + len(chunk), '/', len(keys), 'matched', len(out), flush=True)
    json.dump({'county': c['county'], 'source': url.rsplit('/query', 1)[0], 'updated': datetime.date.today().isoformat(), 'p': out},
              open(S + 'parcels/al-%s.json' % c['co'], 'w'), separators=(',', ':'))
    print(c['co'], 'done', len(out), 'of', len(c['rows']))
