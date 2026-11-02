// Florida tax certificate sale info and lien listings.
// RULE: every entry in LIENS must come from an official county or state list and carry `source` (URL) and `checked` (YYYY-MM-DD).
// Row shape: {county:'Lee', parcel:'12-34-56-00-0000', amount:1234.56, saleDate:'2027-05-20', status:'Offered|Sold|Redeemed', rate:'5.25%' (optional, winning rate once sold), source:'https://...', checked:'2027-05-01'}
const FL_SALE = {
  nextSale: 'On or before June 1, 2027',
  listsPosted: 'Delinquent lists are usually advertised in April and May',
  steps: [
    'Property taxes become delinquent on April 1, with a 3% penalty added.',
    'The county tax collector advertises the delinquent list (usually in May) and must hold the tax certificate sale on or before June 1.',
    'Bidding starts at 18% interest and is bid down. The lowest rate wins the certificate. The floor is 0.25%.',
    'The owner can redeem by paying the tax plus the interest. A certificate holder can apply for a tax deed after 2 years.'
  ],
  statute: ['Fla. Stat. 197.432 (the sale)', 'http://www.leg.state.fl.us/Statutes/index.cfm?App_mode=Display_Statute&URL=0100-0199/0197/Sections/0197.432.html'],
  portal: ['Florida Tax Sale Portal', 'https://www.flataxsales.com/Home.aspx'],
  portalCounties: ['Baker','Bradford','Calhoun','DeSoto','Franklin','Glades','Gulf','Hamilton','Hardee','Holmes','Jefferson','Jackson','Liberty','Okeechobee','Wakulla','Madison','Washington'],
  // Official delinquent / tax certificate list pages (each opened when checked)
  lists: {
    'Palm Beach': 'https://www.pbctax.gov/services/property-tax/tax-certificates',
    'Pasco': 'https://pascotaxes.com/taxes/tax-information/delinquent-real-estate-taxes/tax-sale-information/',
    'Marion': 'https://mariontax.com/delinquent-taxes',
    'Walton': 'https://waltontaxcollector.com/services/property-taxes/delinquent-taxes',
    'Nassau': 'https://www.nassautaxes.com/Content/Delinquent',
    'Santa Rosa': 'https://srctc.com/real-estate/delinquent-tax-information/'
  }
};
const LIENS = []; // 2027 sale lists are not posted yet. Older liens load from official files (see liens-*.js).

// Parcel outline lookups (public county GIS). Add a county here only after testing that its parcel numbers match.
const PARCEL_MAPS = {
  'Palm Beach': {
    query: 'https://services1.arcgis.com/ZWOoUZbtaYePLlPw/ArcGIS/rest/services/Parcels/FeatureServer/0/query',
    idField: 'PARID',
    fmt: pin => pin.replace(/-/g, ''),
    page: pin => 'https://www.pbcgov.org/papa/Asps/PropertyDetail/PropertyDetail.aspx?parcel=' + pin.replace(/-/g, ''),
    facts: 'https://services1.arcgis.com/ZWOoUZbtaYePLlPw/ArcGIS/rest/services/Property_Information_Table/FeatureServer/0/query',
    pageName: 'Palm Beach County Property Appraiser'
  }
};

// Shown on every county page: what to check before buying a lien.
const DUE_DILIGENCE = [
  'Look up the parcel on the county property appraiser site: owner of record, property use, assessed value and tax history.',
  'Check whether the lot can be built on (zoning, flood zone, access). Many county-held parcels are thin strips, road buffers or canal edges.',
  'Look for other liens, a mortgage, code-enforcement fines or a bankruptcy. Ask the county or a title company.',
  'Homestead (owner-occupied) properties are handled differently. Confirm the rules with the tax collector.',
  'Confirm the payoff, the rate and how to buy with the tax collector before you pay anything.',
  'Talk to a Florida real estate attorney before relying on a lien. This site is educational only.'
];
