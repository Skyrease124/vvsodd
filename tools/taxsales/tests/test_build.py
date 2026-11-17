# Run: python3 tools/taxsales/tests/test_build.py
import json, os, sys, tempfile, shutil
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import build as B
real = os.path.join(os.path.dirname(__file__), '..', 'sources')
ok = 0
def check(c, m):
    global ok; assert c, m; ok += 1; print('ok -', m)

out = B.build(None, real, '2026-11-12')
vd = [l for l in out['listings'] if l['county'] == 'Volusia' and l['type'] == 'taxdeed']
check(len(vd) == 45 and all(l['saleDate'] == '2026-11-17' and l['saleTime'] == '09:00' and l['tz'] == 'ET' for l in vd), 'Volusia Nov 17 2026 9:00 AM ET sale: 45 certificates from the Clerk list')
st = {l['cert']: l['status'] for l in vd}
check(sum(v == 'redeemed' for v in st.values()) == 14 and st['4216-24'] == 'withdrawn' and sum(v == 'scheduled' for v in st.values()) == 30, '14 redeemed, 1 pulled, 30 scheduled (as the county marked them)')
x = next(l for l in vd if l['cert'] == '3774-20')
check(x['openingBid'] == 2207.43 and x['parcel'] == '612901110240' and x['owner'].startswith('BOARTS') and x['auctionUrl'] == 'https://volusia.realtaxdeed.com/', 'published opening bid, owner and official auction link carried for 3774-20')
check(all('openingBid' not in l for l in vd if l['cert'] != '3774-20'), 'no opening bid is invented where the file does not publish one')
keys = [l['key'] for l in out['listings']]
check(len(keys) == len(set(keys)), 'no duplicate listings (county|type|parcel|certificate)')
check({l['type'] for l in out['listings']} >= {'taxdeed', 'otc'} and all(l['type'] in ('taxdeed', 'otc', 'laft') for l in out['listings']), 'every listing has one of the three labeled sale types')
check(all(l.get('checked') for l in out['listings'] if l['type'] == 'taxdeed'), 'every tax deed listing shows when it was last checked')

# newer copy of the same sale list: one item silently missing, one canceled by the county, one rescheduled
tmp = tempfile.mkdtemp()
src = json.load(open(os.path.join(real, 'volusia-2026-11-17.json')))
items = [i for i in src['items'] if i['cert'] != '617-24']
for i in items:
    if i['cert'] == '808-24': i.update(status='canceled', statusNote='Canceled by the Clerk')
    if i['cert'] == '1548-24': i.update(status='rescheduled', newDate='2026-12-15', statusNote='Moved by the Clerk')
src['items'] = items; json.dump(src, open(os.path.join(tmp, 'v.json'), 'w'))
out2 = B.build(out, tmp, '2026-11-14')
by = {l['cert']: l for l in out2['listings'] if l['type'] == 'taxdeed'}
check(by['617-24']['status'] == 'gone' and by['617-24']['statusNote'] == 'No longer listed · outcome unconfirmed' and by['617-24']['goneSince'] == '2026-11-14', 'a parcel that disappears without explanation shows "No longer listed · outcome unconfirmed"')
check(by['808-24']['status'] == 'canceled' and by['1548-24']['status'] == 'rescheduled' and by['1548-24']['newDate'] == '2026-12-15', 'county-confirmed cancel / reschedule are applied')
check(by['1658-24']['status'] == 'redeemed', 'county-confirmed outcomes are kept')
out3 = B.build(out2, tmp, '2026-11-15')
check(next(l for l in out3['listings'] if l.get('cert') == '617-24' and l['type'] == 'taxdeed')['goneSince'] == '2026-11-14', 'gone date is kept on later builds')
shutil.rmtree(tmp)

# ---- confirmed changes, sale events, source health, registry (TEST FIXTURE data) ----
import check as C
reg = [{'state': 'FL', 'county': 'Volusia', 'file': 'volusia', 'integrated': ['taxdeed'], 'calendar': {'name': 'Volusia Clerk', 'url': 'https://www.clerk.org/tax-deeds.aspx'}, 'links': {'Clerk': 'https://www.clerk.org/tax-deeds.aspx'}, 'probe': {'url': 'https://www.clerk.org/tax-deeds.aspx', 'contains': 'tax deed'}},
       {'state': 'FL', 'county': 'Bay', 'file': 'bay', 'integrated': [], 'calendar': {'name': 'Bay Tax Collector', 'url': 'https://www.baytaxcollector.com/'}, 'links': {'TC': 'https://www.baytaxcollector.com/'}, 'probe': None}]
def mk_src(event=None, items=None):
    d = json.load(open(os.path.join(real, 'volusia-2026-11-17.json')))
    d['items'] = items or d['items'][:3]
    if event: d['event'] = event
    t = tempfile.mkdtemp(); json.dump(d, open(os.path.join(t, 'v.json'), 'w')); return t
CONF = {'name': 'Volusia County Clerk notice (TEST FIXTURE)', 'url': 'https://www.clerk.org/tax-deeds.aspx', 'date': '2026-11-10'}

t = mk_src({'status': 'rescheduled', 'newDate': '2026-12-02', 'newTime': '09:00', 'note': 'TEST FIXTURE: sale moved', 'confirmedBy': CONF})
o = B.build(None, t, '2026-11-12', reg, {})
ev = o['events'][0]
check(ev['status'] == 'rescheduled' and ev['saleDate'] == '2026-11-17' and ev['newDate'] == '2026-12-02' and ev['confirmedBy']['date'] == '2026-11-10' and ev['items'] == 3, 'confirmed date change: the sale event keeps the old and new dates and who confirmed it')
check(all(l['status'] == 'rescheduled' and l['oldDate'] == '2026-11-17' and l['newDate'] == '2026-12-02' and l['confirmedBy']['url'] == CONF['url'] for l in o['listings'] if l['type'] == 'taxdeed'), 'every listing in that sale shows old date -> new date with the confirmation')
shutil.rmtree(t)
t = mk_src({'status': 'canceled', 'note': 'TEST FIXTURE: sale canceled', 'confirmedBy': CONF})
o = B.build(None, t, '2026-11-12', reg, {}); check(o['events'][0]['status'] == 'canceled' and all(l['status'] == 'canceled' for l in o['listings'] if l['type'] == 'taxdeed'), 'confirmed cancellation: sale event and its listings are canceled')
shutil.rmtree(t)
for bad in ({'status': 'canceled', 'note': 'x'}, {'status': 'canceled', 'confirmedBy': {'name': 'x', 'url': 'http://not-https', 'date': '2026-11-10'}}, {'status': 'postponed'}):
    t = mk_src(bad)
    try: B.build(None, t, '2026-11-12', reg, {}); check(False, 'unconfirmed change accepted')
    except AssertionError as e: check('confirmedBy' in str(e), 'a cancel / postpone without a named, https official confirmation is refused: %s' % bad.get('status'))
    shutil.rmtree(t)
t = mk_src({'status': 'postponed', 'note': 'TEST FIXTURE: postponed, no new date', 'confirmedBy': CONF}); o = B.build(None, t, '2026-11-12', reg, {})
check(all(l['status'] == 'postponed' and 'oldDate' not in l and not l.get('newDate') for l in o['listings'] if l['type'] == 'taxdeed'), 'postponed with no announced date stays postponed (no invented new date)'); shutil.rmtree(t)
t = mk_src({'status': 'rescheduled', 'confirmedBy': CONF})
try: B.build(None, t, '2026-11-12', reg, {}); check(False, 'reschedule without a date accepted')
except AssertionError as e: check('newDate' in str(e), 'a reschedule without a new date is refused')
shutil.rmtree(t)
# disappeared listing keeps the last time it was seen; a vanished listing is never turned into "canceled"
t = mk_src(None); o1 = B.build(None, t, '2026-11-12', reg, {}); keep = [json.load(open(os.path.join(t, 'v.json')))['items'][0]]; shutil.rmtree(t)
t = mk_src(None, keep); o2 = B.build(o1, t, '2026-11-15', reg, {}); g = [l for l in o2['listings'] if l['status'] == 'gone']
check(len(g) == 2 and all(l['lastSeen'] == '2026-11-12' and l['goneSince'] == '2026-11-15' for l in g) and not any(l['status'] == 'canceled' for l in o2['listings']), 'listings that vanish are "gone" with the last time they were seen, never "canceled"'); shutil.rmtree(t)
# registry + health
o = B.build(None, real, '2026-11-12', reg, {'Volusia': {'ok': False, 'lastSuccess': '2026-11-12T10:00:00Z'}})
check(o['counties']['Bay']['probed'] is False and o['counties']['Bay']['calendar']['url'].startswith('https://') and o['counties']['Bay']['integrated'] == [], 'a county without an integrated feed still carries its official calendar link')
check(o['counties']['Volusia']['health']['ok'] is False and o['counties']['Volusia']['health']['lastSuccess'] == '2026-11-12T10:00:00Z', 'source health (and the last successful check) is carried into the data')
check(set(o['counties']) == {'Volusia', 'Bay'} and not any(l['county'] == 'Bay' for l in o['listings']), 'only counties in the registry are built; a county marked non-integrated loads no lists')
allreg = B.load_registry(); check(len(allreg) >= 18 and all(r['calendar']['url'].startswith('http') and r['state'] for r in allreg), 'the real registry has an official calendar link for every county')
# health probe
class R:
    def __init__(s, body, status=200): s.body, s.status = body, status
    def read(s, n): return s.body.encode()
ok1 = C.probe('https://x', 'tax deed', opener=lambda req, timeout: R('<h1>Tax Deed sales</h1>'))
ok2 = C.probe('https://x', 'tax deed', opener=lambda req, timeout: R('<h1>Moved</h1>'))
def boom(req, timeout): raise OSError('timed out')
ok3 = C.probe('https://x', None, opener=boom)
check(ok1[0] is True and ok2[0] is False and 'expected text' in ok2[2] and ok3[0] is False, 'probe: ok when the page answers with its expected text; failed when the page changed or the site did not answer')
res = C.run(reg, {'Volusia': {'lastSuccess': '2026-11-10T00:00:00Z'}}, '2026-11-17T00:00:00Z', prober=lambda u, c: (False, 0, 'down'))
check(res['Volusia']['ok'] is False and res['Volusia']['lastSuccess'] == '2026-11-10T00:00:00Z' and 'Bay' not in res, 'a failed probe never overwrites the last successful check time; counties that refuse automated checks are not probed')
print('\n%d checks passed' % ok)
