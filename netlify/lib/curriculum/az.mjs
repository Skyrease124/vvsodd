// Arizona: tax lien sales (certificates of purchase), bid-down interest, judicial foreclosure of the right to redeem.
const CK = '2026-11-11', ED = 'Arizona Revised Statutes (azleg.gov), as posted';
const S = (short, name, url, checked = CK, effective = ED) => ({ short, name, url, checked, effective });
const ars = sec => S('ARS ' + sec, 'A.R.S. § ' + sec, 'https://www.azleg.gov/ars/42/' + sec.split('-')[1] + '.htm');
const sources = {
  '17154': ars('42-17154'), '18053': ars('42-18053'), '18056': ars('42-18056'), '18101': ars('42-18101'), '18104': ars('42-18104'), '18105': ars('42-18105'),
  '18106': ars('42-18106'), '18107': ars('42-18107'), '18109': ars('42-18109'), '18111': ars('42-18111'), '18112': ars('42-18112'), '18113': ars('42-18113'),
  '18114': ars('42-18114'), '18115': ars('42-18115'), '18116': ars('42-18116'), '18117': ars('42-18117'), '18118': ars('42-18118'), '18121': ars('42-18121'),
  '18122': ars('42-18122'), '18125': ars('42-18125'), '18127': ars('42-18127'), '18151': ars('42-18151'), '18152': ars('42-18152'), '18153': ars('42-18153'),
  '18154': ars('42-18154'), '18155': ars('42-18155'), '18201': ars('42-18201'), '18202': ars('42-18202'), '18204': ars('42-18204'), '18205': ars('42-18205'), '18206': ars('42-18206'),
  pima: S('Pima TO', 'Pima County Treasurer: Tax Lien Sale (2026 sale information)', 'https://www.to.pima.gov/taxLienSale/', CK, '2026 sale'),
  maricopa: S('Maricopa TO', 'Maricopa County Treasurer: Tax Lien Information', 'https://treasurer.maricopa.gov/TaxLienInformation/', CK, ''),
  pinal: S('Pinal list', 'Pinal County Treasurer: Tax Lien Sale List', 'https://treasurer.pinal.gov/ParcelInquiry/Main/TaxLienSale', '2026-11-03', 'list dated 11/3/2026'),
  fema: S('FEMA', 'FEMA National Flood Hazard Layer', 'https://msc.fema.gov/portal/search', CK, ''),
  nwi: S('NWI', 'U.S. Fish and Wildlife Service National Wetlands Inventory', 'https://www.fws.gov/program/national-wetlands-inventory/wetlands-mapper', CK, '')
};
const SIM = '!! SIMULATED. Every number below is made up to teach the method. No real certificate, purchase or payout is described.';

const modules = [
{ id: 'm1', title: 'How Arizona’s tax lien system works', free: true, lessons: [
{ id: 'az-what', title: 'What Arizona sells: a lien, not the land', body: `
Arizona sells the **tax lien** on a delinquent parcel, not the parcel itself. The county treasurer secures unpaid taxes by selling the lien at auction and, later, by foreclosing the right to redeem [[18101]]. The winner receives a **certificate of purchase** (or a registered certificate in the treasurer's records) [[18118]].

## What you buy
You pay the whole amount of delinquent taxes, interest, penalties and charges, and you earn interest at the rate you bid [[18114]]. The owner still owns the property. You gain a right to be paid back and, if the owner never redeems, a right to sue to **foreclose the right to redeem** [[18201]].

## Who does what
- **County treasurer**: prepares the list, runs the sale, issues certificates, takes redemptions, and later delivers a treasurer's deed when a court orders it [[18106]] [[18112]] [[18154]] [[18205]].
- **County assessor**: describes the parcel on the roll and sets values.
- **Superior court**: hears the foreclosure and enters judgment [[18201]] [[18204]].
- **County recorder**: records deeds and lis pendens notices [[18206]].

>> In Arizona you buy the debt in February. Only a court judgment, years later, can turn it into ownership.

?? Open {{u:/liens/states/state/?s=AZ|our Arizona page}} and find one county treasurer link. Write down which county it is and where it says the sale is run.

Foundations refresher: {{f:basics|What tax liens and tax deeds are}}.` },
{ id: 'az-calendar', title: 'The Arizona calendar, from delinquency to expiration', body: `
- **Taxes accrue 16% simple interest** from delinquency. Part of a month counts as a whole month [[18053]].
- **By December 31**: the treasurer prepares the list of delinquent real property and the notice of sale [[18106]].
- **January 1**: a penalty of $5 or 5% of the delinquent taxes, whichever is more, is added to each listed parcel [[18107]].
- **Two to three weeks before the sale**: the list is published at least once in a newspaper, and posted at the treasurer's door for at least two weeks [[18109]].
- **February**: the tax lien sale is held, continuing from day to day until every lien is offered [[18112]].
- **From the first day of the next month**: your lien earns interest at your bid rate [[18114]].
- **Within 15 days after the sale closes**: you must pay in full [[18116]].
- **After 3 years**: you may file a foreclosure action [[18201]].
- **10 years after the end of the month you bought**: an unforeclosed lien and certificate expire [[18127]].

## Worked timeline (simulated)
= Taxes for 2025 unpaid → delinquent in 2026
= List prepared by December 31, 2026 · sale in February 2027
= Interest at your bid rate starts March 1, 2027
= Earliest foreclosure action: February 2030 (3 years after the sale)
= Expiration if you do nothing: 10 years after the end of the month of purchase

?? Using the Pima County 2026 sale as a model (sale held February 26, 2026) [[pima]], write the dates for your own simulated purchase.` },
{ id: 'az-ends', title: 'The three ways a lien certificate ends', body: `
## 1. Redemption (the usual ending)
The owner, or someone on the owner's behalf, pays the amount for which the lien was sold plus interest at your bid rate, plus any later taxes you paid and statutory fees [[18153]]. You are paid when you surrender the certificate or the registered certificate is redeemed [[18155]].

## 2. Foreclosure of the right to redeem
After 3 years (and no later than 10), you may sue in superior court [[18201]]. If you win, the court orders the treasurer to deliver a deed [[18204]] [[18205]]. The owner can ask for a sale to recover excess proceeds instead [[18204]].

## 3. Expiration
If you never foreclose within 10 years after the end of the purchase month, the certificate expires and the lien is void [[18127]].

>> Plan every purchase for the first ending. Only buy it if you could live with the second.

?? For each of the three endings, write one sentence on where your money comes from or why it stops.` }
], quiz: [
  { q: 'What does an Arizona tax lien buyer receive?', a: ['The property', 'A certificate of purchase that earns the bid interest rate', 'A discount on future taxes'], c: 1, why: 'See [[18114]] and [[18118]].' },
  { q: 'What interest rate applies to delinquent Arizona taxes?', a: ['16% a year simple, with part of a month counted as a whole month', '8% compounded', '5% a year'], c: 0, why: 'See [[18053]].' },
  { q: 'When may a certificate holder first file a foreclosure action?', a: ['Immediately', 'Three years after the sale', 'Never'], c: 1, why: 'See [[18201]].' }
]},
{ id: 'm2', title: 'Finding notices, lists and results', lessons: [
{ id: 'az-notices', title: 'Where Arizona sale notices and lists are published', body: `
The treasurer must prepare the delinquent list by December 31 and post it at the treasurer's office for at least two weeks before the sale [[18106]] [[18109]]. It must be published at least once in a newspaper of general circulation, two to three weeks before the sale, and the newspaper must also post it online on a legal-notices site from first publication through March 1 [[18109]].

## What the notice must include
The owner's name, the parcel number (and account number if available), the tax years delinquent, and the taxes, penalties, interest and charges [[18106]]. Counties must make the property description for each parcel number available on a county website [[18106]].

## Where investors look in practice
1. **The county treasurer's tax lien page.** Pima's page explains the 2026 online sale, hosted by RealAuction, with a booklet of rules [[pima]]. Maricopa's page points to RealAuction and has a separate section on state assignments [[maricopa]].
2. **Our Arizona county pages.** We list Pinal and Coconino parcels from official lists [[pinal]].
3. **The record of tax lien sales.** The treasurer must keep one showing sale date, parcel, buyer, amount, subsequent taxes, assignments, redemptions and deeds [[18117]].

?? From {{u:/liens/states/state/?s=AZ|our Arizona page}}, open two counties' tax lien pages and write down the sale date and the auction platform for each.` },
{ id: 'az-columns', title: 'Reading an Arizona lien list', body: `
Arizona lists come straight from the statute's required contents [[18106]].

- **Parcel number**: the assessor's number. Keep every digit and any letters. In Pinal, the last character is a check digit, and the county map uses the first 9 characters [[pinal]].
- **Tax years**: which years are delinquent. A lien can bundle many years [[18104]].
- **Amount**: taxes, penalties, interest and charges. This is the **price of the lien** you pay if you win, plus fees [[18104]] [[18114]].
- **Penalty**: the $5-or-5% listed-property penalty is part of the total [[18107]].
- **Description**: the county's legal description. Two or more lots assessed as one parcel can be sold as one lien [[18111]].

## A real row from our Pinal data (list dated 11/3/2026)
= Parcel 5051601705 · vacant land · 1.18 acres
= Amount on the list: $29,334.74
= County value (market): $27,612
= Source: Pinal County Treasurer tax lien sale list [[pinal]]

The price of the lien is **more than the county says the land is worth**. That is a red flag, covered in Module 6.

!! A list is a snapshot of what was offered. Check the treasurer for the current status before you act.

?? Open {{u:/liens/states/county/?c=Pinal|our Pinal page}} and find one lien whose amount is higher than its county market value.` },
{ id: 'az-ids', title: 'Arizona parcel numbers and descriptions', body: `
County assessors use their own parcel number formats, and notices may use either the parcel number or a legal description [[18111]]. Sections, townships and ranges may be abbreviated by initials and figures [[18111]]. A sale is not invalid just because the property was advertised in a wrong person's name, if the description identifies the property [[18111]].

## Practical rules
1. Match the parcel number **and** the description.
2. A description like "S1/2 SW OF R/R" or "ANY POR OF LAND LYING W OF I-10" can be a strip or part of a parcel. Check size and shape on the map.
3. Mineral rights are taxed separately. Taxes on separately owned minerals are not a lien on the surface, and a tax sale on one does not affect ownership of the other [[17154]].

?? Choose two Pinal parcels from {{u:/liens/states/county/?c=Pinal|our list}} and compare the "acres" to what the description says.

Foundations refresher: {{f:parcels|Parcel IDs}}.` }
], quiz: [
  { q: 'Where must the delinquent list be posted before the sale?', a: ['Only online', 'At the treasurer’s office for at least two weeks, plus a newspaper', 'Nowhere'], c: 1, why: 'See [[18109]].' },
  { q: 'The listed price of a lien is $29,335 and the county value is $27,612. What does it suggest?', a: ['A bargain', 'The lien costs more than the land is worth', 'The land is a flood zone'], c: 1, why: 'Compare price with value before anything else.' },
  { q: 'Does a tax sale of separately owned minerals affect the surface?', a: ['Yes', 'No', 'Only in Pima'], c: 1, why: 'See [[17154]].' }
]},
{ id: 'm3', title: 'Registering, bidding and paying', lessons: [
{ id: 'az-register', title: 'Registration and the online auction', body: `
Arizona's biggest counties run the sale online through RealAuction. Pima's 2026 sale had registration from February 2 through February 19 and a **one-day** auction on February 26, with batches closing between 8:00 and 12:00 and an auxiliary session after [[pima]]. **All sales are final** [[pima]].

## What registration involves
You create an account on the auction site and agree to its rules. [[?Deposit requirements, tax forms and identity steps for each county's sale must be read from that county's current bidding rules.]]

## Your checklist
1. Read the county's tax lien booklet and bidding rules for this year.
2. Register before the deadline.
3. Research every parcel before the batch closes. Pima segregates liens into batches [[pima]].
4. Know your payment method and the payment deadline. The statute allows up to 15 days after the sale closes [[18116]].

?? Find a county's 2026 or 2027 tax lien sale page and write down the registration window and the sale date.` },
{ id: 'az-bidding', title: 'Bid-down rates, 0% bids and who wins', body: `
## The rule
The lien goes to the person who pays the full amount due and **accepts the lowest interest rate**, which cannot exceed the 16% statutory rate [[18114]] [[18053]]. Pima's sale starts at 16% and goes down in **1% increments**. A **0% bid is acceptable** [[pima]].

## What a bid means
You are not bidding the amount you pay. You pay the whole delinquent amount, and the competition is over the rate you will accept [[18114]]. Interest begins the first day of the month after you buy [[18114]].

## No bids
Liens nobody wants are passed, reoffered, and finally **assigned to the state** [[18113]]. Taxes on that property are not payable until the lien is redeemed or the certificate is sold again, and redemption interest follows the statute [[18113]].

## Zero percent: why people do it
A 0% bid wins when competition is heavy, and earns nothing if the owner redeems. Some investors accept it to get a foreclosure right on a valuable parcel. That is a deed strategy, not an interest strategy. It only makes sense if the land is worth far more than the lien.

= Lien amount $4,000 · bid 0% · redeemed after 6 months
= Interest earned: $0.00. Fees paid: certificate $10 [[18118]] plus county and platform fees [[pima]]
= Net: a small loss

?? Rework the example at a 4% bid. How much interest would you earn in 6 months? (Interest is simple, by the month.)` },
{ id: 'az-pay', title: 'Paying, fees, and what happens if you do not', body: `
## Payment
The purchaser pays the purchase price in **cash** at a time the treasurer sets, but **within 15 days after the sale closes** [[18116]].

## If you do not pay
- If the sale has not closed, the treasurer resells the lien [[18116]].
- If the sale has closed, the treasurer may **sue to recover the amount you bid**, or **bar you from buying liens in any Arizona county for up to one year** [[18116]].

## Fees you will see
- **Certificate fee**: $10 per certificate [[18118]].
- **Processing fee**: up to $10 per lien by statute [[18116]]. Pima's schedule is $1 under $50, $5 under $200 and $10 at $200 or more, plus a platform fee that varies by amount [[pima]].
- **Later taxes**: a $5 fee to record subsequent taxes on the certificate [[18121]].

!! Fees are fixed, so they hurt small liens most. A $30 lien pays $11 in county fees before the platform fee.

?? List every fee you would pay on a simulated $150 lien in Pima County, using the schedule above.` }
], quiz: [
  { q: 'In Pima County’s 2026 sale, what was the bid increment?', a: ['1%', '0.25%', '5%'], c: 0, why: 'See [[pima]].' },
  { q: 'How long do you have to pay after the sale closes?', a: ['Within 15 days', '1 year', '24 hours'], c: 0, why: 'See [[18116]].' },
  { q: 'If you win and fail to pay after the sale closed, the treasurer may:', a: ['Do nothing', 'Sue for the bid or bar you for up to 1 year', 'Give you the lien free'], c: 1, why: 'See [[18116]].' }
]},
{ id: 'm4', title: 'State assignments, over-the-counter liens and later taxes', lessons: [
{ id: 'az-assign', title: 'State-assigned liens: buying what the auction left', body: `
Unsold liens are assigned to the state and a certificate is issued to the state [[18113]]. Later, **anyone** can buy them: the treasurer sells, assigns and delivers the certificate to any person who pays the **whole amount then due**, including interest, penalties and charges, **plus the entire amount of subsequent taxes** assessed [[18122]]. The treasurer collects an assignment fee of up to $10 [[18122]].

## Where it happens
Pima calls these "New Assignments (Over-The Counter Liens)" and sells them through its auction account [[pima]]. Maricopa's page links to RealAuction and has a State Assignment section [[maricopa]].

## What changes for you
- Interest on state-held liens follows the statute's rate when redeemed [[18113]].
- The price includes later years' taxes, so the amount grows each year.
- The lien has sat unsold. Someone with the same information declined it at auction.

!! Over-the-counter does not mean cheap. It means nobody wanted it at the sale.

?? Find where one Arizona county lists its assigned liens, and write down how the price is stated.` },
{ id: 'az-subsequent', title: 'Paying later taxes as a certificate holder', body: `
On or after June 1, a certificate holder may pay **subsequent taxes** on the property, with accrued interest and fees. The treasurer records the payment on the certificate and in the record of tax lien sales, and a $5 fee applies [[18121]]. The amount of subsequent taxes **bears interest at the rate on your certificate**, starting the month after you buy that subsequent lien [[18121]].

## Why do it
1. It protects the lien from being lost to a competing certificate.
2. It builds your total claim at your bid rate. If the owner redeems, they must pay these amounts with interest [[18153]].

## Large-county rule
In counties with more than three million people, if no prior-year certificates are outstanding, the treasurer issues a **separate certificate for each subsequent year** [[18121]].

?? A $2,000 lien at 6% with $500 of subsequent taxes paid 12 months later. How much does the owner owe at redemption 24 months after the sale? Check with [[18153]].` },
{ id: 'az-transfer', title: 'Transfers and records', body: `
A certificate of purchase is **assignable by endorsement**, and an assignment noted in the treasurer's record vests all right and title in the assignee [[18118]]. The treasurer collects a $10 fee for each certificate [[18118]]. Pima's page also describes a reassignment form that must be notarized and sent with a $10 transfer fee [[pima]].

## Keep your own records
The county's record of tax lien sales shows purchaser, amount, subsequent taxes, assignments, redemptions and deeds [[18117]]. Mirror it in {{t:portfolio|My portfolio}}: certificate number, parcel, amount, rate, date, later taxes and notices.

## Lost certificates
A duplicate can be issued for a fee. [[?The duplicate-certificate procedure and fee in 42-18120 were not reviewed.]]

?? Enter a simulated Arizona certificate in {{t:portfolio|My portfolio}} with every date from Module 1.` }
], quiz: [
  { q: 'To buy a state-assigned lien, you pay:', a: ['Only the original amount', 'The whole amount then due plus subsequent taxes', 'Nothing'], c: 1, why: 'See [[18122]].' },
  { q: 'Subsequent taxes you pay earn interest at:', a: ['16%', 'The rate stated on your certificate', '0%'], c: 1, why: 'See [[18121]].' },
  { q: 'How is a certificate transferred?', a: ['By endorsement, noted in the treasurer’s record', 'It cannot be', 'By a new auction'], c: 0, why: 'See [[18118]].' }
]},
{ id: 'm5', title: 'Researching the parcel', lessons: [
{ id: 'az-research', title: 'Researching an Arizona lien with our maps', body: `
Our Pinal and Coconino cards show the county map outline where we have checked the ID match, plus pre-checked road, flood and wetland flags. (The new Florida-style aerial thumbnails cover Florida today; Arizona listings use the county parcel map.)

## A repeatable routine
1. **Open the parcel map.** Tap Show on map on a Pinal listing. Check shape, size and neighbors.
2. **Roads.** The card flags "no mapped road". A flagged lot can be landlocked.
3. **Flood.** FEMA zones with A or V are high-risk [[fema]].
4. **Wetlands.** Mapped wetlands can limit building [[nwi]].
5. **Value.** Compare the lien amount with the county market value shown on the card.
6. **Land use.** "Vacant land" is a use code, not a promise that the lot is usable.

## Real example: Pinal 5051601705
1.18 acres, vacant land, county value $27,612, lien amount $29,334.74. Our flags: road found nearby, not in a mapped high-risk flood zone, no mapped wetlands [[pinal]] [[fema]] [[nwi]].

?? Open {{u:/liens/states/county/?c=Pinal|our Pinal page}}, tap Research on three parcels and record what each shows.` },
{ id: 'az-value', title: 'Lien amount versus land value: the central Arizona test', body: `
Arizona is a lien state with a long road to a deed, so the **price of the lien relative to the land** decides whether the deed path is worth walking.

## Three cases
- **Lien far below the land value.** If the owner never redeems, a foreclosure could deliver land worth much more than you paid. These parcels draw the most competition and the lowest bids.
- **Lien near the land value.** The deed path may barely pay for itself after legal costs.
- **Lien above the land value.** Your only profit is interest. If the owner never redeems, you can end up foreclosing on land worth less than you paid.

## Our real data
- Pinal 5051601705: lien $29,334.74 vs value $27,612, **above** value.
- Pinal 20319001A7: lien $33,525.22 vs value $154,028, well **below** value, but 1.04 acres with mapped wetlands on the lot [[pinal]].

>> A county market value is not a price. It is a starting point for your own estimate.

?? Compute the lien-to-value ratio for five Pinal parcels. Which ones would you research first, and which would you skip?` },
{ id: 'az-title', title: 'Recorded documents, easements and legal descriptions', body: `
Tax liens do not wipe out everything. Neither the sale of a lien nor a foreclosure extinguishes an **easement** on or appurtenant to the property, nor certain **assessment liens** (such as irrigation, flood-control and improvement district assessments) [[18115]] [[18204]].

## What to pull
1. The last recorded deed at the county recorder.
2. Recorded easements and plat notes.
3. Any lis pendens or other recorded notices [[18206]].
4. The assessor's parcel record and legal description.

## Reading a description
"THOSE PORTIONS OF LOT 8 & 9 BLK 2 CASA GRANDE FARMS UNIT 2 LYING WEST OF COLORADO ST" is a **partial parcel**. Check how much of the lot it really is.

?? Pick a Pinal parcel whose description says "portion" or "any por". Find the county's map and note the shape.` }
], quiz: [
  { q: 'Does a tax lien foreclosure in Arizona wipe out recorded easements?', a: ['Yes', 'No', 'Only unrecorded ones'], c: 1, why: 'See [[18115]] and [[18204]].' },
  { q: 'Your lien costs more than the county value of the land. The main profit source is:', a: ['The land', 'Interest if the owner redeems', 'Surplus'], c: 1, why: 'The deed path would not pay for itself.' },
  { q: 'Which flood zones are high-risk?', a: ['X', 'A and V zones', 'None'], c: 1, why: 'See [[fema]].' }
]},
{ id: 'm6', title: 'Title and property risks', lessons: [
{ id: 'az-survive', title: 'What survives, and what a foreclosure does', body: `
## A tax lien sale does not extinguish
Easements on or appurtenant to the property, and liens for assessments under certain Title 48 districts and city or county provisions [[18115]].

## A judgment foreclosing the right to redeem
The defendants' rights to redeem end, and they have no further legal or equitable right, title or interest, subject to appeal [[18204]]. It still leaves easements, those assessment liens and, if the court allows an excess proceeds sale, the owner's interest in the excess proceeds [[18204]].

## Insubstantial errors
The statute says an insubstantial failure to follow the procedure does not invalidate the assessment, the lien or the sale [[18101]]. Substantial failures can still be challenged. [[?What counts as substantial is a legal question for an Arizona attorney.]]

## Erroneous sales
If a lien is sold by mistake on property where no tax was due, the treasurer pays you back the principal plus interest at your bid rate or **10% simple, whichever is less** [[18125]].

?? Find one Arizona recorded easement or assessment lien on a parcel (the county recorder's search) and note what it is.` },
{ id: 'az-owners', title: 'Owners, occupants and bankruptcy', body: `
A lien gives you no right to enter. A foreclosure judgment and a treasurer's deed are required first [[18204]] [[18205]]. [[?Removing occupants after a deed is governed by Arizona eviction law. Ask an Arizona attorney.]]

## Homesteads
Real property occupied as a homestead is not charged for taxes other than those on the homestead [[17154]]. A homestead owner can redeem as anyone can [[18151]].

## Bankruptcy and court orders
If a court order or another law prohibits bringing a foreclosure action, the 10-year deadline is **extended 12 months after the prohibition ends** [[18201]] [[18127]]. The expiration is also paused if the parcel is the subject of a judicial proceeding or a 30-day notice [[18127]].

## Redemption during foreclosure
An owner can redeem **any time before judgment**. If they redeem after a lis pendens is recorded, they must also pay your litigation guarantee, record search and reasonable attorney fees [[18206]].

?? Write a short plan for how you would learn that an owner filed bankruptcy, and what you would do next.` },
{ id: 'az-pass', title: 'Arizona liens to pass on', body: `
- **Lien above the land's value.** You are lending money against land worth less than the loan.
- **No mapped road.** Possible landlocked parcel. Legal access is unverified.
- **Mapped wetlands or high-risk flood.** Common near washes and rivers.
- **Strips and partial parcels.** Descriptions such as "E-30 FEET OF THE S-313.90" often describe slivers.
- **Mineral rights only.** Taxes on separately owned minerals do not touch the surface [[17154]].
- **Subdivision "tracts" owned by an association.** The association may be the real owner and payer.

## Real data point
Our Pinal list has parcels valued at $500 by the county with liens of $70 to $22,000. Both extremes are red flags: $500 usually means a county placeholder value, not market value [[pinal]].

?? Mark ten Pinal parcels B (research further) or P (pass), with one reason for each P.` }
], quiz: [
  { q: 'A treasurer’s foreclosure judgment still leaves:', a: ['Nothing', 'Easements and certain assessment liens', 'Mortgages'], c: 1, why: 'See [[18204]].' },
  { q: 'If a lien was sold by mistake where no tax was due, you receive:', a: ['Nothing', 'Principal plus interest at the bid rate or 10% simple, whichever is less', 'Double'], c: 1, why: 'See [[18125]].' },
  { q: 'An owner redeems after a lis pendens is recorded. They also owe:', a: ['Nothing extra', 'Your litigation guarantee, record search and reasonable attorney fees', 'A fine to the county'], c: 1, why: 'See [[18206]].' }
]},
{ id: 'm7', title: 'Deal math', lessons: [
{ id: 'az-math', title: 'Interest math, line by line', body: `
Arizona interest on your lien is **simple interest by the month at your bid rate**, starting the first day of the month after purchase [[18114]]. The owner pays the amount for which the lien was sold with interest, plus later taxes with interest, plus statutory fees you paid (except the processing fee) [[18153]].

## Example A (simulated): redeemed after 14 months
= Lien amount: $3,000.00 · bid 8%
= Interest: 3,000 × 8% × 14/12 = $280.00
= Statutory fees you paid and get back with interest: certificate $10 [[18118]]
= You receive about $3,290.00 plus a little interest on the $10
= Total return on $3,010 cash in (incl. fee): 280 / 3,010 = 9.3% · annualized about 8%

## Example B (simulated): 0% bid
= Same lien at 0% → interest $0.00 · you get your $3,000 back plus the $10 certificate fee
= Fees not returned: the processing fee [[18153]] and the platform fee

## Example C: a long wait
= Same lien at 8% redeemed in month 60: 3,000 × 8% × 60/12 = $1,200.00
= Total return 40% · annualized 8%

>> Arizona interest is simple and does not compound. Time is your friend only at a decent rate.

?? Redo Example A at 5% and 12 months. Then check it in the {{t:calc|calculator}}.

Foundations refresher: {{f:math|Return math}}.` },
{ id: 'az-costs', title: 'When fees and costs erase the profit', body: `
${SIM}

## Scenario: many small liens
= 10 liens × $60 = $600 · each bid at 2% · each redeemed after 6 months
= Interest: 60 × 2% × 6/12 = $0.60 each → $6.00 total
= County and certificate fees: each $10 certificate fee [[18118]] plus a $1 to $5 processing fee [[pima]] → about $13 each → $130
= Net: a loss of about $124

## Scenario: the foreclosure path
= $29,000 lien at 0% on land worth $27,000
= Wait 3 years, then notices and a superior court action [[18201]] [[18202]]
= Attorney fees, title report, notices: example $4,000
= Treasurer's deed fee $50 [[18205]]
= If the court orders an excess proceeds sale, the price you can recover is limited to your amounts at 16% simple, fees and costs [[18204]]
= Result: you could sink $33,000+ into land worth $27,000

!! Small liens lose to fixed fees. Large liens on weak land lose to the deed path.

?? Compute the break-even bid rate for a $500 lien held 12 months when fixed fees are $25.` },
{ id: 'az-maxbid', title: 'Deciding the lowest rate you will accept', body: `
In a bid-down auction your decision is the **floor rate**. Set it from how long you expect to wait and what the deed path could cost.

## A working method
1. **Pick your hold time** for planning: 12 months, 36 months and 60 months.
2. **Add every fixed cost**: certificate $10 [[18118]], processing and platform fees [[pima]].
3. **Choose a minimum dollar profit** that justifies the research time.
4. **Solve for the rate**: rate = (needed profit + fixed costs) ÷ (amount × years held).
5. **Check the bad ending**: if nobody redeems, can you foreclose and recover your money from this land? If not, add risk to your floor or pass.

## Worked example (simulated)
= Lien $5,000 · hold 24 months · fixed costs $25 · needed profit $200
= Rate = (200 + 25) ÷ (5,000 × 2) = 2.25% → you would bid 3% or higher

?? Compute your floor for a $2,000 lien held 12 months with $25 fixed costs and $80 needed profit.` }
], quiz: [
  { q: 'Arizona lien interest is:', a: ['Simple, by the month, at the bid rate', 'Compounded daily', 'A flat 16% regardless of bid'], c: 0, why: 'See [[18114]].' },
  { q: '10 liens of $60 at 2% redeemed in 6 months: fees vs interest?', a: ['Interest wins', 'Fixed fees wipe out the interest', 'They are equal'], c: 1, why: 'Interest is $6 total versus about $130 in fees.' },
  { q: 'Which fee is NOT returned to you at redemption?', a: ['Certificate fee', 'Processing fee', 'Later taxes'], c: 1, why: 'See [[18153]].' }
]},
{ id: 'm8', title: 'Redemption', lessons: [
{ id: 'az-who', title: 'Who can redeem, and when', body: `
A tax lien may be redeemed by [[18151]]:
- the **owner**;
- any person who wants to pay for the owner as a **charitable gift**;
- the owner's agent, assignee or attorney;
- anyone with a **legal or equitable claim** in the property, including a holder of another certificate.

A part-owner may redeem a proportionate share [[18151]].

## When
At any time within 3 years of the sale, and after 3 years until the **treasurer's deed is delivered** [[18152]]. Even after a foreclosure is filed, the owner can redeem before judgment [[18206]].

## Paying you
On demand, the treasurer pays the redemption money to the person entitled, on surrender of the certificate or redemption of the registered certificate [[18155]]. A partial redemption is endorsed on the certificate [[18155]].

?? Write the four categories of people who can redeem, in your own words.` },
{ id: 'az-amount', title: 'The redemption amount', body: `
To redeem, a person pays the county treasurer [[18153]]:
1. The amount for which the lien was sold, with interest at the certificate rate.
2. Subsequent taxes paid by the purchaser and endorsed on the certificate, with interest at the same rate.
3. Statutory fees the purchaser paid, **except the processing fee**, with interest at the certificate rate.

The treasurer issues a **certificate of redemption** for $10 (or $5 for partial payments in the large-county process) and the redeeming person may record it [[18154]].

## Example (simulated)
= Lien $4,000 · rate 6% · redeemed after 20 months
= Interest: 4,000 × 6% × 20/12 = $400.00
= Subsequent taxes paid $900 at month 8 → interest 900 × 6% × 12/12 = $54.00
= Fees: certificate $10 + interest on it $0.10
= Total paid by the redeemer: 4,000 + 400 + 900 + 54 + 10.10 = **$5,364.10**

?? Redo the example with a 9% rate and check the interest in the {{t:calc|calculator}}.` },
{ id: 'az-verify', title: 'Verifying a redemption and your payout', body: `
1. **The certificate of redemption**: it states the parcel, date, amount and who redeemed [[18154]].
2. **Your payment**: matches the formula in [[18153]].
3. **The record of tax lien sales**: shows the redemption date and amount [[18117]].
4. **If you hold a physical certificate**, surrender it to be paid [[18155]].

!! A lien that disappears from a list is not proof of redemption. Ask the treasurer for the record.

?? Record a simulated redemption in {{t:portfolio|My portfolio}} with the source and date you checked.` }
], quiz: [
  { q: 'Who may redeem an Arizona tax lien?', a: ['Only the owner', 'The owner, a charitable payer, an agent or anyone with a claim', 'Only the county'], c: 1, why: 'See [[18151]].' },
  { q: 'Can the owner redeem after a foreclosure case is filed?', a: ['No', 'Yes, any time before judgment', 'Only after the deed'], c: 1, why: 'See [[18206]].' },
  { q: 'Is the processing fee returned to you at redemption?', a: ['Yes', 'No', 'Only if you ask'], c: 1, why: 'See [[18153]].' }
]},
{ id: 'm9', title: 'After you win: foreclosure and deeds', lessons: [
{ id: 'az-foreclose', title: 'Foreclosing the right to redeem', body: `
## When
Starting **3 years after the sale**, and no later than **10 years** after the end of the month you bought [[18201]]. The action is filed in **superior court** in the county where the property sits, and names the county treasurer [[18201]].

## The notice first
At least **30 days** before filing, and not more than 180 days before, you send notice of intent by **certified mail** to the owner of record, or to the owner at the assessor's address, the situs address and the tax-bill address [[18202]]. The notice must include the owner's name, parcel number, description, certificate number, proposed filing date and a statement about the owner's right to ask for an **excess proceeds sale** [[18202]]. A court may not enter judgment until you send it [[18202]].

## Then
The treasurer may no longer accept partial payments after receiving the notice [[18202]]. File a lis pendens as your attorney advises [[18206]].

?? Make a dated checklist working backward from a planned filing date: notice at least 30 days before, no more than 180 days before.` },
{ id: 'az-excess', title: 'Excess proceeds sales: the owner’s protection', body: `
Either side can ask the court to decide if selling the property to recover **excess proceeds** is reasonable [[18204]]. The court finds it reasonable if the sale price is likely to be **more than $2,500 above** the total of: your costs including attorney fees, your lien amount with 16% interest through the sale, fees, other recorded state liens and the cost of sale [[18204]].

## What each side provides
- **You**: costs, lien amount with interest at 16%, fees, other recorded state liens and the estimated cost of sale [[18204]].
- **The owner**: a reasonable estimate of market value [[18204]].

## Result
- If reasonable, the court orders a **public sale**. The opening bid is set from your amounts. The owner keeps an interest in the excess proceeds [[18204]].
- If not, the court forecloses and orders a treasurer's deed to you [[18204]].

>> If the land is worth much more than your lien, expect the owner to ask for an excess proceeds sale. You may recover your money and interest, not the windfall.

?? Using round numbers (your costs $6,000, lien $10,000, fees $100, liens $0, sale costs $2,000), find the price above which the court would find a sale reasonable.` },
{ id: 'az-deed', title: 'The treasurer’s deed and what comes after', body: `
If the court forecloses without an excess proceeds sale, it directs the treasurer to deliver a deed [[18204]]. The treasurer executes it on receiving a certified copy of the judgment and a **$50 per parcel** fee [[18205]]. The deed recites the court case, the purchaser and the description [[18205]].

## After you hold the deed
1. Record it with the county recorder.
2. Order a title report: easements and the assessment liens in [[18115]] survive.
3. Pay current taxes and insure the property.
4. Plan the sale or use. A quiet-title action may be needed for title insurance. [[?Ask an Arizona title agent about insurability.]]

## Outcomes by path
- **Redeemed**: paid with interest [[18153]].
- **Foreclosed with deed**: you own the land [[18204]] [[18205]].
- **Excess proceeds sale**: you are repaid your amounts with interest at 16% and costs, from the sale [[18204]].
- **Expired**: if you wait over 10 years, you lose the lien [[18127]].

?? For each outcome, write what you would record in {{t:portfolio|My portfolio}}.` }
], quiz: [
  { q: 'How far before filing must the foreclosure notice be mailed?', a: ['At least 30 days, but no more than 180', '1 day', '1 year'], c: 0, why: 'See [[18202]].' },
  { q: 'The court finds an excess proceeds sale reasonable if the price is likely more than:', a: ['$500 above the total', '$2,500 above the total', 'Double the lien'], c: 1, why: 'See [[18204]].' },
  { q: 'What does the treasurer’s deed cost?', a: ['$50 per parcel', '$500', 'Free'], c: 0, why: 'See [[18205]].' }
]},
{ id: 'm10', title: 'Local differences inside Arizona', lessons: [
{ id: 'az-local', title: 'Comparing Pima and Maricopa procedures', body: `
The statute sets the frame. Each county runs its own sale. From each county's own page (checked ${CK}):

## Pima County
- Online sale hosted by RealAuction. Registration Feb 2 to Feb 19, 2026, and a **one-day auction on Feb 26, 2026**, closing in batches from 8 a.m. to noon, plus an auxiliary session in the afternoon [[pima]].
- Bidding starts at **16%** in **1% increments**. **0% allowed**. All sales final [[pima]].
- Fees: $10 certificate fee, county processing fee of $1 to $10, a RealAuction fee per delinquent tax year, plus any unpaid NSF fees [[pima]].
- Over-the-counter liens are purchased through the same account, and transfers need a notarized form and a $10 fee per certificate [[pima]].

## Maricopa County
- The sale is hosted on RealAuction, with a separate section on state assignments and a published tax sale history [[maricopa]].
- [[?Maricopa's bid increments, fees and dates were not published on the page we read. Read the current sale rules before bidding.]]

## What to compare each year
Registration window, sale length, batch closings, fees, the minimum rate step and how assignments are sold.

?? Pick two counties and fill in a comparison table of the six items above. Use "not posted" where the county does not say.` },
{ id: 'az-offices', title: 'Which office to call for what', body: `
- **"Is this lien still available?"** → county treasurer [[18117]].
- **"What do I owe to redeem, or what did I earn?"** → county treasurer [[18153]] [[18154]].
- **"Can I buy a state-assigned lien?"** → county treasurer [[18122]].
- **"Foreclosure."** → your attorney, then superior court [[18201]].
- **"Recorded documents."** → county recorder.
- **"Value, description, exemptions."** → county assessor.
- **"Flood."** → FEMA map [[fema]], then the county floodplain office.

Our {{u:/liens/states/state/?s=AZ|Arizona page}} links each county's treasurer and the parcel search.

?? Make a one-page contact sheet for one Arizona county.` }
], quiz: [
  { q: 'Pima County’s 2026 sale started bidding at:', a: ['16%', '5%', '10%'], c: 0, why: 'See [[pima]].' },
  { q: 'Which office keeps the record of lien sales?', a: ['County treasurer', 'Assessor', 'Recorder'], c: 0, why: 'See [[18117]].' },
  { q: 'Which detail must you confirm locally?', a: ['The 16% interest cap', 'Registration deadlines and fees', 'The 3-year wait'], c: 1, why: 'Those details are set by each county each year.' }
]},
{ id: 'm11', title: 'Case studies', lessons: [
{ id: 'az-case-win', title: 'Case 1 (simulated): a lien that paid', body: `
${SIM}

A suburban lot with a house, county value $240,000, owes $1,900 in delinquent taxes. Bidding runs down to 5% and the simulated investor wins.

## Research
- Parcel matched on the map; house present; paved road; not in a high-risk flood zone; no mapped wetlands.
- Lien far below the value, so competition is heavy and the rate fell.

## Math
= Lien $1,900 + $10 certificate fee [[18118]] + $5 processing fee [[pima]]
= Owner redeems after 9 months
= Interest: 1,900 × 5% × 9/12 = $71.25 [[18114]]
= Received: 1,900 + 71.25 + 10 = $1,981.25 [[18153]]
= Net after the unreturned $5 processing fee: $66.25 on $1,915 cash in → annualized about 4.6%

## Why it worked
A valuable, occupied property nearly always redeems. The return is modest and predictable.` },
{ id: 'az-case-pass', title: 'Case 2 (real parcel): a lien above the land’s value', body: `
This case uses a real listing from our Pinal data. No purchase happened.

## The listing
Pinal parcel 5051601705. Amount on the Treasurer's list: **$29,334.74**. County value: **$27,612**. Vacant land, 1.18 acres. Description: portions of lots 8 and 9, Casa Grande Farms Unit 2, lying west of Colorado St [[pinal]].

## The checks
- Road: a mapped road is nearby. Flood: not in a mapped high-risk zone. Wetlands: none mapped [[fema]] [[nwi]].
- The lien costs **106% of the county's value**.
- The description is a **portion** of two lots. Shape and access need confirming.

## Decision: Pass
If the owner redeems, interest at a low bid rate on a lien this size is small compared with the risk. If nobody redeems, the foreclosure path ends with land worth less than your total cost, and an excess proceeds sale would not help. A county value can be stale, so a buyer could do an independent valuation first. Without one, the numbers do not work.

?? Open the parcel on {{u:/liens/states/county/?c=Pinal|our Pinal page}} and write one more fact you would need to change this decision.` },
{ id: 'az-case-unknown', title: 'Case 3 (simulated): when missing information blocks a decision', body: `
${SIM}

A listing shows a $6,200 lien on a 5-acre parcel with a county value of $18,000. The description says "ANY POR OF LAND LYING W OF I-10". The map outline is a long, thin strip along a freeway.

## What is missing
1. Does the parcel touch a public road, or only the freeway right-of-way?
2. Is the county value a placeholder? Some Pinal parcels show $500 [[pinal]].
3. Is the strip possibly part of the freeway's right-of-way, taxed in error? An erroneous sale is refunded only to principal plus interest [[18125]].

## Decision: need more information
Without access and a real value, neither Bid nor Pass is justified. Ask the treasurer whether the parcel has any known tax errors, and ask the county recorder for easements.

?? Write the three questions you would ask the treasurer, in order.` }
], quiz: [
  { q: 'In Case 2 the lien is what share of the county value?', a: ['About 106%', 'About 50%', 'About 10%'], c: 0, why: '29,334.74 ÷ 27,612 ≈ 1.06.' },
  { q: 'Which cases are simulated?', a: ['1 and 3', 'All', 'None'], c: 0, why: 'Case 2 uses a real listing; no outcome is claimed.' },
  { q: 'Why did we pass on Case 2?', a: ['Interest is too small relative to the deed-path risk', 'It is in a flood zone', 'It has no road'], c: 0, why: 'The lien exceeds the land value.' }
]},
{ id: 'm12', title: 'Final project', lessons: [
{ id: 'az-project', title: 'Final project: research an Arizona lien and decide', body: `
## Your assignment
Choose a real Arizona listing on our site (Pinal or Coconino) and write a one-page memo:
1. **The listing**: county, parcel number exactly as written, amount, description, source and date checked [[pinal]].
2. **Verification**: parcel on the county map, acres, shape, nearest road.
3. **Land risks**: flood, wetlands, road, each with source and date, "not checked" where unknown.
4. **Title risks**: easements and assessment liens that survive [[18115]], homestead, bankruptcy, other certificates.
5. **Math**: interest at 12 and 36 months at your floor rate, fixed fees, and the foreclosure-path cost.
6. **Decision**: Bid (with a floor rate), Pass or need more information.

## Worked answer: Pinal parcel 5051601705
1. Pinal, 5051601705, $29,334.74, portions of lots 8 and 9 Casa Grande Farms Unit 2, list dated 11/3/2026 [[pinal]].
2. 1.18 acres on the county map; a mapped road nearby.
3. Flood: no mapped high-risk overlap. Wetlands: none mapped. Road: found nearby; legal access unverified [[fema]] [[nwi]].
4. Easements and district assessments survive [[18115]]. Other certificates and bankruptcy: not checked.
5. At 4% for 12 months: 29,334.74 × 4% = $1,173.39. Fees about $20. At 0%: nothing. Deed path: lien already exceeds value.
6. **Pass.** The price is 106% of the county value and the interest cannot pay for the risk.

## Grading rubric (100 points)
- Listing copied exactly, with source and date: **15**
- Parcel verified on the map with notes: **15**
- Land risks with sources, unknowns marked: **20**
- Title risks, including surviving items: **15**
- Math shown line by line, including the foreclosure path: **20**
- Decision that follows from the evidence: **15**

80 or more passes. An invented fact caps the score at 60.` }
], quiz: [
  { q: 'What caps the project score at 60?', a: ['A typo', 'An invented fact presented as real', 'Choosing Pass'], c: 1, why: 'Every number must have a source.' },
  { q: 'Which three answers can the memo end with?', a: ['Bid, Pass, or need more information', 'Only Bid', 'Only Pass'], c: 0, why: 'Honesty about gaps is part of the grade.' },
  { q: 'Where do you get the amount and description?', a: ['The county list, with its source and date', 'A forum post', 'A guess'], c: 0, why: 'Cite the official list.' }
]}
];

const exercise = {
  title: 'Bid or Pass: Pinal County parcel 5051601705',
  simulated: false,
  label: 'Real listing and real public records from the Pinal County Treasurer’s list (dated 11/3/2026). **The decision is a simulation.** No purchase is made and no outcome is reported.',
  lien: { county: 'Pinal', state: 'AZ', parcel: '5051601705', amount: 29334.74, rate: '' },
  calc: { amount: 29334.74, rate: 4, months: 24, fees: 25, from: 'Pinal parcel 5051601705 (lien amount $29,334.74)' },
  facts: [
    ['Amount on the list', '$29,334.74 (the price of the lien, before fees) [[pinal]]'],
    ['List', 'Pinal County Treasurer tax lien sale list, dated 11/3/2026 [[pinal]]'],
    ['Land', '1.18 acres, vacant land, portions of lots 8 and 9, Casa Grande Farms Unit 2 [[pinal]]'],
    ['County value', '$27,612 [[pinal]]'],
    ['Flood / wetlands', 'No mapped high-risk flood, no mapped wetlands (map checks, 2026-11-10) [[fema]] [[nwi]]'],
    ['Road', 'A mapped road is nearby. Legal access is unverified.']
  ],
  brief: `
Decide whether you would bid on the lien for this parcel. Enter the **most total cash you would put in**, counting the lien price, fees and what a foreclosure would cost if nobody redeems [[18201]]. Then choose Bid or Pass and explain.

Use the map to check the shape and access, and the calculator to price interest at different rates. The lien amount is higher than the county value, which changes how the foreclosure path looks [[18204]].`,
  walkthrough: `
## 1. Price the lien
= Lien amount $29,334.74 + certificate fee $10 [[18118]] + county and platform fees (example) $25 = about $29,370 cash in

## 2. Interest scenarios (simple, by the month) [[18114]]
= Bid 4% for 12 months: 29,334.74 × 4% = $1,173.39
= Bid 4% for 36 months: $3,520.17
= Bid 0%: $0.00

## 3. The bad ending
If nobody redeems, you may sue after 3 years [[18201]]. Add attorney fees, notice, title report and a $50 deed fee [[18205]]: example $5,000. Your total cost could reach about $34,400 plus interest forgone. The land's county value is $27,612. If the owner asks for an excess proceeds sale, the court looks at your amounts plus 16% interest [[18204]]. It would not be reasonable if the sale price is not likely more than $2,500 above your total [[18204]].

## 4. A reasonable answer
**Pass**, unless an independent valuation shows the land is worth well above $35,000. Strong answers mention that the lien exceeds the county value, that interest at a typical competitive rate is small relative to the principal at risk, and that easements and district assessments survive [[18115]].`
};

export default {
  id: 'az', state: 'AZ', title: 'Arizona Tax Sales: The Complete Course', status: 'published', checked: CK,
  review: 'Batch 1. Rules cited to the Arizona Revised Statutes (azleg.gov), read in full for Title 42 Chapter 18 sections cited, checked ' + CK + '. County procedures from the Pima and Maricopa treasurer pages. Items marked "Needs review" were not verified. No outside legal review yet.',
  intro: 'How Arizona sells tax liens at a bid-down auction, how interest and redemption work, how to research a parcel with our maps, the math, the risks, and how a lien holder forecloses. Every rule cited to the statute.',
  sources, modules, exercise,
  glossary: [
    ['Certificate of purchase', 'The record that you bought a tax lien. It can be a registered certificate in the treasurer’s records.'],
    ['Bid-down', 'Bidders compete on the lowest interest rate, from a 16% cap.'],
    ['Subsequent taxes', 'Later years’ taxes a holder pays on the property. They earn interest at the certificate rate.'],
    ['Assigned to the state', 'An unsold lien. Anyone can buy it later at the amount due.'],
    ['Redemption', 'Paying the lien, with interest and fees, to the treasurer.'],
    ['Foreclosure of the right to redeem', 'A superior court action, allowed from 3 years after the sale.'],
    ['Lis pendens', 'A recorded notice that a lawsuit about the property is pending.'],
    ['Excess proceeds sale', 'A court-ordered sale when the land is likely worth more than $2,500 over the lien holder’s amounts.'],
    ['Treasurer’s deed', 'The deed issued after a foreclosure judgment, for a $50 fee.'],
    ['Easement', 'A right for someone else to use part of the property. It survives a tax sale.'],
    ['Assessment lien', 'A lien from a district for improvements. Certain ones survive.'],
    ['RealAuction', 'The online platform most large Arizona counties use for the sale.'],
    ['Simple interest', 'Interest on the original amount only, with no compounding.']
  ],
  links: [
    ['Arizona Revised Statutes Title 42 Chapter 18', 'https://www.azleg.gov/arsDetail/?title=42', 'statute'],
    ['Pima County Treasurer: Tax Lien Sale', 'https://www.to.pima.gov/taxLienSale/', 'county'],
    ['Maricopa County Treasurer: Tax Lien Information', 'https://treasurer.maricopa.gov/TaxLienInformation/', 'county'],
    ['Pinal County Treasurer: Tax Lien Sale List', 'https://treasurer.pinal.gov/ParcelInquiry/Main/TaxLienSale', 'county'],
    ['Our Arizona page', '/liens/states/state/?s=AZ', 'site'],
    ['FEMA Flood Map Service Center', 'https://msc.fema.gov/portal/search', 'federal']
  ],
  checklists: {
    research: ['Parcel number copied exactly', 'Matched on the county map; shape and acres checked', 'Lien amount versus county value', 'Flood zone with source and date', 'Wetlands with source and date', 'Road frontage; legal access flagged unverified', 'Easements and district assessment liens', 'Other certificates and subsequent taxes', 'Homestead and bankruptcy', 'Confirm status with the treasurer'],
    bid: ['Registered for this year’s sale', 'Payment method ready (within 15 days of close)', 'Fixed fees counted (certificate, processing, platform)', 'Interest worked out at 12, 36 and 60 months', 'Floor rate written before the sale', 'Foreclosure-path cost estimated', 'Plan if nobody redeems', 'Everything logged in My portfolio']
  }
};
