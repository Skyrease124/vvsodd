#!/usr/bin/env python3
"""Florida Department of Revenue 2026 Final tax roll (NAL files) -> adds an "rl" block to every parcel in
kinvest-liens/liens/states/parcels/<county>.json: owner name, owner mailing address, situs (property) address,
just value, land value, DOR land-use code, land sq ft, year built, living area, last sale (price/month/year/qualified)
and an absentee flag (mailing address not the property address / out of state).
Source: https://floridarevenue.com/property/dataportal/  (Tax Roll Data Files > NAL > 2026F), public record.
Run: python3 tools/fl-dor/build_roll.py <folder with c<CO_NO>/*.csv unzipped NAL files>
Matching: our parcel key, the record's stored county parcel id (pid), or the roll's ALT_KEY (Escambia account numbers).
"""
import csv, glob, json, os, re, sys
csv.field_size_limit(10 ** 8)
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PD = os.path.join(ROOT, 'kinvest-liens', 'liens', 'states', 'parcels')
CO = {'alachua': 11, 'bay': 13, 'miami-dade': 23, 'duval': 26, 'escambia': 27, 'hernando': 37, 'hillsborough': 39, 'leon': 47, 'manatee': 51, 'nassau': 55,
      'osceola': 59, 'palm-beach': 60, 'pasco': 61, 'santa-rosa': 67, 'sarasota': 68, 'volusia': 74, 'walton': 76}
URL = 'https://floridarevenue.com/property/dataportal/Pages/default.aspx?path=/property/dataportal/Documents/PTO%20Data%20Portal/Tax%20Roll%20Data%20Files/NAL/2026F'
norm = lambda x: re.sub(r'[^0-9A-Z]', '', str(x or '').upper())
sp = lambda *a: re.sub(r'\s+', ' ', ' '.join(x for x in a if x and x.strip())).strip()
num = lambda v: int(float(v)) if v and re.match(r'^-?\d+(\.\d+)?$', v.strip()) else None


def block(r):
    mail = sp(r['OWN_ADDR1'], r['OWN_ADDR2'])
    mail_full = (mail + ', ' if mail else '') + sp(r['OWN_CITY'], 'FL' if (r['OWN_STATE'] or '').strip().upper() == 'FLORIDA' else r['OWN_STATE'], (r['OWN_ZIPCD'] or '')[:5])
    site = sp(r['PHY_ADDR1'], r['PHY_ADDR2'])
    if re.match(r'^(NO STREET|UNASSIGNED|0 )', site.upper()): site = ''
    city = (r['PHY_CITY'] or '').strip(); city = '' if re.search(r'COUNTY|UNINCORP', city.upper()) else city
    site_full = (site + ', ' + sp(city, 'FL', (r['PHY_ZIPCD'] or '')[:5])) if site else ''
    st = (r['OWN_STATE'] or '').strip().upper()
    out_of_state = bool(st) and st not in ('FL', 'FLORIDA')
    # absentee only when the lot has a numbered street address and the owner's mail goes somewhere else
    absentee = bool(re.match(r'^\d', site)) and bool(mail) and norm(site)[:12] != norm(mail)[:12]
    b = {'own': sp(r['OWN_NAME']), 'mail': mail_full.strip(', '), 'site': site_full, 'jv': num(r['JV']), 'lv': num(r['LND_VAL']), 'uc': (r['DOR_UC'] or '').strip(),
         'sqft': num(r['LND_SQFOOT']), 'yb': num(r['ACT_YR_BLT']), 'liv': num(r['TOT_LVG_AREA'])}
    p, y, m = num(r['SALE_PRC1']), num(r['SALE_YR1']), num(r['SALE_MO1'])
    if p and y: b['sale'] = [p, y, m or 0, (r['QUAL_CD1'] or '').strip()]
    b['abs'] = 'out-of-state' if out_of_state else ('absentee' if absentee else '')
    if r.get('FIDU_NAME', '').strip(): b['fidu'] = sp(r['FIDU_NAME'])
    return {k: v for k, v in b.items() if v not in (None, '', 0) or k == 'abs'}


if __name__ == '__main__':
    src = sys.argv[1]; total = found = 0
    for slug, no in CO.items():
        path = os.path.join(PD, slug + '.json'); d = json.load(open(path))
        keys = {}
        for k, v in d['p'].items():
            keys.setdefault(norm(k), k)
            if v.get('pid'): keys.setdefault(norm(v['pid']), k)
        f = glob.glob(os.path.join(src, 'c%d' % no, '*.csv'))[0]; got = {}
        for r in csv.DictReader(open(f, encoding='latin-1')):
            k = keys.get(norm(r['PARCEL_ID'])) or keys.get(norm(r.get('ALT_KEY')))
            if k and k not in got: got[k] = block(r)
        for k, v in d['p'].items():
            if k in got: v['rl'] = got[k]
            else: v.pop('rl', None)
        d.setdefault('sources', {})['roll'] = {'name': 'Florida Department of Revenue, 2026 Final tax roll (NAL)', 'url': URL, 'date': '2026'}
        json.dump(d, open(path, 'w'), separators=(',', ':'))
        total += len(d['p']); found += len(got)
        print('%-13s %4d/%4d' % (slug, len(got), len(d['p'])), sum(1 for x in got.values() if x['abs']), 'absentee/out-of-state')
    print('total', found, '/', total)
