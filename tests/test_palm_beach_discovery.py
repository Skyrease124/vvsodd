import importlib.util
import pathlib
import unittest

spec=importlib.util.spec_from_file_location('discover',pathlib.Path(__file__).resolve().parents[1]/'scripts'/'discover-palm-beach-source.py')
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
class DiscoveryTests(unittest.TestCase):
    def test_approved_link(self):
        html='<a href="/wp-content/uploads/2026/11/certs.xlsx">List of current county held certificates.</a>'
        self.assertEqual(mod.resolve_from_html(html),'https://www.pbctax.gov/wp-content/uploads/2026/11/certs.xlsx')
    def test_reject_wrong_domain(self):
        with self.assertRaisesRegex(ValueError,'Unapproved'):
            mod.resolve_from_html('<a href="https://evil.example/certs.xlsx">List of current county held certificates</a>')
    def test_reject_non_spreadsheet(self):
        with self.assertRaisesRegex(ValueError,'not XLSX'):
            mod.resolve_from_html('<a href="/somefile.pdf">List of current county held certificates</a>')
    def test_no_link(self):
        with self.assertRaisesRegex(ValueError,'Expected one'):
            mod.resolve_from_html('<html></html>')
if __name__=='__main__':unittest.main()
