"""Geocode a county's listing addresses with the US Census batch geocoder (free, official). Writes timeline/geo-<slug>.json {parcel: [lat, lng, quality]}.
Quality: 'x' exact match, 'a' approximate (street matched, number interpolated or non-exact). Unmatched parcels get no entry."""
import sys, re, csv, io, json, subprocess, os
sys.path.insert(0, os.path.dirname(__file__))
from importer import *
county = sys.argv[1]; cfg = CFG[county]; _, rows = load_liens_js(cfg['file'])
lines = []
for l in rows:
    a = l.get('address', '')
    m = re.match(r'(.*?),\s*(.*?)\s+([A-Z]{2})\s+(\d{5})', a)
    if not m: continue
    lines.append([l['parcel'], m.group(1), m.group(2), m.group(3), m.group(4)])
out = {}
for i in range(0, len(lines), 5000):
    chunk = lines[i:i + 5000]; buf = io.StringIO(); csv.writer(buf, quoting=csv.QUOTE_ALL).writerows(chunk)
    open('/tmp/geo_in.csv', 'w').write(buf.getvalue())
    r = subprocess.run(['curl', '-s', '-m', '600', '--form', 'addressFile=@/tmp/geo_in.csv', '--form', 'benchmark=Public_AR_Current', 'https://geocoding.geo.census.gov/geocoder/locations/addressbatch'], capture_output=True, text=True)
    for row in csv.reader(io.StringIO(r.stdout)):
        if len(row) >= 6 and row[2] == 'Match':
            lng, lat = row[5].split(',')
            out[row[0]] = [round(float(lat), 5), round(float(lng), 5), 'x' if row[3] == 'Exact' else 'a']
write_json(os.path.join(TL, 'geo-' + cfg['slug'] + '.json'), {'county': county, 'source': 'US Census Bureau geocoder (addresses from the county list)', 'geo': out})
print(county, len(lines), 'sent', len(out), 'matched')
