#!/usr/bin/env python3
"""Florida parcel backfill for PricePocketAsset.

Matches every Florida listing (county + parcel ID) to the official statewide parcel roll, then adds
property facts, flood / wetland overlap, mapped road frontage, zoning (where we have a verified layer)
and an aerial thumbnail with the parcel outline.

Resumable and idempotent: results are keyed by "county|original parcel ID", so a rerun updates the same
record and the same image file, never a duplicate. Run it again after importing new county lists.

  python3 tools/fl-parcels/backfill.py                # process anything new or incomplete
  python3 tools/fl-parcels/backfill.py --refresh      # redo everything
  python3 tools/fl-parcels/backfill.py --county Leon  # one county only

Outputs (served by the site):
  kinvest-liens/liens/states/parcels/<county-slug>.json
  kinvest-liens/liens/states/parcels/img/<county-slug>/<id>.webp
  tools/fl-parcels/report.md, report.json, review.csv
"""
import argparse, concurrent.futures as cf, datetime, hashlib, io, json, math, os, re, subprocess, sys, threading, time
from net import fetch
from shapely.geometry import Polygon, MultiPolygon, LineString, shape, mapping
from shapely.ops import unary_union, transform
from shapely import clip_by_rect, box as sbox
from PIL import Image, ImageDraw, ImageStat

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '../..'))
OUT = os.path.join(ROOT, 'kinvest-liens/liens/states/parcels')
WORK = os.path.join(HERE, 'work')
TODAY = datetime.date.today().isoformat()

STATEWIDE = 'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query'
STATEWIDE_ITEM = 'efa909d6b1c841d298b0a649e7f71cf2'
FEMA = 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query'
NWI = 'https://fwspublicservices.wim.usgs.gov/wetlandsmapservice/rest/services/Wetlands/MapServer/0/query'
TIGER = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Transportation/MapServer/%d/query'
TIGER_LAYERS = [2, 6, 8]  # primary, secondary (most detailed), local roads
NAIP = 'https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPPlus/ImageServer'

# Florida Department of Revenue county numbers (used by the statewide roll).
CO_NO = {n: i + 11 for i, n in enumerate(['Alachua', 'Baker', 'Bay', 'Bradford', 'Brevard', 'Broward', 'Calhoun', 'Charlotte', 'Citrus', 'Clay', 'Collier', 'Columbia', 'Miami-Dade', 'DeSoto', 'Dixie', 'Duval', 'Escambia', 'Flagler', 'Franklin', 'Gadsden', 'Gilchrist', 'Glades', 'Gulf', 'Hamilton', 'Hardee', 'Hendry', 'Hernando', 'Highlands', 'Hillsborough', 'Holmes', 'Indian River', 'Jackson', 'Jefferson', 'Lafayette', 'Lake', 'Lee', 'Leon', 'Levy', 'Liberty', 'Madison', 'Manatee', 'Marion', 'Martin', 'Monroe', 'Nassau', 'Okaloosa', 'Okeechobee', 'Orange', 'Osceola', 'Palm Beach', 'Pasco', 'Pinellas', 'Polk', 'Putnam', 'St. Johns', 'St. Lucie', 'Santa Rosa', 'Sarasota', 'Seminole', 'Sumter', 'Suwannee', 'Taylor', 'Union', 'Volusia', 'Wakulla', 'Walton', 'Washington'])}

nodash = lambda p: p.replace('-', '')
# How each county's list IDs map to the statewide roll. field = statewide column to match; norm = the county's own format.
# Leading zeros and inner spacing are kept exactly; only the separators the county drops are removed.
ID_RULES = {
    'Alachua': ('PARCEL_ID', lambda p: p), 'Bay': ('PARCEL_ID', nodash), 'Duval': ('PARCEL_ID', lambda p: nodash(p) + 'R'),
 'Hernando': ('PARCEL_ID', lambda p: p.replace('-', ' ')),
    'Leon': ('PARCEL_ID', lambda p: p), 'Manatee': ('PARCEL_ID', lambda p: p), 'Miami-Dade': ('PARCEL_ID', nodash), 'Nassau': ('PARCEL_ID', nodash),
    'Osceola': ('PARCEL_ID', lambda p: re.sub(r'^R', '', p).replace('-', '')), 'Palm Beach': ('PARCEL_ID', nodash), 'Pasco': ('PARCEL_ID', lambda p: p),
    'Santa Rosa': ('PARCEL_ID', lambda p: p), 'Sarasota': ('PARCEL_ID', lambda p: p), 'Volusia': ('PARCEL_ID', lambda p: p), 'Walton': ('PARCEL_ID', nodash),
}
DEFAULT_RULE = ('PARCEL_ID', lambda p: p)
# Counties whose list IDs are the county's own account number: look the ID up in the county's parcel service
# first, then use the statewide parcel ID it reports. (The statewide ALT_KEY column holds these numbers but cannot be queried.)
XWALK = {
    'Escambia': ('https://gismaps.myescambia.com/arcgis/rest/services/Escambia_County/MapServer/0/query', 'CONTROLNO', nodash, 'REFERENCE'),
    'Hillsborough': ('https://gis.hcpafl.org/arcgis/rest/services/Webmaps/HillsboroughFL_WebParcels/MapServer/0/query', 'folio', lambda p: p[1:], 'strap'),
}
def crosswalk(county, parcels):
    url, f, fmt, out = XWALK[county]; res = {}
    keys = {p: fmt(p) for p in parcels}
    vals = sorted(set(keys.values()))
    for i in range(0, len(vals), 40):
        w = f + ' IN (' + ','.join("'" + v.replace("'", "''") + "'" for v in vals[i:i + 40]) + ')'
        d = fetch(url, {'where': w, 'outFields': f + ',' + out, 'returnGeometry': 'false', 'f': 'json'}, timeout=90)
        for x in d.get('features', []):
            a = x['attributes']; res.setdefault(a[f], set()).add((a.get(out) or '').strip())
    return {p: res.get(k, set()) for p, k in keys.items()}
# Loose variants, tried only when the county rule finds nothing. A hit here is flagged for review, never shown as verified.
LOOSE = lambda p: {p, nodash(p), p.replace(' ', ''), re.sub(r'[^A-Za-z0-9]', '', p)}

# Zoning layers we have checked against the jurisdiction (others are reported as unavailable).
ZONING = {
    'Leon': {'url': 'https://intervector.leoncountyfl.gov/intervector/rest/services/MapServices/TLC_OverlayZoning_D_WM/MapServer/0/query', 'field': 'ZONING', 'name': 'Tallahassee-Leon County zoning map', 'page': 'https://www.talgov.com/place/pln-zoning'},
    'Manatee': {'url': 'https://www.mymanatee.org/gisits/rest/services/opendata/General/FeatureServer/0/query', 'field': 'ZONING', 'name': 'Manatee County parcel map (zoning field)', 'page': 'https://www.mymanatee.org/'},
}

# Florida DOR land use codes (Rule 12D-8.008, F.A.C.), first two digits.
DOR_UC = {0: 'Vacant residential', 1: 'Single family', 2: 'Mobile home', 3: 'Multi-family (10+ units)', 4: 'Condominium', 5: 'Cooperative', 6: 'Retirement home', 7: 'Miscellaneous residential', 8: 'Multi-family (under 10 units)', 9: 'Residential common area', 10: 'Vacant commercial', 11: 'Store, one story', 12: 'Mixed use (store/office/residential)', 13: 'Department store', 14: 'Supermarket', 15: 'Regional shopping center', 16: 'Community shopping center', 17: 'Office, one story', 18: 'Office, multi-story', 19: 'Professional service building', 20: 'Airport, terminal or marina', 21: 'Restaurant', 22: 'Drive-in restaurant', 23: 'Financial institution', 24: 'Insurance office', 25: 'Repair service shop', 26: 'Service station', 27: 'Auto sales or repair', 28: 'Parking lot or mobile home park', 29: 'Wholesale outlet', 30: 'Florist or greenhouse', 31: 'Drive-in theater', 32: 'Enclosed theater or auditorium', 33: 'Nightclub or bar', 34: 'Bowling alley, rink or arena', 35: 'Tourist attraction', 36: 'Camp', 37: 'Race track', 38: 'Golf course', 39: 'Hotel or motel', 40: 'Vacant industrial', 41: 'Light manufacturing', 42: 'Heavy industrial', 43: 'Lumber yard', 44: 'Packing plant', 45: 'Cannery or brewery', 46: 'Other food processing', 47: 'Mineral processing', 48: 'Warehouse or distribution', 49: 'Open storage', 50: 'Improved agricultural', 51: 'Cropland', 52: 'Cropland', 53: 'Cropland', 54: 'Timberland', 55: 'Timberland', 56: 'Timberland', 57: 'Timberland', 58: 'Timberland', 59: 'Timberland', 60: 'Grazing land', 61: 'Grazing land', 62: 'Grazing land', 63: 'Grazing land', 64: 'Grazing land', 65: 'Grazing land', 66: 'Orchard or grove', 67: 'Poultry, bees or fish', 68: 'Dairy or feed lot', 69: 'Ornamentals', 70: 'Vacant institutional', 71: 'Church', 72: 'Private school or college', 73: 'Private hospital', 74: 'Home for the aged', 75: 'Non-profit or charitable', 76: 'Mortuary or cemetery', 77: 'Club or lodge', 78: 'Rest home', 79: 'Cultural organization', 80: 'Undefined (reserved)', 81: 'Military', 82: 'Forest, park or recreation', 83: 'Public school', 84: 'College', 85: 'Hospital', 86: 'County-owned', 87: 'State-owned', 88: 'Federal', 89: 'Municipal', 90: 'Leasehold interest', 91: 'Utility', 92: 'Mining or petroleum', 93: 'Subsurface rights', 94: 'Right-of-way', 95: 'Rivers, lakes or submerged land', 96: 'Sewage, waste or borrow pit', 97: 'Outdoor recreation or parkland', 98: 'Centrally assessed', 99: 'Acreage not zoned agricultural'}

slug = lambda c: re.sub(r'[^a-z0-9]+', '-', c.lower()).strip('-')
def img_name(parcel):
    safe = re.sub(r'[^A-Za-z0-9]+', '_', parcel).strip('_')[:60]
    return safe + '-' + hashlib.sha1(parcel.encode()).hexdigest()[:6] + '.webp'

# ---------- geometry helpers ----------
def rings_to_geom(rings):
    polys = [Polygon(r) for r in rings if len(r) >= 4]
    polys = [p if p.is_valid else p.buffer(0) for p in polys]
    polys.sort(key=lambda p: -p.area)
    g = None
    for p in polys:
        if g is None: g = p
        elif g.contains(p): g = g.difference(p)
        else: g = g.union(p)
    return g
def rings_to_geom_clipped(rings, bounds, pad=0.0005):
    # Flood and wetland shapes can be huge; keep only the part around the lot before assembling holes.
    x0, y0, x1, y1 = bounds; bx = (x0 - pad, y0 - pad, x1 + pad, y1 + pad); B = sbox(*bx)
    parts = []
    for r in rings:
        if len(r) < 4: continue
        xs = [q[0] for q in r]; ys = [q[1] for q in r]
        if max(xs) < bx[0] or min(xs) > bx[2] or max(ys) < bx[1] or min(ys) > bx[3]: continue
        p = Polygon(r)
        if not p.is_valid: p = p.buffer(0)
        c = clip_by_rect(p, *bx)
        if not c.is_empty: parts.append((p.area, c, p.contains(B)))
    if not parts: return None
    parts.sort(key=lambda t: -t[0])
    g = None
    for _, c, _ in parts:
        if g is None: g = c
        elif g.contains(c) or g.buffer(1e-9).contains(c): g = g.difference(c)
        else: g = g.union(c)
    return g

def local(lat0, lon0):
    k = math.cos(math.radians(lat0))
    return lambda x, y, z=None: ((x - lon0) * 111320 * k, (y - lat0) * 110574)
def esri_rings(g):
    out = []
    for p in (g.geoms if isinstance(g, MultiPolygon) else [g]):
        out.append([[round(x, 6), round(y, 6)] for x, y in p.exterior.coords])
        for h in p.interiors: out.append([[round(x, 6), round(y, 6)] for x, y in h.coords])
    return out
def merc(lon, lat):
    return lon * 20037508.34 / 180, math.log(math.tan((90 + lat) * math.pi / 360)) * 20037508.34 / math.pi

def poly_params(g):
    return {'geometry': json.dumps({'rings': esri_rings(g.simplify(0.000002)), 'spatialReference': {'wkid': 4326}}), 'geometryType': 'esriGeometryPolygon', 'inSR': '4326', 'spatialRel': 'esriSpatialRelIntersects', 'outSR': '4326', 'f': 'json'}

def overlap(g, feats, attr, P):
    """Percent of the parcel area covered by each value of `attr` in the returned polygons."""
    gp = transform(P, g); A = gp.area or 1; res = {}
    for f in feats:
        rings = (f.get('geometry') or {}).get('rings')
        if not rings: continue
        z = rings_to_geom_clipped(rings, g.bounds)
        if z is None or z.is_empty: continue
        inter = gp.intersection(transform(P, z)).area
        if inter > 0: res[f['attributes'].get(attr) or '?'] = res.get(f['attributes'].get(attr) or '?', 0) + inter
    return {k: round(100 * v / A, 1) for k, v in res.items()}

# ---------- steps ----------
FIELDS = 'PARCEL_ID,ALT_KEY,ASMNT_YR,DOR_UC,JV,AV_SD,LND_SQFOOT,OWN_NAME,PHY_ADDR1,PHY_ADDR2,PHY_CITY,PHY_ZIPCD,S_LEGAL'
def lookup(county, ids, field):
    """Batch query the statewide roll; returns {id: [features]}."""
    co = CO_NO[county]; found = {}
    for i in range(0, len(ids), 40):
        chunk = ids[i:i + 40]
        w = "CO_NO=%d AND %s IN (%s)" % (co, field, ','.join("'" + c.replace("'", "''") + "'" for c in chunk))
        d = fetch(STATEWIDE, {'where': w, 'outFields': FIELDS, 'returnGeometry': 'true', 'outSR': '4326', 'geometryPrecision': 7, 'f': 'json'}, timeout=120)
        for f in d.get('features', []): found.setdefault(f['attributes'][field], []).append(f)
    return found

def facts(attrs, g, P):
    a = attrs; sq = a.get('LND_SQFOOT') or 0
    est = not (sq and sq > 0)
    if est: sq = transform(P, g).area * 10.7639
    uc = a.get('DOR_UC'); ucn = int(str(uc)[:-1]) if uc and str(uc).isdigit() and len(str(uc)) == 3 else (int(uc) if uc and str(uc).isdigit() else None)
    addr = ' '.join(x for x in [(a.get('PHY_ADDR1') or '').strip(), (a.get('PHY_ADDR2') or '').strip()] if x)
    city = ' '.join(x for x in [(a.get('PHY_CITY') or '').strip(), str(a.get('PHY_ZIPCD') or '').strip()] if x and x != '0')
    own = (a.get('OWN_NAME') or '').strip()
    return {'own': own, 'addr': (addr + (', ' + city if city and addr else '')) if addr else '', 'sqft': round(sq), 'ac': round(sq / 43560, 4), 'aEst': est,
            'uc': str(uc or ''), 'use': DOR_UC.get(ucn, '') if ucn is not None else '', 'jv': a.get('JV'), 'av': a.get('AV_SD'), 'yr': a.get('ASMNT_YR'), 'legal': (a.get('S_LEGAL') or '').strip()}

def flood(g, P):
    # 1) which zones touch the lot (small reply); 2) only if more than one, fetch shapes to measure the split.
    try:
        d = fetch(FEMA, {**poly_params(g), 'outFields': 'FLD_ZONE,SFHA_TF', 'returnGeometry': 'false'}, timeout=60, tries=3)
    except Exception: return {'s': 'na'}
    feats = d.get('features', [])
    if not feats: return {'s': 'na', 'why': 'No digital FEMA flood map covers this lot.'}
    sf = {}
    for f in feats: sf[f['attributes'].get('FLD_ZONE')] = sf.get(f['attributes'].get('FLD_ZONE')) or f['attributes'].get('SFHA_TF') == 'T'
    if len(sf) == 1:
        z, h = next(iter(sf.items())); return {'s': 'ok', 'z': [[z, 100.0, 1 if h else 0]], 'sfha': 100.0 if h else 0.0}
    try:
        d = fetch(FEMA, {**poly_params(g), 'outFields': 'FLD_ZONE,SFHA_TF', 'maxAllowableOffset': '0.00001'}, timeout=90, tries=3)
    except Exception: return {'s': 'na'}
    z = overlap(g, d.get('features', []), 'FLD_ZONE', P)
    zones = sorted([[k, v, 1 if sf.get(k) else 0] for k, v in z.items()], key=lambda r: -r[1])
    if not zones: return {'s': 'na'}
    return {'s': 'ok', 'z': zones, 'sfha': round(sum(r[1] for r in zones if r[2]), 1)}

def wetlands(g, P):
    try:
        d = fetch(NWI, {**poly_params(g), 'outFields': 'WETLAND_TYPE', 'maxAllowableOffset': '0.00001'}, timeout=60, tries=3)
    except Exception: return {'s': 'na'}
    feats = d.get('features', [])
    if not feats: return {'s': 'none', 'pct': 0}
    z = overlap(g, feats, 'WETLAND_TYPE', P)
    if not z: return {'s': 'none', 'pct': 0}
    return {'s': 'ok', 'pct': round(min(100, sum(z.values())), 1), 't': sorted(z, key=lambda k: -z[k])}

def roads(g, P):
    lines, names, err = [], set(), 0
    for lid in TIGER_LAYERS:
        try:
            d = fetch(TIGER % lid, {**poly_params(g), 'distance': '20', 'units': 'esriSRUnit_Meter', 'outFields': 'NAME'}, timeout=60, tries=3)
        except Exception: err += 1; continue
        for f in d.get('features', []):
            for p in (f.get('geometry') or {}).get('paths', []):
                if len(p) >= 2: lines.append(transform(P, LineString(p))); names.add((f['attributes'].get('NAME') or '').strip())
    if err == len(TIGER_LAYERS): return {'s': 'na'}
    if not lines: return {'s': 'none'}
    edge = transform(P, g).boundary
    ft = edge.intersection(unary_union([l.buffer(15) for l in lines])).length * 3.28084
    return {'s': 'ok', 'ft': round(ft), 'n': sorted(n for n in names if n)[:3]}

def zoning(county, g):
    z = ZONING.get(county)
    if not z: return {'s': 'na'}
    pt = g.representative_point()
    try:
        d = fetch(z['url'], {'geometry': '%f,%f' % (pt.x, pt.y), 'geometryType': 'esriGeometryPoint', 'inSR': '4326', 'spatialRel': 'esriSpatialRelIntersects', 'outFields': z['field'], 'returnGeometry': 'false', 'f': 'json'}, timeout=90)
    except Exception: return {'s': 'na'}
    v = [(f['attributes'].get(z['field']) or '').strip() for f in d.get('features', [])]
    v = [x for x in v if x]
    return {'s': 'ok', 'v': v[0]} if v else {'s': 'na', 'why': 'Outside the mapped zoning area (may be another jurisdiction).'}

W, H = 480, 320
def thumb(county, parcel, g):
    """Aerial (USGS NAIP Plus, public domain) framed on the lot with its outline drawn in gold. Returns img dict."""
    xs, ys = zip(*[merc(x, y) for x, y in (g.envelope.exterior.coords if g.area else g.buffer(0.0001).envelope.exterior.coords)])
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    lat = math.degrees(math.atan(math.sinh(cy / 6378137)))
    k = 1 / math.cos(math.radians(lat))  # mercator meters per ground meter
    w = max((max(xs) - min(xs)) * 2.2, (max(ys) - min(ys)) * 2.2 * 1.5, 90 * k)
    h = w / 1.5
    bb = (cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)
    env = json.dumps({'xmin': bb[0], 'ymin': bb[1], 'xmax': bb[2], 'ymax': bb[3], 'spatialReference': {'wkid': 3857}})
    try:
        cat = fetch(NAIP + '/query', {'geometry': env, 'geometryType': 'esriGeometryEnvelope', 'inSR': '3857', 'spatialRel': 'esriSpatialRelIntersects', 'where': 'Category=1', 'outFields': 'OBJECTID,Year,acquisition_date', 'returnGeometry': 'false', 'f': 'json'}, timeout=90)
        items = [f['attributes'] for f in cat.get('features', []) if f['attributes'].get('acquisition_date')]
        if not items: return {'s': 'map', 'why': 'No aerial covers this lot.'}
        yr = max(i['Year'] for i in items); use = [i for i in items if i['Year'] == yr]
        acq = max(i['acquisition_date'] for i in use)
        rule = json.dumps({'mosaicMethod': 'esriMosaicLockRaster', 'lockRasterIds': [i['OBJECTID'] for i in use]})
        raw = fetch(NAIP + '/exportImage', {'bbox': ','.join('%.2f' % v for v in bb), 'bboxSR': '3857', 'imageSR': '3857', 'size': '%d,%d' % (W * 2, H * 2), 'format': 'jpg', 'compressionQuality': '85', 'mosaicRule': rule, 'bandIds': '0,1,2', 'f': 'image'}, timeout=120, raw=True)
        im = Image.open(io.BytesIO(raw)).convert('RGB')
    except Exception as e:
        return {'s': 'map', 'why': 'Aerial request failed.'}
    st = ImageStat.Stat(im)
    if max(st.stddev) < 6: return {'s': 'map', 'why': 'Aerial had no usable picture here.'}
    # outline: same parcel geometry the map uses, projected into the image frame
    dr = ImageDraw.Draw(im)
    for p in (g.geoms if isinstance(g, MultiPolygon) else [g]):
        for ring in [p.exterior] + list(p.interiors):
            pts = [((merc(x, y)[0] - bb[0]) / (bb[2] - bb[0]) * W * 2, (bb[3] - merc(x, y)[1]) / (bb[3] - bb[1]) * H * 2) for x, y in ring.coords]
            dr.line(pts, fill=(10, 14, 28), width=9, joint='curve')
            dr.line(pts, fill=(255, 209, 102), width=5, joint='curve')
    im = im.resize((W, H), Image.LANCZOS)
    d = os.path.join(OUT, 'img', slug(county)); os.makedirs(d, exist_ok=True)
    name = img_name(parcel)
    im.save(os.path.join(d, name), 'WEBP', quality=52, method=6)
    return {'s': 'aerial', 'f': slug(county) + '/' + name, 'd': datetime.datetime.utcfromtimestamp(acq / 1000).date().isoformat(), 'yr': yr}

def enrich(county, parcel, feat):
    g = rings_to_geom(feat['geometry']['rings'])
    if g is None or g.is_empty: return None
    c = g.centroid; P = local(c.y, c.x)
    rec = {'st': 'matched', 'pid': feat['attributes']['PARCEL_ID'], **facts(feat['attributes'], g, P), 'ck': TODAY}
    gs = g.simplify(0.0000015, preserve_topology=True)
    rec['g'] = esri_rings(gs); b = g.bounds; rec['bb'] = [round(v, 6) for v in b]
    rec['fl'] = flood(g, P); rec['wt'] = wetlands(g, P); rec['rd'] = roads(g, P); rec['zn'] = zoning(county, g)
    rec['img'] = thumb(county, parcel, gs)
    return rec

# ---------- driver ----------
def load_json(p, d):
    try: return json.load(open(p))
    except Exception: return d

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--refresh', action='store_true'); ap.add_argument('--county'); ap.add_argument('--workers', type=int, default=6); ap.add_argument('--limit', type=int, default=0)
    a = ap.parse_args()
    os.makedirs(WORK, exist_ok=True); os.makedirs(OUT, exist_ok=True)
    listings = json.loads(subprocess.check_output(['node', os.path.join(HERE, 'export-listings.js')]))
    try:
        it = fetch('https://www.arcgis.com/sharing/rest/content/items/' + STATEWIDE_ITEM, {'f': 'json'}, post=False)
        roll_date = datetime.datetime.utcfromtimestamp(it['modified'] / 1000).date().isoformat()
    except Exception: roll_date = ''
    by = {}; info = {}
    for x in listings: by.setdefault(x['county'], []).append(x['parcel']); info[(x['county'], x['parcel'])] = x
    lock = threading.Lock()
    for county in sorted(by):
        if a.county and county != a.county: continue
        if county not in CO_NO: print('skip (not a Florida county name):', county); continue
        path = os.path.join(OUT, slug(county) + '.json')
        data = load_json(path, {})
        recs = data.get('p', {})
        field, norm = ID_RULES.get(county, DEFAULT_RULE)
        todo = [p for p in by[county] if a.refresh or p not in recs or recs[p].get('st') == 'error']
        if a.limit: todo = todo[:a.limit]
        print(county, len(by[county]), 'listed,', len(todo), 'to do', flush=True)
        if todo:
            if county in XWALK:
                try: xw = crosswalk(county, todo)
                except Exception as e: print('  crosswalk failed:', e); continue
                want = {}
                for p in todo:
                    ids = {i for i in xw[p] if i}
                    if len(ids) == 1: want[p] = next(iter(ids))
                    else: recs[p] = {'st': 'ambiguous' if len(ids) > 1 else 'unmatched', 'note': ('The county parcel map lists more than one parcel for this account number.' if len(ids) > 1 else 'The county parcel map has no parcel with this account number.'), 'ck': TODAY}
                todo = list(want); field = 'PARCEL_ID'
            else:
                want = {p: norm(p) for p in todo}
            try: found = lookup(county, sorted(set(want.values())), field)
            except Exception as e: print('  lookup failed:', e); found = None
            if found is None: continue
            loose_need = [p for p in todo if want[p] not in found]
            loose = {}
            if loose_need:
                cands = sorted({c for p in loose_need for c in LOOSE(p) | {norm(p)}} - set(found))
                try: loose = lookup(county, cands, 'PARCEL_ID') if cands else {}
                except Exception: loose = {}
            jobs = {}
            for p in todo:
                hits = found.get(want[p], [])
                ids = {f['attributes']['PARCEL_ID'] for f in hits}
                if len(ids) == 1:
                    owners = {(f['attributes'].get('OWN_NAME') or '') for f in hits}
                    if len(hits) > 1 and len(owners) > 1:
                        recs[p] = {'st': 'ambiguous', 'note': 'The statewide roll has %d records with this ID and different owners.' % len(hits), 'ck': TODAY}; continue
                    feat = hits[0]
                    if len(hits) > 1:  # split polygons of one parcel: merge
                        gg = unary_union([rings_to_geom(f['geometry']['rings']) for f in hits if f.get('geometry')])
                        feat = {'attributes': hits[0]['attributes'], 'geometry': {'rings': esri_rings(gg)}}
                    if not feat.get('geometry'): recs[p] = {'st': 'unmatched', 'note': 'Record found but it has no mapped boundary.', 'pid': feat['attributes']['PARCEL_ID'], 'ck': TODAY}; continue
                    jobs[p] = feat
                elif len(ids) > 1:
                    recs[p] = {'st': 'ambiguous', 'note': 'More than one statewide parcel matches this ID.', 'ck': TODAY}
                else:
                    lh = sorted({f['attributes']['PARCEL_ID'] for c in LOOSE(p) for f in loose.get(c, [])})
                    recs[p] = {'st': 'ambiguous', 'note': 'Only a loosely formatted ID matched (' + ', '.join(lh) + '). Needs a person to confirm.', 'ck': TODAY} if lh else {'st': 'unmatched', 'note': 'No statewide parcel has this ID (' + field + ' ' + want[p] + ').', 'ck': TODAY}
            done = [0]
            def work(p):
                try: r = enrich(county, p, jobs[p])
                except Exception as e: r = {'st': 'error', 'note': str(e)[:160], 'ck': TODAY}
                with lock:
                    recs[p] = r or {'st': 'unmatched', 'note': 'Boundary could not be read.', 'ck': TODAY}
                    done[0] += 1
                    if done[0] % 25 == 0: save(path, county, recs, roll_date); print('  ', done[0], '/', len(jobs), flush=True)
            with cf.ThreadPoolExecutor(a.workers) as ex: list(ex.map(work, list(jobs)))
        # explain why a parcel has no picture when the listing itself shows it is not a piece of land
        for p in by[county]:
            r = recs.get(p)
            if r and r.get('st') in ('unmatched', 'ambiguous'): r['kind'] = kind_of(info.get((county, p), {}))
        # drop records for parcels no longer listed (keeps files tidy; nothing is duplicated)
        recs = {p: recs[p] for p in by[county] if p in recs}
        save(path, county, recs, roll_date)
    report(by)

def kind_of(x):
    t = ((x.get('use') or '') + ' ' + (x.get('desc') or '')).upper()
    if re.search(r'MINERAL|SUBSURF|SUB SRFC|S/S RTS|SUB-SURFACE', t): return 'mineral'
    if re.search(r'CONDO|UNIT\b|MERCHANDISE MAR', t): return 'condo'
    return ''

NO_ADDR = re.compile(r'^(UNASSIGNED|NO SITUS|NONE|UNKNOWN|NOT ASSIGNED|0+\b)', re.I)
def clean(rec):
    # County placeholders such as "UNASSIGNED LOCATION" mean no street address has been assigned.
    if rec.get('addr') and NO_ADDR.search(rec['addr'].strip()): rec['addr'] = ''
    return rec

def save(path, county, recs, roll_date):
    recs = {k: clean(v) for k, v in recs.items()}
    z = ZONING.get(county)
    data = {'county': county, 'co_no': CO_NO[county], 'updated': TODAY,
            'sources': {
                'parcels': {'name': 'Florida Statewide Parcels (Florida Geographic Information Office, from county property appraisers via the Florida Department of Revenue)', 'url': 'https://www.arcgis.com/home/item.html?id=' + STATEWIDE_ITEM, 'date': roll_date},
                'flood': {'name': 'FEMA National Flood Hazard Layer', 'url': 'https://msc.fema.gov/portal/search'},
                'wetlands': {'name': 'U.S. Fish and Wildlife Service National Wetlands Inventory', 'url': 'https://www.fws.gov/program/national-wetlands-inventory/wetlands-mapper'},
                'roads': {'name': 'U.S. Census Bureau TIGER roads', 'url': 'https://tigerweb.geo.census.gov/'},
                'zoning': {'name': z['name'], 'url': z['page']} if z else None,
                'imagery': {'name': 'USGS The National Map, NAIP Plus orthoimagery (USDA NAIP, public domain)', 'url': 'https://www.usgs.gov/programs/national-geospatial-program/national-map'}},
            'p': recs}
    tmp = path + '.tmp'
    with open(tmp, 'w') as f: json.dump(data, f, separators=(',', ':'))
    os.replace(tmp, path)

def report(by):
    rows, review = [], []
    for county in sorted(by):
        if county not in CO_NO: continue
        d = load_json(os.path.join(OUT, slug(county) + '.json'), {'p': {}}); P = d.get('p', {})
        r = {'county': county, 'parcels': len(by[county]), 'matched': 0, 'ambiguous': 0, 'unmatched': 0, 'error': 0, 'pending': 0, 'aerial': 0, 'map_preview': 0, 'no_owner': 0, 'no_address': 0, 'area_estimated': 0, 'flood_unavailable': 0, 'wetlands_unavailable': 0, 'roads_unavailable': 0, 'zoning_unavailable': 0, 'mineral_only': 0, 'condo_unit': 0, 'other_unmatched': 0}
        for p in by[county]:
            x = P.get(p)
            if not x: r['pending'] += 1; continue
            r[x['st']] = r.get(x['st'], 0) + 1
            if x['st'] != 'matched':
                k = x.get('kind', ''); r['mineral_only' if k == 'mineral' else 'condo_unit' if k == 'condo' else 'other_unmatched'] += x['st'] in ('unmatched', 'ambiguous')
                review.append((county, p, x['st'], k or 'needs review', x.get('note', ''))); continue
            r['aerial' if x['img']['s'] == 'aerial' else 'map_preview'] += 1
            r['no_owner'] += not x.get('own'); r['no_address'] += not x.get('addr'); r['area_estimated'] += bool(x.get('aEst'))
            for k, n in [('fl', 'flood'), ('wt', 'wetlands'), ('rd', 'roads'), ('zn', 'zoning')]: r[n + '_unavailable'] += x[k]['s'] == 'na'
        rows.append(r)
    tot = {k: sum(r[k] for r in rows) for k in rows[0] if k != 'county'} if rows else {}
    json.dump({'generated': TODAY, 'counties': rows, 'total': tot}, open(os.path.join(HERE, 'report.json'), 'w'), indent=1)
    cols = ['parcels', 'matched', 'ambiguous', 'unmatched', 'mineral_only', 'condo_unit', 'other_unmatched', 'aerial', 'map_preview', 'no_owner', 'no_address', 'area_estimated', 'flood_unavailable', 'wetlands_unavailable', 'roads_unavailable', 'zoning_unavailable']
    md = ['# Florida parcel coverage report', '', 'Generated ' + TODAY + ' by tools/fl-parcels/backfill.py. One row per county; counts are unique parcels.', '',
          '| County | ' + ' | '.join(c.replace('_', ' ') for c in cols) + ' |', '|' + '---|' * (len(cols) + 1)]
    for r in rows + ([dict(tot, county='**Total**')] if tot else []): md.append('| ' + r['county'] + ' | ' + ' | '.join(str(r.get(c, 0)) for c in cols) + ' |')
    md += ['', 'Unmatched parcels split into mineral-only interests (no surface lot exists to picture), condo units (not mapped separately) and other IDs that need a person to check. “Unavailable” means the source did not return data for that lot, not that the lot is clear. Zoning is only filled in where we have a checked zoning layer (Leon, Manatee).', '', 'Parcels needing review are listed in review.csv.']
    open(os.path.join(HERE, 'report.md'), 'w').write('\n'.join(md) + '\n')
    with open(os.path.join(HERE, 'review.csv'), 'w') as f:
        f.write('county,parcel,status,kind,note\n')
        for row in review: f.write(','.join('"' + str(v).replace('"', '""') + '"' for v in row) + '\n')
    print(open(os.path.join(HERE, 'report.md')).read())

if __name__ == '__main__': main()
