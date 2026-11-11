"""Checks that the sale prices shown on the site match the official Wayne County results PDF, parsed a second, independent way.
Run: python3 tools/imports/tests/test_wayne_prices.py <path to the results PDF>   (skips if no PDF is given)"""
import json, re, subprocess, sys, collections, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..')); S = ROOT + '/kinvest-liens/liens/states/'
if len(sys.argv) < 2: print('skipped: pass the results PDF path'); sys.exit(0)
flat = re.sub(r'\s+', ' ', subprocess.run(['pdftotext', '-raw', sys.argv[1], '-'], capture_output=True, text=True).stdout)
indep = [float(m.group(1)) for m in re.finditer(r'(?<![\d.])(\d+(?:\.\d+)?) (\d{8}) ', flat)]
res = json.load(open(S + 'timeline/results-wayne.json'))['results']
ev = [e['new'] for e in json.load(open(S + 'timeline/wayne.json'))['events'] if e['type'] == 'result_posted']
s = open(S + 'liens-wayne.js').read(); rows = json.loads(s[s.index('LIENS.push(...') + 14:s.rindex(');')])
card = {r['parcel']: r['amount'] for r in rows if r.get('priceLabel') == 'Sold for'}
assert collections.Counter(indep) == collections.Counter(r['price'] for r in res) == collections.Counter(ev), 'prices differ from the PDF'
assert all(card.get(r['parcel']) == r['price'] for r in res), 'a card price differs from the official result'
print('ok: %d results, total $%s match the PDF, the timeline events and the cards' % (len(res), format(sum(indep), ',.2f')))
