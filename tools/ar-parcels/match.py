"""Match Arkansas COSL auction parcels (ar-cosl-data.js) to the official statewide parcel layer (Arkansas GIS Office, County Assessor Mapping Program).
Match = same county (FIPS) AND same parcel ID, exactly. Writes kinvest-liens/liens/states/parcels/ar.json: {p: {'County|parcel': {st, g, bb, cid}}}
Run: python3 tools/ar-parcels/match.py"""
import json, os, time, urllib.request, urllib.parse, datetime
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')); S = ROOT + '/kinvest-liens/liens/states/'
URL = 'https://gis.arkansas.gov/arcgis/rest/services/FEATURESERVICES/Planning_Cadastre/FeatureServer/6/query'
UA = {'User-Agent': 'PricePocketAsset research (https://pricepocketasset.com)'}
NAMES = ('Arkansas Ashley Baxter Benton Boone Bradley Calhoun Carroll Chicot Clark Clay Cleburne Cleveland Columbia Conway Craighead Crawford Crittenden Cross Dallas Desha Drew Faulkner Franklin Fulton Garland Grant Greene Hempstead Hot_Spring Howard Independence Izard Jackson Jefferson Johnson Lafayette Lawrence Lee Lincoln Little_River Logan Lonoke Madison Marion Miller Mississippi Monroe Montgomery Nevada Newton Ouachita Perry Phillips Pike Poinsett Polk Pope Prairie Pulaski Randolph St._Francis Saline Scott Searcy Sebastian Sevier Sharp Stone Union Van_Buren Washington White Woodruff Yell').split()
FIPS = {n.replace('_', ' ').replace('.', '').lower(): '%03d' % (2 * i + 1) for i, n in enumerate(NAMES)}
assert len(FIPS) == 75 and FIPS['yell'] == '149' and FIPS['pulaski'] == '119'
def q(params):
    for a in range(4):
        try:
            d = json.loads(urllib.request.urlopen(urllib.request.Request(URL, data=urllib.parse.urlencode(params).encode(), headers=UA), timeout=120).read())
            if 'error' in d: raise RuntimeError(d['error'])
            return d
        except Exception:
            if a == 3: raise
            time.sleep(4 * (a + 1))
t = open(S + 'ar-cosl-data.js').read(); i = t.index('const AR_COSL = ') + 16; rows = json.JSONDecoder().raw_decode(t[i:])[0]
by = {}
for r in rows: by.setdefault(r[0], set()).add(r[1])
out, miss = {}, []
for county, pids in sorted(by.items()):
    f = FIPS.get(county.replace('.', '').lower())
    if not f: miss.append(county); continue
    ids = sorted(pids)
    for k in range(0, len(ids), 80):
        ch = ids[k:k + 80]
        d = q({'where': "countyfips='%s' AND parcelid IN (%s)" % (f, ','.join("'%s'" % x.replace("'", "''") for x in ch)), 'outFields': 'parcelid', 'returnGeometry': 'true', 'outSR': '4326', 'geometryPrecision': '6', 'f': 'json'})
        for ft in d.get('features', []):
            pid = ft['attributes']['parcelid']; g = ft.get('geometry') or {}
            if pid not in pids or not g.get('rings'): continue
            xs = [p[0] for r in g['rings'] for p in r]; ys = [p[1] for r in g['rings'] for p in r]
            o = out.setdefault(county + '|' + pid, {'st': 'matched', 'g': [], 'bb': [min(xs), min(ys), max(xs), max(ys)], 'cid': pid})
            o['g'] += [[[round(x, 6), round(y, 6)] for x, y in r] for r in g['rings']]
            b = o['bb']; o['bb'] = [min(b[0], min(xs)), min(b[1], min(ys)), max(b[2], max(xs)), max(b[3], max(ys))]
    print(county, len([1 for k in out if k.startswith(county + '|')]), '/', len(ids), flush=True)
json.dump({'county': 'Arkansas (statewide)', 'source': URL.rsplit('/query', 1)[0], 'updated': datetime.date.today().isoformat(), 'p': out}, open(S + 'parcels/ar.json', 'w'), separators=(',', ':'))
print('done', len(out), 'of', len(rows), 'unknown counties', miss)
