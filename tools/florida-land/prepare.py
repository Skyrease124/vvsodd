"""Prepare bounded JSON batches from an authorized local file. This tool has no network I/O."""

import argparse
import csv
import json
import resource
import subprocess
from tempfile import TemporaryDirectory
from pathlib import Path

MAX_JSON_BYTES = 8 * 1024 * 1024
BATCH_BYTES = 480 * 1024
CSV_COLUMNS = {
    "fdor-nal": {"PARCEL_ID", "CO_NO", "PHY_ADDR1"},
    "sale": {"PARCEL_ID", "GEOID", "FDOR_CODE", "LISTING_ID", "EVENT_ID",
             "STATUS", "AVAILABLE", "EVIDENCE_URL"},
}


def rows(args):
    if args.format == "csv":
        csv.field_size_limit(32768)
        with args.input.open(encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            headers = reader.fieldnames or []
            required = CSV_COLUMNS["fdor-nal" if args.source == "fdor-nal" else "sale"]
            if not required.issubset(headers) or len(headers) != len(set(headers)):
                raise ValueError("Missing or duplicate CSV columns")
            yield from reader
        return
    if args.format == "shapefile":
        if args.input.suffix.lower() != ".shp" or not args.input.with_suffix(".prj").is_file():
            raise ValueError("A local .shp and its .prj are required")
        for suffix in (".shp", ".dbf", ".shx", ".prj"):
            if args.input.with_suffix(suffix).stat().st_size > MAX_JSON_BYTES:
                raise ValueError("Use a bounded Shapefile extract")
        with TemporaryDirectory() as directory:
            output = Path(directory) / "parcels.geojson"

            def cap_output():
                resource.setrlimit(resource.RLIMIT_FSIZE, (MAX_JSON_BYTES, MAX_JSON_BYTES))

            subprocess.run(["ogr2ogr", "-f", "GeoJSON", "-t_srs", "EPSG:4326",
                            "-lco", "RFC7946=YES", str(output), str(args.input.resolve())],
                           check=True, timeout=45, preexec_fn=cap_output)
            with output.open(encoding="utf-8") as handle:
                data = json.load(handle)
        if data.get("type") != "FeatureCollection" or "crs" in data:
            raise ValueError("Shapefile transformation did not produce RFC 7946 GeoJSON")
        yield from data["features"]
        return
    if args.input.stat().st_size > MAX_JSON_BYTES:
        raise ValueError("Use a bounded GeoJSON or ArcGIS export")
    with args.input.open(encoding="utf-8") as handle:
        data = json.load(handle)
    if args.format == "arcgis":
        ref = data.get("spatialReference", {})
        if (data.get("error") or data.get("exceededTransferLimit") or
                ref.get("latestWkid", ref.get("wkid")) != 4326):
            raise ValueError("Incomplete ArcGIS export or spatial reference differs from EPSG:4326")
    elif data.get("type") != "FeatureCollection" or "crs" in data:
        raise ValueError("Expected RFC 7946 GeoJSON without a CRS override")
    if not isinstance(data.get("features"), list):
        raise ValueError("Missing feature array")
    yield from data["features"]


def prepare(args):
    args.output.mkdir(exist_ok=True)
    manifest = {"sourceId": args.source, "format": "geojson" if args.format == "shapefile" else args.format, "geoid": args.geoid,
                "retrievedAt": args.retrieved_at, "fixture": args.fixture,
                "wkid": None if args.format == "csv" else 4326}
    batch = []
    size = 1024
    index = 0

    def save():
        nonlocal index
        index += 1
        name = args.output / f"batch-{index:05}.json"
        content = json.dumps({**manifest, "rows": batch}, separators=(",", ":"))
        if name.exists():
            if name.read_text() != content:
                raise ValueError(f"Existing batch differs: {name}")
            return
        with name.open("x") as handle:
            handle.write(content)

    for row in rows(args):
        # Drop all columns outside the documented evidence schema, including owner PII.
        fields = {"PARCEL_ID", "PARCELNO", "CO_NO", "GEOID", "FDOR_CODE",
                  "PHY_ADDR1", "SITUS_ADDRESS", "CLASSIFICATION", "LEGAL_REFERENCE",
                  "ACREAGE", "ZONING", "VACANT", "EVIDENCE_URL", "LISTING_ID", "EVENT_ID",
                  "STATUS", "AVAILABLE", "AVAILABLE_FROM", "AUCTION_AT", "DEADLINE", "ASKING_PRICE",
                  "OPENING_BID", "MINIMUM_BID"}
        if isinstance(row, dict):
            attrs = row.get("attributes", row.get("properties", row))
            if isinstance(attrs, dict):
                projected = {k: v for k, v in attrs.items() if k in fields}
                row = projected if args.format == "csv" else {
                    "properties": projected, "geometry": row.get("geometry")}
        row_size = len(json.dumps(row)) + 1
        if row_size > BATCH_BYTES - 1024:
            raise ValueError("One record exceeds the request limit")
        if len(batch) == 100 or size + row_size > BATCH_BYTES:
            save()
            batch = []
            size = 1024
        batch.append(row)
        size += row_size
    if batch:
        save()
    return index


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--format", choices=("csv", "geojson", "arcgis", "shapefile"), required=True)
    parser.add_argument("--source", choices=("fdor-nal", "floridagio", "miami-surplus",
                                           "palm-beach-tax-deed", "florida-dep-surplus", "putnam-land-available"), required=True)
    parser.add_argument("--geoid", required=True)
    parser.add_argument("--retrieved-at", required=True)
    parser.add_argument("--fixture", action="store_true")
    print(f"Prepared {prepare(parser.parse_args())} local batch(es).")
