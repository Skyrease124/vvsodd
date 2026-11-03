// Parcel lookup links. FL_PA = the 67 county property appraiser sites from the Florida Department of Revenue's official
// "Find a County Official" list (https://floridarevenue.com/property/Pages/LocalOfficials.aspx), copied 2026-11-03.
// Some of these sites block automated checkers, so they were confirmed reachable only in part; open them in a normal browser.
// PARCEL_LOOKUP = a statewide parcel map or the state office that lists county assessors, one or two per state, reachable when checked 2026-11-03.
const FL_PA = {
"Alachua": "http://www.acpafl.org/",
"Baker": "http://www.bakerpa.com/",
"Bay": "https://baypa.net/",
"Bradford": "http://www.bradfordappraiser.com/",
"Brevard": "https://www.bcpao.us/",
"Broward": "http://www.bcpa.net",
"Calhoun": "https://calhounpa.net/",
"Charlotte": "https://www.ccappraiser.com/",
"Citrus": "https://www.citruspa.org/_dnn/",
"Clay": "http://www.ccpao.com/",
"Collier": "http://www.collierappraiser.com/",
"Columbia": "http://columbia.floridapa.com/",
"DeSoto": "http://www.desotopa.com/",
"Dixie": "http://www.qpublic.net/dixie/",
"Duval": "http://www.coj.net/Departments/Property-Appraiser.aspx",
"Escambia": "http://www.escpa.org",
"Flagler": "http://www.flaglerpa.com/",
"Franklin": "http://www.qpublic.net/franklin/",
"Gadsden": "https://gadsdenpa.com/",
"Gilchrist": "https://www.qpublic.net/fl/gilchrist/",
"Glades": "http://www.gladesflpa.com/",
"Gulf": "https://gulfpa.com/",
"Hamilton": "http://www.hamiltonpa.com/",
"Hardee": "http://www.qpublic.net/hardee/",
"Hendry": "http://www.hendryprop.com/",
"Hernando": "https://hernandocountypa-florida.us/",
"Highlands": "http://www.hcpao.org/",
"Hillsborough": "http://www.hcpafl.org",
"Holmes": "http://www.qpublic.net/holmes/",
"Indian River": "http://www.ircpa.org/",
"Jackson": "https://jacksonpa.com/",
"Jefferson": "http://www.JeffersonPA.net",
"Lafayette": "http://www.lafayettepa.com/",
"Lake": "http://www.lakecopropappr.com/",
"Lee": "http://www.leepa.org/",
"Leon": "https://www.leonpa.gov/",
"Levy": "http://www.qpublic.net/fl/levy/",
"Liberty": "https://libertypa.org/",
"Madison": "http://www.madisonpa.com",
"Manatee": "http://www.manateepao.com/",
"Marion": "http://www.pa.marion.fl.us/",
"Martin": "http://www.pa.martin.fl.us/",
"Miami-Dade": "http://www.miamidade.gov/pa/",
"Monroe": "https://www.mcpafl.org/",
"Nassau": "https://ncpafl.com/",
"Okaloosa": "http://www.okaloosapa.com/",
"Okeechobee": "http://www.okeechobeepa.com/",
"Orange": "https://ocpaweb.ocpafl.org/",
"Osceola": "http://www.property-appraiser.org/",
"Palm Beach": "http://www.co.palm-beach.fl.us/papa/index.htm",
"Pasco": "http://www.pascopa.com/",
"Pinellas": "https://www.pcpao.gov/",
"Polk": "https://www.polkpa.org/",
"Putnam": "https://pa.putnam-fl.com/",
"Santa Rosa": "https://srcpa.gov",
"Sarasota": "http://www.SC-PA.com",
"Seminole": "http://www.scpafl.org/",
"Saint Johns": "http://www.sjcpa.us",
"Saint Lucie": "http://www.paslc.org/",
"Sumter": "http://www.SumterPA.com",
"Suwannee": "http://www.suwanneepa.com/",
"Taylor": "https://qpublic.net/fl/taylor/",
"Union": "http://union.floridapa.com",
"Volusia": "https://vcpa.vcgov.org/#gsc.tab=0",
"Wakulla": "https://mywakullapa.com/",
"Walton": "http://www.waltonpa.com/",
"Washington": "http://www.qpublic.net/washington/"
};
const PARCEL_LOOKUP = {
"AL": [
[
"Alabama Department of Revenue: county property tax offices",
"https://www.revenue.alabama.gov/property-tax/"
]
],
"AK": [
[
"Alaska state assessor: local assessors",
"https://www.commerce.alaska.gov/web/dcra/OfficeoftheStateAssessor.aspx"
]
],
"AZ": [
[
"Arizona Department of Revenue: property tax",
"https://azdor.gov/business/property-tax"
]
],
"AR": [
[
"Arkansas Assessment Coordination Division",
"https://www.arkansasassessment.com/"
]
],
"CO": [
[
"Colorado Division of Property Taxation: county assessors",
"https://dpt.colorado.gov/"
]
],
"CT": [
[
"Connecticut OPM: local property tax",
"https://portal.ct.gov/opm"
]
],
"DE": [
[
"Delaware FirstMap (state GIS, parcels)",
"https://firstmap.delaware.gov/"
]
],
"DC": [
[
"DC Office of Tax and Revenue: real property search",
"https://www.taxpayerservicecenter.com/RP_Search.jsp?search_type=Assessment"
]
],
"GA": [
[
"Georgia Department of Revenue: county tax officials",
"https://dor.georgia.gov/local-government-services"
]
],
"HI": [
[
"Hawaii statewide GIS parcel viewer",
"https://geoportal.hawaii.gov/"
]
],
"ID": [
[
"Idaho State Tax Commission: county assessors",
"https://tax.idaho.gov/"
]
],
"IL": [
[
"Illinois Department of Revenue: property tax",
"https://tax.illinois.gov/localgovernments/property.html"
]
],
"IN": [
[
"Indiana DLGF: county assessors",
"https://www.in.gov/dlgf/"
]
],
"IA": [
[
"Iowa Land Records (statewide)",
"https://iowalandrecords.org/"
]
],
"KS": [
[
"Kansas Division of Property Valuation",
"https://www.ksrevenue.gov/pvdhome.html"
]
],
"KY": [
[
"Kentucky Department of Revenue: property valuation administrators",
"https://revenue.ky.gov/Property/Pages/default.aspx"
]
],
"ME": [
[
"Maine Revenue Services: property tax",
"https://www.maine.gov/revenue/taxes/property-tax"
]
],
"MD": [
[
"Maryland SDAT real property search (statewide)",
"https://sdat.dat.maryland.gov/RealProperty/Pages/default.aspx"
]
],
"MA": [
[
"MassGIS: property tax parcels",
"https://www.mass.gov/info-details/massgis-data-property-tax-parcels"
]
],
"MI": [
[
"Michigan Treasury: local government property tax",
"https://www.michigan.gov/treasury/local"
]
],
"MN": [
[
"Minnesota Geospatial Commons: parcels",
"https://gisdata.mn.gov/dataset/plan-parcels-open"
]
],
"MS": [
[
"Mississippi Department of Revenue: property tax",
"https://www.dor.ms.gov/property"
]
],
"MO": [
[
"Missouri State Tax Commission: county assessors",
"https://stc.mo.gov/"
]
],
"MT": [
[
"Montana Cadastral (statewide parcel map)",
"https://svc.mt.gov/msl/mtcadastral/"
]
],
"NE": [
[
"Nebraska Property Assessment Division: county assessors",
"https://revenue.nebraska.gov/PAD"
]
],
"NV": [
[
"Nevada Department of Taxation: county assessors",
"https://tax.nv.gov/"
]
],
"NH": [
[
"NH GRANIT (state GIS)",
"https://www.granit.unh.edu/"
]
],
"NJ": [
[
"NJ Division of Taxation: county tax boards",
"https://www.nj.gov/treasury/taxation/lpt/localtax.shtml"
]
],
"NM": [
[
"New Mexico Taxation and Revenue: property tax",
"https://www.tax.newmexico.gov/property-tax/"
]
],
"NY": [
[
"NY ORPTS: assessor and parcel lookup",
"https://www.tax.ny.gov/research/property/default.htm"
]
],
"NC": [
[
"NC OneMap: parcels (statewide)",
"https://www.nconemap.gov/pages/parcels"
]
],
"ND": [
[
"North Dakota GIS Hub: parcels",
"https://www.gis.nd.gov/"
]
],
"OK": [
[
"Oklahoma Tax Commission",
"https://oklahoma.gov/tax.html"
]
],
"OR": [
[
"Oregon Department of Revenue: county assessors",
"https://www.oregon.gov/dor/programs/property/Pages/default.aspx"
]
],
"PA": [
[
"PASDA: Pennsylvania parcel data",
"https://www.pasda.psu.edu/"
]
],
"RI": [
[
"RIGIS: Rhode Island parcels",
"https://www.rigis.org/"
]
],
"SC": [
[
"South Carolina Department of Revenue: property",
"https://dor.sc.gov/property"
]
],
"SD": [
[
"South Dakota Department of Revenue",
"https://dor.sd.gov/"
]
],
"TN": [
[
"Tennessee Comptroller: property assessments",
"https://comptroller.tn.gov/office-functions/pa.html"
]
],
"TX": [
[
"Texas Comptroller: find your appraisal district",
"https://comptroller.texas.gov/taxes/property-tax/"
]
],
"UT": [
[
"Utah AGRC: parcels (statewide)",
"https://gis.utah.gov/products/sgid/cadastre/parcels/"
]
],
"VT": [
[
"Vermont Open Geodata: parcels",
"https://geodata.vermont.gov/"
]
],
"VA": [
[
"Virginia Tax",
"https://www.tax.virginia.gov/"
]
],
"WA": [
[
"Washington Department of Revenue: county assessors",
"https://dor.wa.gov/taxes-rates/property-tax"
]
],
"WV": [
[
"West Virginia Property Viewer (statewide parcels)",
"https://mapwv.gov/parcel/"
]
],
"WY": [
[
"Wyoming Department of Revenue",
"https://revenue.wyo.gov/"
]
]
};
