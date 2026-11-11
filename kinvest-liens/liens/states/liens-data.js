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
    'Walton': 'https://lienhub.com/county/walton/certsale/main',
    'Nassau': 'https://www.nassautaxes.com/Content/Delinquent',
    'Santa Rosa': 'https://lienhub.com/county/santarosa/certsale/main',
    'Volusia': 'https://lienhub.com/county/volusia/certsale/main'
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
  'Nassau': {
    query: 'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query',
    idField: 'CO_NO=55 AND PARCEL_ID',
    fmt: pin => pin.replace(/-/g, ''),
    page: pin => 'https://ncpafl.com/',
    pageName: 'Nassau County Property Appraiser'
  },
  'Hernando': {
    query: 'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query',
    idField: 'CO_NO=37 AND PARCEL_ID',
    fmt: pin => pin.replace(/-/g, ' '),
    page: pin => 'https://hernandocountypa-florida.us/',
    pageName: 'Hernando County Property Appraiser'
  },
  'Hillsborough': {
    query: 'https://gis.hcpafl.org/arcgis/rest/services/Webmaps/HillsboroughFL_WebParcels/MapServer/0/query',
    idField: 'folio',
    fmt: pin => pin.slice(1),
    page: pin => 'https://www.hcpafl.org/',
    pageName: 'Hillsborough County Property Appraiser'
  },
  'Escambia': {
    query: 'https://gismaps.myescambia.com/arcgis/rest/services/Escambia_County/MapServer/0/query',
    idField: 'CONTROLNO',
    fmt: pin => pin.replace(/-/g, ''),
    page: pin => 'https://www.escpa.org/',
    pageName: 'Escambia County Property Appraiser'
  },
  'Duval': {
    query: 'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query',
    idField: 'CO_NO=26 AND PARCEL_ID',
    fmt: pin => pin.replace(/-/g, '') + 'R',
    page: pin => 'https://paopropertysearch.coj.net/',
    pageName: 'Duval County Property Appraiser'
  },
  'Sarasota': {
    query: 'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query',
    idField: 'CO_NO=68 AND PARCEL_ID',
    fmt: pin => pin,
    page: pin => 'https://www.sc-pa.com/',
    pageName: 'Sarasota County Property Appraiser'
  },
  'Osceola': {
    query: 'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query',
    idField: 'CO_NO=59 AND PARCEL_ID',
    fmt: pin => pin.replace(/^R/, '').replace(/-/g, ''),
    page: pin => 'https://www.property-appraiser.org/',
    pageName: 'Osceola County Property Appraiser'
  },
  'Pasco': {
    query: 'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query',
    idField: 'CO_NO=61 AND PARCEL_ID',
    fmt: pin => pin,
    page: pin => 'https://www.pascopa.com/',
    pageName: 'Pasco County Property Appraiser'
  },
  'Volusia': {
    query: 'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query',
    idField: 'CO_NO=74 AND PARCEL_ID',
    fmt: pin => pin,
    page: pin => 'https://vcpa.vcgov.org/',
    pageName: 'Volusia County Property Appraiser'
  },
  'Santa Rosa': {
    query: 'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query',
    idField: 'CO_NO=67 AND PARCEL_ID',
    fmt: pin => pin,
    page: pin => 'https://srcpa.gov/',
    pageName: 'Santa Rosa County Property Appraiser'
  },
  'Walton': {
    query: 'https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query',
    idField: 'CO_NO=76 AND PARCEL_ID',
    fmt: pin => pin.replace(/-/g, ''),
    page: pin => 'https://waltonpa.com/',
    pageName: 'Walton County Property Appraiser'
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
  'Saguache': {
    query: 'https://services1.arcgis.com/zH7gQ37AKcpvTX6d/arcgis/rest/services/Saguache_County_Parcels_View/FeatureServer/0/query',
    idField: 'Account',
    fmt: pin => pin,
    page: pin => 'https://saguachecounty.colorado.gov/departments/treasurer/public-trustee',
    pageName: 'Saguache County Treasurer'
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
  'Saguache': {
    office: 'Saguache County Treasurer',
    status: l => 'On Saguache County\u2019s 2026 tax lien sale list (face amount $' + Number(l.amount).toFixed(2) + ').' + (/no bids/.test(l.status) ? ' It had no bids yet when the list was exported.' : '') + ' Bidding happens on the county\u2019s online auction; bids go above face, and that extra premium earns no interest. The owner can still pay, which takes it off the sale.',
    record: null,
    links: [['Saguache County Treasurer (sale notice and rules)', 'https://saguachecounty.colorado.gov/departments/treasurer/public-trustee'], ['Zeus Auction (where the county took bidder registration in 2025)', 'https://www.zeusauction.com/']],
    steps: [
      'Check the Treasurer\u2019s page for the 2026 sale dates and rules. In 2025 the sale was online and bidders registered at Zeus Auction.',
      'Register as a bidder before the sale (W-9 and payment details are usually required).',
      'In Colorado the interest rate is set by state law each year: 9 points above the federal discount rate (13% for 2026 sales, per our Colorado guide). Bids above the face amount are a premium that earns no interest, so do not overbid.',
      'Look at Land Information here first. Many cheap lots in this area have no road, water or power.'
    ]
  },
  'El Paso': {
    office: 'El Paso County Treasurer',
    status: l => 'Held by El Paso County itself (certificate ' + (l.cert || 'number not shown') + ', ' + (l.rate || '') + ' interest, face $' + Number(l.amount).toFixed(2) + '). It is already issued, so it is not an auction lot. The owner can still pay it off.',
    record: null,
    links: [['El Paso County Treasurer', 'https://treasurer.elpasoco.com/']],
    steps: [
      'These are liens the county kept because nobody bought them at the sale. Ask the Treasurer whether a county-held certificate can be bought and how.',
      'Give them the account number and certificate number shown here, and ask for the exact payoff today.',
      'Look at Land Information and the county records first. Some are large amounts on built properties, others are small vacant parcels.'
    ]
  },
  'Boulder': {
    office: 'Boulder County Treasurer',
    status: l => 'Advertised for Boulder County\u2019s 2026 tax lien sale (balance due $' + Number(l.amount).toFixed(2) + '). It is not sold yet, and the owner can pay before the sale, which takes it off the list.',
    record: null,
    links: [['Boulder County Treasurer', 'https://bouldercounty.gov/property-and-land/treasurer/']],
    steps: [
      'Read the Treasurer\u2019s tax lien sale page for the sale date, registration and payment rules.',
      'In Colorado the interest rate is set by state law each year (9 points above the federal discount rate). Bidders compete by paying a premium above the face amount, and that premium earns no interest.',
      'Many parcels here are homes. Check the property record and what is on it before you bid.'
    ]
  },
  'Scott': {
    office: 'Scott County Treasurer (Iowa)',
    status: l => 'On Scott County\u2019s 2026 tax sale list (total due $' + Number(l.amount).toFixed(2) + ', including any special assessments). The owner can still pay before the sale. Iowa lets the owner redeem afterward.',
    record: null,
    links: [['Scott County Treasurer', 'https://www.scottcountyiowa.gov/treasurer']],
    steps: [
      'Check the Treasurer\u2019s page for the sale date, how to register and what payment they accept.',
      'Iowa sells the tax sale certificate. Read our Iowa course lesson on interest, redemption and what happens if the owner never pays.',
      'Look the parcel up on the county records first. Check what it is, and that it is not just a sliver or a road strip.'
    ]
  },
  'Davidson': {
    office: 'Davidson County Clerk & Master (Nashville)',
    status: l => 'Listed on Metro Nashville\u2019s June 17, 2026 delinquent property tax sale notice (amount owed $' + Number(l.amount).toFixed(2) + '). That sale date has passed. Properties not sold can go to a later sale, so confirm it is still available. The owner keeps a right of redemption after a sale.',
    record: null,
    links: [['Nashville Chancery Court tax sales (Clerk & Master)', 'https://www.nashville.gov/chancery'], ['Davidson County Property Assessor', 'https://www.padctn.org/']],
    steps: [
      'Call the Clerk & Master\u2019s office (615-862-5712) or the Metro Legal Department (615-862-6343) and ask if this property is still for sale, and when the next sale is.',
      'Tennessee sells the property itself to the highest bidder, cash, subject to the owner\u2019s right to redeem. Read our Tennessee page for the redemption rules.',
      'Research before you bid: the notice says buyers are strongly urged to research each parcel. Many are tiny lots, vacant lots with no street number, or condo units.'
    ]
  },
  'Wayne': {
    office: 'Wayne County Treasurer (Michigan)',
    status: l => /Sold/.test(l.status) ? 'Sold at Wayne County\u2019s September 2026 tax foreclosure auction for $' + Number(l.amount).toFixed(2) + '. It is no longer for sale; this is a past result you can learn from.' : 'The county foreclosed on this parcel in 2026 (list dated 4/24/2026). The list gives no price, owner or sale status. It was not on the September 2026 sold list, so check with the Treasurer whether it is still offered.',
    record: null,
    links: [['Wayne County Treasurer: tax foreclosure auction', 'https://www.waynecountytreasurermi.com/']],
    steps: [
      'Michigan sells the foreclosed property itself (a deed), not a lien. There is no interest earned and no redemption after the foreclosure is final.',
      'Ask the Treasurer which parcels are still available, the minimum bid, and when and how the next auction runs.',
      'Research before you bid: many Detroit parcels are vacant lots or have back taxes, liens or demolition orders. Check the property and its condition first.'
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
      'In Colorado the interest rate is set by state law each year (9 points above the federal discount rate). Bidders compete by paying a premium above the face amount, and that premium earns no interest. Use Calculate with this year\u2019s rate.',
      'Call the Treasurer\u2019s office at (970) 498-7020 to ask whether this parcel is still on the list and how to register.'
    ],
    phone: '(970) 498-7020'
  },
  'MS-TFL': {
    office: 'Mississippi Secretary of State, Public Lands Division',
    status: l => 'This parcel is on the Mississippi Secretary of State\u2019s tax-forfeited lands list (downloaded ' + (typeof MS_TFL_CHECKED !== 'undefined' ? MS_TFL_CHECKED : 'recently') + '): land that forfeited to the State for unpaid taxes. The State sells it directly. Whether it is still available, the price and the kind of deed must be confirmed with the Secretary of State.',
    record: null,
    links: [['Mississippi Secretary of State: tax-forfeited lands', 'https://www.sos.ms.gov/public-lands/tax-forfeited-lands']],
    steps: [
      'Open the Secretary of State\u2019s Tax-Forfeited Lands page (link below) and look up this parcel number in its search.',
      'Follow the State\u2019s application steps there. We could not read the State\u2019s purchase rules automatically, so confirm the price, fees, and what kind of deed or title you get before paying.',
      'Check the county property record and Land Information. Many forfeited parcels are small lots, have no county value, or have title problems.',
      'Talk to a Mississippi real estate attorney or title company about the title before you build or resell.'
    ]
  },
  'Nassau': {
    office: 'Nassau County Tax Collector',
    status: l => 'County-held certificate ' + l.cert + ' from the ' + l.certYear + ' sale (tax year ' + l.taxYear + '): nobody bought it, so Nassau County holds it. It is on LienHub\u2019s Nassau purchase list. Purchase amount: $' + Number(l.amount).toFixed(2) + '.' + (l.outstanding > 1 ? ' This parcel has ' + l.outstanding + ' certificates outstanding: research it carefully.' : ''),
    record: {label: 'Open the Nassau County Property Appraiser', url: pin => 'https://ncpafl.com/'},
    links: [['Buy on LienHub (Nassau County)', 'https://lienhub.com/county/nassau/certsale/main'], ['Nassau Tax Collector: delinquent taxes', 'https://www.nassautaxes.com/Content/Delinquent']],
    steps: [
      'This list comes from LienHub\u2019s Nassau County \u201cView/Purchase Certificates\u201d page.',
      'Open LienHub, make a free account, and add a W-9 and payment method as it asks.',
      'Search this certificate or parcel number. If it is still listed, it is still for sale.',
      'Check the description and Land Information before you pay. Owning a certificate does not make you the owner of the property.'
    ]
  },
  'Hernando': {
    office: 'Hernando County Tax Collector',
    status: l => (/EASEMENT/i.test(l.desc || '') ? 'POWER-LINE EASEMENT STRIP: the description says this is a strip under a Florida Power easement, which usually cannot be built on. ' : '') + 'County-held certificate ' + l.cert + ' from the ' + l.certYear + ' sale (tax year ' + l.taxYear + '): nobody bought it, so Hernando County holds it. It is on LienHub\u2019s Hernando purchase list. Purchase amount: $' + Number(l.amount).toFixed(2) + '.' + (l.outstanding > 1 ? ' This parcel has ' + l.outstanding + ' certificates outstanding: research it carefully.' : ''),
    record: {label: 'Open the Hernando County Property Appraiser', url: pin => 'https://hernandocountypa-florida.us/'},
    links: [['Buy on LienHub (Hernando County)', 'https://lienhub.com/county/hernando/certsale/main']],
    steps: [
      'This list comes from LienHub\u2019s Hernando County \u201cView/Purchase Certificates\u201d page.',
      'Open LienHub, make a free account, and add a W-9 and payment method as it asks.',
      'Search this certificate or parcel number. If it is still listed, it is still for sale.',
      'Several of these are 100-foot strips under power-line easements. Check the description and Land Information before you pay. Owning a certificate does not make you the owner of the property.'
    ]
  },
  'Hillsborough': {
    office: 'Hillsborough County Tax Collector',
    status: l => 'County-held certificate ' + l.cert + ' from the ' + l.certYear + ' sale (tax year ' + l.taxYear + '): nobody bought it, so Hillsborough County holds it. The Tax Collector says county-held certificates are bought on LienHub after you register there. Purchase amount: $' + Number(l.amount).toFixed(2) + '.' + (l.outstanding > 1 ? ' This parcel has ' + l.outstanding + ' certificates outstanding: research it carefully.' : ''),
    record: {label: 'Open the Hillsborough County Property Appraiser', url: pin => 'https://www.hcpafl.org/'},
    links: [['Buy on LienHub (Hillsborough County)', 'https://lienhub.com/county/hillsborough/certsale/main'], ['Hillsborough Tax Collector: county-held certificates', 'https://www.hillstaxfl.gov/?p=691']],
    steps: [
      'Register as a buyer on LienHub; once registered you can buy Hillsborough county-held certificates there.',
      'Add a W-9 and payment method as LienHub asks.',
      'Search this certificate or account number. If it is still listed, it is still for sale.',
      'Check the description and Land Information before you pay. Owning a certificate does not make you the owner of the property.'
    ]
  },
  'Escambia': {
    office: 'Escambia County Tax Collector',
    status: l => (l.mineral ? 'MINERAL RIGHTS ONLY: not land you could use or build on. ' : '') + 'County-held certificate ' + l.cert + ' from the ' + l.certYear + ' sale (tax year ' + l.taxYear + '): nobody bought it, so Escambia County holds it. It is on LienHub\u2019s Escambia purchase list. Purchase amount: $' + Number(l.amount).toFixed(2) + '.' + (l.outstanding > 1 ? ' This parcel has ' + l.outstanding + ' certificates outstanding: research it carefully.' : ''),
    record: {label: 'Open the Escambia County Property Appraiser', url: pin => 'https://www.escpa.org/'},
    links: [['Buy on LienHub (Escambia County)', 'https://lienhub.com/county/escambia/certsale/main'], ['Escambia County Tax Collector', 'https://escambiataxcollector.com/']],
    steps: [
      'This list comes from LienHub\u2019s Escambia County \u201cView/Purchase Certificates\u201d page.',
      'Open LienHub, make a free account, and add a W-9 and payment method as it asks.',
      'Search this certificate or account number. If it is still listed, it is still for sale.',
      'Many are small pieces described by metes and bounds. Check Land Information and the Property Appraiser before you pay. Owning a certificate does not make you the owner of the property.'
    ]
  },
  'Duval': {
    office: 'Duval County Tax Collector',
    status: l => 'County-held certificate ' + l.cert + ' from the ' + l.certYear + ' sale (tax year ' + l.taxYear + '): nobody bought it, so Duval County holds it. It is on LienHub\u2019s Duval purchase list. Purchase amount: $' + Number(l.amount).toFixed(2) + '.' + (l.outstanding > 1 ? ' This parcel has ' + l.outstanding + ' certificates outstanding: research it carefully.' : ''),
    record: {label: 'Open the Duval County Property Appraiser search', url: pin => 'https://paopropertysearch.coj.net/'},
    links: [['Buy on LienHub (Duval County)', 'https://lienhub.com/county/duval/certsale/main']],
    steps: [
      'This list comes from LienHub\u2019s Duval County \u201cView/Purchase Certificates\u201d page.',
      'Open LienHub, make a free account, and add a W-9 and payment method as it asks.',
      'Search this certificate or RE (parcel) number. If it is still listed, it is still for sale.',
      'Check the description and Land Information before you pay. Owning a certificate does not make you the owner of the property.'
    ]
  },
  'Sarasota': {
    office: 'Sarasota County Tax Collector',
    status: l => 'County-held certificate ' + l.cert + ' from the ' + l.certYear + ' sale (tax year ' + l.taxYear + '): nobody bought it, so Sarasota County holds it. It is on LienHub\u2019s Sarasota purchase list. Purchase amount: $' + Number(l.amount).toFixed(2) + '.' + (l.outstanding > 1 ? ' This parcel has ' + l.outstanding + ' certificates outstanding: research it carefully.' : ''),
    record: {label: 'Open the Sarasota County Property Appraiser', url: pin => 'https://www.sc-pa.com/'},
    links: [['Buy on LienHub (Sarasota County)', 'https://lienhub.com/county/sarasota/certsale/main']],
    steps: [
      'This list comes from LienHub\u2019s Sarasota County \u201cView/Purchase Certificates\u201d page.',
      'Open LienHub, make a free account, and add a W-9 and payment method as it asks.',
      'Search this certificate or parcel number. If it is still listed, it is still for sale.',
      'Many of these are slivers and strips (for example \u201cwest 2 ft of lot\u201d). Check the description and Land Information before you pay. Owning a certificate does not make you the owner of the property.'
    ]
  },
  'Osceola': {
    office: 'Osceola County Tax Collector',
    status: l => 'County-held certificate ' + l.cert + ' from the ' + l.certYear + ' sale (tax year ' + l.taxYear + '): nobody bought it, so Osceola County holds it. It is on LienHub\u2019s Osceola purchase list. Purchase amount: $' + Number(l.amount).toFixed(2) + '.' + (l.outstanding > 1 ? ' This parcel has ' + l.outstanding + ' certificates outstanding, so taxes have gone unpaid for years. It is a thin strip of land: research it carefully.' : ''),
    record: {label: 'Open the Osceola County Property Appraiser', url: pin => 'https://www.property-appraiser.org/'},
    links: [['Buy on LienHub (Osceola County)', 'https://lienhub.com/county/osceola/certsale/main'], ['Osceola County Tax Collector', 'https://www.osceolataxcollector.org/']],
    steps: [
      'This list comes from LienHub\u2019s Osceola County \u201cView/Purchase Certificates\u201d page.',
      'Open LienHub, make a free account, and add a W-9 and payment method as it asks.',
      'Search this certificate or parcel number. If it is still listed, it is still for sale.',
      'Both Osceola listings are thin strips (10 to 12.5 feet wide). Check Land Information before you pay. Owning a certificate does not make you the owner of the property.'
    ]
  },
  'Pasco': {
    office: 'Pasco County Tax Collector',
    status: l => 'County-held certificate ' + l.cert + ' from the ' + l.certYear + ' sale (tax year ' + l.taxYear + '): nobody bought it, so Pasco County holds it. It is on LienHub\u2019s Pasco purchase list. Purchase amount: $' + Number(l.amount).toFixed(2) + '.' + (l.outstanding > 1 ? ' This parcel has ' + l.outstanding + ' certificates outstanding: research it carefully.' : ''),
    record: {label: 'Open the Pasco County Property Appraiser', url: pin => 'https://www.pascopa.com/'},
    links: [['Buy on LienHub (Pasco County)', 'https://lienhub.com/county/pasco/certsale/main'], ['Pasco Tax Collector: tax sale information', 'https://pascotaxes.com/taxes/tax-information/delinquent-real-estate-taxes/tax-sale-information/']],
    steps: [
      'This list comes from LienHub\u2019s Pasco County \u201cView/Purchase Certificates\u201d page.',
      'Open LienHub, make a free account, and add a W-9 and payment method as it asks.',
      'Search this certificate or parcel number. If it is still listed, it is still for sale.',
      'Many of these are partial lots and strips (\u201cwest half of lot\u201d, \u201ceast 25 ft\u201d). Check the description and Land Information before you pay. Owning a certificate does not make you the owner of the property.'
    ]
  },
  'Volusia': {
    office: 'Volusia County Tax Collector',
    status: l => (l.mineral ? 'SUBSURFACE RIGHTS ONLY: this certificate is on underground (subsurface or mineral) rights, not on land you could use or build on. ' : '') + 'County-held certificate ' + l.cert + ' from the ' + l.certYear + ' sale (tax year ' + l.taxYear + '): nobody bought it, so Volusia County holds it. The Tax Collector says county-held certificates can be bought on LienHub or at its DeLand office. Purchase amount: $' + Number(l.amount).toFixed(2) + '.' + (l.outstanding > 1 ? ' This parcel has ' + l.outstanding + ' certificates outstanding: research it carefully.' : ''),
    record: {label: 'Open the Volusia County Property Appraiser', url: pin => 'https://vcpa.vcgov.org/'},
    links: [['Buy on LienHub (Volusia County)', 'https://lienhub.com/county/volusia/certsale/main'], ['Volusia Tax Collector: tax certificate information', 'https://www.vctaxcollector.org/taxes/tax-certificate-info.html']],
    steps: [
      'Volusia runs its certificate sales on LienHub, and county-held certificates can be bought there or at the DeLand office.',
      'Open LienHub, make a free account, and add a W-9 and payment method as it asks.',
      'Search this certificate or parcel number. If it is still listed, it is still for sale.',
      'Most Volusia county-held certificates are on subsurface rights, not land. Check the description and Land Information before you pay. Owning a certificate does not make you the owner of the property.'
    ]
  },
  'Santa Rosa': {
    office: 'Santa Rosa County Tax Collector',
    status: l => (l.mineral ? 'MINERAL RIGHTS ONLY: this certificate is on an underground mineral interest, not on land you could use or build on. ' : '') + 'County-held certificate ' + l.cert + ' from the ' + l.certYear + ' sale (tax year ' + l.taxYear + '): nobody bought it, so Santa Rosa County holds it. Anyone can buy it on LienHub. Purchase amount: $' + Number(l.amount).toFixed(2) + '.' + (l.outstanding > 1 ? ' This parcel has ' + l.outstanding + ' certificates outstanding: research it carefully.' : ''),
    record: {label: 'Open the Santa Rosa County Property Appraiser', url: pin => 'https://srcpa.gov/'},
    links: [['Buy on LienHub (Santa Rosa County)', 'https://lienhub.com/county/santarosa/certsale/main'], ['Santa Rosa Tax Collector: delinquent tax information', 'https://srctc.com/real-estate/delinquent-tax-information/']],
    steps: [
      'Santa Rosa sells its certificates on LienHub.',
      'Open LienHub, make a free account, and add a W-9 and payment method as it asks.',
      'Search this certificate or parcel number. If it is still listed, it is still for sale.',
      'Most Santa Rosa county-held certificates are on mineral rights, not land. Check the description and Land Information before you pay. Owning a certificate does not make you the owner of the property.'
    ]
  },
  'Walton': {
    office: 'Walton County Tax Collector',
    status: l => (l.mineral ? 'MINERAL RIGHTS ONLY: this certificate is on an underground mineral interest, not on land you could use or build on. ' : '') + 'County-held certificate ' + l.cert + ' from the ' + l.certYear + ' sale (tax year ' + l.taxYear + '): nobody bought it, so Walton County holds it. Anyone can buy it on LienHub. Purchase amount: $' + Number(l.amount).toFixed(2) + '.' + (l.outstanding > 1 ? ' This parcel has ' + l.outstanding + ' certificates outstanding: research it carefully.' : ''),
    record: {label: 'Open the Walton County Property Appraiser', url: pin => 'https://waltonpa.com/'},
    links: [['Buy on LienHub (Walton County)', 'https://lienhub.com/county/walton/certsale/main'], ['Walton Tax Collector: tax certificates', 'https://waltontaxcollector.com/pay-online/tax-certificate']],
    steps: [
      'Walton sells its certificates on LienHub (the Tax Collector\u2019s site links there).',
      'Open LienHub, make a free account, and add a W-9 and payment method as it asks.',
      'Search this certificate or parcel number. If it is still listed, it is still for sale.',
      'Before you pay, check the parcel on the Property Appraiser site and read Land Information here. Owning a certificate does not make you the owner of the property.'
    ]
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
