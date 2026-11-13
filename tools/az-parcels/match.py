"""Match Arizona listings (liens-pinal.js, liens-coconino.js) to official county parcel outlines for card thumbnails and maps.
Pinal: gis.pinal.gov TaxParcels (PARCELID = first 9 characters of the list's parcel number). Coconino: Coconino County GIS open data (APN = parcel number).
Exact ID matches only. Writes kinvest-liens/liens/states/parcels/az-<county>.json  Run: python3 tools/az-parcels/match.py"""
import json, os, time, urllib.request, urllib.parse, datetime
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')); S = ROOT + '/kinvest-liens/liens/states/'
UA = {'User-Agent': 'PricePocketAsset research (https://pricepocketasset.com)'}
SRC = {'pinal': ('https://gis.pinal.gov/mapping/rest/services/TaxParcels/FeatureServer/3/query', 'PARCELID', lambda p: p[:9], 'Pinal County GIS'),
       'larimer': ('https://maps1.larimer.org/arcgis/rest/services/MapServices/Parcels/MapServer/3/query', 'PARCELNUM', lambda p: p, 'Larimer County GIS'),
       'elpaso': ('https://gisservices.elpasoco.com/arcgis2/rest/services/HubPublic/Parcels/MapServer/0/query', 'PARCEL', lambda p: p.lstrip('R'), 'El Paso County GIS'),
       'boulder': ('https://maps.bouldercounty.org/arcgis/rest/services/PARCELS/PARCELS_OWNER/FeatureServer/0/query', 'AccountNo', lambda p: p, 'Boulder County GIS'),
       'saguache': (None, 'Account', lambda p: p, 'Saguache County GIS'),
       'coconino': ('https://services1.arcgis.com/Rlvx5g8pKeK13apH/arcgis/rest/services/Coconino_County_Parcels_Open_Data/FeatureServer/0/query', 'APN', lambda p: p, 'Coconino County GIS')}
def q(url, params):
    for a in range(4):
        try:
            d = json.loads(urllib.request.urlopen(urllib.request.Request(url, data=urllib.parse.urlencode(params).encode(), headers=UA), timeout=120).read())
            if 'error' in d: raise RuntimeError(d['error'])
            return d
        except Exception:
            if a == 3: raise
            time.sleep(4 * (a + 1))
import re
PM = open(S + 'liens-data.js').read()
import sys
only = sys.argv[1:]
for name, (url, fld, fmt, label) in SRC.items():
    if only and name not in only: continue
    if url is None: url = re.search(r"'Saguache': \{\n    query: '([^']+)'", PM).group(1)
    s = open(S + 'liens-%s.js' % name).read(); rows = json.loads(s[s.index('LIENS.push(...') + 14:s.rindex(');')])
    want = {}
    for r in rows: want.setdefault(fmt(r['parcel']), []).append(r['parcel'])
    out, keys = {}, sorted(want)
    for k in range(0, len(keys), 80):
        ch = keys[k:k + 80]
        d = q(url, {'where': fld + ' IN (' + ','.join("'%s'" % x.replace("'", "''") for x in ch) + ')', 'outFields': fld, 'returnGeometry': 'true', 'outSR': '4326', 'geometryPrecision': '6', 'f': 'json'})
        for ft in d.get('features', []):
            cid = (ft['attributes'].get(fld) or '').strip(); g = ft.get('geometry') or {}
            if cid not in want or not g.get('rings'): continue
            xs = [p[0] for r in g['rings'] for p in r]; ys = [p[1] for r in g['rings'] for p in r]
            for pid in want[cid]:
                o = out.setdefault(pid, {'st': 'matched', 'g': [], 'bb': [min(xs), min(ys), max(xs), max(ys)], 'cid': cid})
                o['g'] += [[[round(x, 6), round(y, 6)] for x, y in r] for r in g['rings']]
                b = o['bb']; o['bb'] = [min(b[0], min(xs)), min(b[1], min(ys)), max(b[2], max(xs)), max(b[3], max(ys))]
    json.dump({'county': label, 'source': url.rsplit('/query', 1)[0], 'updated': datetime.date.today().isoformat(), 'p': out}, open(S + 'parcels/%s-%s.json' % ('co' if name in ('larimer', 'saguache', 'elpaso', 'boulder') else 'az', name), 'w'), separators=(',', ':'))
    print(name, len(out), 'of', len(rows))
