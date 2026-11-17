#!/usr/bin/env python3
"""Fulton County, Georgia: Sheriff's December 1, 2026 Tax / Levy Sale list, 1st posting (11/6/2026) -> kinvest-liens/liens/states/liens-fulton.js
Source PDF is a scan (no text layer), so rows.tsv was transcribed by hand from the 5 pages and checked against the page images:
97 non-judicial delinquent tax lien rows (section N) + 13 judicial foreclosure lien rows (section J).
The list prints no owners and no bid amounts. Run: python3 tools/fulton-ga/build.py
"""
import json, os, re
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(ROOT, 'kinvest-liens', 'liens', 'states', 'liens-fulton.js')
URL = 'https://www.fultoncountyga.gov/-/media/Departments/Sheriff/Tax-Sales/2026/Sheriffs-December-1-2026-Tax--Levy-Sale-List--1st-Posting-1162026.pdf'
rows = []
for line in open(os.path.join(HERE, 'rows.tsv')):
    sec, sale, pid, situs = line.rstrip('\n').split('\t')
    assert sec in 'NJ' and re.match(r'^1226-\d{5}$', sale), line
    pid = re.sub(r'\s*-\s*', '-', pid.strip()).replace(' ', '')
    a = situs.strip().title().replace(' Ne', ' NE').replace(' Nw', ' NW').replace(' Se', ' SE').replace(' Sw', ' SW').replace('Mc Kinley', 'McKinley').replace('Mcgill', 'McGill')
    rows.append({'county': 'Fulton', 'state': 'GA', 'parcel': pid, 'amount': None, 'priceLabel': 'Bid amount (not on the list; ask the Sheriff)',
                 'saleDate': 'Sheriff tax / levy sale Tuesday, December 1, 2026',
                 'status': ('Non-judicial delinquent tax lien' if sec == 'N' else 'Judicial foreclosure lien') + ' · Sheriff sale #' + sale + ' (1st posting 11/6/26; list not final, may change before the sale)',
                 'rate': '', 'cert': sale, 'source': URL, 'checked': '2026-11-17', 'use': '', 'desc': ('No street number on the list' if not re.match(r'^\d', a) or a.startswith('0 ') else ''),
                 'address': a + ', Fulton County GA'})
assert len(rows) == 110 and len({r['cert'] for r in rows}) == 110, len(rows)
hdr = ("// Fulton County, Georgia: Sheriff's Tax / Levy Sale, Tuesday December 1, 2026: sale list, 1st posting 11/6/2026 (%d parcels: 97 non-judicial delinquent tax liens, 13 judicial foreclosure liens).\n"
       "// The list is not final and prints no owners and no bid amounts. Transcribed from the scanned county PDF by tools/fulton-ga/build.py: %s\n") % (len(rows), URL)
open(OUT, 'w', encoding='utf8').write(hdr + 'LIENS.push(...' + json.dumps(rows, separators=(',', ':')) + ');\n')
print(len(rows), 'parcels')
