"""Official Palm Beach list provenance is holder evidence, not purchase eligibility."""
import importlib.util
import pathlib
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[1]
def module(name,filename):
    spec=importlib.util.spec_from_file_location(name,ROOT/'scripts'/filename)
    obj=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(obj)
    return obj
importer=module('palm_importer','stage-palm-beach-certificates.py')
status=module('cert_status','certificate-status.py')

class PalmHolderProvenanceTest(unittest.TestCase):
    def test_official_county_held_list_classifies_holder_without_sale_claim(self):
        head=['PIN','Certificate Number','Tax Year','Face Amount','Interest Rate','Total Amt']
        rows=[head,['74-42-43-13-17-004-0000','102','2017','177.20','18','390.77']]
        url='https://www.pbctax.gov/wp-content/uploads/2026/11/County_Certs_PBCTax-11.2.26.xlsx'
        report=importer.normalize(rows,url)
        self.assertEqual(report['summary']['accepted'],1)
        importer.apply_status_classification(report)
        rec=report['records'][0]
        self.assertEqual(rec['holdingType'],'county-held')
        self.assertEqual(rec['holderEvidenceSource'],'official-county-held-list')
        self.assertEqual(rec['redemptionStatus'],'unknown')
        self.assertEqual(rec['taxDeedStatus'],'unknown')
        self.assertFalse(rec['availableForPurchase'])
        self.assertEqual(rec['status'],'unverified')
    def test_blank_status_never_becomes_unredeemed(self):
        rec={'certificateTypeRaw':'County Held'}
        data=status.classify(rec)
        self.assertEqual(data['holdingType'],'county-held')
        self.assertEqual(data['redemptionStatus'],'unknown')
        self.assertFalse(data['availableForPurchase'])

if __name__=='__main__':
    unittest.main()
