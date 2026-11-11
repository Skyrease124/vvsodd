"""Run: python3 tools/imports/tests/test_importer.py   (uses temp folders and a fake county; touches no real data)"""
import os, sys, tempfile, json, unittest
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import importer as I

class T(unittest.TestCase):
    def setUp(self):
        d = tempfile.mkdtemp(); I.TL = os.path.join(d, 'tl'); I.SNAP = os.path.join(d, 'snap'); os.makedirs(I.TL); os.makedirs(I.SNAP)
        I.CFG['Testville'] = {'state': 'TX', 'slug': 'testville', 'file': 'x.js', 'kind': 'lien', 'amountLabel': 'Minimum bid', 'payoffLabel': 'Payoff', 'sourceName': 'Testville list', 'sourceUrl': 'https://example.gov/list', 'minRatio': 0.8}
    def recs(self, rows):
        return {I.key_of('TX', 'Testville', p, c): {'parcel': p, 'cert': c, 'amount': a, 'payoff': pay, 'saleDate': sd, 'status': 'Listed', 'row': {'parcel': p}} for p, c, a, pay, sd in rows}
    def imp(self, rows, tag, **kw):
        return I.run_import('Testville', self.recs(rows), raw_sha=I.sha(tag.encode()), detected=kw.pop('detected', '2026-11-10'), **kw)
    base = [('0001234', '', 800.0, 900.0, '2026-12-01'), ('0005', 'C1', 100.0, 110.0, '2026-12-01'), ('0005', 'C2', 200.0, 210.0, '2026-12-01')] + [('P%03d' % i, '', 50.0, 55.0, '2026-12-01') for i in range(20)]
    def events(self): return I.load_tl('Testville')['events']

    def test_changed_amount_and_reimport(self):
        self.imp(self.base, 'v1')
        rows = [r for r in self.base]; rows[0] = ('0001234', '', 950.0, 1050.0, '2026-12-08')
        e = self.imp(rows, 'v2', detected='2026-11-11'); self.assertEqual(e['status'], 'ok')
        ev = self.events(); amt = [x for x in ev if x['type'] == 'amount_changed'][0]
        self.assertEqual((amt['old'], amt['new'], amt['parcel']), (800.0, 950.0, '0001234'))  # leading zeros kept
        self.assertEqual(amt['text'], "Minimum bid changed from $800.00 to $950.00 on the county's latest list.")
        self.assertTrue(any(x['type'] == 'saleDate_changed' for x in ev))
        n = len(ev); self.assertEqual(self.imp(rows, 'v2', detected='2026-11-12')['status'], 'duplicate'); self.assertEqual(len(self.events()), n)  # same file again: nothing new
        # a different file with the same content: snapshot already current, so still no events
        self.imp(rows, 'v2-resaved', detected='2026-11-13'); self.assertEqual(len(self.events()), n)

    def test_missing_parcel_is_unconfirmed(self):
        self.imp(self.base, 'v1'); self.imp(self.base[:-1], 'v2')
        g = [x for x in self.events() if x['type'] == 'no_longer_listed']
        self.assertEqual(len(g), 1); self.assertEqual(g[0]['text'], 'No longer listed. Outcome unconfirmed.'); self.assertFalse(g[0]['official'])
        self.assertFalse(any(x['type'] in ('redemption_confirmed', 'result_posted', 'withdrawn_confirmed') for x in self.events()))
        self.assertIn('TX|Testville|P019|', I.load_tl('Testville')['gone'])

    def test_incomplete_and_failed_imports_change_nothing(self):
        self.imp(self.base, 'v1'); before = json.dumps(I.load_tl('Testville'), sort_keys=True)
        e = self.imp(self.base[:5], 'partial'); self.assertEqual(e['status'], 'incomplete')
        e = I.run_import('Testville', {}, raw_sha=I.sha(b'broken'), ok=False, note='HTTP 500'); self.assertEqual(e['status'], 'failed')
        e = self.imp(self.base, 'flagged', complete=False); self.assertEqual(e['status'], 'incomplete')
        self.assertEqual(before, json.dumps(I.load_tl('Testville'), sort_keys=True))  # no removal events, nothing touched
        self.assertEqual({x['status'] for x in json.load(open(I.TL + '/imports.json'))['imports']}, {'ok', 'incomplete', 'failed'})
        # the next good import still compares with the last VERIFIED snapshot, not the incomplete one
        rows = list(self.base); rows[1] = ('0005', 'C1', 120.0, 130.0, '2026-12-01'); self.imp(rows, 'v3')
        t = [x['type'] for x in self.events()]; self.assertEqual(t.count('amount_changed'), 1); self.assertNotIn('no_longer_listed', t)

    def test_multiple_certificates_stay_separate(self):
        self.imp(self.base, 'v1'); rows = list(self.base); rows[1] = ('0005', 'C1', 101.0, 111.0, '2026-12-01'); self.imp(rows, 'v2')
        ev = [x for x in self.events() if x['type'] == 'amount_changed']; self.assertEqual(len(ev), 1); self.assertEqual(ev[0]['key'], 'TX|Testville|0005|C1')
        self.assertFalse(any(x['key'].endswith('|C2') for x in self.events()))

    def test_relisted_and_added(self):
        self.imp(self.base, 'v1'); self.imp(self.base[:-1], 'v2'); self.imp(self.base, 'v3')
        self.assertIn('relisted', [x['type'] for x in self.events()]); self.assertEqual(I.load_tl('Testville')['gone'], {})

    def test_outcome_needs_official_source(self):
        with self.assertRaises(ValueError): I.record_outcome('Testville', '0001234', 'redeemed', '2026-11-12', '', 'x')
        self.assertTrue(I.record_outcome('Testville', '0001234', 'redeemed', '2026-11-12', 'https://example.gov/redeem.pdf', 'Testville redemption report'))
        self.assertFalse(I.record_outcome('Testville', '0001234', 'redeemed', '2026-11-12', 'https://example.gov/redeem.pdf', 'Testville redemption report'))  # same record twice: ignored

    def test_ambiguous_rekey_goes_to_review(self):
        a = I.key_of('TX', 'Testville', 'OLD1', ''); self.imp(self.base, 'v1')
        r = self.recs(self.base); r[I.key_of('TX', 'Testville', 'P000', '')]['alt'] = 'S1'
        I.run_import('Testville', r, raw_sha=I.sha(b'alt1'), detected='2026-11-10')
        r2 = self.recs(self.base[:-20] + [('NEW1', '', 50.0, 55.0, '2026-12-01')] + self.base[-20:][1:]); r2[I.key_of('TX', 'Testville', 'NEW1', '')]['alt'] = 'S1'
        I.run_import('Testville', r2, raw_sha=I.sha(b'alt2'), detected='2026-11-11')
        q = json.load(open(I.TL + '/review.json'))['items']; self.assertEqual(len(q), 1); self.assertIn('same schedule', q[0]['reason'])
        held = [x for x in self.events() if x['type'] == 'no_longer_listed' and x.get('review')]; self.assertEqual(len(held), 1)

if __name__ == '__main__': unittest.main(verbosity=2)
