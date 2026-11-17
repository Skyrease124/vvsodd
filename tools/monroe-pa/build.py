#!/usr/bin/env python3
"""Monroe County, Pennsylvania: Tax Claim Bureau "Repository List" (PDF) -> kinvest-liens/liens/states/liens-monroepa.js
Source: https://www.monroecountypa.gov/getmedia/b45073e8-1221-4f2c-80e6-0f4c34793681/A_20261021_RepositoryList.pdf  (list as of 10/21/26, "905 Parcels")
Run:  python3 tools/monroe-pa/build.py <repository-list.pdf>     (needs poppler's pdftotext)
Fails unless the number of parcels read equals the count printed on the list.
"""
import json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'kinvest-liens', 'liens', 'states', 'liens-monroepa.js')
URL = 'https://www.monroecountypa.gov/getmedia/b45073e8-1221-4f2c-80e6-0f4c34793681/A_20261021_RepositoryList.pdf'


def parse(text):
    declared = int(re.search(r'([\d,]+)\s+Parcels', text).group(1).replace(',', ''))
    asof = re.search(r'as of\s+(\d+/\d+/\d+)', text).group(1)
    rows, seen = [], set()
    for line in text.split('\n'):
        m = re.match(r'^(\d{2}[.-]\S+)\s+(.*)$', line)
        if not m: continue
        pid, rest = m.group(1), m.group(2).rstrip()
        mp = re.search(r'(\d{14})\s*$', rest); mapno = mp.group(1) if mp else ''
        if mp: rest = rest[:mp.start()].rstrip()
        parts = [p.strip() for p in re.split(r'\s{2,}', rest) if p.strip()]
        owner = parts[0] if parts else ''; legal = ' '.join(parts[1:])
        if pid in seen: continue
        seen.add(pid); rows.append({'parcel': pid, 'owner': owner, 'legal': legal, 'map': mapno})
    return declared, asof, rows


if __name__ == '__main__':
    txt = subprocess.run(['pdftotext', '-layout', sys.argv[1], '-'], capture_output=True, text=True).stdout
    declared, asof, rows = parse(txt)
    assert len(rows) == declared, 'read %d parcels but the list says %d' % (len(rows), declared)
    m, d, y = asof.split('/'); iso = '20%s-%s-%s' % (y, m.zfill(2), d.zfill(2))
    out = [{'county': 'Monroe', 'state': 'PA', 'parcel': r['parcel'], 'saleDate': 'Repository list', 'priceLabel': 'Price (ask the Tax Claim Bureau)', 'status': "On the Tax Claim Bureau's Repository List as of %s (confirm still available)" % asof, 'rate': '', 'cert': '',
            'source': URL, 'checked': '2026-11-17', 'desc': r['legal'], 'owner': r['owner'], 'mapNumber': r['map']} for r in rows]
    hdr = ("// Monroe County, Pennsylvania: parcels on the Tax Claim Bureau's Repository List as of %s (%d parcels): properties that did not sell at the upset or judicial sale and can be bought from the Bureau.\n"
           "// The list prints the owner of record, a short legal description and the county map number; it prints NO price. The Bureau says it makes no warranty and that purchases are at your own risk with no refund unless by court order.\n"
           "// Built by tools/monroe-pa/build.py from %s\n") % (asof, len(rows), URL)
    open(OUT, 'w', encoding='utf8').write(hdr + 'LIENS.push(...' + json.dumps(out, separators=(',', ':')) + ');\n')
    print(len(rows), 'parcels written;', sum(1 for r in rows if not r['map']), 'without a map number;', sum(1 for r in rows if r['legal']), 'with a legal description')
