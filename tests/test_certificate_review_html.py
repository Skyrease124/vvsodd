import importlib.util
import pathlib
import unittest

spec=importlib.util.spec_from_file_location('review',pathlib.Path(__file__).resolve().parents[1]/'scripts'/'build-certificate-review-html.py')
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class ReviewHTMLTest(unittest.TestCase):
    def sample(self):
        records={'source':'https://example.gov/certs.csv','checkedAt':'2026-11-20',
                 'records':[{'county':'St. Johns','parcelId':'123','certificateNumber':'12',
                             'taxYear':'2026','holdingType':'county-held',
                             'redemptionStatus':'reported-unredeemed','taxDeedStatus':'unknown',
                             'dueAmount':'140.12','verificationFlags':['confirm-county']}]}
        changes={'mode':'comparison','summary':{'added':1,'missingFromLatest':0,'statusChanged':0,'amountChanged':0},
                 'changes':[{'type':'new-in-report','certificateKey':'fl|st. johns|123|12|2026'}]}
        return records,changes
    def test_readonly_dashboard(self):
        a,b=self.sample()
        page=mod.render(a,b,'St. Johns')
        self.assertIn('admin review',page.lower())
        self.assertIn('NOT APPROVED TO SELL',page)
        self.assertIn('reported-unredeemed',page)
        self.assertIn('new-in-report',page)
    def test_html_is_escaped(self):
        a,b=self.sample()
        a['records'][0]['parcelId']='<script>alert(1)</script>'
        page=mod.render(a,b,'St. Johns')
        self.assertIn('&lt;script&gt;',page)
        self.assertNotIn('<script>alert(1)</script>',page)
    def test_county_mismatch_blocked(self):
        a,b=self.sample()
        with self.assertRaisesRegex(ValueError,'County mismatch'):
            mod.render(a,b,'Palm Beach')
    def test_invalid_change_mode_blocked(self):
        a,b=self.sample()
        b['mode']='publish'
        with self.assertRaises(ValueError):mod.render(a,b,'St. Johns')
if __name__=='__main__':unittest.main()
