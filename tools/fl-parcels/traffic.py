"""Nearby Traffic: match each matched Florida parcel outline to measured FDOT road segments (AADT) and store one 'featured' segment per parcel.

Source: FDOT Annual Average Daily Traffic (SECTADT), free public FeatureServer:
  https://services1.arcgis.com/O1JpcwDW8sjYuddV/ArcGIS/rest/services/Annual_Average_Daily_Traffic_TDA/FeatureServer/0
Rule (used identically by the card, the filter and the map highlight, because they all read this one stored segment):
  * Candidates are segments with a measured AADT > 0 within 1,500 ft of the lot outline (distance is lot boundary to road line; 0 = touching).
  * Featured segment = the highest-AADT candidate within 500 ft; if none is within 500 ft, the nearest candidate (shown, but it does not pass the 500 ft filter).
  * No candidate at all -> 'Traffic data unavailable'.
Resumable: python3 tools/fl-parcels/traffic.py [County ...] [--refresh]"""
import json, math, os, sys, datetime, concurrent.futures as cf
sys.path.insert(0, os.path.dirname(__file__))
from net import fetch
from shapely.geometry import Polygon, LineString, MultiPolygon
from shapely.ops import unary_union
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')); P = ROOT + '/kinvest-liens/liens/states/parcels/'
FDOT = 'https://services1.arcgis.com/O1JpcwDW8sjYuddV/ArcGIS/rest/services/Annual_Average_Daily_Traffic_TDA/FeatureServer/0'
FT = 3.28084; NEAR_FT = 500; SEARCH_FT = 1500
SRC = {'name': 'FDOT Annual Average Daily Traffic (SECTADT)', 'url': 'https://services1.arcgis.com/O1JpcwDW8sjYuddV/ArcGIS/rest/services/Annual_Average_Daily_Traffic_TDA/FeatureServer/0', 'note': 'AADT is an estimate of vehicles per day on that road segment for the count year.'}

def local(lng0, lat0):
    k = math.cos(math.radians(lat0)); return lambda x, y: ((x - lng0) * k * 111320.0, (y - lat0) * 110574.0)

def nearby(rec, tries=3):
    rings = rec['g']; xs = [p[0] for r in rings for p in r]; ys = [p[1] for r in rings for p in r]
    lng0, lat0 = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2; f = local(lng0, lat0)
    pad_m = SEARCH_FT / FT; dlat = pad_m / 110574.0; dlng = pad_m / (111320.0 * math.cos(math.radians(lat0)))
    env = '%f,%f,%f,%f' % (min(xs) - dlng, min(ys) - dlat, max(xs) + dlng, max(ys) + dlat)
    d = fetch(FDOT + '/query', {'where': 'AADT > 0', 'geometry': env, 'geometryType': 'esriGeometryEnvelope', 'inSR': '4326', 'spatialRel': 'esriSpatialRelIntersects', 'outFields': 'COSITE,ROADWAY,DESC_FRM,DESC_TO,AADT,YEAR_,BEGIN_POST,AADTFLG,COUNTY',
                              'returnGeometry': 'true', 'outSR': '4326', 'f': 'json'}, timeout=60)
    poly = unary_union([Polygon([f(*p) for p in r]).buffer(0) for r in rings])
    cands = []
    for ft in d.get('features', []):
        a = ft['attributes']; paths = (ft.get('geometry') or {}).get('paths') or []
        if not paths or not a.get('AADT'): continue
        line = unary_union([LineString([f(*p) for p in pa]) for pa in paths if len(pa) > 1])
        dist = poly.distance(line) * FT
        if dist <= SEARCH_FT: cands.append((dist, a, paths, line))
    return cands, f, poly

def thin(paths, f, poly, lng0, lat0, keep_ft=2000):
    """The part of the road line within 2,000 ft of the lot (clipped, not just vertex-filtered), simplified, as [[lng, lat], ...] lists for the map highlight."""
    k = math.cos(math.radians(lat0)); inv = lambda x, y: (x / (k * 111320.0) + lng0, y / 110574.0 + lat0)
    line = unary_union([LineString([f(*p) for p in pa]) for pa in paths if len(pa) > 1])
    clip = line.intersection(poly.buffer(keep_ft / FT)); clip = clip if not clip.is_empty else line
    geoms = list(clip.geoms) if hasattr(clip, 'geoms') else [clip]
    out = []
    for g in geoms:
        if g.geom_type != 'LineString': continue
        g = g.simplify(1.0)   # 1 metre
        out.append([[round(x, 6), round(y, 6)] for x, y in (inv(*c) for c in g.coords)])
    return out

def segment_for(rec):
    cands, f, poly = nearby(rec)
    xs = [p[0] for r in rec['g'] for p in r]; ys = [p[1] for r in rec['g'] for p in r]; lng0, lat0 = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    if not cands: return {'none': 1}
    near = [c for c in cands if c[0] <= NEAR_FT]
    pick = max(near, key=lambda c: (c[1]['AADT'], -c[0])) if near else min(cands, key=lambda c: c[0])
    dist, a, paths, _ = pick
    return {'id': '%s:%s:%s' % (a['COSITE'], a['ROADWAY'], a['BEGIN_POST']), 'road': str(a['ROADWAY']), 'from': (a.get('DESC_FRM') or '').strip(), 'to': (a.get('DESC_TO') or '').strip(), 'aadt': int(a['AADT']), 'yr': int(a['YEAR_']),
            'ft': int(round(dist)), 'n': len(near), 'geo': thin(paths, f, poly, lng0, lat0)}

def run(county, refresh=False):
    path = P + county.lower().replace(' ', '-') + '.json'; d = json.load(open(path)); today = datetime.date.today().isoformat()
    todo = [(k, r) for k, r in d['p'].items() if r.get('st') == 'matched' and r.get('g') and (refresh or not (r.get('tr') or {}).get('ck'))]
    def one(item):
        k, r = item
        try: t = segment_for(r); t['ck'] = today; return k, t
        except Exception as e: return k, None
    done = 0
    with cf.ThreadPoolExecutor(6) as ex:
        for k, t in ex.map(one, todo):
            if t is not None: d['p'][k]['tr'] = t; done += 1
    d['sources']['traffic'] = dict(SRC, date=today)
    tmp = path + '.tmp'
    with open(tmp, 'w') as fh: json.dump(d, fh, separators=(',', ':'))
    os.replace(tmp, path)
    ps = [r['tr'] for r in d['p'].values() if r.get('tr')]
    print('%-13s polygons %4d  stored %4d  with segment %4d  within 500 ft %4d  10,000+ and within 500 ft %4d  failed %d' % (county, len(todo), done, sum(1 for t in ps if not t.get('none')), sum(1 for t in ps if t.get('ft', 9e9) <= NEAR_FT), sum(1 for t in ps if t.get('ft', 9e9) <= NEAR_FT and t.get('aadt', 0) >= 10000), len(todo) - done))

if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]; ref = '--refresh' in sys.argv
    allc = sorted(os.path.basename(f)[:-5].replace('-', ' ').title().replace('Miami Dade', 'Miami-Dade') for f in os.listdir(P) if f.endswith('.json'))
    for c in (args or allc): run(c, ref)
