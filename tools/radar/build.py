"""Build kinvest-liens/liens/states/radar.json: the data behind the homepage Tax Sale Radar.
Everything comes from files already on the site (county lists, the official-import timeline, parcel land use). Nothing is invented.
Run after any county import:   python3 tools/radar/build.py        (output is deterministic: running it twice changes nothing)"""
import json, os, re, glob, hashlib, bisect, statistics, collections, datetime
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')); S = ROOT + '/kinvest-liens/liens/states/'; TL = S + 'timeline/'
rd = lambda p, d=None: json.load(open(p)) if os.path.exists(p) else d
def liens(fn):
    s = open(S + fn).read(); return json.loads(s[s.index('LIENS.push(...') + 14:s.rindex(');')])
idx = {c['county']: c for c in rd(TL + 'index.json')['counties']}
imports = rd(TL + 'imports.json', {'imports': []})['imports']
GROUP = {'El Paso': 'county-held'}   # everything else with status County-held is county-held too (set below)
DEED = {'Wayne', 'Davidson'}
LABEL = {'state-held': 'State-held land', 'county-held': 'County-held liens', 'lien-sale': 'Advertised lien sale', 'deed': 'Tax deed sale'}
PRICE = {'state-held': 'Amount on the state list (not today\'s price)', 'county-held': 'Lien purchase amount', 'lien-sale': 'Amount owed on the list (lien face)', 'deed': 'Amount owed on the notice (not an opening bid)'}
today = datetime.date.today().isoformat()
def vacant(l, pj):
    u = (l.get('use') or '').lower()
    r = pj.get(l['parcel']) or {}
    return 'vacant' in u or 'vacant' in (r.get('use') or '').lower() or 'vacant lot' in (l.get('desc') or '').lower()
def saleinfo(rows):
    c = collections.Counter(l.get('saleDate') for l in rows); d, n = c.most_common(1)[0]
    if re.match(r'^\d{4}-\d\d-\d\d$', d or ''): return {'date': d, 'kind': 'scheduled' if d >= today else 'past', 'text': d}
    m = re.search(r'([A-Z][a-z]+ \d{1,2}, \d{4})', d or '')
    if m:
        dt = datetime.datetime.strptime(m.group(1), '%B %d, %Y').date().isoformat(); return {'date': dt, 'kind': 'scheduled' if dt >= today else 'past', 'text': m.group(1)}
    return {'date': '', 'kind': 'tentative', 'text': d or 'date not stated'}
out = {'built': today, 'counties': [], 'changes': [], 'courses': ['AZ', 'CO', 'FL', 'IA', 'MI', 'TX']}
for fn in sorted(glob.glob(S + 'liens-*.js')):
    base = os.path.basename(fn)
    if base == 'liens-data.js': continue
    rows = liens(base); st = rows[0].get('state', 'FL'); cn = rows[0]['county']
    pjp = S + 'parcels/' + cn.lower().replace(' ', '-') + '.json'; pj = (rd(pjp, {'p': {}}) or {'p': {}})['p'] if st == 'FL' else {}
    held = all(l.get('status') == 'County-held' or 'County-held' in (l.get('saleDate') or '') or 'Held by' in (l.get('status') or '') for l in rows)
    group = 'deed' if cn in DEED else 'county-held' if held else 'lien-sale'
    sold = [l for l in rows if l.get('priceLabel') == 'Sold for']
    open_rows = [l for l in rows if l.get('priceLabel') != 'Sold for' and l.get('amount') is not None]
    if group == 'deed' and cn == 'Wayne': open_rows = []          # unsold foreclosures have no price or verified sale status
    amts = sorted(round(l['amount']) for l in open_rows)
    vam = sorted(round(l['amount']) for l in open_rows if vacant(l, pj))
    si = saleinfo(rows) if group != 'county-held' else {'date': '', 'kind': 'inventory', 'text': 'Held by the county: buy any time (confirm with the county)'}
    c = {'state': st, 'county': cn, 'file': base, 'group': group, 'label': LABEL[group], 'priceLabel': PRICE[group], 'count': len(rows), 'open': len(open_rows), 'amounts': amts, 'vac': vam,
         'sale': si, 'checked': max(l.get('checked', '') for l in rows), 'tracked': cn in idx, 'source': next((l['source'] for l in rows if str(l.get('source', '')).startswith('http')), '')}
    if cn == 'Wayne': si = {'date': '', 'kind': 'completed', 'text': 'September 2026 auction (completed)'}; c['sale'] = si
    if group == 'deed' and si['kind'] in ('past', 'completed'): c['open'] = 0; c['amounts'] = []; c['vac'] = []
    if sold:
        pr = sorted(l['amount'] for l in sold); c['history'] = {'results': len(sold), 'finalMin': pr[0], 'finalMedian': statistics.median(pr), 'finalMax': pr[-1], 'date': '2026-10-13', 'label': 'September 2026 auction', 'openingBid': None, 'advertised': None}
    out['counties'].append(c)
# ---- State-held land lists and state-run auctions loaded from official state files (AL, AR, MS, NM)
def jsdata(fn, var):
    p = S + fn
    if not os.path.exists(p): return None
    t = open(p).read(); i = t.index('const ' + var + ' = ') + len('const ' + var + ' = '); return json.JSONDecoder().raw_decode(t[i:])[0]
def addc(st, county, group, file, amts, count, sale, checked, source, opn=None, price=None):
    out['counties'].append({'state': st, 'county': county, 'file': file, 'group': group, 'label': LABEL[group], 'priceLabel': price or PRICE[group], 'count': count, 'open': count if opn is None else opn,
                            'amounts': sorted(round(a) for a in amts if a), 'vac': [], 'sale': sale, 'checked': checked, 'tracked': False, 'source': source})
INV = lambda txt: {'date': '', 'kind': 'inventory', 'text': txt}
for c in jsdata('al-state-land-data.js', 'AL_STATE_LAND') or []:
    addc('AL', c['county'], 'state-held', 'al-state-land-data.js', [r[6] for r in c['rows'] if r[6]], len(c['rows']), INV('Held by the State of Alabama: buy by price quote any time'), c['date'], c['source'])
ar = jsdata('ar-cosl-data.js', 'AR_COSL') or []
for cn in sorted({r[0] for r in ar}):
    rows = [r for r in ar if r[0] == cn]
    addc('AR', cn, 'state-held', 'ar-cosl-data.js', [r[5] for r in rows], len(rows), INV('Commissioner of State Lands online auction (rolling)'), '2026-11-12', 'https://www.cosl.org/', price='Starting bid on the state auction')
ms = jsdata('ms-forfeited-data.js', 'MS_TFL') or []
for cn in sorted({r[0] for r in ms}):
    rows = [r for r in ms if r[0] == cn]
    addc('MS', cn, 'state-held', 'ms-forfeited-data.js', [], len(rows), INV('Held by the State of Mississippi: apply to buy any time'), '2026-11-10', 'https://www.sos.ms.gov/public-lands/tax-forfeited-lands')
for a2 in jsdata('nm-auctions-data.js', 'NM_AUCTIONS') or []:
    live = [i for i in a2['items'] if not i['removed']]
    addc('NM', a2['county'], 'deed', 'nm-auctions-data.js', [i['minBid'] for i in live], len(a2['items']), {'date': a2['date'], 'kind': 'scheduled' if a2['date'] >= today else 'past', 'text': a2['date']}, a2['checked'], a2['source'], opn=len(live), price='Minimum bid on the official notice')
# ---- What Changed: official imports compared with the previous complete version (events come from tools/imports, already de-duplicated by id)
links = lambda st: '/liens/states/state/?s=' + st
def agg(county, st, evs, typ, label_fn):
    by = collections.defaultdict(list)
    for e in evs: by[(e['detectedAt'], e['importId'])].append(e)
    for (det, imp), es in sorted(by.items()):
        es.sort(key=lambda e: e['id']); first = es[0]
        item = {'id': hashlib.sha1(('%s|%s|%s|%s' % (county, typ, det, imp)).encode()).hexdigest()[:12], 'county': county, 'state': st, 'type': typ, 'detectedAt': det, 'publishedAt': first.get('publishedAt', ''), 'count': len(es),
                'text': label_fn(es), 'source': first['source'], 'official': first['official'], 'link': links(st), 'items': [{'key': e['key'], 'parcel': e['parcel'], 'old': e.get('old'), 'new': e.get('new'), 'field': e.get('field')} for e in es[:6]]}
        if typ == 'result': item['prices'] = {'min': min(e['new'] for e in es), 'max': max(e['new'] for e in es)}
        out['changes'].append(item)
for cn, cfg in idx.items():
    tl = rd(TL + cfg['slug'] + '.json'); st = cfg['state']
    if not tl: continue
    ev = [e for e in tl['events'] if not e.get('review')]          # events waiting for admin review never reach the radar
    T = lambda t: [e for e in ev if e['type'] == t]
    agg(cn, st, T('amount_changed') + T('payoff_changed'), 'amount', lambda es: '%d listing%s changed amount (%s)' % (len({e['key'] for e in es}), '' if len({e['key'] for e in es}) == 1 else 's', 'old → new shown below'))
    agg(cn, st, T('saleDate_changed') + T('auction_rescheduled'), 'schedule', lambda es: 'Sale date changed on %d listing%s' % (len(es), '' if len(es) == 1 else 's'))
    agg(cn, st, T('auction_canceled'), 'canceled', lambda es: 'Sale canceled (official record) on %d listing%s' % (len(es), '' if len(es) == 1 else 's'))
    agg(cn, st, T('result_posted'), 'result', lambda es: 'Sale results published: %d completed sale%s with actual prices' % (len(es), '' if len(es) == 1 else 's'))
    agg(cn, st, T('no_longer_listed'), 'missing', lambda es: 'No longer listed · outcome unconfirmed (%d listing%s)' % (len(es), '' if len(es) == 1 else 's'))
    agg(cn, st, T('added_to_list') + T('relisted'), 'added', lambda es: '%d listing%s added to the list' % (len(es), '' if len(es) == 1 else 's'))
# newly posted lists: the first successful import of a county list
for i in imports:
    if i['status'] != 'ok' or i['kind'] != 'list': continue
    prior = [x for x in imports if x['county'] == i['county'] and x['kind'] == 'list' and x['status'] == 'ok' and x['at'] < i['at']]
    if prior: continue
    c = next((x for x in out['counties'] if x['county'] == i['county'] and x['state'] == i['state']), None)
    out['changes'].append({'id': hashlib.sha1(('%s|new_list|%s' % (i['county'], i['id'])).encode()).hexdigest()[:12], 'county': i['county'], 'state': i['state'], 'type': 'new_list', 'detectedAt': i['at'], 'publishedAt': i['published'],
        'count': i['records'], 'text': 'New list added: %s listings' % format(i['records'], ','), 'source': {'name': i['sourceName'], 'url': i['sourceUrl']}, 'official': True, 'link': links(i['state']), 'items': []})
out['changes'].sort(key=lambda c: (c['detectedAt'], c['id']), reverse=True)
json.dump(out, open(S + 'radar.json', 'w'), separators=(',', ':'), sort_keys=True)

# ---- keep the homepage counters (lien-summary.js LIEN_SUMMARY) in step with every list on the site
_ls = open(S + 'lien-summary.js').read(); _a = _ls.index('const LIEN_SUMMARY = ['); _b = _ls.index('];', _a) + 2
_rows = ',\n'.join("  {state: '%s', county: %s, count: %d}" % (c['state'], json.dumps(c['county']), c['count']) for c in sorted(out['counties'], key=lambda c: (c['state'], c['county'])))
_new = _ls[:_a] + 'const LIEN_SUMMARY = [   // generated by tools/radar/build.py from every county and state list on the site\n' + _rows + '\n];' + _ls[_b:]
if _new != _ls: open(S + 'lien-summary.js', 'w').write(_new)
print('counties', len(out['counties']), 'changes', len(out['changes']), 'bytes', os.path.getsize(S + 'radar.json'))
print(collections.Counter(c['type'] for c in out['changes']))
