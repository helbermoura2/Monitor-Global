import importlib.util
import pathlib
import tempfile
import unittest
import urllib.error
from unittest.mock import patch

SCRIPT=pathlib.Path(__file__).resolve().parents[2]/'tools'/'import-telegram-imperial-preview.py'
spec=importlib.util.spec_from_file_location('imperial_preview_importer',SCRIPT)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class ImperialImportTests(unittest.TestCase):
    def test_missing_file_is_normal_noop(self):
        with tempfile.TemporaryDirectory() as temp:
            dest=pathlib.Path(temp)/'master.png'
            def not_found(*args,**kwargs):
                raise urllib.error.HTTPError('https://example.test',404,'Not Found',{},None)
            with patch.object(mod.urllib.request,'urlopen',side_effect=not_found):
                self.assertEqual(mod.import_approved_art(dest),'not-uploaded')
            self.assertFalse(dest.exists())
    def test_never_import_unverified_png(self):
        with tempfile.TemporaryDirectory() as temp:
            dest=pathlib.Path(temp)/'master.png'
            dest.write_bytes(b'not the approved PNG')
            with self.assertRaises(ValueError):
                mod.import_approved_art(dest)
    def test_fixed_digest_dimensions_source_and_destination(self):
        self.assertEqual(len(mod.SHA256),64)
        self.assertIn(mod.SHA256,mod.SOURCE)
        self.assertEqual(mod.DEST.suffix,'.png')
        self.assertTrue(str(mod.DEST).startswith('assets/telegram/m6/'))
        self.assertLessEqual(mod.MAX_BYTES,6*1024*1024)

if __name__=='__main__':
    unittest.main()
