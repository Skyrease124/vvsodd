#!/usr/bin/env python3
"""Macon-Bibb County, Georgia: Tax Commissioner's Judicial In Rem List of Properties (PDF created 11/03/26) -> kinvest-liens/liens/states/liens-bibb.js
Source: https://images-governmentwindow.s3.amazonaws.com/resources/sites/bibbcountyga/docs/rp.pdf     Run: python3 tools/bibb-ga/build.py <rp.pdf>
Columns: date posted, street address, parcel, status (e.g. "Sale Process Started", "Scheduled for demolition"), blighted (Yes).
The list prints no owners and no bid amounts (opening bid = taxes and fees past due; Land Bank Authority bids start at $3,250).
The build fails if any line that starts with a posted date is not read.
"""
import json, os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'kinvest-liens', 'liens', 'states', 'liens-bibb.js')
URL = 'https://images-governmentwindow.s3.amazonaws.com/resources/sites/bibbcountyga/docs/rp.pdf'
ROW = re.compile(r'^(\d\d/\d\d/\d\d)\s+(.+?)\s{2,}([A-Z0-9]{3,4}-[0-9]{4})(?:\s{2,}(.*?))?\s*$')
if __name__ == '__main__':
    lines = subprocess.run(['pdftotext', '-layout', sys.argv[1], '-'], capture_output=True, text=True).stdout.split('\n')
    cand = [l.strip() for l in lines if re.match(r'^\s*\d\d/\d\d/\d\d\s', l)]
    rows = []
    for l in cand:
        m = ROW.match(l); assert m, 'could not read: ' + l
        posted, a, pid, rest = m.groups(); rest = (rest or '').strip()
        blight = bool(re.search(r'\bYes$', rest)); st = re.sub(r'\s*\bYes$', '', rest).strip()
        mm, dd, yy = posted.split('/')
        notes = ['Posted to the list ' + posted] + ([st] if st else []) + (['designated blighted by code enforcement'] if blight else [])
        rows.append({'county': 'Bibb', 'state': 'GA', 'parcel': pid, 'amount': None, 'priceLabel': 'Opening bid (taxes and fees past due; ask the Tax Commissioner)',
                     'saleDate': 'Judicial in rem auction (date not on the list)',
                     'status': 'On the Macon-Bibb Tax Commissioner judicial in rem list (subject to change without notice; confirm before bidding)' + ('; ' + st if st else ''),
                     'rate': '', 'cert': '', 'source': URL, 'checked': '2026-11-17', 'use': '', 'desc': '; '.join(notes),
                     'address': re.sub(r"'(?=\w)", ' ', a).strip() + ', Macon GA', 'posted': '20%s-%s-%s' % (yy, mm, dd)})
    seen = set(); out = []
    for r in rows:
        if r['parcel'] in seen: continue
        seen.add(r['parcel']); out.append(r)
    hdr = ("// Macon-Bibb County, Georgia: properties on the Tax Commissioner's Judicial In Rem List (PDF created 11/03/26; %d parcels). No owners and no bid amounts are printed:\n"
           "// the Tax Commissioner's opening bid is the taxes and fees past due; Land Bank Authority auction bids start at $3,250. Built by tools/bibb-ga/build.py from %s\n") % (len(out), URL)
    open(OUT, 'w', encoding='utf8').write(hdr + 'LIENS.push(...' + json.dumps(out, separators=(',', ':')) + ');\n')
    print(len(out), 'parcels (lines read', len(cand), '; duplicates dropped', len(rows) - len(out), ');', sum('Sale Process' in r['status'] for r in out), 'sale started;', sum('blighted' in r['desc'] for r in out), 'blighted;', sum('demolition' in r['status'].lower() for r in out), 'demolition')
