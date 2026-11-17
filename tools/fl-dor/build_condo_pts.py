#!/usr/bin/env python3
"""Miami-Dade condo units have no lot outline; the DOR 2026 condo layer (miamidade_condos_2026.shp, points) gives each unit's building location.
Adds "pt": [lng, lat] to Miami-Dade parcels without an outline. Run: python3 tools/fl-dor/build_condo_pts.py <miamidade_condos_2026.shp>"""
import json, os, re, sys, shapefile, pyproj
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
path = os.path.join(ROOT, 'kinvest-liens', 'liens', 'states', 'parcels', 'miami-dade.json')
norm = lambda x: re.sub(r'[^0-9A-Z]', '', str(x or '').upper())
d = json.load(open(path)); need = {norm(k): k for k, v in d['p'].items() if not v.get('g')}
r = shapefile.Reader(sys.argv[1]); tr = pyproj.Transformer.from_crs(pyproj.CRS.from_wkt(open(sys.argv[1][:-4] + '.prj').read()), 'EPSG:4326', always_xy=True)
fi = [f[0] for f in r.fields[1:]].index('FOLIO'); n = 0
for i in range(r.numRecords):
    rec = r.record(i); k = need.get(norm(rec[fi]))
    if not k or 'pt' in d['p'][k]: continue
    s = r.shape(i)
    if not s.points: continue
    x, y = tr.transform(*s.points[0]); v = d['p'][k]; rl = v.get('rl') or {}
    v['pt'] = [round(x, 6), round(y, 6)]
    for a, b in (('own', 'own'), ('addr', 'site'), ('jv', 'jv'), ('uc', 'uc')):
        if not v.get(a) and rl.get(b): v[a] = rl[b]
    n += 1
d['sources']['condos'] = {'name': 'Florida Department of Revenue 2026 Miami-Dade condo map', 'url': 'https://floridarevenue.com/property/dataportal/'}
json.dump(d, open(path, 'w'), separators=(',', ':')); print('condo pins', n, 'of', len(need))
