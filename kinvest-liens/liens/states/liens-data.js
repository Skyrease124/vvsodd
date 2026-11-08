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
    'Leon': 'https://leontaxcollector.net/Services/property-taxes/Certificate-Lists',
    'Manatee': 'https://www.taxcollector.com/services/property-tax/tax-certs.cfm',
    'Alachua': 'https://lienhub.com/county/alachua/certsale/',
    'Bay': 'https://lienhub.com/county/bay/certsale/',
    'Miami-Dade': 'https://lienhub.com/county/miamidade/certsale/',
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
  'Miami-Dade': {
    query: 'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query',
    idField: 'CO_NO=23 AND PARCEL_ID',
    fmt: pin => pin.replace(/-/g, ''),
    page: pin => 'https://www.miamidade.gov/Apps/PA/propertysearch/#/?folio=' + pin.replace(/-/g, ''),
    pageName: 'Miami-Dade Property Appraiser'
  },
  'Bay': {
    query: 'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query',
    idField: 'CO_NO=13 AND PARCEL_ID',
    fmt: pin => pin.replace(/-/g, ''),
    page: pin => 'https://baypa.net/',
    pageName: 'Bay County Property Appraiser'
  },
  'Alachua': {
    query: 'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query',
    idField: 'CO_NO=11 AND PARCEL_ID',
    fmt: pin => pin,
    page: pin => 'https://www.acpafl.org/',
    pageName: 'Alachua County Property Appraiser'
  },
  'Manatee': {
    query: 'https://www.mymanatee.org/gisits/rest/services/opendata/General/FeatureServer/0/query',
    idField: 'PARCEL_ID',
    fmt: pin => pin,
    page: pin => 'https://www.manateepao.gov/',
    pageName: 'Manatee County Property Appraiser'
  },
  'Leon': {
    query: 'https://intervector.leoncountyfl.gov/intervector/rest/services/MapServices/TLC_OverlayParcel_D_WM/MapServer/0/query',
    idField: 'TAXID',
    fmt: pin => pin,
    page: pin => 'https://www.leonpa.gov/',
    pageName: 'Leon County Property Appraiser'
  },
  'Coconino': {
    query: 'https://services1.arcgis.com/Rlvx5g8pKeK13apH/arcgis/rest/services/Coconino_County_Parcels_Open_Data/FeatureServer/0/query',
    idField: 'APN',
    fmt: pin => pin,
    page: pin => 'https://www.coconino.az.gov/DocumentCenter/View/70663/2026-ACCT-BAL-EXTRACT-WEBSITE',
    pageName: 'Coconino County Treasurer'
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
    links: [['Register to buy online (RealAuction, the county\u2019s official sale site)', 'https://palmbeachfl.realtaxlien.com/'], ['Tax Collector: tax certificates (county-held list and contact)', 'https://www.pbctax.gov/services/property-tax/tax-certificates'], ['Florida statute 197.432', FL_SALE.statute[1]]],
    steps: [
      'Open the property record and check the lot, the county value and what is on it.',
      'Contact the Palm Beach County Tax Collector\u2019s tax certificate office (use the page below). Give them the parcel number and the certificate number shown here.',
      'Palm Beach sells on RealAuction, not LienHub. The Tax Collector says buyers must register there first (link below). You then buy in person, by mail or wire, or in a RealAuction supplemental sale when notified.',
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
  'Miami-Dade': {
    office: 'Miami-Dade Tax Collector',
    status: l => 'County-held certificate ' + l.cert + ' from the ' + l.certYear + ' sale (tax year ' + l.taxYear + '): nobody bought it, so Miami-Dade County holds it. It is on LienHub\u2019s Miami-Dade purchase list. Purchase amount: $' + Number(l.amount).toFixed(2) + '.' + (/CONDO/i.test(l.desc || '') ? ' This is a condo unit, not a piece of land.' : '') + (l.outstanding > 1 ? ' This parcel has ' + l.outstanding + ' certificates outstanding, so taxes have gone unpaid for years: research it carefully.' : ''),
    record: {label: 'Open the Miami-Dade Property Appraiser record', url: pin => 'https://www.miamidade.gov/Apps/PA/propertysearch/#/?folio=' + pin.replace(/-/g, '')},
    links: [['Buy on LienHub (Miami-Dade)', 'https://lienhub.com/county/miamidade/certsale/']],
    steps: [
      'This list comes from LienHub\u2019s Miami-Dade \u201cView/Purchase Certificates\u201d page.',
      'Open LienHub, make a free account, and add a W-9 and payment method as it asks.',
      'Search this certificate or folio number. If it is still listed, it is still for sale.',
      'Before you pay, check the folio on the Property Appraiser site and read Land Information here. Owning a certificate does not make you the owner of the property.'
    ]
  },
  'Bay': {
    office: 'Bay County Tax Collector',
    status: l => 'County-held certificate ' + l.cert + ' from the ' + l.certYear + ' sale (tax year ' + l.taxYear + '): nobody bought it, so Bay County holds it. It is on LienHub\u2019s Bay County purchase list. Purchase amount on the list: $' + Number(l.amount).toFixed(2) + '.' + (l.outstanding > 1 ? ' This parcel has ' + l.outstanding + ' certificates outstanding, so taxes have gone unpaid for years: research it carefully.' : ''),
    record: {label: 'Open the Bay County Property Appraiser', url: pin => 'https://baypa.net/'},
    links: [['Buy on LienHub (Bay County)', 'https://lienhub.com/county/bay/certsale/']],
    steps: [
      'This list comes from LienHub\u2019s Bay County \u201cView/Purchase Certificates\u201d page.',
      'Open LienHub, make a free account, and add a W-9 and payment method as it asks.',
      'Search this certificate or parcel number. If it is still listed, it is still for sale.',
      'Before you pay, check the parcel on the Property Appraiser site and read Land Information here. Owning a certificate does not make you the owner of the property.'
    ]
  },
  'Alachua': {
    office: 'Alachua County Tax Collector',
    status: l => 'County-held certificate ' + l.cert + ' from the ' + l.certYear + ' sale (tax year ' + l.taxYear + '): nobody bought it, so Alachua County holds it. Anyone can buy it on LienHub. Purchase amount on the list: $' + Number(l.amount).toFixed(2) + '.' + (l.outstanding > 1 ? ' This parcel has ' + l.outstanding + ' certificates outstanding, so taxes have gone unpaid for years: research it carefully.' : ''),
    record: {label: 'Open the Alachua County Property Appraiser', url: pin => 'https://www.acpafl.org/'},
    links: [['Buy on LienHub (Alachua County)', 'https://lienhub.com/county/alachua/certsale/'], ['Alachua County Tax Collector', 'https://www.alachuacollector.com/']],
    steps: [
      'Alachua sells its certificates on LienHub (the Tax Collector\u2019s site links there).',
      'Open LienHub, make a free account, and add a W-9 and payment method as it asks.',
      'Go to View/Purchase Certificates for Alachua and search this certificate or parcel number. If it is listed, it is still for sale.',
      'Before you pay, check the parcel on the Property Appraiser site and read Land Information here. Owning a certificate does not make you the owner of the property.'
    ]
  },
  'Manatee': {
    office: 'Manatee County Tax Collector',
    status: l => 'County-held certificate ' + l.cert + ' from the ' + l.certYear + ' sale (tax year ' + l.taxYear + '): nobody bought it, so Manatee County holds it. Florida lets anyone buy a county-held certificate. Total due on the county list: $' + Number(l.payoff).toFixed(2) + ' through 11/30/2026. Confirm it is still available.',
    record: {label: 'Open the Manatee County Property Appraiser', url: pin => 'https://www.manateepao.gov/'},
    links: [['Manatee Tax Collector: tax certificates (county-held list, W-9)', 'https://www.taxcollector.com/services/property-tax/tax-certs.cfm']],
    steps: [
      'Manatee sells county-held certificates by email, not LienHub. Email legal@taxcollector.com with the certificate number(s) you want to buy.',
      'The Tax Collector\u2019s Field Services and Collections Department replies with payment instructions. They ask for a W-9 (on their tax certificate page).',
      'Before you pay, look up the parcel on the Property Appraiser site and read Land Information here. Owning a certificate does not make you the owner of the property.'
    ]
  },
  'Leon': {
    office: 'Leon County Tax Collector',
    status: l => 'County-held certificate ' + l.cert + ' (tax year ' + l.taxYear + '): nobody bought it at the ' + l.certYear + ' sale, so Leon County holds it. Florida lets anyone buy a county-held certificate. It earns up to 18%. Confirm it is still available with the Tax Collector.',
    record: {label: 'Open the Leon County Property Appraiser', url: pin => 'https://www.leonpa.gov/'},
    links: [['Register as a bidder (Leon County Tax Collector)', 'https://wwwtax2.leoncountyfl.gov/itm/CTYRegistration.aspx'], ['Purchase county-held certificates (sign in)', 'https://wwwtax2.leoncountyfl.gov/itm/CTYLogin.aspx'], ['Leon certificate lists', 'https://leontaxcollector.net/Services/property-taxes/Certificate-Lists'], ['How to be a tax certificate investor (Leon)', 'https://www.leontaxcollector.net/Investors/Interested-in-Being-a-Tax-Certificate-Investor']],
    steps: [
      'Leon sells county-held certificates on its own Tax Collector website, not LienHub or RealAuction.',
      'Register as a bidder first (link below). The Tax Collector asks for a tax form (W-9, or W-8 for non-US buyers) after you register.',
      'Sign in to the county certificate purchase page and search for this parcel number. If it is listed, it is still for sale.',
      'Check the property on the Property Appraiser site and the Land Information here before you pay. Owning a certificate does not make you the owner of the property.'
    ]
  },
  'Coconino': {
    office: 'Coconino County Treasurer',
    phone: '(928) 679-8188',
    status: l => 'On the Coconino County Treasurer\u2019s 2026 delinquent account list (taxes owed: $' + Number(l.amount).toFixed(2) + ').' + (l.prior ? ' Marked as more than one year delinquent: research it carefully.' : '') + ' This list shows unpaid taxes; whether a lien is for sale now, and at what rate, must be confirmed with the Treasurer.',
    record: null,
    links: [['Coconino County Treasurer: 2026 delinquent account list (PDF)', 'https://www.coconino.az.gov/DocumentCenter/View/70663/2026-ACCT-BAL-EXTRACT-WEBSITE']],
    steps: [
      'Call the Treasurer\u2019s office and give the parcel number. Ask whether a tax lien on it is for sale now (at the yearly sale or over the counter), the exact amount, and how to pay.',
      'The county also posts an \u201cover the counter\u201d list of liens that did not sell at auction. Those can be bought directly from the Treasurer, and some carry extra fees.',
      'Arizona\u2019s rate cap is 16%. A lien holder cannot start a foreclosure until 3 years after the sale, and the owner can pay it off any time before that.',
      'Look at Land Information here and the county Assessor\u2019s records before you decide.'
    ]
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
