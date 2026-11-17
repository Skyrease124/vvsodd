#!/usr/bin/env python3
"""Builds kinvest-liens/liens/states/vital-records.json: where to request a death certificate, per state.
Florida: the Florida Department of Health page. Every other state: that state's page in the CDC / NCHS directory
"Where to Write for Vital Records" (https://www.cdc.gov/nchs/w2w/index.htm), which names the state's official vital records office, fees and address.
Every link is fetched once to make sure it answers. Run:  python3 tools/probate/build_vital.py
"""
import json, os, re, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'kinvest-liens', 'liens', 'states', 'vital-records.json')
UA = 'PricePocketAsset research (https://pricepocketasset.com)'
INDEX = 'https://www.cdc.gov/nchs/w2w/index.htm'
ABBR = {'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'District of Columbia': 'DC', 'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD', 'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'}
FL = {'name': 'Florida Department of Health: death certificates', 'url': 'https://www.floridahealth.gov/certificates-records/death-certificates/'}


def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=40)


if __name__ == '__main__':
    page = get(INDEX).read().decode('utf-8', 'replace')
    found = {}
    for href, name in re.findall(r'href="(/nchs/w2w/[a-z_]+\.htm)"[^>]*>\s*([A-Za-z .]+?)\s*<', page):
        if name in ABBR: found[ABBR[name]] = 'https://www.cdc.gov' + href
    out, bad = {}, []
    for st in sorted(ABBR.values()):
        cdc = found.get(st)
        if not cdc: bad.append((st, 'not in the CDC index')); continue
        try: ok = get(cdc).status == 200
        except Exception as e: ok = False; bad.append((st, str(e)[:50]))
        out[st] = {'cdc': cdc, 'ok': ok}; time.sleep(0.4)
    for st, r in out.items():
        r.pop('ok')
        if st == 'FL': r.update(FL)
    json.dump({'source': 'CDC NCHS, Where to Write for Vital Records', 'sourceUrl': INDEX, 'checked': time.strftime('%Y-%m-%d'), 'states': out}, open(OUT, 'w'), indent=1)
    print(len(out), 'states written; problems:', bad)
