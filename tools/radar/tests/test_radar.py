"""Run: python3 tools/radar/tests/test_radar.py   (checks the built radar.json against the import timeline)"""
import json, os, subprocess, sys, hashlib, unittest
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..')); S = ROOT + '/kinvest-liens/liens/states/'
def build(): subprocess.run([sys.executable, ROOT + '/tools/radar/build.py'], check=True, capture_output=True)
md5 = lambda: hashlib.md5(open(S + 'radar.json', 'rb').read()).hexdigest()
class T(unittest.TestCase):
    def test_rebuild_is_identical_so_reimports_add_nothing(self):
        build(); a = md5(); build(); self.assertEqual(a, md5())
    def test_no_duplicate_updates(self):
        ids = [c['id'] for c in json.load(open(S + 'radar.json'))['changes']]; self.assertEqual(len(ids), len(set(ids)))
    def test_missing_listings_are_never_called_sold(self):
        for c in json.load(open(S + 'radar.json'))['changes']:
            if c['type'] == 'missing': self.assertIn('No longer listed · outcome unconfirmed', c['text']); self.assertFalse(c['official'])
    def test_every_update_has_a_source_date_and_link(self):
        for c in json.load(open(S + 'radar.json'))['changes']: self.assertTrue(c['source']['url'].startswith('http')); self.assertRegex(c['detectedAt'], r'^\d{4}-\d\d-\d\d$'); self.assertTrue(c['link'].startswith('/liens/'))
    def test_events_waiting_for_review_are_not_published(self):
        tl = json.load(open(S + 'timeline/wayne.json')); held = {e['id'] for e in tl['events'] if e.get('review')}; self.assertTrue(held)
        r = json.load(open(S + 'radar.json')); res = [c for c in r['changes'] if c['county'] == 'Wayne' and c['type'] == 'result'][0]
        shown = sum(1 for e in tl['events'] if e['type'] == 'result_posted' and not e.get('review')); self.assertEqual(res['count'], shown)
    def test_amounts_match_the_county_files(self):
        r = json.load(open(S + 'radar.json'))
        for c in r['counties']:
            s = open(S + c['file']).read(); rows = json.loads(s[s.index('LIENS.push(...') + 14:s.rindex(');')]); self.assertEqual(c['count'], len(rows), c['county'])
    def test_sale_history_keeps_prices_separate(self):
        w = [c for c in json.load(open(S + 'radar.json'))['counties'] if c['county'] == 'Wayne'][0]['history']; self.assertIsNone(w['openingBid']); self.assertIsNone(w['advertised']); self.assertEqual(w['results'], 1437)
if __name__ == '__main__': unittest.main(verbosity=2)
