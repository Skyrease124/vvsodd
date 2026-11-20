import importlib.util
import pathlib
import unittest

spec=importlib.util.spec_from_file_location('alert',pathlib.Path(__file__).resolve().parents[1]/'scripts'/'report-certificate-changes.py')
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class AlertTests(unittest.TestCase):
    def test_clean_comparison(self):
        body,count=mod.render({'mode':'comparison','summary':{'added':0,'missingFromLatest':0,'statusChanged':0,'amountChanged':0},'changes':[]},'Wakulla')
        self.assertEqual(count,0)
        self.assertIn('No changes found',body)
    def test_missing_is_not_redeemed(self):
        body,count=mod.render({'mode':'comparison','summary':{'added':1,'missingFromLatest':1,'statusChanged':0,'amountChanged':0},
            'changes':[{'type':'new-in-report','certificateKey':'fl|wakulla|1|2|2026'},
                       {'type':'missing-from-report','certificateKey':'fl|wakulla|3|4|2026'}]},'Wakulla')
        self.assertEqual(count,2)
        self.assertIn('NOT proof of redemption',body)
    def test_first_baseline_does_not_alert(self):
        body,count=mod.render({'mode':'initial-baseline','summary':{'baselineRecords':100,'added':0,'missingFromLatest':0,'statusChanged':0,'amountChanged':0},'changes':[]},'St. Johns')
        self.assertEqual(count,0)
        self.assertIn('Initial baseline only',body)
    def test_reject_bad_counts(self):
        with self.assertRaises(ValueError):
            mod.render({'mode':'comparison','summary':{'added':-2}},'Palm Beach')
if __name__=='__main__':unittest.main()
