"""Record, per parcel, which county aerial year covers it (newest first), so card previews can be drawn from the same source as the map.
We store ONLY the choice (year + check date), never the imagery itself: the county's terms do not clearly allow us to store or redistribute copies of its
imagery, so previews are drawn live from the county's own service. Re-run this when a county publishes a newer layer (add it to SOURCES first)
so older choices are refreshed to the newest year that covers each parcel.   python3 tools/fl-parcels/aerial_coverage.py [County]"""
import json, math, os, sys, urllib.request, urllib.parse, concurrent.futures as cf, datetime
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')); P = ROOT + '/kinvest-liens/liens/states/parcels/'
SOURCES = {'Palm Beach': [(2026, 'https://gis.pbcgov.org/image/rest/services/Aerialphotgraphy_2026_WebMercator/ImageServer'), (2025, 'https://gis.pbcgov.org/image/rest/services/Aerialphotography_2025_Webmercator/ImageServer')]}
def wm(lng, lat): return lng * 20037508.34 / 180, math.log(math.tan((90 + lat) * math.pi / 360)) / (math.pi / 180) * 20037508.34 / 180
def covered(url, x, y):
    q = url + '/identify?' + urllib.parse.urlencode({'geometry': '%f,%f' % (x, y), 'geometryType': 'esriGeometryPoint', 'returnGeometry': 'false', 'returnCatalogItems': 'false', 'f': 'json'})
    for _ in range(3):
        try:
            d = json.load(urllib.request.urlopen(q, timeout=30)); return d.get('value') not in (None, '', 'NoData')
        except Exception: pass
    return None   # could not check: leave the earlier choice alone
def run(county):
    path = P + county.lower().replace(' ', '-') + '.json'; d = json.load(open(path)); today = datetime.date.today().isoformat(); n = ch = 0
    def one(item):
        k, r = item
        if r.get('st') != 'matched' or not r.get('bb'): return k, None
        x, y = wm((r['bb'][0] + r['bb'][2]) / 2, (r['bb'][1] + r['bb'][3]) / 2)
        for year, url in SOURCES[county]:
            c = covered(url, x, y)
            if c is None: return k, 'keep'
            if c: return k, year
        return k, 0
    with cf.ThreadPoolExecutor(8) as ex: res = list(ex.map(one, d['p'].items()))
    for k, y in res:
        if y is None or y == 'keep': continue
        old = (d['p'][k].get('aer') or {}).get('y'); d['p'][k]['aer'] = {'y': y, 'ck': today}; n += 1; ch += (old != y)
    d['aerial'] = {'county': county, 'sources': [{'year': y, 'url': u} for y, u in SOURCES[county]], 'checked': today, 'stored_imagery': False}
    tmp = path + '.tmp'; json.dump(d, open(tmp, 'w'), separators=(',', ':')); os.replace(tmp, path); print(county, 'checked', n, 'changed', ch)
    import collections; print(collections.Counter((v.get('aer') or {}).get('y') for v in d['p'].values()))
for c in (sys.argv[1:] or SOURCES): run(c)
