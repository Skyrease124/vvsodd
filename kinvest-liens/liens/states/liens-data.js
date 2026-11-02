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
const LIENS = []; // none loaded yet: the 2027 lists are not posted. Load from official files only.
