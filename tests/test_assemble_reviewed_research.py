import importlib.util
import pathlib
import unittest

spec=importlib.util.spec_from_file_location('research',pathlib.Path(__file__).resolve().parents[1]/'scripts'/'assemble-reviewed-research.py')
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
class ResearchAssemblyTest(unittest.TestCase):
    def candidate(self):
        return {'schemaVersion':1,'publicationState':'awaiting-separate-human-merge',
          'reviewedBy':'Skyrease124','reviewReceiptSha256':'a'*64,'sourceSnapshotSha256':'b'*64,
          'record':{'state':'FL','county':'Wakulla','certificateKey':'fl|wakulla|1|2|2024',
           'parcelId':'1','certificateNumber':'2','taxYear':'2024',
           'listingType':'tax-certificate-research-only',
           'researchReviewStatus':'approved-for-research','status':'unverified',
           'availableForPurchase':False,'purchaseLink':None,
           'disclaimer':'Research only; verify details directly with the county collector before any decision.'}}
    def test_valid_research_only(self):
        result=mod.assemble([self.candidate()])
        self.assertEqual(len(result['records']),1)
        self.assertFalse(result['records'][0]['availableForPurchase'])
    def test_empty_defaults_safe(self):
        result=mod.assemble([])
        self.assertEqual(result['records'],[])
        self.assertIsNone(result['publishedAt'])
    def test_reject_owner_name(self):
        c=self.candidate();c['record']['ownerName']='somebody'
        with self.assertRaisesRegex(ValueError,'Unexpected field'):mod.assemble([c])
    def test_reject_purchase_flag(self):
        c=self.candidate();c['record']['availableForPurchase']=True
        with self.assertRaisesRegex(ValueError,'Unsafe'):mod.assemble([c])
    def test_reject_pending_or_rejected_review(self):
        c=self.candidate();c['record']['researchReviewStatus']='needs-follow-up'
        with self.assertRaisesRegex(ValueError,'Unsafe'):mod.assemble([c])
    def test_reject_duplicates(self):
        c=self.candidate()
        with self.assertRaisesRegex(ValueError,'Duplicate'):mod.assemble([c,c])
if __name__=='__main__':unittest.main()
