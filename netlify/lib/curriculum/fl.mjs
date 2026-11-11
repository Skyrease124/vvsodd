// Florida: tax certificate sales (liens) and tax deed sales. Pilot course.
// Every rule that can change a bid carries a citation key; see SOURCES below (checked dates and editions).
const CK = '2026-11-11', ED = '2025 Florida Statutes';
const S = (short, name, url, checked = CK, effective = ED) => ({ short, name, url, checked, effective });
const fs = sec => S('§' + sec, 'Fla. Stat. § ' + sec, 'https://www.flsenate.gov/Laws/Statutes/2025/' + sec);

const sources = {
  '197.172': fs('197.172'), '197.333': fs('197.333'), '197.402': fs('197.402'), '197.432': fs('197.432'), '197.4325': fs('197.4325'),
  '197.443': fs('197.443'), '197.462': fs('197.462'), '197.472': fs('197.472'), '197.4725': fs('197.4725'), '197.482': fs('197.482'),
  '197.502': fs('197.502'), '197.522': fs('197.522'), '197.542': fs('197.542'), '197.552': fs('197.552'), '197.573': fs('197.573'), '197.582': fs('197.582'),
  '201.02': fs('201.02'),
  '7425': S('26 USC 7425', '26 U.S.C. § 7425 (discharge of federal tax liens; redemption by the United States)', 'https://www.law.cornell.edu/uscode/text/26/7425', CK, 'current U.S. Code'),
  lee: S('Lee TC', 'Lee County Tax Collector: Tax Certificates page', 'https://www.leetc.com/tax-certificates/', CK, ''),
  leon: S('Leon TC', 'Leon County Tax Collector: certificate lists', 'https://leontaxcollector.net/Services/property-taxes/Certificate-Lists', '2026-11-02', ''),
  alachua: S('Alachua list', 'Alachua County tax certificate sale list (LienHub)', 'https://lienhub.com/county/alachua/certsale/', '2026-11-08', ''),
  roll: S('FL parcels', 'Florida Statewide Parcels (Florida Geographic Information Office; county property appraisers via the Florida Department of Revenue)', 'https://www.arcgis.com/home/item.html?id=efa909d6b1c841d298b0a649e7f71cf2', CK, 'roll updated 2026-09-30'),
  fema: S('FEMA', 'FEMA National Flood Hazard Layer', 'https://msc.fema.gov/portal/search', CK, ''),
  nwi: S('NWI', 'U.S. Fish and Wildlife Service National Wetlands Inventory', 'https://www.fws.gov/program/national-wetlands-inventory/wetlands-mapper', CK, ''),
  naip: S('USGS NAIP', 'USGS The National Map, NAIP Plus orthoimagery', 'https://www.usgs.gov/programs/national-geospatial-program/national-map', CK, ''),
  portal: S('FL portal', 'Florida Tax Sale Portal (used by the smaller counties listed on our Florida page)', 'https://www.flataxsales.com/Home.aspx', '2026-11-02', '')
};

const modules = [
// ───────────────────────── 1
{ id: 'm1', title: 'How Florida’s tax sale system works', free: true, lessons: [
{ id: 'fl-what', title: 'What Florida sells: certificates first, deeds later', body: `
Florida runs two different sales, years apart. First the county sells **tax certificates**: a certificate is a lien for the unpaid tax, not the property [[197.432]]. Later, if the taxes are never paid, a certificate holder can force a **tax deed** auction where the property itself is sold [[197.502]] [[197.542]].

## What a certificate buyer actually receives
You pay the delinquent taxes, interest, costs and charges on one parcel. In return you hold a certificate that earns the interest rate you bid, up to 18% a year [[197.172]]. The certificate "may not be enforced in any manner except as prescribed in this chapter" [[197.432]]: you cannot enter the property, collect rent or contact the owner for the first 2 years [[197.432]].

## Who does what
- **Tax collector**: advertises the delinquent list, runs the certificate sale, takes redemptions, sells county-held certificates and takes tax deed applications [[197.402]] [[197.432]] [[197.472]] [[197.502]].
- **Clerk of the circuit court**: sends owner notices, runs the tax deed auction, issues the tax deed and handles surplus money [[197.522]] [[197.542]] [[197.582]].
- **Property appraiser**: sets the values on the roll and apportions value if part of a parcel is redeemed [[197.472]].
- **Board of county commissioners**: pays for advertising and has first right to buy "lands available for taxes" [[197.402]] [[197.502]].

>> The one sentence to remember: in Florida you buy the debt in the spring, and only a separate court-clerk auction years later can transfer the land.

?? Open {{u:/liens/states/state/?s=FL|our Florida page}} and find two county links: one tax collector (certificates) and one clerk (tax deeds). Write down which office you would call about a redemption and which about a deed auction.

Foundations refresher: {{f:basics|What tax liens and tax deeds are}}.` },
{ id: 'fl-calendar', title: 'The Florida calendar: from tax bill to tax deed', body: `
Florida dates come straight from the statute. Learn them once and every county list makes sense.

- **November 1**: taxes are due [[197.333]].
- **April 1**: unpaid taxes become delinquent (or 60 days after the bill is mailed, if later) [[197.333]]. A 3% minimum charge applies to delinquent taxes paid before the certificate sale [[197.172]].
- **By June 1** (or the 60th day after delinquency, if later): the tax collector advertises once a week for 3 weeks and sells certificates on every delinquent parcel [[197.402]].
- **Certificate date**: for sales that start on or after June 1, every certificate is dated the first day of the sale, and interest includes the month of June [[197.402]].
- **2 years after April 1 of the issue year**: the earliest a holder can apply for a tax deed [[197.502]].
- **7 years after issue**: a certificate with no deed application (and no bankruptcy or other proceeding of record) is void and canceled [[197.482]].

## Worked timeline
= 2025 taxes billed November 2025
= Delinquent April 1, 2026
= Certificate sold at the county's 2026 sale (dated the first sale day)
= Earliest deed application: April 1, 2028
= Certificate expires: 7 years after the 2026 issue date, unless a deed application is filed

!! Months matter, not days: interest is calculated from the first day of each month [[197.172]]. An owner who pays on the 2nd of a month pays the whole month.

?? On our site, open the {{u:/liens/states/county/?c=Leon|Leon County page}}. Pick a certificate and work out (1) its issue year, (2) the earliest deed application date and (3) its 7-year expiration year.` },
{ id: 'fl-paths', title: 'The two ways a Florida certificate ends', body: `
Almost every Florida certificate ends one of two ways.

## Path 1: redemption (the usual ending)
Anyone may redeem at any time after the certificate is issued and before the tax deed buyer pays in full [[197.472]]. The person redeeming pays the face amount plus interest, costs and charges. The tax collector pays you within 15 business days [[197.472]]. Most investors in certificates are paid this way: they earn interest and never touch the property.

## Path 2: tax deed
If no one redeems, after 2 years you may apply for a tax deed [[197.502]]. You must pay off every other outstanding certificate on the parcel, current and delinquent taxes, and the costs to bring the property to sale [[197.502]]. The clerk then auctions the property. Your certificate becomes your opening bid. If someone outbids you, you are paid back with 1.5% a month interest on your sums [[197.582]]. If nobody does, you may end up with the property and must pay the remaining amounts within 30 days [[197.542]].

## A third ending to watch: expiration
If you do nothing for 7 years, the certificate is canceled and you lose it [[197.482]].

>> Plan every certificate for path 1, and only buy it if you would be comfortable with path 2.

?? Write one sentence for each path explaining where your money comes from. Then check your answer against {{f:redemption|Foundations: Redemption}}.` }
], quiz: [
  { q: 'What does a Florida tax certificate buyer receive?', a: ['The property', 'A lien for the unpaid taxes that earns the bid interest rate', 'A share of county revenue'], c: 1, why: 'Certificates are liens enforced only under Chapter 197 [[197.432]].' },
  { q: 'Who runs the tax deed auction?', a: ['The tax collector', 'The clerk of the circuit court', 'The property appraiser'], c: 1, why: 'The clerk sells property at public auction after a deed application [[197.542]].' },
  { q: 'When is the earliest a holder may apply for a tax deed?', a: ['Right after the sale', '2 years after April 1 of the year the certificate was issued', '7 years after issue'], c: 1, why: 'See [[197.502]]. Seven years is when an unused certificate expires [[197.482]].' }
]},
// ───────────────────────── 2
{ id: 'm2', title: 'Finding notices, lists, results and rules', lessons: [
{ id: 'fl-notices', title: 'Where Florida sale notices and lists are published', body: `
Every Florida certificate sale is advertised before it happens. The tax collector must advertise once a week for 3 weeks, listing each parcel in roll order with the amount due, interest to the sale date, the advertising cost and the expense of sale [[197.402]].

## Where to look, in order
1. **The county tax collector's website.** Most post the delinquent list, sale rules, registration dates and a link to the online auction. Example: Lee County's page explains that the sale is a competitive bid that starts at 18% and moves down in 0.25% steps [[lee]].
2. **The auction platform the county uses.** Florida lets tax collectors sell electronically, including proxy bidding [[197.432]]. Seventeen smaller counties use the Florida Tax Sale Portal [[portal]]. [[?Which vendor every other county uses changes. Always follow the link from the county's own site.]]
3. **The newspaper notice** required by law [[197.402]].
4. **Results.** After the sale the collector keeps the "list of tax certificates sold" with the date, certificate number, owner as returned, property description, buyer, rate and amount [[197.432]]. Many counties publish it. Leon County posts certificate lists online [[leon]].

## Tax deed sales are posted elsewhere
Tax deed auctions are run by the clerk, so their notices and calendars are on the clerk's site. Owners and lienholders get certified-mail notice at least 20 days before the sale [[197.522]].

?? From {{u:/liens/states/state/?s=FL|our Florida page}}, open one county's tax collector link. Find (1) the sale date, (2) the registration deadline and (3) the deposit rule. Write "not posted" for anything you cannot find. That gap is itself information.` },
{ id: 'fl-columns', title: 'Reading a Florida certificate list column by column', body: `
County files look different, but the facts inside them are set by law [[197.432]]. Here is how the columns on our county pages line up with what the county publishes.

- **Parcel (PIN)**: the county's parcel number exactly as the county writes it. Keep every leading zero and space.
- **Tax year**: the year the unpaid tax was assessed. A 2025 tax is sold at the 2026 sale.
- **Certificate number and year**: unique within the county and year. You need both to look a certificate up.
- **Face**: what the certificate costs at a sale. It includes the tax, interest to the sale, advertising, costs and the tax collector's 5% commission [[197.432]] [[197.402]].
- **Rate**: the winning bid rate, or 18% for certificates "struck to the county" when nobody bid [[197.432]].
- **Status**: sold to a bidder, county-held, redeemed or canceled.
- **Payoff**: what it would take to redeem on the file date. It grows each month [[197.172]].

## A real row from our Leon County page
= Parcel 1308202020000 · Tax year 2019 · Certificate 925 of 2020
= Face $191.34 · Rate 18% · Status County-held
= Source: Leon County Tax Collector certificate lists, checked 2026-11-02 [[leon]]

The rate is 18% and the status is county-held. Together those tell you nobody bid on this certificate at the 2020 sale.

!! A list is a snapshot. A certificate can be redeemed the day after the file was made. Confirm the current status with the tax collector before you pay anything.

?? Open the {{u:/liens/states/county/?c=Leon|Leon County page}}, switch to Table view and find one certificate that a bidder bought (a rate below 18%). What does the rate tell you about competition for it?` },
{ id: 'fl-ids', title: 'Florida parcel IDs: same land, different formats', body: `
Each Florida county writes parcel numbers its own way, and the statewide parcel map sometimes writes them differently again. Matching the wrong format is the most common research mistake.

## Real examples from our Florida backfill
- **Palm Beach**: the list shows 74-43-43-16-00-001-0340. The statewide map stores 74434316000010340, the same digits with the dashes removed [[roll]].
- **Leon**: 411352  C0120 has **two spaces** inside it. Remove one and the lookup fails.
- **Hillsborough**: lists use a folio such as A0009670000. The statewide map uses a different key (a strap). We match them through the county's own parcel map.
- **Escambia**: lists use an account number such as 02-3125-000. The statewide map uses a reference number such as 211S301101025008.
- **Santa Rosa, Volusia, Walton**: IDs ending in M or containing MINR are often **mineral or subsurface interests**, with no surface lot to look at.

## Rules that keep you out of trouble
1. Copy the ID exactly. Never retype it.
2. Keep leading zeros. 0009670000 is not 9670000.
3. When a map lookup fails, try the county property appraiser's own search before deciding the parcel does not exist.
4. If two parcels could match, stop. Bidding on an ambiguous ID is how people buy the wrong land.

?? Open any Florida county page on our site, tap Show on map on a parcel and compare the "Official parcel ID" in the public record with the ID in the list. Are they written the same way?

Foundations refresher: {{f:parcels|Parcel IDs}}.` }
], quiz: [
  { q: 'How often must the tax collector advertise the certificate sale?', a: ['Once', 'Once a week for 3 weeks', 'Daily for a month'], c: 1, why: 'See [[197.402]].' },
  { q: 'A certificate shows an 18% rate and status "county-held". What most likely happened?', a: ['The buyer bid 18%', 'Nobody bid, so it was struck to the county at the maximum rate', 'The owner redeemed'], c: 1, why: 'Unsold certificates are struck to the county at the maximum rate [[197.432]].' },
  { q: 'Why keep the two spaces in a Leon ID like "411352  C0120"?', a: ['They are decoration', 'The official records store them, and lookups fail without them', 'They mark a mineral parcel'], c: 1, why: 'Parcel IDs must match the official format character for character.' }
]},
// ───────────────────────── 3
{ id: 'm3', title: 'Registering, bidding and paying', lessons: [
{ id: 'fl-register', title: 'Registration, deposits and who may bid', body: `
Florida law leaves the mechanics of registration to each tax collector, within a few hard rules.

- The tax collector **may require a reasonable deposit** from anyone who wants to bid [[197.432]].
- Sales may be **electronic**, with **proxy bidding**, electronic deposits and electronic payment [[197.432]].
- A person who fails or refuses to pay a bid can be barred from bidding [[197.432]].
- A certificate holder who contacts an owner to demand payment within 2 years of April 1 of the issue year can be barred from future sales, and the contact can count as an unfair trade practice [[197.432]].

## What the county decides
Deposit size, registration deadline, the tax ID form (usually a W-9) and the bidding platform are set locally. [[?Deposit amounts and registration deadlines for each county must be read from that county's current sale rules. We do not list them because they change each year.]]

## A registration checklist
1. Find the sale rules on the tax collector's site, for this year.
2. Register before the deadline and file the tax form.
3. Fund the deposit in the way the county accepts.
4. Set a budget. Your deposit usually limits the total you can win.
5. Save every confirmation email.

?? Using {{u:/liens/states/state/?s=FL|our Florida page}}, open two counties' tax collector sites and compare their registration steps. Note one difference.

Foundations refresher: {{f:sale|How a tax sale works}}.` },
{ id: 'fl-bidding', title: 'Bidding down the rate, ties and zero-percent bids', body: `
## The rule
Each certificate goes to the bidder who will pay the amount due and accept **the lowest interest rate**, no higher than 18% [[197.432]] [[197.172]]. Bids are in quarter-point steps only: 18, 17.75, 17.5 and so on [[197.432]]. Lee County describes its sale exactly this way: bids start at 18% and go down in 0.25% increments [[lee]].

## Ties
When several bidders offer the same lowest rate, the tax collector chooses how to pick the winner. The law names two acceptable methods: **first bid received** or a **random-number generator** [[197.432]]. [[?Which method each county uses must be read from its sale rules.]]

## No bids
A certificate nobody buys is **struck to the county** at 18% [[197.432]]. You can buy it later (Module 4).

## Zero and near-zero bids
When a certificate is redeemed and the interest earned is less than 5% of the face, the person redeeming pays a **mandatory minimum of 5%** of the face. This does **not** apply to certificates bid at 0% [[197.472]]. That is why many bidders go very low but stop above zero.

= $1,000 certificate bid at 0.25%, redeemed after 3 months
= Interest at the bid rate: 1,000 × 0.25% × 3/12 = $0.63
= Mandatory minimum: 1,000 × 5% = $50.00
= You are paid the greater: $50.00

?? Use the {{t:calc|calculator}} to compare a 0.25% bid and a 6% bid on a $1,000 certificate redeemed after 6 months. Which pays more, and why does the answer flip after enough months?` },
{ id: 'fl-pay', title: 'Paying, failed payments and canceled bids', body: `
## Paying for what you won
The tax collector sends written or electronic notice when certificates are ready. **Payment is due within 48 hours** after that notice is sent. If you miss it, the collector may forfeit all or part of your deposit [[197.432]]. The certificate is issued only after payment [[197.432]].

## If a bid is canceled
- If the sale is still running, the certificate is offered again.
- If the sale has ended, it is offered at a later sale after being advertised again [[197.432]].

## If a payment bounces
Within 10 days after a payment is dishonored, the tax collector must notify the payor. If a payment for a certificate bounces after the sale has ended, the certificate is advertised and sold again, and a forfeited deposit pays the advertising first [[197.4325]].

## What is included in the face
The face includes the 5% commission the tax collector earns on the delinquent taxes and interest [[197.432]]. You do not pay it separately, but it is part of the amount you put in.

!! Never bid more than the money you can wire within 48 hours. "I'll find the money after I win" is how deposits are lost.

?? Write your own payment plan: where the money sits now, how long a wire takes from your bank, and who can approve it if you are away.` }
], quiz: [
  { q: 'What is the smallest step between Florida bid rates?', a: ['1%', '0.25%', '0.1%'], c: 1, why: 'Bids are accepted only in quarter-point fractions [[197.432]].' },
  { q: 'A certificate bid at 0% is redeemed. Does the 5% minimum apply?', a: ['Yes', 'No', 'Only for county-held certificates'], c: 1, why: 'The 5% minimum excludes certificates bid at 0% [[197.472]].' },
  { q: 'How long do you have to pay after the tax collector sends notice?', a: ['48 hours', '30 days', '1 week'], c: 0, why: 'Payment is due within 48 hours of the notice [[197.432]].' }
]},
// ───────────────────────── 4
{ id: 'm4', title: 'County-held certificates, unsold land and surplus money', lessons: [
{ id: 'fl-county', title: 'Buying county-held certificates over the counter', body: `
Certificates nobody bought are held by the county at 18%. **Anyone may buy one** at any time after it is issued and before a tax deed application is filed [[197.4725]].

## The price
You pay the face plus interest at **1.5% a month** (or part of a month) up to the purchase date, plus a $6.25 fee [[197.4725]]. Your new certificate's face includes everything you paid [[197.4725]].

## Two dates to keep straight
- The **original issue date** still controls when a deed application can be made [[197.4725]].
- **Your purchase date** is used to work out the interest or the minimum interest when it is redeemed [[197.4725]].

## Worked example (made-up numbers)
= County-held face: $500.00, issued June 2024
= You buy in June 2026: 24 months × 1.5% = 36% → $180.00 interest
= Fee: $6.25 → you pay $686.25 and your certificate's face is $686.25
= Earliest deed application still counts from the 2024 issue date

## Where to find them
Many tax collectors list county-held certificates online, and the law lets them sell these electronically [[197.4725]]. Lee County says unsold certificates are held by the county and can be bought later [[lee]]. On our county pages, filter the status for "County-held".

!! County-held means nobody wanted it at auction. Research it twice as hard.

?? On the {{u:/liens/states/county/?c=Leon|Leon County page}}, find a county-held certificate from 2020. Work out the 1.5%-a-month interest to today. Then check whether 7 years from issue has passed or is close [[197.482]].` },
{ id: 'fl-lands', title: '"Lands available for taxes" and escheat', body: `
Sometimes a tax deed auction draws no bidders, and the certificate holder does not pay what is due within 30 days. The clerk then puts the land on a list called **lands available for taxes** [[197.502]].

## Who can buy, and when
1. For the first **90 days**, the county may buy it for the opening bid or waive its right [[197.502]].
2. After that, **anyone** may buy it from the clerk for the opening bid, with no further notice or advertising [[197.502]]. Interest on the opening bid keeps building through the month of sale [[197.502]].
3. Taxes are not billed while it sits on the list. They are added to the minimum bid as omitted years [[197.502]].
4. **Three years** after the land was offered at the sale, it escheats to the county free and clear [[197.502]].

## Why this list is mostly leftovers
Land lands on this list because no one bid at a public auction. Expect slivers, landlocked lots, submerged land and other parcels with problems.

?? Find your target county's clerk website and search for "lands available for taxes". Is the list posted? How many parcels are on it, and what kinds of land are they?` },
{ id: 'fl-surplus', title: 'Surplus money after a tax deed sale', body: `
When a tax deed sells for more than the certificate holder's opening bid, the extra is **surplus** [[197.582]].

## Who gets it, in order
1. Government units with liens of record, including other certificates and omitted taxes [[197.582]].
2. Then people with an interest in the property who were entitled to notice, such as mortgage holders, lienholders and the former owner, as their interests may appear. This excludes neighbors who only got notice as adjoining owners [[197.582]].

The clerk mails a notice and holds the surplus **for 120 days** from the date of that notice for claims [[197.582]]. The notice tells claimants that senior mortgages and liens are paid in full before junior ones or the former owner [[197.582]].

## What this means for you as a bidder
- Surplus is not yours unless you held an interest in the property.
- If the opening bid included the homestead amount (half the assessed value), that amount is also treated as surplus [[197.582]].

!! Be wary of anyone selling "surplus recovery" as an easy business. Claims are handled by the clerk and the court under the rules above. Get legal advice before you act for anyone else.

?? Find one clerk's "surplus funds" or "tax deed surplus" page in your county. What does it say about how to file a claim and the deadline?` }
], quiz: [
  { q: 'How is interest figured when you buy a county-held certificate?', a: ['At your bid rate', 'At 1.5% a month up to the purchase date', 'There is no interest'], c: 1, why: 'See [[197.4725]].' },
  { q: 'Who gets the first 90 days to buy "lands available for taxes"?', a: ['Any investor', 'The county', 'The former owner only'], c: 1, why: 'The county may buy or waive during the first 90 days [[197.502]].' },
  { q: 'How long does the clerk hold surplus for claims after mailing its notice?', a: ['30 days', '120 days', '7 years'], c: 1, why: 'The required notice says 120 days [[197.582]].' }
]},
// ───────────────────────── 5
{ id: 'm5', title: 'Researching the parcel with our listings and maps', lessons: [
{ id: 'fl-picture', title: 'Read the picture: aerial, outline and lot size', body: `
Every matched Florida card on our site shows a USGS aerial photo with the parcel boundary drawn in gold, the lot size, and the photo's capture date [[naip]]. The outline comes from the Florida statewide parcel map, matched by county and parcel ID [[roll]].

## What to look for
- **Shape.** A long thin outline is often a strip, buffer or leftover. A tiny outline between two houses may be a sliver.
- **What is inside.** Trees, a roof, a pond, a road?
- **What touches it.** Is there pavement along one side? A house that looks like it sits partly on the lot?
- **Lot size label.** "Reported by the county" means the roll gave the size. "Estimated from the mapped boundary" means we measured the outline, so treat it as approximate.
- **Photo date.** The aerial can be years old. A house built since then will not show.

## Real example: Leon County parcel 1308202020000
The record shows 1.60 acres, vacant residential, with just value $8,400 [[roll]]. The aerial (December 2022) shows thick woods with no visible driveway [[naip]]. Our map layers show 40% of the lot in FEMA Zone A (high risk), 24.6% mapped wetlands, and **no mapped road within about 65 feet** [[fema]] [[nwi]].

!! The outline is a map, not a survey. It can be off by several feet, more in rural areas.

?? Open the {{u:/liens/states/county/?c=Leon|Leon County page}}, search 1308202020000, and tap Show on map. Zoom out until you can see the nearest road. How would someone legally reach this lot?` },
{ id: 'fl-layers', title: 'Zoning, flood zones, wetlands and road access', body: `
Our public record panel checks the **whole lot boundary**, not just a center point, against four layers.

## Flood (FEMA)
We show each flood zone and the share of the lot inside it. Zones starting with A or V are high-risk Special Flood Hazard Areas [[fema]]. "Data unavailable" means FEMA has no digital map there or the request failed. That is **not** the same as "no flood risk".

## Wetlands (NWI)
"No mapped overlap" means no wetland polygon touches the lot. "Data unavailable" means we could not check. A mapped wetland is a warning, not a final ruling. Permits decide what can be built [[nwi]].

## Road frontage
We measure how much of the boundary lies within about 50 feet of a mapped Census road. **Legal access is always marked unverified.** A road on a map does not prove a recorded right to use it.

## Zoning
We show zoning only where we have checked the local zoning layer (today: Leon and Manatee). Elsewhere it says "data unavailable". Check with the county or city, because cities and counties zone separately.

?? Pick any Florida card that says "Data unavailable" for one layer. Find the official source yourself: the FEMA map link, the wetlands mapper, or the county zoning map. What does it show?

Foundations refresher: {{f:gis|GIS and parcel maps}}.` },
{ id: 'fl-value', title: 'Assessed value, just value and what a lot is really worth', body: `
The roll gives two values [[roll]]:
- **Just value**: the appraiser's estimate of market value as of January 1.
- **Assessed value**: just value after caps. For homesteads it can be far below market.

Neither is a price. A county value can lag behind the market, and it may assume the lot is usable when it is not.

## Land-use codes tell you more than the price
Florida uses Department of Revenue codes from 00 to 99. In our Florida listings, the most common matched types are:
- 00 Vacant residential (483 parcels)
- 94 Right-of-way (233)
- 96 Sewage, waste or borrow pit (92)
- 95 Rivers, lakes or submerged land (34)
- 91 Utility (30)

Codes 94, 95 and 96 are almost never buildable. They are on tax lists because nobody pays taxes on them.

## A quick value check
1. Read the land-use code and description.
2. Compare the just value with nearby sold lots of the same size, using the county property appraiser's sales search.
3. Ask: if I ended up owning this, could I sell it, and to whom?

?? Find a parcel coded 94, 95 or 96 on one of our Florida county pages and look at its aerial. Write one sentence on why a buyer would struggle to resell it.` },
{ id: 'fl-legal', title: 'Legal descriptions, easements and recorded documents', body: `
The roll carries a **short legal description** of about 30 characters [[roll]]. County lists often carry a longer one. Neither replaces the recorded deed.

## Reading what you have
- "LOT 112 RAINBOW ACRES UNREC" means lot 112 in an **unrecorded** subdivision, so there may be no recorded plat to check boundaries against.
- "COM NE COR LOT 1 ... POB ... 12.91 FT ..." is a **metes and bounds** description: a walk around the boundary. Short distances like 12.91 feet often mean a strip.
- "OR 1311/792" points to Official Records **book 1311, page 792** at the clerk. Pull it.

## Easements and restrictions
Recorded easements, deed restrictions and plat notes live in the clerk's official records, not on the tax roll. After a tax deed, recorded use restrictions and covenants generally survive, and so can a lien for association assessments that come due after the deed [[197.573]].

## What to pull before bidding
1. The last recorded deed (from the OR book and page).
2. The plat, if one is recorded.
3. Any recorded easements, liens or lis pendens.

?? For Leon parcel 4123120001120, the list's description includes "OR 1364/1077 1819/211". Find the Leon County clerk's official records search and look up one of those book and page pairs. What kind of document is it?` }
], quiz: [
  { q: 'Our card says "Wetlands: data unavailable". What does it mean?', a: ['No wetlands', 'We could not check, so the lot is not cleared', 'The lot is all wetland'], c: 1, why: '"Unavailable" means not checked, which is different from "no mapped overlap".' },
  { q: 'Which code is most likely unbuildable?', a: ['00 Vacant residential', '01 Single family', '94 Right-of-way'], c: 2, why: 'Right-of-way parcels are road or utility strips.' },
  { q: 'After a tax deed, do recorded use restrictions usually survive?', a: ['Yes, generally', 'No, never', 'Only for homesteads'], c: 0, why: 'See [[197.573]].' }
]},
// ───────────────────────── 6
{ id: 'm6', title: 'Title and property risks', lessons: [
{ id: 'fl-survive', title: 'What survives a Florida tax deed', body: `
A tax deed wipes out most private claims, but not all of them.

## Survives
- **Government liens of record** held by a city, county, special district or community development district that were not paid from the sale proceeds [[197.552]]. Code-enforcement and utility liens are common examples.
- **Recorded restrictions and covenants** that limit use or building, and a lien for association assessments that come due **after** the tax deed [[197.573]].

## Destroyed
Except as the chapter allows, no other right, interest, restriction or covenant survives [[197.552]]. Rights of forfeiture, re-entry and reverter are destroyed [[197.573]].

## The federal exception to know about
If the United States holds a federal tax lien that is junior to the tax lien and was given the required notice, federal law gives the government **120 days from the sale**, or the local redemption period if longer, to redeem [[7425]]. Ask a title attorney whether this applies before you spend money on the property.

## Proof of regular process
A Florida tax deed is **prima facie evidence** that the proceedings were regular [[197.552]]. That helps, but buyers usually still need a quiet-title action before a title insurer will insure. [[?Insurer requirements vary. Confirm with a Florida title agent.]]

?? Search one county's code-enforcement lien records for a parcel on our list. Would that lien survive a tax deed?` },
{ id: 'fl-people', title: 'Homesteads, occupants and bankruptcy', body: `
## Homestead property
If the land is a homestead on the latest roll, the opening bid at the tax deed auction must also include **half of the assessed value** [[197.542]] [[197.502]]. If the property sells to someone else, that amount is treated as surplus [[197.582]]. Homesteads also change the certificate sale itself: a certificate under $250 on a homestead is not auctioned. It is issued to the county at 18% [[197.432]].

## Occupants
A certificate gives no right to enter [[197.432]]. Even after a tax deed, anyone living there must be removed through the courts. [[?Florida eviction and ejectment steps were not reviewed for this course. Ask a Florida attorney.]]

## Bankruptcy
A bankruptcy of record stops the 7-year expiration clock [[197.482]]. It can also pause collection and change how and when you are paid. Watch for it in the clerk's records and the federal court index.

## Errors and void certificates
Certificates can be canceled or corrected for errors [[197.443]]. Refunds on void certificates earn **8% simple interest or your bid rate, whichever is less**, figured monthly [[197.432]]. You get your money back, slowly, at a low return.

?? Look up whether a parcel on our list is a homestead (the property appraiser shows exemptions). How would that change the minimum bid at a deed sale?` },
{ id: 'fl-hoa', title: 'HOAs: finding the declaration and confirming it covers your lot', body: `
A tax deed does not wipe out a homeowners' association's rules. Recorded restrictions and covenants running with the land **survive**, and so can a lien for association assessments that come due **after** the deed [[197.573]]. Before you bid on any lot inside a subdivision, find out whether an HOA covers **that exact lot**.

## What our badge means
Every Florida parcel card shows one of three HOA statuses:
- **HOA confirmed**: a recorded declaration or amendment covers this specific parcel. We only use this after a person reviews the recorded documents.
- **Possible HOA**: an association is linked to the subdivision (for example, the county roll lists an association as owner of a common-area parcel), but coverage for this lot or phase is unverified.
- **HOA status unknown**: the records checked did not establish whether an HOA applies.

Open Show on map and read the HOA section. It shows the association, whether membership is mandatory, dues with a date and source (or **"Dues unverified"**), verified special assessments, restrictions that matter for vacant land, and the recording numbers.

## How to confirm coverage yourself
1. **Get the subdivision, phase, lot and block** from the legal description on the county record (our HOA section shows what we parsed). A name alone is only a lead.
2. **Find the recorded declaration** in the county clerk's official records, using the plat book and page or the association's name. Our "Check official records" link starts you at the property appraiser, then the clerk.
3. **Read the exhibits.** The legal description attached to the declaration lists the phases, blocks and lots it covers.
4. **Search for amendments** that add or remove parcels. A later phase is often added by a separate recorded document, and a lot can be removed.
5. **Match your exact lot** against that coverage. Same subdivision does not mean same declaration: phases can have different documents.
6. **Get current dues and assessments from a dated association source** (a budget, a statement, or a manager's letter). If you cannot, write "Dues unverified".

!! Never treat a subdivision name or a map boundary as proof. Confirm against the recorded documents.

## What to read for vacant land
Building approval and plans review, minimum house size, setbacks, fences, whether RVs, trailers or boats may be stored, rules about leaving a lot unbuilt, mowing and clean-up requirements, and enforcement fines.

## Factor it into your math
= Annual dues (verified) · multiplied by years you will hold
= Plus any verified special assessment
= Plus costs to meet building rules before you can use or sell the lot
= Subtract all of it from your maximum bid [[197.573]]

?? Pick a Florida card marked Possible HOA. List the three documents you would pull and the one fact each would settle.` },
{ id: 'fl-pass', title: 'Cheap Florida parcels you should usually pass on', body: `
Cheap lists are full of land nobody can use. Here are real patterns from our Florida data [[roll]].

1. **Mineral or subsurface rights only.** 980 of our Florida listings are interests under the ground with no surface lot, mostly in Santa Rosa, Volusia and Walton. There is nothing to stand on.
2. **Slivers.** Alachua parcel 03231-005-002 is 436 square feet, valued at $300, with no mapped road within about 65 feet. Its certificate was $47.19 [[alachua]].
3. **Right-of-way, retention ponds, submerged land.** Land-use codes 94, 96 and 95 together cover more than 350 of our matched parcels.
4. **Common areas.** Code 09 parcels belong to a subdivision. The owners' association usually controls them.
5. **Unmapped condo units.** 149 Miami-Dade listings are units in one commercial condo building. They have no separate outline, so you cannot verify the space from the map.

## Why they still matter
A certificate on any of these can still be redeemed. You earn interest on a lien, not on the land. But if no one redeems, the deed path leaves you holding something unsellable. Price the certificate as if you might end up owning the land.

?? On any Florida county page, turn off the junk filter and scroll. Find one example of each pattern above.` }
], quiz: [
  { q: 'Which of these can survive a Florida tax deed?', a: ['A private second mortgage', 'A county code-enforcement lien of record', 'A right of reverter'], c: 1, why: 'Government liens of record survive [[197.552]]. Reverter rights are destroyed [[197.573]].' },
  { q: 'At a tax deed sale on a homestead, the opening bid also includes:', a: ['Nothing extra', 'Half the assessed value', 'Double the taxes'], c: 1, why: 'See [[197.542]].' },
  { q: 'A void certificate is refunded with interest at:', a: ['18%', 'The lesser of 8% simple or your bid rate', 'Nothing'], c: 1, why: 'See [[197.432]].' },
  { q: 'A parcel is badged Possible HOA. What does that mean?', a: ['An association is linked to the subdivision, but coverage for this lot is unverified', 'The lot is definitely in an HOA', 'There is no HOA'], c: 0, why: 'Only a recorded declaration or amendment that covers the exact lot makes it confirmed [[197.573]].' }
]},
// ───────────────────────── 7
{ id: 'm7', title: 'Deal math', lessons: [
{ id: 'fl-certmath', title: 'Certificate return math, line by line', body: `
Florida certificate interest is simple interest on the face, counted by month from the first day of each month [[197.172]], with a 5% minimum on redemption unless you bid 0% [[197.472]].

## Example A: a mid-rate bid, redeemed in 10 months (made-up certificate)
= Face (what you paid): $2,400.00
= Bid rate: 9% a year
= Interest: 2,400 × 9% × 10/12 = $180.00
= 5% minimum: 2,400 × 5% = $120.00 → not needed, $180 is higher
= You receive: $2,580.00, within 15 business days of the redemption [[197.472]]
= Total return: 180 / 2,400 = 7.5%
= Annualized: 7.5% × 12/10 = 9.0%

## Example B: a low bid, redeemed fast
= Face $2,400.00 · bid 0.5% · redeemed after 2 months
= Interest at bid: 2,400 × 0.5% × 2/12 = $2.00
= 5% minimum: $120.00 → you receive the minimum
= Total return 5.0% · annualized 5.0% × 12/2 = 30%

## Example C: the same low bid, redeemed slowly
= Same certificate redeemed after 24 months
= Interest at bid: 2,400 × 0.5% × 24/12 = $24.00
= 5% minimum: $120.00 → you still receive $120.00
= Total return 5.0% · annualized 2.5%

>> Low bids win on fast redemptions and lose on slow ones. Your real return depends on when the owner pays, and you do not control that.

?? Rework Example A with the owner paying after 30 months. Then put the numbers in the {{t:calc|calculator}} and compare.

Foundations refresher: {{f:math|Return math}}.` },
{ id: 'fl-costs', title: 'When costs erase the profit', body: `
Small certificates look safe. Here is how they quietly lose money. The fee figures marked "example" are assumptions for illustration. Check your own bank and the county's rules.

## Scenario: twenty small certificates
= 20 certificates × $60 face = $1,200.00 invested
= All bid at 0.25% and all redeemed in 4 months
= Each pays the 5% minimum: $60 × 5% = $3.00 → 20 × $3 = $60.00 earned
= Example costs: a $25 bank wire to fund the deposit and a $25 wire back = $50.00
= Your time: about 20 minutes of research per parcel = 6.7 hours
= Net: $60.00 − $50.00 = $10.00, before valuing your time at all

## Scenario: the deed path on a cheap lot
= County-held certificate bought for $686.25 (face $500, plus interest and fee)
= Two years later you apply for a tax deed: $75 application fee [[197.502]]
= You must also pay every other certificate and tax on the parcel, plus the costs to bring it to sale: property search, notices, advertising [[197.502]]
= Example: other certificates and taxes $900, sale costs $450 → about $1,425 more
= Nobody else bids, so you become the buyer. You owe documentary stamps at 70 cents per $100 [[201.02]] and recording fees within 30 days [[197.542]]
= You now own a lot the county valued at $3,000, with no road access and partly in a flood zone
= Total cash in: about $2,130, plus a quiet-title action and years of taxes

!! The cheapest certificates often lead to the most expensive deeds. Work out the deed-path cash before you buy, not after.

?? Take any certificate on our list under $100 and estimate the deed-path cash using the steps above. Is the land worth it?` },
{ id: 'fl-maxbid', title: 'Setting a maximum bid at a tax deed auction', body: `
At a tax deed auction you bid dollars for the property. Decide your top number before the sale, then do not move it.

## The formula
= Conservative resale value (what it would sell for, fast, as-is)
= − Costs to clear title (quiet title, title search)
= − Back taxes and any surviving government liens [[197.552]]
= − Documentary stamps on your bid: 70 cents per $100 [[201.02]], plus recording fees
= − Holding costs until resale (taxes, insurance, mowing, association dues)
= − Selling costs (agent, closing)
= − The profit you need for the risk
= = Maximum bid

## Worked example (made-up numbers)
= Resale value as-is: $40,000
= Quiet title and title work: −$3,000 (example)
= Surviving code lien: −$1,200
= Holding 12 months: −$1,800
= Selling costs at 8%: −$3,200
= Profit required: −$8,000
= Before doc stamps: $22,800
= Doc stamps on a bid near $22,600: about $158 → maximum bid ≈ $22,600

## Deposit and payment
Non-certificate-holder winners must post a **nonrefundable deposit of 5% of the bid or $200, whichever is greater** at the sale, and pay in full, including documentary stamps and recording, **within 24 hours**, excluding weekends and holidays [[197.542]]. If you fail to pay, the clerk can refuse your future bids [[197.542]].

?? Pick a vacant lot on our Florida pages and build this table for it, using the just value as a starting guess and cutting it by 30% for "as-is". What is your maximum bid?

Foundations refresher: {{f:bidlimit|Bid limits}}.` }
], quiz: [
  { q: 'A $1,000 certificate bid at 1% is redeemed after 6 months. What do you receive in interest?', a: ['$5', '$50', '$180'], c: 1, why: '1,000 × 1% × 6/12 = $5, but the 5% minimum ($50) applies [[197.472]].' },
  { q: 'How much documentary stamp tax applies to a $10,000 tax deed?', a: ['$7', '$70', '$700'], c: 1, why: '70 cents per $100: 100 × $0.70 = $70 [[201.02]].' },
  { q: 'At a Florida tax deed auction, a non-certificate-holder winner must pay in full within:', a: ['24 hours, excluding weekends and holidays', '30 days', '2 years'], c: 0, why: 'See [[197.542]]. The certificate holder, if it wins, has 30 days.' }
]},
// ───────────────────────── 8
{ id: 'm8', title: 'Redemption', lessons: [
{ id: 'fl-who', title: 'Who can redeem, and how much they pay', body: `
**Any person** may redeem a Florida certificate at any time after it is issued, until the tax deed buyer pays in full, including documentary stamps and recording fees [[197.472]]. It is not limited to the owner. A lender, a relative or a buyer of the property can redeem.

## The amount
The face amount plus all interest, costs and charges [[197.472]]. Interest is monthly simple interest at your bid rate [[197.172]], or the 5% minimum if that is more and you did not bid 0% [[197.472]]. The person redeeming also pays a $6.25 fee to the tax collector [[197.472]].

## Partial redemption
Part of a parcel can be redeemed only if that part can be described legally and is backed by a sale contract or recorded deed. The property appraiser then splits the value [[197.472]].

## Your payment
The tax collector pays you what it received, less its fee, **within 15 business days** of the redemption, and identifies which certificates were paid [[197.472]].

?? Record a made-up certificate in {{t:portfolio|My portfolio}} and practice entering the redemption date and payout.` },
{ id: 'fl-clock', title: 'When the clock starts and what changes it', body: `
## Start
For sales that begin on or after June 1, every certificate is dated the first day of the sale, and interest includes the month of June [[197.402]]. A county-held certificate you buy later earns from **your purchase date** for interest, but keeps its original date for deed timing [[197.4725]].

## Monthly steps
Interest is counted from the first day of each month [[197.172]].

## What can change the timeline
- **A deed application** after 2 years. The owner can still redeem until the deed buyer pays in full [[197.502]] [[197.472]].
- **Seven years with no application.** The certificate is void and canceled [[197.482]].
- **Bankruptcy or other proceedings of record** stop that 7-year expiration [[197.482]].
- **Errors.** Certificates can be canceled or corrected, and refunds earn the lesser of 8% or your bid rate [[197.443]] [[197.432]].
- **A bounced redemption payment.** The redemption is reversed under the dishonored-payment rules [[197.4325]].

?? For a certificate dated June 1, 2026, list the earliest application date and the expiration date. Then name one event that could keep it alive past expiration.` },
{ id: 'fl-verify', title: 'Verifying that a certificate was really redeemed', body: `
Never assume. A certificate disappearing from a list does **not** prove it was redeemed. It may have been canceled, corrected or moved to a deed application.

## How to verify
1. **The tax collector's certificate record.** Look up by certificate number and year. It shows redeemed, canceled or deed application.
2. **Your payment.** The tax collector must pay within 15 business days and identify the certificates paid [[197.472]]. Match the amount to your math.
3. **The clerk's tax deed records**, if an application was filed.

## Record it
In {{t:portfolio|My portfolio}}, mark the certificate redeemed only when you have the payment or the official record. Write the source and the date you checked.

!! On our listing pages, a status change is shown only with its source and the date checked. A missing row is never treated as "redeemed".

?? Pick a certificate number from one of our Florida county pages and find where that county lets you look up a certificate's current status. Write down the URL.` }
], quiz: [
  { q: 'Who may redeem a Florida certificate?', a: ['Only the owner of record', 'Any person', 'Only a mortgage holder'], c: 1, why: '"A person may redeem" [[197.472]].' },
  { q: 'How soon must the tax collector pay you after a redemption?', a: ['15 business days', '90 days', 'At the next sale'], c: 0, why: 'See [[197.472]].' },
  { q: 'A certificate vanished from the latest county list. What can you conclude?', a: ['It was redeemed', 'Nothing yet. Check the official record.', 'It expired'], c: 1, why: 'Removal alone does not prove redemption. Verify with the tax collector.' }
]},
// ───────────────────────── 9
{ id: 'm9', title: 'What happens after you win', lessons: [
{ id: 'fl-hold', title: 'After a certificate sale: documents and follow-up', body: `
## Right after the sale
1. Watch for the tax collector's notice that certificates are ready, then pay within 48 hours [[197.432]].
2. The certificate is issued after payment [[197.432]]. Save the certificate number, year, parcel, face, rate and date.
3. Add it to {{t:portfolio|My portfolio}} with the earliest deed-application date and the 7-year expiration [[197.502]] [[197.482]].

## While you hold it
- **No contact** with the owner to demand payment for 2 years after April 1 of the issue year [[197.432]].
- You may **sell (transfer)** the certificate any time before redemption or deed. The tax collector records it for $2.25 [[197.462]].
- Check the status a few times a year. Watch for bankruptcy filings, corrections and later certificates on the same parcel.

## Possible outcomes
- **Redeemed**: paid within 15 business days [[197.472]].
- **Canceled or corrected**: refunded with the lesser of 8% or your bid rate [[197.432]].
- **Still open after 2 years**: decide whether to apply for a deed (next lesson) or keep waiting.
- **Seven years untouched**: void [[197.482]].

?? Set up a dated reminder for each milestone of one made-up certificate: payment due, 2-year mark, a 6-year "decide now" warning and the 7-year expiration.` },
{ id: 'fl-apply', title: 'Applying for a tax deed', body: `
After 2 years from April 1 of the issue year, and before the certificate is canceled, you may file it with an application for a tax deed [[197.502]].

## What you pay
- An application fee of up to **$75**, plus online service costs if the county charges them. If the combined fee is more than $75, you may file without the online service [[197.502]].
- **All other outstanding certificates** on the parcel, plus omitted, delinquent and current taxes, with interest [[197.502]].
- The **costs to bring the property to sale**: property information search, mailing and advertising. You must pay them within 30 days of the clerk's notice, or the application is canceled [[197.502]].

## What happens next
1. The tax collector orders a property information report from a title or abstract company to find who must be notified [[197.502]].
2. The tax collector certifies to the clerk who must be notified: owners, lienholders, mortgage holders, contract-for-deed buyers, the person assessed, mobile home lienholders and adjoining owners, among others [[197.502]].
3. The clerk mails notice by certified mail **at least 20 days before the sale** [[197.522]].
4. The clerk advertises and holds the auction [[197.542]].

!! Owners often redeem after an application is filed. Plan for that. It is a common ending, not a failure.

?? List every amount you would pay to apply for a deed on a made-up $800 certificate with one later certificate of $650 and current taxes of $400.` },
{ id: 'fl-auction', title: 'The tax deed auction and its outcomes', body: `
## The opening bid
Your bid as certificate holder is everything needed to redeem your certificate, plus the sale costs, other certificates you redeemed and your other costs, plus **1.5% a month** from the month after the application through the month of sale, plus notice-service costs. Homesteads add half the assessed value [[197.542]].

## Outcome 1: someone outbids you
The clerk pays you all the sums you paid plus 1.5% a month for that period [[197.582]]. Any surplus goes to government liens, then to the people entitled to notice [[197.582]].

## Outcome 2: nobody outbids you
The property is struck off to you. You pay any unpaid amounts, documentary stamps and recording fees (and the homestead amount, if any) **within 30 days** [[197.542]]. The clerk then issues and records the tax deed [[197.542]]. The deed is issued in the county's name and is prima facie evidence of regular proceedings [[197.552]].

## Outcome 3: a buyer fails to pay
For a non-certificate-holder winner who misses the 24-hour deadline, the clerk cancels the bids, readvertises within 30 days, and pays the costs from the deposit [[197.542]].

## Outcome 4: no bidders and you do not pay
The land goes on "lands available for taxes" [[197.502]].

## After you get the deed
Order a title search, budget for a quiet-title action, check for surviving government liens and covenants [[197.552]] [[197.573]], and plan how to deal with any occupants.

?? Write down which outcome above you would prefer for a lot worth $15,000 with your opening bid at $3,000, and explain why.` }
], quiz: [
  { q: 'What does it cost to transfer (sell) a certificate you hold?', a: ['Nothing', '$2.25 recording charge at the tax collector', '5% of face'], c: 1, why: 'See [[197.462]].' },
  { q: 'How far ahead must the clerk mail notice of a tax deed sale?', a: ['At least 20 days', '2 years', '48 hours'], c: 0, why: 'See [[197.522]].' },
  { q: 'If someone outbids the certificate holder, the holder receives:', a: ['Nothing', 'Their sums plus 1.5% a month for the application period', 'The whole sale price'], c: 1, why: 'See [[197.582]].' }
]},
// ───────────────────────── 10
{ id: 'm10', title: 'Local differences inside Florida', lessons: [
{ id: 'fl-local', title: 'Comparing two counties’ verified procedures', body: `
Chapter 197 sets the frame, and each county fills in the details. Here are two counties we checked against their own official pages.

## Lee County (tax collector page, checked ${CK})
- Certificate sale: competitive bidding starts at 18% and moves down in **0.25% increments**. The lowest rate wins [[lee]].
- The tax collector says it does not guarantee the value or condition of any property [[lee]].
- Unsold certificates are held by the county and can be bought later [[lee]].

## Leon County (certificate lists, checked 2026-11-02)
- The tax collector publishes **certificate lists online**, including county-held certificates years after the sale. Our Leon page has 113 of them, some dating from 2020 [[leon]].
- Those old county-held certificates show how long unsold liens can sit, and why the 7-year expiration [[197.482]] and the county's own deed applications [[197.502]] matter.

## Seventeen small counties
Baker, Bradford, Calhoun, DeSoto, Franklin, Glades, Gulf, Hamilton, Hardee, Holmes, Jefferson, Jackson, Liberty, Okeechobee, Wakulla, Madison and Washington sell through the Florida Tax Sale Portal [[portal]].

## Always confirm locally
- Deposit amount and how to fund it.
- The registration deadline.
- How ties are broken (first bid or random number) [[197.432]].
- The platform and its fees.
- [[?Lee and Leon deposit amounts and tie methods were not posted on the pages we checked. Read each year's sale rules.]]

?? Pick two Florida counties from {{u:/liens/states/state/?s=FL|our Florida page}} and fill in the four "confirm locally" items for each.` },
{ id: 'fl-offices', title: 'Which office to call for what', body: `
Calling the wrong office wastes a week. Use this map.

- **"Is this certificate still open?"** → tax collector [[197.472]].
- **"Can I buy a county-held certificate?"** → tax collector [[197.4725]].
- **"I want to apply for a tax deed."** → tax collector [[197.502]].
- **"When is the deed auction? What is the opening bid?"** → clerk of court [[197.542]].
- **"Is there surplus money? How do I claim it?"** → clerk of court [[197.582]].
- **"Who owns this? Is it a homestead? What is it worth?"** → property appraiser [[roll]].
- **"Can I build here?"** → county or city planning and zoning.
- **"Is it in a flood zone?"** → FEMA map [[fema]], then the county floodplain office.

## Where to find each office
Our {{u:/liens/states/state/?s=FL|Florida page}} links every county's tax collector and parcel search. The clerk's tax deed pages are on each clerk's own site.

?? Make a one-page contact sheet for one county: tax collector, clerk tax deeds, property appraiser and zoning, with phone numbers and URLs.` }
], quiz: [
  { q: 'Lee County says its bidding starts at what rate?', a: ['5%', '18%', '0%'], c: 1, why: 'See [[lee]] and [[197.172]].' },
  { q: 'Who runs the tax deed auction calendar?', a: ['Clerk of court', 'Property appraiser', 'Tax collector'], c: 0, why: 'See [[197.542]].' },
  { q: 'Which detail is NOT set by the state statute and must be checked locally?', a: ['The 18% maximum rate', 'The deposit amount', 'The 2-year wait for a deed application'], c: 1, why: 'The statute allows a "reasonable deposit" but leaves the amount to the county [[197.432]].' }
]},
// ───────────────────────── 11
{ id: 'm11', title: 'Case studies', lessons: [
{ id: 'fl-case-win', title: 'Case 1 (simulated): a certificate that paid', body: `
!! SIMULATED. The numbers below are made up to show the math. No real purchase or payout is described.

## Setup
A residential lot with a house, just value $180,000, has $2,100 of unpaid taxes. At the June sale, bidding falls to 7.5%, and the simulated investor wins.

## Research done first
- Parcel matched to the statewide roll. Aerial shows a house with a driveway on a paved street.
- Flood: Zone X only. Wetlands: no mapped overlap.
- No code liens found. Owner-occupied homestead, so a certificate under $250 would not have been auctioned [[197.432]]. This one is above that.

## Math
= Face: $2,205.00 (taxes, interest, costs and 5% commission) [[197.432]]
= Owner redeems after 11 months
= Interest: 2,205 × 7.5% × 11/12 = $151.59
= 5% minimum would be $110.25, so the bid interest applies [[197.472]]
= Paid within 15 business days: $2,356.59
= Annualized: 151.59 / 2,205 × 12/11 = 7.5%

## Why it worked
A valuable, occupied home almost always redeems. The investor accepted a lower rate in return for very low deed-path risk.

?? Change only the redemption time to 3 months and recompute. Which rule kicks in?` },
{ id: 'fl-case-pass', title: 'Case 2 (real parcel): a cheap certificate to pass on', body: `
This case uses a real listing and real public records. No purchase happened.

## The listing
Alachua County parcel 03231-005-002, certificate 659 of 2026, tax year 2025. Face $47.19, status county-held, rate 18% [[alachua]].

## The record
- Lot size: **436 square feet** (reported by the county). Just value $300. Vacant residential [[roll]].
- Legal description begins "COM NE COR LOT 1 BK 5 LUNDYS ADDN ...", a metes-and-bounds strip 12.91 feet wide at one end [[alachua]].
- Flood: Zone X across the lot. Wetlands: no mapped overlap [[fema]] [[nwi]].
- Road frontage: **no mapped road within about 65 feet**. Legal access unverified.
- The list notes 7 outstanding certificates on this parcel [[alachua]].

## Decision: Pass
1. A 436-square-foot strip cannot hold a house and has no sensible resale market.
2. If nobody redeems, a deed application means paying all 7 outstanding certificates plus sale costs [[197.502]]. That is far more than the $300 value.
3. The interest on $47.19 is too small to justify the research time and the deed-path risk.

>> When the cost of the bad ending is bigger than the land, the interest does not matter.

?? Open Alachua parcel 03231-005-002 on {{u:/liens/states/county/?c=Alachua|our Alachua page}} and tap Show on map. Describe what is on each side of the strip.` },
{ id: 'fl-case-unknown', title: 'Case 3 (real parcel): when missing information blocks a decision', body: `
## The listing
Leon County parcel 4123120001120, certificate 4778 of 2021, tax year 2020. Face $1,660.56, county-held at 18%, from the tax collector's list checked 2026-11-02 [[leon]].

## The record
- 1454 Craft St, Tallahassee. 0.48 acre. Land-use code 01 **single family**. Just value **$93,354** for the 2026 roll [[roll]].
- Zoning R-5. Flood Zone X across the lot. No mapped wetlands. About 183 feet of mapped frontage on Craft St [[fema]] [[nwi]].
- The December 2022 aerial shows mostly tree cover inside the outline [[naip]].

## What we cannot tell from here
1. **Is the certificate still available?** County-held certificates cannot be bought once a tax deed application is filed [[197.4725]]. The county must apply for a deed on county-held certificates for property valued at $5,000 or more [[197.502]]. At $93,354, this one qualifies. It may already be in the deed process.
2. **Is there a house?** The roll says single family. The aerial shows trees. A house under the canopy, a demolished house or a coding error are all possible.
3. **Homestead status** affects a deed sale's opening bid [[197.542]].

## Decision: no decision yet
The right move is to call the Leon County Tax Collector about certificate 4778 of 2021, and check the clerk's tax deed list. Until then, neither Bid nor Pass is justified.

?? Write the three questions you would ask the tax collector, in order.` }
], quiz: [
  { q: 'In Case 2, why pass even though the face is only $47.19?', a: ['The rate is too high', 'The deed-path costs are far larger than the land is worth', 'It is in a flood zone'], c: 1, why: 'Seven outstanding certificates plus sale costs would exceed the $300 value [[197.502]].' },
  { q: 'In Case 3, why might the county-held certificate no longer be available to buy?', a: ['Because the county must apply for a deed on property valued at $5,000 or more', 'Because it is in a flood zone', 'Because it is under $250'], c: 0, why: 'See [[197.502]] and [[197.4725]].' },
  { q: 'Case 1 is labeled simulated. What does that mean?', a: ['The numbers are illustrations, not a real payout', 'It happened last year', 'It is from a court record'], c: 0, why: 'We call an outcome real only when a record supports it.' }
]},
// ───────────────────────── 12
{ id: 'm12', title: 'Final project', lessons: [
{ id: 'fl-project', title: 'Final project: research a Florida certificate and decide', body: `
## Your assignment
Choose one Florida listing on our site and produce a one-page decision memo with these six parts:
1. **The listing**: county, parcel ID exactly as written, certificate number and year, face, rate, status, list source and date checked.
2. **Verification**: confirm the parcel on the map. Write the official ID, owner of record, land use and lot size, and note any ID format difference.
3. **Land risks**: flood share, wetlands, mapped frontage and zoning, each with its source, and "unavailable" where we could not check.
4. **Title risks**: government liens, covenants, homestead status, bankruptcy and other certificates.
5. **Math**: interest at a 6-month and a 24-month redemption, the deed-path cash estimate, and your maximum price.
6. **Decision**: Bid, Pass or "need more information", in three sentences.

## Worked answer: Leon parcel 4123120001120
1. Leon County, 4123120001120 (no spaces), certificate 4778 of 2021, tax year 2020, face $1,660.56, county-held at 18%. Leon certificate list, checked 2026-11-02 [[leon]].
2. Matches statewide ID 4123120001120. 1454 Craft St, 0.48 acre (reported), code 01 single family, just value $93,354 (2026 roll) [[roll]].
3. Flood Zone X, 100%. No mapped wetlands. About 183 feet of frontage on Craft St (legal access unverified). Zoning R-5 [[fema]] [[nwi]].
4. Possible homestead: unknown, check the appraiser. Other certificates: unknown, check the collector. A deed application is likely because the value is over $5,000 [[197.502]].
5. If bought now: 1.5% a month since issue applies, so the price is far above the face [[197.4725]]. At 18% on the new face, a 6-month redemption earns 9%. Low deed-path risk, given the value and frontage.
6. **Need more information.** First confirm the certificate is still county-held and no deed application exists [[197.4725]]. If both are true, it is a reasonable certificate to consider, because of the value, frontage and clean flood picture.

## Grading rubric (100 points)
- Listing copied exactly, with source and date: **15**
- Parcel verified on the map, with the ID difference noted: **15**
- Land risks with sources, and unknowns marked: **20**
- Title risks, including homestead and other certificates: **15**
- Math shown line by line, including a deed-path estimate: **20**
- Clear decision that follows from the evidence: **15**

A score of 80 or more passes. Any invented fact, or an unsourced number used in the decision, caps the score at 60.

?? Do the project on a different Florida listing. Then use the {{u:/learn/course/?c=fl&x=1|Bid or Pass exercise}} to practice the decision step.` }
], quiz: [
  { q: 'In the rubric, what happens if your memo invents a fact?', a: ['Nothing', 'The score is capped at 60', '10 bonus points'], c: 1, why: 'Every number in a bid decision must have a source.' },
  { q: 'What is the first thing to confirm before buying a county-held certificate on a valuable property?', a: ['That no tax deed application has been filed', 'The color of the house', 'The owner’s phone number'], c: 0, why: 'County-held certificates cannot be bought after a deed application [[197.4725]].' },
  { q: 'Which three answers can a decision memo end with?', a: ['Bid, Pass or need more information', 'Only Bid', 'Bid or Pass only'], c: 0, why: '"Need more information" is the honest answer when key facts are missing.' }
]}
];

const exercise = {
  title: 'Bid or Pass: Leon County parcel 1308202020000',
  simulated: false,
  label: 'Real listing and real public records. **The decision is a simulation.** No purchase is made and no outcome is reported, because no record of one exists.',
  lien: { county: 'Leon', state: 'FL', parcel: '1308202020000', amount: 191.34, rate: '18%' },
  calc: { amount: 380.33, rate: 18, months: 24, fees: 6.25, from: 'Leon parcel 1308202020000 (two county-held certificates, faces $191.34 and $188.99)' },
  facts: [
    ['Certificates', '925 of 2020 ($191.34) and 730 of 2021 ($188.99), county-held at 18% [[leon]]'],
    ['List checked', '2026-11-02, Leon County Tax Collector [[leon]]'],
    ['Lot', '1.60 acres (reported), vacant residential, just value $8,400 (2026 roll) [[roll]]'],
    ['Flood', '40% in FEMA Zone A (high risk), 60% Zone X [[fema]]'],
    ['Wetlands', '24.6% of the lot, freshwater forested or shrub wetland [[nwi]]'],
    ['Road', 'No mapped road within about 65 ft. Legal access unverified.'],
    ['Zoning', 'R (Tallahassee-Leon County zoning map)'],
    ['HOA', 'HOA status unknown on our card: the legal description (“8 1N 3E”) names no subdivision. Check it yourself in the steps below.']
  ],
  brief: `
Your task: decide whether you would buy the county-held certificates on this parcel over the counter [[197.4725]]. Enter the **most cash you would put in**, counting the purchase price now and what a tax deed application would cost if nobody redeems. Then choose Bid or Pass and explain.

Use the map to check access, the calculator to price the purchase, and the rules on county-held purchases [[197.4725]], deed applications [[197.502]] and expiration [[197.482]].

**HOA check (do this before you enter a number):** (1) Open Show on map and read the HOA section and the legal description. (2) Decide whether a subdivision exists: if the description names none, search the clerk’s official records for the parcel’s deeds and any recorded declaration that mentions this tract. (3) If you find a declaration, read its exhibits and every amendment, and write the document and recording number that covers your exact lot. (4) Get dues and assessments from a dated source, or write “Dues unverified”. (5) List the restrictions that affect an unbuilt lot. (6) Subtract verified dues and building costs from your maximum.`,
  walkthrough: `
## 1. Price the purchase
County-held certificates are bought at face plus 1.5% a month to the purchase date, plus $6.25 each [[197.4725]].
= Certificate 925 (2020): $191.34 + about 77 months × 1.5% ≈ $191.34 + $220.94 = $412.28 + $6.25
= Certificate 730 (2021): $188.99 + about 65 months × 1.5% ≈ $188.99 + $184.27 = $373.26 + $6.25
= Rough total today ≈ $798 (months counted from June of each sale year to November 2026)

## 2. Check the clock
The 2020 certificate turns 7 years old in 2027. Without a deed application it will be canceled [[197.482]]. The county must apply for deeds on county-held certificates for property valued at $5,000 or more [[197.502]]. At $8,400, this parcel qualifies. So the first step is a call: is a deed application already pending? If it is, you cannot buy [[197.4725]].

## 3. Picture the bad ending
If nobody redeems and you apply for a deed, you must pay every other certificate and the current taxes, plus the costs to bring it to sale [[197.502]]. If nobody outbids you, you may end up owning 1.6 wooded acres with no mapped road, 40% in a high-risk flood zone and a quarter mapped as wetland, valued at $8,400.

## 4. A reasonable answer
**Pass**, or at most a small amount after confirming that no deed application is pending. The certificates have sat unredeemed since 2020, which suggests the owner may not redeem. The deed path leads to land that is hard to reach, hard to build on and hard to resell. An 18% headline rate does not fix that.

## 5. The HOA step
Our card says **HOA status unknown**, because the roll’s legal description for this tract names no subdivision. That is not a clearance. A careful student searches the clerk’s records for a recorded declaration, and if none is found writes “No declaration found in the records checked, on (date)”. Had a declaration existed, the student would confirm its exhibits and amendments cover this exact lot, then subtract verified dues and building rules from the maximum. **Simulated example (made-up numbers):** dues of $600 a year held for 3 years is $1,800, plus a $2,500 building-plan and landscaping requirement, so $4,300 comes off the maximum before bidding. If dues cannot be verified, say so and treat the parcel as higher risk.

Strong answers mention: the 1.5%-a-month purchase price, the 7-year expiration, the county's duty to apply, the access, flood and wetland findings with their sources, and the HOA steps.`
};

export default {
  id: 'fl', state: 'FL', title: 'Florida Tax Sales: The Complete Course', status: 'published', checked: CK,
  review: 'Pilot course. Rules are cited to the 2025 Florida Statutes, checked ' + CK + '. Items marked "Needs review" were not verified. This course has not yet had an outside legal review.',
  intro: 'How Florida really sells tax certificates and tax deeds: who does what, how to read the lists, how bidding and redemption work, how to research a parcel with our maps, the math, the risks, and what happens after you win. Built on the statute, with every rule cited.',
  sources, modules, exercise,
  glossary: [
    ['Tax certificate', 'A lien for unpaid property taxes sold at the yearly sale. It earns interest until redeemed.'],
    ['Face amount', 'The amount paid for a certificate: taxes, interest, costs, charges and the 5% commission.'],
    ['Bid-down', 'Bidders compete by accepting lower interest, in 0.25% steps, from 18%.'],
    ['Struck to the county', 'A certificate nobody bought, held by the county at 18%.'],
    ['County-held certificate', 'A certificate owned by the county that anyone may buy before a deed application, at face plus 1.5% a month.'],
    ['Redemption', 'Paying off a certificate. Anyone may redeem until the deed buyer pays in full.'],
    ['Mandatory minimum interest', 'At least 5% of face on redemption, unless the bid was 0%.'],
    ['Tax deed application', 'A filing, allowed 2 years after April 1 of the issue year, that starts the deed auction.'],
    ['Opening bid', 'The certificate holder’s bid at the deed auction: redemption amounts, costs and 1.5% a month (plus half the assessed value for homesteads).'],
    ['Lands available for taxes', 'Land with no bidders at a deed sale. The county may buy it first, then anyone.'],
    ['Surplus', 'Deed-sale money above the opening bid, paid to government liens and then interested parties.'],
    ['Escheat', 'After 3 years on the lands-available list, the land passes to the county free and clear.'],
    ['Documentary stamp tax', '70 cents per $100 of consideration on a deed.'],
    ['Prima facie evidence', 'Treated as true unless someone proves otherwise. A tax deed is prima facie evidence of regular proceedings.'],
    ['HOA declaration', 'The recorded document that creates an association and its rules. Its exhibits and amendments list which lots it covers.'],
    ['Quiet title', 'A court action to clear title so it can be sold or insured.'],
    ['Just value', 'The property appraiser’s market-value estimate as of January 1.'],
    ['DOR land-use code', 'Florida’s 00 to 99 code describing how a parcel is used.'],
    ['Official Records (OR) book/page', 'Where a recorded document sits in the clerk’s records.']
  ],
  links: [
    ['Florida Statutes, Chapter 197 (2025)', 'https://www.flsenate.gov/Laws/Statutes/2025/Chapter197', 'statute'],
    ['Our Florida page: every county’s tax collector and parcel search', '/liens/states/state/?s=FL', 'site'],
    ['Lee County Tax Collector: Tax Certificates', 'https://www.leetc.com/tax-certificates/', 'county'],
    ['Leon County Tax Collector: Certificate Lists', 'https://leontaxcollector.net/Services/property-taxes/Certificate-Lists', 'county'],
    ['Florida Tax Sale Portal (17 smaller counties)', 'https://www.flataxsales.com/Home.aspx', 'portal'],
    ['FEMA Flood Map Service Center', 'https://msc.fema.gov/portal/search', 'federal'],
    ['National Wetlands Inventory mapper', 'https://www.fws.gov/program/national-wetlands-inventory/wetlands-mapper', 'federal']
  ],
  checklists: {
    research: ['Copy the parcel ID exactly, keeping zeros and spaces', 'Confirm the parcel on the map, and note any ID format difference', 'Read the land-use code and just value', 'Look at the aerial: shape, access, structures', 'Flood share (FEMA) with source and date', 'Wetlands (NWI) with source and date', 'Mapped road frontage, and remember legal access is unverified', 'Zoning from the county or city', 'Pull the last deed (OR book/page) and any plat', 'Search government liens (code, utility)', 'Check homestead status', 'HOA: find the recorded declaration and any amendments, and confirm they cover this exact lot', 'HOA: dues and special assessments from a dated source (or write “Dues unverified”)', 'HOA: restrictions on building, RVs and unbuilt vacant lots', 'Check other certificates and pending deed applications', 'Check for bankruptcy', 'Confirm the current status with the tax collector'],
    bid: ['Registered, tax form filed, deposit funded', 'Payment can be wired within 48 hours', 'Interest worked out at 6, 12 and 24 months, plus the 5% minimum', 'Deed-path cash estimated (other certificates, taxes, costs)', 'Maximum rate or price written down before the sale', 'Tie rule for this county known', 'Deposit and 24-hour rule known for deed sales (5% or $200)', 'Documentary stamps (70 cents per $100) and recording in the budget', 'Verified HOA dues, assessments and building rules subtracted from my maximum bid', 'Plan if nobody redeems', 'Everything logged in My portfolio']
  }
};
