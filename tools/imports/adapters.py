"""Parsers that turn an official county file into import records. They never guess: anything unparseable is dropped
and the importer's completeness check decides whether the import is trustworthy."""
import re, json
from importer import *

tc = lambda x: re.sub(r'\s+', ' ', str(x or '')).strip()

def title(s):
    s = tc(s)
    return s.title().replace(' Llc', ' LLC').replace(' Lp', ' LP') if s.isupper() else s

def larimer_xls(path):
    """Larimer County Treasurer 'Real_Property_Tax_Sale.xls'. Parcel numbers are TEXT in the file: leading zeros are kept as published."""
    import xlrd
    s = xlrd.open_workbook(path).sheet_by_index(0); H = s.row_values(0)
    need = ['SCHEDULE', 'OWNER NAME', 'PROPERTY ADDRESS', 'PARCEL NO', 'BALANCE', 'TOTAL_DUE']
    if any(h not in H for h in need): return None, 'Unexpected columns in the file.'
    recs = {}
    for i in range(1, s.nrows):
        r = dict(zip(H, s.row_values(i)))
        p = r['PARCEL NO']; p = str(int(p)) if isinstance(p, float) else tc(p)
        if not p or not isinstance(r['BALANCE'], float): continue
        addr = ', '.join(x for x in [tc(r['PROPERTY ADDRESS']), tc(r['CITY']), (tc(r['STATE']) + ' ' + tc(r['ZIP5'])).strip()] if x)
        row = {'county': 'Larimer', 'state': 'CO', 'parcel': p, 'amount': r['BALANCE'], 'saleDate': '2026-11-19', 'status': 'Advertised for the sale (not sold yet)', 'rate': '', 'cert': '',
               'payoff': r['TOTAL_DUE'], 'desc': tc(r['LEGAL DESCRIPTION'])[:140], 'market': r['VALUATION'] or None}
        if tc(r['OWNER NAME']): row['owner'] = title(r['OWNER NAME'])
        if addr: row['address'] = title(addr).replace(' Co ', ' CO ')
        k = key_of('CO', 'Larimer', p)
        if k in recs: return None, 'Duplicate parcel number %s in the file.' % p
        recs[k] = {'parcel': p, 'cert': '', 'amount': r['BALANCE'], 'payoff': r['TOTAL_DUE'], 'saleDate': '2026-11-19', 'status': 'Advertised for the sale (not sold yet)',
                   'alt': str(r['SCHEDULE']), 'row': row}
    return recs, ''

def records_from_liens_js(county):
    """Baseline from the county file already on the site (used once, to start tracking)."""
    c = CFG[county]; _, rows = load_liens_js(c['file']); recs = {}
    for l in rows:
        k = key_of(c['state'], county, l['parcel'])
        recs[k] = {'parcel': l['parcel'], 'cert': '', 'amount': l.get('amount'), 'payoff': l.get('payoff'), 'saleDate': l.get('saleDate'), 'status': l.get('status'), 'row': l}
    return recs

def apply_larimer(records, snap):
    """Bring liens-larimer.js in line with a verified import: update changed rows, drop parcels no longer listed, add new ones."""
    head, rows = load_liens_js('liens-larimer.js'); by = {l['parcel']: l for l in rows}; seen = set()
    out = []
    for l in rows:
        k = key_of('CO', 'Larimer', l['parcel'])
        if k not in records: continue
        r = records[k]['row']; l['amount'] = r['amount']; l['payoff'] = r['payoff']; l['checked'] = today(); out.append(l); seen.add(k)
    for k, r in records.items():
        if k in seen: continue
        row = dict(r['row']); row.update({'source': 'https://www.larimer.gov/treasurer/thirdparty/liens/sale', 'checked': today()}); out.append(row)
    save_liens_js('liens-larimer.js', head, out)
    p = os.path.join(STATES, 'lien-summary.js'); s = open(p).read()
    s2 = re.sub(r"(county: 'Larimer', count: )\d+", r"\g<1>%d" % len(out), s)
    if s2 != s: open(p, 'w').write(s2)

# ---- Wayne County, Michigan -------------------------------------------------------------------------------------
import subprocess
def _pdf_text(path): return subprocess.run(['pdftotext', '-layout', path, '-'], capture_output=True, text=True).stdout

def wayne_foreclosed(path):
    """'Parcels foreclosed in 2026' list: parcel id, property address, city and zip. No prices (the county's list has none)."""
    recs = {}; geo = {}
    for l in _pdf_text(path).split('\n'):
        if not re.match(r'\d', l): continue
        m = re.match(r'(\S+)\s+(.*?)\s{2,}(.*)$', l.rstrip()) or re.match(r'(\S+)\s+(.*)$', l.rstrip())
        pid = m.group(1); addr = tc(m.group(2)); city = tc(m.group(3)) if m.lastindex > 2 else ''
        p = pid.rstrip('.')
        recs[key_of('MI', 'Wayne', p)] = {'parcel': p, 'cert': '', 'saleDate': '2026 foreclosure list', 'status': 'Foreclosed in 2026 (list as of 4/24/2026)', 'row': {'parcel': p, 'officialId': pid}}
        geo[p] = (addr, city)
    return recs, geo

def wayne_results(path):
    """September 2026 auction results: parcel id, property address, actual sale price. Buyer fields are read but only used by the site's existing owner display."""
    out = []; cur = None
    for l in _pdf_text(path).split('\n'):
        if re.match(r'\d', l):
            m = re.match(r'(\S+)\s+(.*?)\s{2,}(\S.*?)\s+(\d[\d.]*)\s+(\d{8})\s+(.*)$', l)
            if not m: return None, 'Unreadable row: ' + l[:60]
            cur = {'officialId': m.group(1), 'parcel': m.group(1).rstrip('.'), 'address': tc(m.group(2)), 'city': tc(m.group(3)), 'price': float(m.group(4))}; out.append(cur)
    return out, ''
