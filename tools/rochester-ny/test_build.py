"""Tests for the Rochester list builder's address text.  Run:  python3 tools/rochester-ny/test_build.py"""
import json
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build  # noqa: E402  (build.py only runs its main block when executed directly)


class AddressText(unittest.TestCase):
    def test_avenue_keeps_its_spelling(self):
        self.assertEqual(build.addr('363 AVENUE A', '14621'), '363 Avenue A, Rochester NY 14621')
        self.assertEqual(build.addr('481-483 AVENUE D', '14621'), '481-483 Avenue D, Rochester NY 14621')

    def test_street_names_that_start_with_av_keep_their_spelling(self):
        self.assertEqual(build.addr('653 AVERILL AV', '14607'), '653 Averill Ave, Rochester NY 14607')
        self.assertEqual(build.addr('139 AVIS ST', '14615'), '139 Avis St, Rochester NY 14615')

    def test_av_abbreviation_is_written_ave(self):
        self.assertEqual(build.addr('10 AV A', '14621'), '10 Ave A, Rochester NY 14621')

    def test_pk_is_expanded_as_a_word_only(self):
        self.assertEqual(build.addr('5 PK AVE', '14620'), '5 Park Ave, Rochester NY 14620')
        self.assertEqual(build.addr('7 PKWY', '14620'), '7 Pkwy, Rochester NY 14620')

    def test_leading_zeros_are_still_removed(self):
        self.assertEqual(build.addr('0081-83 ABERDEEN ST', '14619'), '81-83 Aberdeen St, Rochester NY 14619')

    def test_each_correction_is_what_the_builder_writes_for_the_official_text(self):
        with open(os.path.join(HERE, 'address-corrections.json'), encoding='utf8') as f:
            manifest = json.load(f)
        self.assertEqual(len(manifest['corrections']), 11)
        for c in manifest['corrections']:
            official = c['official']
            self.assertEqual(build.addr(official['siteAddress'].upper(), official['zip']), c['corrected'], c['parcel'])
            self.assertNotRegex(c['corrected'], r'Aveenue|Aveerill|Aveis')


if __name__ == '__main__':
    unittest.main()
