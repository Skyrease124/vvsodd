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
print('\n%d checks passed' % ok)
