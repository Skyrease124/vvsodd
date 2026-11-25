"""Generate the Florida directory offline using the checked-in source snapshot."""
import argparse
import csv
import io
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent
CENSUS = 'https://www2.census.gov/geo/docs/reference/codes2020/cou/st12_fl_cou2020.txt'
FDOR = 'https://floridarevenue.com/property/dataportal/Documents/PTO%20Data%20Portal/User%20Guides/2025%20Users%20guide%20and%20quick%20reference/2025_NAL_SDF_NAP_Users_Guide.pdf'
OFFICIALS = 'https://floridarevenue.com/property/Pages/LocalOfficials.aspx'
STATE_LAYER = 'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0'
TERMS = 'https://www.arcgis.com/home/item.html?id=efa909d6b1c841d298b0a649e7f71cf2'
URL_OVERRIDES = {
    'Miami-Dade': 'https://www.miamidadepa.gov/pa/real-estate/property-search.page',
    'Palm Beach': 'https://pbcpao.gov/departments/gis.htm',
    'Broward': 'https://bcpa.net/',
}


def county_key(value):
    return re.sub('[^a-z0-9]', '', value.lower().replace('saint', 'st'))


def write_json(value):
    return json.dumps(value, ensure_ascii=False, indent=2) + '\n'


def generate(raw, references):
    original = list(csv.DictReader(io.StringIO(raw)))
    by_name = {county_key(row['name']): row for row in references}
    if len(original) != 67 or len(references) != 67 or len(by_name) != 67:
        raise ValueError('Expected exactly 67 unique Florida counties')
    corrected, counties, changes = [], [], []
    seen, geoids, fdor_codes = set(), set(), set()
    for row in original:
        key = county_key(row['County_Name'])
        if key in seen or key not in by_name:
            raise ValueError('Duplicate or unidentified input county: ' + row['County_Name'])
        seen.add(key)
        government = by_name[key]
        state, fips, fdor = (government[k] for k in ('stateFips', 'countyFips', 'fdorCode'))
        if state != '12' or not re.fullmatch(r'\d{3}', fips) or not re.fullmatch(r'\d{2}', fdor):
            raise ValueError('Invalid official county identifier: ' + government['name'])
        geoid = state + fips
        if geoid in geoids or fdor in fdor_codes:
            raise ValueError('Duplicate official identifier')
        geoids.add(geoid)
        fdor_codes.add(fdor)
        appraiser = URL_OVERRIDES.get(government['name'], government['appraiserUrl'])
        listed, uploaded = urlsplit(appraiser), urlsplit(row['County_Property_Appraiser_URL'])
        if (listed.scheme == 'http' and uploaded.scheme == 'https'
                and (listed.hostname or '').removeprefix('www.') == (uploaded.hostname or '').removeprefix('www.')
                and listed.path.rstrip('/') == uploaded.path.rstrip('/')
                and listed.query == uploaded.query and listed.fragment == uploaded.fragment):
            appraiser = row['County_Property_Appraiser_URL']
        if urlsplit(appraiser).scheme not in ('http', 'https') or not urlsplit(appraiser).hostname:
            raise ValueError('Invalid appraiser URL')
        values = {
            **row, 'County_Name': government['name'], 'State_FIPS': state, 'County_FIPS': fips,
            'Full_FIPS': geoid, 'FDOR_County_Code': fdor, 'County_Property_Appraiser_URL': appraiser,
            'FGIO_Statewide_Parcels_Portal': TERMS, 'GEOID': geoid,
        }
        corrected.append(values)
        for field, old in row.items():
            if old != values[field]:
                if field == 'County_Property_Appraiser_URL':
                    evidence = [appraiser if government['name'] in URL_OVERRIDES else OFFICIALS]
                elif field == 'FGIO_Statewide_Parcels_Portal':
                    evidence = [TERMS]
                else:
                    evidence = [FDOR if field == 'FDOR_County_Code' else CENSUS]
                changes.append({'county': government['name'], 'field': field, 'original': old,
                                'corrected': values[field], 'evidence': evidence})
        counties.append({
            'name': government['name'], 'stateFips': state, 'countyFips': fips, 'geoid': geoid,
            'fdorCode': fdor, 'appraiserUrl': appraiser, 'fdorDirectoryUrl': government['appraiserUrl'],
            'sourceId': 'floridagio-cadastral', 'sourceCountyValue': int(fdor),
            **({'alternateSourceIds': ['santa-rosa-open-data']} if key == 'santarosa' else {}),
            'countyEvidenceStatus': 'unverified', 'liveExecutionEnabled': False, 'publicationEnabled': False,
        })
    buffer = io.StringIO(newline='')
    writer = csv.DictWriter(buffer, fieldnames=list(corrected[0]), lineterminator='\n')
    writer.writeheader()
    writer.writerows(corrected)
    registry = {
        'reviewedOn': '2026-11-22',
        'evidence': {'census': CENSUS, 'fdor': FDOR, 'countyOfficials': OFFICIALS},
        'sources': {'floridagio-cadastral': {
            'status': 'Source validated', 'validationScope': 'Public layer metadata only',
            'url': STATE_LAYER, 'agency': 'Florida Geographic Information Office · Florida Department of Revenue · Florida county property appraisers',
            'type': 'ArcGIS FeatureServer', 'layerId': 0,
            'parcelField': 'PARCELNO', 'countyField': 'CO_NO', 'situsField': 'PHY_ADDR1',
            'geometryType': 'esriGeometryPolygon', 'nativeWkid': 6439, 'nativeAlias': 102967,
            'requiredOutputWkid': 4326, 'supportsPagination': True, 'maxRecordCount': 2000, 'verifiedOn': '2026-11-22',
            'publicQueryAdvertised': True, 'rateLimit': None,
            'restrictions': 'Public metadata advertises Query and Extract. Observe confidentiality protections and survey-use limitations. Commercial redistribution remains unverified.',
            'termsUrl': TERMS, 'evidence': [STATE_LAYER, TERMS, FDOR],
        }, 'santa-rosa-open-data': {
            'status': 'Source validated', 'validationScope': 'Public layer metadata only',
            'url': 'https://services.arcgis.com/Eg4L1xEv2R3abuQd/arcgis/rest/services/ParcelsOpenData/FeatureServer/0',
            'agency': 'Santa Rosa County GIS · Santa Rosa County Property Appraiser',
            'type': 'ArcGIS FeatureServer', 'layerId': 0, 'parcelField': 'ParcelDisp',
            'countyField': None, 'situsField': None, 'unverifiedAddressFields': ['Addr1', 'Addr2', 'Addr3'],
            'geometryType': 'esriGeometryPolygon', 'nativeWkid': 3857, 'nativeAlias': 102100,
            'requiredOutputWkid': 4326, 'supportsPagination': True, 'maxRecordCount': 2000,
            'publicQueryAdvertised': True, 'rateLimit': None, 'verifiedOn': '2026-11-22',
            'restrictions': 'Confirm situs field semantics and reuse terms. Parcel lines are for assessment purposes.',
            'termsUrl': 'https://srcpa.gov/map-disclaimer/',
            'evidence': ['https://santarosa.fl.gov/470/Mapping-GIS',
                         'https://srcpa.gov/public-records-request/',
                         'https://www.arcgis.com/home/item.html?id=d25e0d2cb3184203a24887a4ac3fe001'],
        }},
        'counties': counties,
    }
    return {
        ROOT / 'directory.corrected.csv': buffer.getvalue(),
        ROOT / 'directory.audit.json': write_json(changes),
        ROOT.parents[1] / 'netlify/lib/data/florida-gis-registry.json': write_json(registry),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    check = parser.parse_args().check
    outputs = generate((ROOT / 'directory.original.csv').read_text(),
                       json.loads((ROOT / 'official-identifiers.json').read_text()))
    for path, contents in outputs.items():
        if check:
            if path.read_text() != contents:
                raise SystemExit(f'{path.name} needs regeneration')
        else:
            path.write_text(contents)


if __name__ == '__main__':
    main()
