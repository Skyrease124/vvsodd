import importlib.util
import json
import pathlib
import tempfile
import unittest

spec=importlib.util.spec_from_file_location('certdiff',pathlib.Path(__file__).resolve().parents[1]/'scripts'/'compare-certificate-snapshots.py')
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
def row(parcel,**changes):
    value={'state':'FL','county':'St. Johns','parcelId':parcel,'certificateNumber':'11',
           'certificateYear':'2026','redemptionStatus':'reported-unredeemed','taxDeedStatus':'unknown',
           'availableForPurchase':False}
    value.update(changes)
    return value
class SnapshotDiffTest(unittest.TestCase):
    def setUp(self):
        self.directory=tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
    def write(self,filename,records,source='https://county.gov/certs.csv'):
        p=pathlib.Path(self.directory.name)/filename
        p.write_text(json.dumps({'source':source,'checkedAt':'2026-11-20','records':records}))
        return p
    def test_baseline_reports_no_redemption(self):
        report=mod.compare(self.write('new.json',[row('123')]))
        self.assertEqual(report['mode'],'initial-baseline')
        self.assertEqual(report['summary']['added'],0)
    def test_added_missing_and_status(self):
        before=self.write('before.json',[row('123'),row('456')])
        after=self.write('after.json',[row('123',redemptionStatus='reported-redeemed',redemptionDateRaw='11/20/2026'),row('789')])
        report=mod.compare(after,before)
        self.assertEqual(report['summary']['added'],1)
        self.assertEqual(report['summary']['missingFromLatest'],1)
        self.assertEqual(report['summary']['statusChanged'],1)
        self.assertFalse(next(x for x in report['changes'] if x['type']=='missing-from-report')['isRedemptionConfirmed'])
    def test_amount_update(self):
        before=self.write('old.json',[row('123',dueAmount='100.00')])
        after=self.write('new.json',[row('123',dueAmount='110.00')])
        self.assertEqual(mod.compare(after,before)['summary']['amountChanged'],1)
    def test_cross_source_refused(self):
        before=self.write('old.json',[row('123')])
        after=self.write('new.json',[row('123')],source='https://other.gov/different.csv')
        with self.assertRaisesRegex(ValueError,'source URLs'):
            mod.compare(after,before)
    def test_duplicates_fail(self):
        current=self.write('new.json',[row('123'),row('123')])
        with self.assertRaisesRegex(ValueError,'duplicate'):
            mod.compare(current)
if __name__=='__main__':unittest.main()
