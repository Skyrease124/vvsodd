import json
import unittest

from build import ROOT, generate


class DirectoryTest(unittest.TestCase):
    def setUp(self):
        self.raw = (ROOT / 'directory.original.csv').read_text()
        self.references = json.loads((ROOT / 'official-identifiers.json').read_text())

    def test_duplicate_input_rejected(self):
        lines = self.raw.splitlines()
        lines[2] = lines[1]
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            generate('\n'.join(lines), self.references)

    def test_invalid_authoritative_fips_rejected(self):
        self.references[0]['countyFips'] = '1'
        with self.assertRaisesRegex(ValueError, 'Invalid official county identifier'):
            generate(self.raw, self.references)


if __name__ == '__main__':
    unittest.main()
