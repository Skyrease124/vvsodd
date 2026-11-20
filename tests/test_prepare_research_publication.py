import importlib.util
import json
import pathlib
import unittest

spec=importlib.util.spec_from_file_location('prep',pathlib.Path(__file__).resolve().parents[1]/'scripts'/'prepare-research-publication.py')
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class PublicationGateTests(unittest.TestCase):
    def setUp(self):
        self.row={'state':'FL','county':'Wakulla','parcelId':'P-1',
          'certificateNumber':'17','taxYear':'2024','holdingType':'county-held',
          'redemptionStatus':'reported-unredeemed','taxDeedStatus':'unknown',
          'availableForPurchase':False,'status':'unverified',
          'ownerName':'PRIVATE NAME','mailingAddress':'PRIVATE ADDRESS','faceAmountRaw':'100.00'}
        self.snap={'source':'https://wakullatax.com/s/certs.xlsx',
          'checkedAt':'2026-11-20','records':[self.row]}
        self.raw=json.dumps(self.snap).encode()
        self.receipt=mod.review_module.review(self.raw,'wakulla','fl|wakulla|p-1|17|2024',
            'approved-for-research','https://wakullatax.com/online-services',
            'Skyrease124','Official source reviewed for research purposes',
            '2026-11-20T20:00:00Z')
    def test_public_research_record_strips_private_fields(self):
        result=mod.candidate(self.raw,self.receipt,'wakulla')
        record=result['record']
        self.assertEqual(record['listingType'],'tax-certificate-research-only')
        self.assertFalse(record['availableForPurchase'])
        self.assertIsNone(record['purchaseLink'])
        self.assertNotIn('ownerName',record)
        self.assertNotIn('mailingAddress',record)
        self.assertEqual(result['publicationState'],'awaiting-separate-human-merge')
    def test_denies_rejected_decision(self):
        receipt=dict(self.receipt,decision='rejected')
        with self.assertRaises(ValueError):mod.candidate(self.raw,receipt,'wakulla')
    def test_denies_mismatched_snapshot(self):
        altered=json.dumps(dict(self.snap,checkedAt='2026-11-21')).encode()
        with self.assertRaisesRegex(ValueError,'hash'):mod.candidate(altered,self.receipt,'wakulla')
    def test_denies_purchasable_record(self):
        self.row['availableForPurchase']=True
        raw=json.dumps(self.snap).encode()
        receipt=mod.review_module.review
        with self.assertRaises(ValueError):mod.candidate(raw,self.receipt,'wakulla')
    def test_denies_wrong_county(self):
        with self.assertRaisesRegex(ValueError,'county'):mod.candidate(self.raw,self.receipt,'st-johns')
    def test_denies_forged_published_receipt(self):
        receipt=dict(self.receipt,publicationAuthorized=True)
        with self.assertRaises(ValueError):mod.candidate(self.raw,receipt,'wakulla')

if __name__=='__main__':unittest.main()
