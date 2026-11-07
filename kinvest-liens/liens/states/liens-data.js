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
  // Report download pages linked from the counties' own sites (they sit behind a browser check, so open them in a browser)
  reports: {
    'Pasco': 'https://pasco.county-taxes.com/public/reports',
    'Santa Rosa': 'https://santarosa.county-taxes.com/public/reports/real_estate'
  },
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
  },
  'Pinal': {
    query: 'https://gis.pinal.gov/mapping/rest/services/TaxParcels/FeatureServer/3/query',
    idField: 'PARCELID',
    fmt: pin => pin.slice(0, 9),
    page: pin => 'https://treasurer.pinal.gov/ParcelInquiry/Main/TaxLienSale',
    pageName: 'Pinal County Treasurer'
  },
  'Larimer': {
    query: 'https://maps1.larimer.org/arcgis/rest/services/MapServices/Parcels/MapServer/3/query',
    idField: 'PARCELNUM',
    fmt: pin => pin,
    page: pin => 'https://www.larimer.gov/assessor',
    pageName: 'Larimer County Assessor'
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

// "How to buy this lien": per-county guidance shown from every lien. Only facts from the county's own pages or the statute;
// where a county has no link that opens one parcel's purchase page, we say so and link the official page instead.
const COUNTY_BUY = {
  'Palm Beach': {
    office: 'Palm Beach County Tax Collector',
    status: l => 'County-held certificate: it was not bought at the tax sale, so the county holds it. Under Florida law, anyone may buy a county-held certificate before a tax deed application is made. Whether this one is still available changes, so confirm with the Tax Collector.',
    record: {label: 'Open the property record (Property Appraiser)', url: pin => PARCEL_MAPS['Palm Beach'].page(pin)},
    links: [['Tax Collector: tax certificates (county-held list and contact)', 'https://www.pbctax.gov/services/property-tax/tax-certificates'], ['Florida statute 197.432', FL_SALE.statute[1]]],
    steps: [
      'Open the property record and check the lot, the county value and what is on it.',
      'Contact the Palm Beach County Tax Collector\u2019s tax certificate office (use the page below). Give them the parcel number and the certificate number shown here.',
      'Ask: is this certificate still available, what is the exact payoff today (interest keeps adding up), how do I pay, and what fee applies per certificate.',
      'Before you pay, look up the owner and tax history on the county records, and read the statute so you know the redemption and tax deed rules.'
    ]
  },
  'Larimer': {
    office: 'Larimer County Treasurer',
    status: l => 'Advertised for the county\u2019s tax lien sale on ' + (l.saleDate || 'the sale date') + '. It is not sold yet, and the owner can pay before the sale, which takes it off the list.',
    record: null,
    links: [['Larimer County Treasurer: tax lien sale (rules, registration, location)', 'https://www.larimer.gov/treasurer/thirdparty/liens/sale']],
    steps: [
      'Read the county\u2019s sale page for the location, whether bidding is in person or online, and the registration rules.',
      'The county\u2019s notice says bidders must be at least 18 and give a W-9, and that payment is by check for the exact amount (a bad check can mean forfeiture and a ban). Confirm the current rules.',
      'In Colorado the interest rate is set by bidding at the sale, so it is not known in advance. Use Calculate with the rate you expect.',
      'Call the Treasurer\u2019s office at (970) 498-7020 to ask whether this parcel is still on the list and how to register.'
    ],
    phone: '(970) 498-7020'
  },
  'Pinal': {
    office: 'Pinal County Treasurer',
    status: l => 'On the Treasurer\u2019s Tax Lien Sale List (PDF dated 11/3/2026). Whether this lien is still available to buy, and the interest rate, must be confirmed with the Treasurer.',
    record: null,
    links: [['Pinal County Treasurer: Tax Lien Sale List and parcel inquiry', 'https://treasurer.pinal.gov/ParcelInquiry/Main/TaxLienSale'], ['Pinal County Treasurer home', 'https://treasurer.pinal.gov/']],
    steps: [
      'Open the Treasurer\u2019s lien list page and look for this parcel number. The county\u2019s site may ask you to confirm you are a person first.',
      'Contact the Treasurer\u2019s office to ask whether this lien is still for sale, the interest rate, and how to register and pay. Arizona\u2019s cap is 16%.',
      'An Arizona lien holder cannot start a foreclosure until 3 years after the sale, and the owner can pay it off any time before that.',
      'Look up the property on the county Assessor\u2019s site before you decide.'
    ]
  }
};
