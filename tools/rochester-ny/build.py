#!/usr/bin/env python3
"""City of Rochester, New York: 2026 foreclosure auction list (PDF dated 11/16/26) -> kinvest-liens/liens/states/liens-rochester.js
Source: https://www.cityofrochester.gov/sites/default/files/2026-11/City%20of%20Roc%20Auction%20List%2011.16.26.pdf
(the city's site refuses automated downloads, so the PDF was supplied by the site owner).  Run:  python3 tools/rochester-ny/build.py <list.pdf>
Columns: SBL, address, zip, lot size, use, assessed value, estimated minimum bid, demolition flag. The build fails if any line that starts like a parcel is not read.
"""
import json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'kinvest-liens', 'liens', 'states', 'liens-rochester.js')
URL = 'https://www.cityofrochester.gov/sites/default/files/2026-11/City%20of%20Roc%20Auction%20List%2011.16.26.pdf'
ROW = re.compile(r'^(\S+)\s+(.+?)\s+(\d{5})\s+(.+?)\s{2,}(.+?)\s+\$([\d,]+\.\d\d)\s+\$([\d,]+\.\d\d)\s*([A-Za-z]?)\s*$')


def addr(a, zipc):
    a = re.sub(r'^0+(?=\d)', '', a.strip()); a = re.sub(r'\b0+(\d)', r'\1', a)   # "0081-83 ABERDEEN ST" -> "81-83 Aberdeen St"
    return '%s, Rochester NY %s' % (a.title().replace(' Av', ' Ave').replace(' Pk', ' Park'), zipc)


def acres(lot):
    m = re.match(r'^(\d+(?:\.\d+)?) X (\d+(?:\.\d+)?)$', lot)
    return round(float(m.group(1)) * float(m.group(2)) / 43560, 3) if m and float(m.group(1)) * float(m.group(2)) > 0 else None


if __name__ == '__main__':
    lines = subprocess.run(['pdftotext', '-layout', sys.argv[1], '-'], capture_output=True, text=True).stdout.split('\n')
    cand = [l.strip() for l in lines if re.match(r'^\s*\d{3}\.\d{2}-', l)]
    rows = []
    for l in cand:
        m = ROW.match(l)
        assert m, 'could not read: ' + l
        sbl, a, z, lot, use, av, mb, dem = m.groups()
        rows.append({'county': 'City of Rochester', 'state': 'NY', 'parcel': sbl, 'amount': float(mb.replace(',', '')), 'priceLabel': 'Estimated minimum bid', 'saleDate': 'Foreclosure auction (date not on the list)',
                     'status': 'On the City of Rochester foreclosure auction list dated 11/16/26 (confirm the auction date and that it is still offered)', 'rate': '', 'cert': '', 'source': URL, 'checked': '2026-11-17',
                     'use': use, 'market': float(av.replace(',', '')), 'desc': ('Lot ' + lot + ' ft' if lot != '0X0' else '') + ('; marked for demolition on the list' if dem == 'Y' else ''), 'address': addr(a, z)})
        a_ = acres(lot)
        if a_: rows[-1]['acres'] = a_
    assert len({r['parcel'] for r in rows}) == len(rows), 'duplicate SBL'
    hdr = ("// City of Rochester (Monroe County), New York: properties on the 2026 foreclosure auction list dated 11/16/26 (%d parcels). amount = the list's \"Estimated Minimum Bid\"; market = the list's assessed value (not a market price).\n"
           "// The list prints no auction date and no owner names. A \"Y\" in its Demolition column is shown in the description. Built by tools/rochester-ny/build.py from %s\n") % (len(rows), URL)
    open(OUT, 'w', encoding='utf8').write(hdr + 'LIENS.push(...' + json.dumps(rows, separators=(',', ':')) + ');\n')
    print(len(rows), 'parcels written (every parcel-looking line read:', len(cand), ');', sum(1 for r in rows if 'demolition' in r['desc']), 'marked for demolition')
