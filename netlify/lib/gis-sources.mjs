// Official parcel sources for position matching. Each entry is one public ArcGIS layer, with the field names,
// address rules, bounding box, evidence link and usage terms that apply to it. Adding a county means adding an
// entry here and running tools/parcel-match/run.mjs; the matching rules themselves live in parcel-match.mjs.
// Only free public services are listed. No source here needs a key.
import {parseAddress, canonicalStreet} from './parcel-match.mjs';

const int = v => (/^\d+$/.test(String(v ?? '').trim()) ? parseInt(String(v).trim(), 10) : null);
const quote = v => "'" + String(v).replace(/'/g, "''") + "'";

const ROCHESTER_LAYER = 'https://maps.cityofrochester.gov/server/rest/services/Open_Data/Tax_Parcels_Open_Data/FeatureServer/0';
const MONROE_LAYER = 'https://services2.arcgis.com/WosK7QpOS4eVSn36/ArcGIS/rest/services/Public_Parcels_2024/FeatureServer/0';
// Scott County, Iowa Cadastral service, layer 3 "Parcel" (polygons). Layer 0 is parcel points, 1 Subdivision, 2 Block,
// 4 ROW and 5 Lot. Layer 5 has only a lot number, so it cannot be matched to a record and is not used.
const SCOTT_LAYER = 'https://services.arcgis.com/ovln19YRWV44nBqV/arcgis/rest/services/Cadastral/FeatureServer/3';

// Known defects in a dataset's addresses, reversed for matching only. Found while matching: the City list builder
// (tools/rochester-ny/build.py) replaced " Av" with " Ave" inside words, so "Avenue", "Averill" and "Avis" were stored
// as "Aveenue", "Aveerill" and "Aveis". The official layer has the correct spelling, which the approved record uses.
export const ADDRESS_ARTIFACT_FIXES = Object.freeze({
  'NY-city-of-rochester': Object.freeze([
    {pattern: /\bAveenue\b/gi, to: 'Avenue'},
    {pattern: /\bAveerill\b/gi, to: 'Averill'},
    {pattern: /\bAveis\b/gi, to: 'Avis'},
  ]),
});

// To add a county, copy one entry and give the layer's own names:
//   parcelField  the attribute that holds the parcel number, compared after "normalize":
//                ny-sbl (New York section-block-lot), alphanumeric (letters and digits) or exact (as written)
//   fields       the attribute names for siteAddress, low, high, street, zip, parcelId, printKey and acres
//   bbox         the county's bounding box; a polygon outside it is a conflict, not a match
//   covers       the state and county the layer serves (datasets are matched by these exact names)
// Nothing is matched until an entry exists and tools/parcel-match/run.mjs is run for the dataset.
export const SOURCES = Object.freeze({
  'city-of-rochester-tax-parcels': {
    id: 'city-of-rochester-tax-parcels',
    label: 'City of Rochester Tax Parcels (Open Data, updated 2025)',
    priority: 1,
    covers: [{state: 'NY', county: 'City of Rochester'}],
    layerUrl: ROCHESTER_LAYER,
    itemUrl: 'https://www.arcgis.com/home/item.html?id=71d6ba096e9b43309b10e7aad9c96ac8',
    // The item was last modified 2025-06-09 and the service describes yearly updates.
    dataDate: '2025',
    itemModified: '2025-06-09',
    parcelField: 'PRINTKEY',
    normalize: 'ny-sbl',
    fields: {parcel: 'PRINTKEY', siteAddress: 'SITEADDRESS', zip: 'ZIP5', parcelId: 'PARCELID', printKey: 'PRINTKEY', acres: 'SHAPEACRES'},
    bbox: [-77.85, 43.0, -77.45, 43.3],
    toAddress: a => {
      const site = parseAddress(a.SITEADDRESS || '');
      const low = int(a.LOW_STREET_NUM) ?? int(a.STREET_NUM) ?? site.low;
      const high = int(a.HIGH_STREET_NUM) ?? int(a.STREET_NUM) ?? site.high ?? low;
      return {low, high, street: a.STREET_NAME ? canonicalStreet(a.STREET_NAME) : site.street, zip: a.ZIP5 ? String(a.ZIP5).trim() : null};
    },
    official: a => ({parcelId: a.PARCELID || null, printKey: a.PRINTKEY || null, siteAddress: a.SITEADDRESS || null,
      zip: a.ZIP5 || null, acres: typeof a.SHAPEACRES === 'number' ? Math.round(a.SHAPEACRES * 1000) / 1000 : null}),
    evidence: parcel => ROCHESTER_LAYER + '/query?where=' + encodeURIComponent('PRINTKEY=' + quote(parcel)) + '&outFields=*&f=html',
    terms: {
      url: 'https://data.cityofrochester.gov/pages/terms',
      summary: 'Free public informational service. Provided as is, with no warranty. Any derivative application must show the City disclaimer where the application is accessed.',
    },
    // Required wording for any application that uses the City's data (DataROC Terms of Use, "Use of Data").
    disclaimer: 'The data made available here has been modified for use from its original source, which is the official website of the City of Rochester, NY. The City of Rochester makes no claims as to the accuracy, timeliness, content, or completeness of any of the data provided in this application. The City of Rochester makes no warranty of the accuracy or fitness for any particular use; nor are any such warranties to be implied or inferred with respect to the information or data furnished herein. The data is subject to change as modifications and updates are complete.',
  },
  'monroe-county-public-parcels': {
    id: 'monroe-county-public-parcels',
    label: 'Monroe County Public Parcels layer (ArcGIS item owned by penfieldny.admin)',
    priority: 2,
    // Secondary only: checked for the City's parcels as a cross-check. Its rows cover Penfield and Webster addresses,
    // not the City, so it can confirm or contradict a City match only where it has the same parcel.
    covers: [{state: 'NY', county: 'Monroe'}],
    secondaryFor: [{state: 'NY', county: 'City of Rochester'}],
    layerUrl: MONROE_LAYER,
    itemUrl: 'https://www.arcgis.com/home/item.html?id=e61dfcfe824246e69e922621ae6f99ff',
    dataDate: 'layer last data edit 2025-12-03; item modified 2026-02-17',
    itemModified: '2026-02-17',
    parcelField: 'PRINTKEY',
    normalize: 'ny-sbl',
    bbox: [-78.2, 42.8, -77.1, 43.5],
    toAddress: a => {
      const number = int(a.PARCELADDRESSNUMBER);
      const street = canonicalStreet([a.PARCELADDRESSSTREETPREFIXDIR, a.PARCELADDRESSSTREETNAME, a.PARCELADDRESSSTREETSUFFIX, a.PARCELADDRESSSTREETPOSTDIR].filter(Boolean).join(' '));
      return {low: number, high: number, street, zip: a.PARCELADDRESSZIPCODE ? String(a.PARCELADDRESSZIPCODE).slice(0, 5) : null};
    },
    official: a => ({parcelId: a.COUNTYSBL || null, printKey: a.PRINTKEY || null, siteAddress: a.PARCELADDRESS || null,
      zip: a.PARCELADDRESSZIPCODE || null, acres: typeof a.ACRES === 'number' ? Math.round(a.ACRES * 1000) / 1000 : null}),
    evidence: parcel => MONROE_LAYER + '/query?where=' + encodeURIComponent('PRINTKEY=' + quote(parcel)) + '&outFields=*&f=html',
    terms: {
      url: 'https://www.arcgis.com/home/item.html?id=e61dfcfe824246e69e922621ae6f99ff',
      summary: 'Monroe County licence: free to copy and use; no warranty of any kind; not to be sold except under a written agreement with Monroe County.',
    },
    disclaimer: 'Parcel data from the Monroe County Public Parcels layer. Provided without warranty of any kind.',
  },
  'scott-county-ia-parcels': {
    id: 'scott-county-ia-parcels',
    label: 'Scott County, Iowa Cadastral service: Parcel layer (county GIS, ArcGIS)',
    priority: 1,
    covers: [{state: 'IA', county: 'Scott'}],
    layerUrl: SCOTT_LAYER,
    itemUrl: 'https://www.arcgis.com/home/item.html?id=09c82cc24dd24af6beb2ebf85bd6fa30',
    // Read from the layer's editingInfo on the service (2026-11-24): the last data edit was 2026-11-13.
    dataDate: 'layer last data edit 2026-11-13 (ArcGIS editingInfo)',
    itemModified: '2026-11-13',
    parcelField: 'PIN',
    // The county's PIN is compared exactly as written. Records keyed by other numbers (for example manufactured-home
    // serials) are not in this layer and stay pending.
    normalize: 'exact',
    bbox: [-91.0, 41.4, -90.25, 41.85],
    fields: {parcel: 'PIN', siteAddress: 'PropertyAddress', parcelId: 'AlternateID', printKey: 'PIN', acres: 'Gross_AC'},
    terms: {
      url: 'https://www.arcgis.com/home/item.html?id=09c82cc24dd24af6beb2ebf85bd6fa30',
      summary: 'Copyright: Scott County, Iowa GIS, as published on the county ArcGIS service. The service publishes no separate terms of use. Confirm the county terms before publishing derived data.',
    },
    disclaimer: 'Source: Scott County, Iowa GIS, Cadastral Parcel layer (ArcGIS). Boundaries as published by the county; not a survey.',
  },
});

// Ordered sources for a dataset: the dataset's own county first, then secondary sources that cover it.
export function sourcesFor(state, county) {
  const primary = Object.values(SOURCES).filter(s => s.covers.some(c => c.state === state && c.county === county))
    .sort((a, b) => a.priority - b.priority);
  const secondary = Object.values(SOURCES).filter(s => (s.secondaryFor || []).some(c => c.state === state && c.county === county))
    .sort((a, b) => a.priority - b.priority);
  return [...primary, ...secondary.filter(s => !primary.includes(s))];
}
