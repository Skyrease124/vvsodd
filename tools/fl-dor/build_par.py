#!/usr/bin/env python3
"""Florida Department of Revenue 2026 parcel maps (Map Data > 2026F > 2026F PAR shapefiles) -> lot outlines for parcels in
kinvest-liens/liens/states/parcels/<county>.json that have no outline yet. Matched by PARCEL_ID (or the record's pid / ALT_KEY).
Outlines are reprojected from the county's State Plane system to WGS84 (pyproj) and rounded to 6 decimals.
Run: python3 tools/fl-dor/build_par.py <folder with <county>/*.shp>   (needs: pip install pyshp pyproj)
"""
import glob, json, os, re, sys
import shapefile, pyproj
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PD = os.path.join(ROOT, 'kinvest-liens', 'liens', 'states', 'parcels')
SLUG = {'santarosa': 'santa-rosa', 'volusia': 'volusia', 'walton': 'walton', 'alachua': 'alachua', 'escambia': 'escambia', 'miamidade': 'miami-dade'}
URL = 'https://floridarevenue.com/property/dataportal/Pages/default.aspx?path=/property/dataportal/Documents/PTO%20Data%20Portal/Map%20Data/2026F/2026F%20PAR'
norm = lambda x: re.sub(r'[^0-9A-Z]', '', str(x or '').upper())


def area_ft(ring):
    return abs(sum(ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1] for i in range(len(ring) - 1))) / 2


if __name__ == '__main__':
    src = sys.argv[1]; tot = 0
    for d0, slug in SLUG.items():
        shp = glob.glob(os.path.join(src, d0, '**', '*.shp'), recursive=True)
        if not shp: continue
        path = os.path.join(PD, slug + '.json'); data = json.load(open(path))
        need = {}
        for k, v in data['p'].items():
            if v.get('g'): continue
            for c in (k, v.get('pid'), (v.get('rl') or {}).get('alt')):
                if c: need.setdefault(norm(c), k)
        if not need: continue
        rd = shapefile.Reader(shp[0]); prj = open(shp[0][:-4] + '.prj').read()
        tr = pyproj.Transformer.from_crs(pyproj.CRS.from_wkt(prj), 'EPSG:4326', always_xy=True)
        names = [f[0] for f in rd.fields[1:]]; ip = names.index(next(n for n in ('PARCEL_ID', 'FOLIO', 'PID') if n in names)); ia = names.index('ALT_KEY') if 'ALT_KEY' in names else None
        unit = 1.0 if 'Feet' in prj or 'foot' in prj.lower() else 10.7639
        got = 0
        for i in range(rd.numRecords):
            try: sr = rd.shapeRecord(i)
            except Exception: continue
            rec = sr.record; k = need.get(norm(rec[ip])) or (need.get(norm(rec[ia])) if ia is not None else None)
            if not k or data['p'][k].get('g') or not sr.shape.points or sr.shape.shapeType not in (5, 15, 25): continue
            parts = list(sr.shape.parts) + [len(sr.shape.points)]
            rings = [sr.shape.points[parts[i]:parts[i + 1]] for i in range(len(parts) - 1)]
            outer = max(rings, key=area_ft)
            ll = [[round(x, 6), round(y, 6)] for x, y in (tr.transform(p[0], p[1]) for p in outer)]
            if len(ll) < 4: continue
            xs, ys = [p[0] for p in ll], [p[1] for p in ll]
            r = data['p'][k]; rl = r.get('rl') or {}
            sq = round(sum(area_ft(x) for x in rings[:1] if x is outer) * unit) or rl.get('sqft')
            r.update({'g': [ll], 'bb': [min(xs), min(ys), max(xs), max(ys)], 'gsrc': 'dor-par', 'st': 'matched', 'pid': r.get('pid') or rec[ip]})
            if not r.get('sqft'): r['sqft'] = int(area_ft(outer) * unit); r['ac'] = round(r['sqft'] / 43560, 3); r['aEst'] = True
            for a, b in (('own', 'own'), ('addr', 'site'), ('jv', 'jv'), ('uc', 'uc')):
                if not r.get(a) and rl.get(b): r[a] = rl[b]
            r.setdefault('yr', 2026); r.setdefault('ck', '2026-11-17')
            got += 1
        data.setdefault('sources', {})['outlines2'] = {'name': 'Florida Department of Revenue 2026 parcel maps (PAR)', 'url': URL}
        json.dump(data, open(path, 'w'), separators=(',', ':'))
        tot += got; print('%-11s outlines added %4d of %4d without one' % (slug, got, len(set(need.values()))))
    print('total added', tot)
