import importlib.util
import json
import pathlib
import unittest

spec=importlib.util.spec_from_file_location('review_cert',pathlib.Path(__file__).resolve().parents[1]/'scripts'/'review-certificate.py')
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class ReviewGateTests(unittest.TestCase):
    def setUp(self):
        self.record={'state':'FL','county':'Wakulla','parcelId':'123','certificateNumber':'15',
                     'taxYear':'2024','availableForPurchase':False,'status':'unverified'}
        self.snapshot=json.dumps({'checkedAt':'2026-11-20','records':[self.record]}).encode()
        self.kw={'county_slug':'wakulla','key':'fl|wakulla|123|15|2024',
                 'decision':'approved-for-research','evidence_url':'https://wakullatax.com/online-services',
                 'reviewer':'skyrease124','reason':'County source was manually inspected',
                 'reviewed_at':'2026-11-20T20:00:00Z'}
    def test_approved_research_does_not_publish(self):
        receipt=mod.review(self.snapshot,**self.kw)
        self.assertFalse(receipt['publicationAuthorized'])
        self.assertFalse(receipt['availableForPurchase'])
        self.assertEqual(len(receipt['snapshotSha256']),64)
        self.assertEqual(receipt['decision'],'approved-for-research')
    def test_rejects_wrong_key(self):
        with self.assertRaisesRegex(ValueError,'missing or ambiguous'):
            mod.review(self.snapshot,**dict(self.kw,key='fl|wakulla|123|17|2024'))
    def test_rejects_unapproved_source(self):
        with self.assertRaisesRegex(ValueError,'approved official source'):
            mod.review(self.snapshot,**dict(self.kw,evidence_url='https://example.com/proof'))
    def test_blocks_purchase_flag(self):
        self.record['availableForPurchase']=True
        with self.assertRaisesRegex(ValueError,'purchase availability'):
            mod.review(json.dumps({'records':[self.record]}).encode(),**self.kw)
    def test_rejects_short_reason(self):
        with self.assertRaisesRegex(ValueError,'reason'):
            mod.review(self.snapshot,**dict(self.kw,reason='ok'))
    def test_rejects_cross_county(self):
        with self.assertRaisesRegex(ValueError,'county/state'):
            mod.review(self.snapshot,**dict(self.kw,county_slug='palm-beach'))
    def test_rejects_duplicate_key(self):
        with self.assertRaisesRegex(ValueError,'ambiguous'):
            mod.review(json.dumps({'records':[self.record,self.record]}).encode(),**self.kw)

if __name__=='__main__':unittest.main()
