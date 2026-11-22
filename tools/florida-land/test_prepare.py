import json
import shutil
import subprocess
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace

from prepare import prepare


class PrepareTest(unittest.TestCase):
    def setUp(self):
        directory = TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.args = SimpleNamespace(input=self.root / "source.csv", output=self.root / "out",
                                    format="csv", source="fdor-nal", geoid="12086",
                                    retrieved_at="2026-11-22T00:00:00Z", fixture=True)

    def batch(self, batch=1):
        return json.loads((self.args.output / f"batch-{batch:05}.json").read_text())

    def test_csv_is_bounded_and_identifiers_are_strings(self):
        self.args.input.write_text("PARCEL_ID,CO_NO,PHY_ADDR1,OWNER\n"
                                   + '0000123,23,"1 Main, Apt 2",private\n' * 101)
        self.assertEqual(prepare(self.args), 2)
        self.assertEqual(prepare(self.args), 2)
        row = self.batch(2)["rows"][0]
        self.assertEqual(row, {"PARCEL_ID": "0000123", "CO_NO": "23", "PHY_ADDR1": "1 Main, Apt 2"})
        self.args.input.write_text("PARCEL_ID,CO_NO,PHY_ADDR1\n0000002,23,2 Main\n")
        with self.assertRaisesRegex(ValueError, "Existing batch differs"):
            prepare(self.args)

    def test_schema_and_arcgis_coordinate_rules(self):
        self.args.input.write_text("PARCEL_ID\n0000123\n")
        with self.assertRaisesRegex(ValueError, "CSV columns"):
            prepare(self.args)
        self.args.format = "arcgis"
        self.args.input.write_text('{"spatialReference":{"wkid":6439},"features":[]}')
        with self.assertRaisesRegex(ValueError, "spatial reference"):
            prepare(self.args)
        self.args.input.write_text('{"spatialReference":{"wkid":4326},"exceededTransferLimit":true,"features":[]}')
        with self.assertRaisesRegex(ValueError, "Incomplete"):
            prepare(self.args)

    def test_geojson_requires_rfc7946(self):
        self.args.format = "geojson"
        self.args.input.write_text('{"type":"FeatureCollection","crs":{},"features":[]}')
        with self.assertRaisesRegex(ValueError, "RFC 7946"):
            prepare(self.args)

    @unittest.skipUnless(shutil.which("ogr2ogr"), "GDAL is optional for Shapefile conversion")
    def test_shapefile_transforms_known_crs(self):
        geojson = self.root / "test.geojson"
        geometry = {"type": "Polygon", "coordinates": [[[-80.3, 25.8], [-80.299, 25.8],
                    [-80.299, 25.801], [-80.3, 25.801], [-80.3, 25.8]]]}
        geojson.write_text(json.dumps({"type": "FeatureCollection", "features": [{
            "type": "Feature", "properties": {"PARCELNO": "0030520750060", "CO_NO": 23},
            "geometry": geometry}]}))
        self.args.input = self.root / "test.shp"
        subprocess.run(["ogr2ogr", "-t_srs", "EPSG:6439", str(self.args.input), str(geojson)],
                       check=True, capture_output=True)
        self.args.format = "shapefile"
        self.args.source = "floridagio"
        self.assertEqual(prepare(self.args), 1)
        self.assertEqual(self.batch()["wkid"], 4326)
        row = self.batch()["rows"][0]
        self.assertEqual(row["properties"]["PARCELNO"], "0030520750060")
        self.assertAlmostEqual(row["geometry"]["coordinates"][0][0][0], -80.3, places=5)


if __name__ == "__main__":
    unittest.main()
