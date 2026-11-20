import importlib.util
import pathlib
import unittest

spec=importlib.util.spec_from_file_location('wakulla_source',pathlib.Path(__file__).resolve().parents[1]/'scripts'/'discover-wakulla-source.py')
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
class WakullaDiscoveryTests(unittest.TestCase):
    def test_current_xlsx(self):
        html='<a href="/s/WakullaCountyCertificates-esft.xlsx">Download County Certificate List</a>'
        self.assertEqual(mod.resolve_from_html(html),'https://wakullatax.com/s/WakullaCountyCertificates-esft.xlsx')
    def test_reject_external_host(self):
        with self.assertRaisesRegex(ValueError,'Unapproved'):
            mod.resolve_from_html('<a href="https://example.com/list.xlsx">Download County Certificate List</a>')
    def test_reject_non_xlsx(self):
        with self.assertRaisesRegex(ValueError,'file type'):
            mod.resolve_from_html('<a href="/s/list.zip">Download County Certificate List</a>')
    def test_missing_link(self):
        with self.assertRaisesRegex(ValueError,'Expected one'):
            mod.resolve_from_html('<html></html>')
if __name__=='__main__':unittest.main()
