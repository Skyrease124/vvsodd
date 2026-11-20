import importlib.util
import pathlib
import unittest

spec=importlib.util.spec_from_file_location('certificate_status',pathlib.Path(__file__).resolve().parents[1]/'scripts'/'certificate-status.py')
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class CertificateStatusTests(unittest.TestCase):
    def test_county_held_unredeemed_no_tda(self):
        result=mod.classify({'certificateTypeRaw':'County Held','certificateStatusRaw':'Unredeemed','taxDeedApplicationRaw':'No'})
        self.assertEqual(result['holdingType'],'county-held')
        self.assertEqual(result['redemptionStatus'],'reported-unredeemed')
        self.assertEqual(result['taxDeedStatus'],'no-application-reported')
        self.assertFalse(result['availableForPurchase'])
    def test_individually_held_with_tda(self):
        result=mod.classify({'certificateTypeRaw':'Individual Held','certificateStatusRaw':'Unredeemed','taxDeedApplicationRaw':'Yes'})
        self.assertEqual(result['holdingType'],'individually-held')
        self.assertEqual(result['taxDeedStatus'],'application-reported')
        self.assertFalse(result['availableForPurchase'])
    def test_wakulla_county_type_code(self):
        self.assertEqual(mod.classify({'countyOrIndividualRaw':'C'})['holdingType'],'county-held')
        self.assertEqual(mod.classify({'countyOrIndividualRaw':'I'})['holdingType'],'individually-held')
    def test_redemption_date_overrides_stale_status_and_flags_conflict(self):
        result=mod.classify({'certificateStatusRaw':'Unredeemed','redemptionDateRaw':'11/01/2026'})
        self.assertEqual(result['redemptionStatus'],'reported-redeemed')
        self.assertIn('redemption-date-conflicts-with-status',result['verificationFlags'])
    def test_missing_data_never_invents_positive_status(self):
        result=mod.classify({})
        self.assertEqual(result['holdingType'],'unknown')
        self.assertEqual(result['redemptionStatus'],'unknown')
        self.assertEqual(result['taxDeedStatus'],'unknown')
        self.assertFalse(result['availableForPurchase'])
    def test_summary_updates_records(self):
        rows=[{'certificateTypeRaw':'County Held','certificateStatusRaw':'Unredeemed','taxDeedApplicationRaw':'No'},
              {'certificateTypeRaw':'Individual Held','redemptionDateRaw':'11/02/2026'}]
        summary=mod.classify_all(rows)
        self.assertEqual(summary['holdingType']['county-held'],1)
        self.assertEqual(summary['redemptionStatus']['reported-redeemed'],1)
        self.assertEqual(len(rows[0]['verificationFlags']),0)
if __name__=='__main__':unittest.main()
