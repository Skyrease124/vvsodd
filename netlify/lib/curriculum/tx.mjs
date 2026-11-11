// Texas: judicial tax foreclosure sales of the property itself (sheriff or constable), with a right of redemption. Pilot course.
const CK = '2026-11-11', ED = 'Texas Tax Code as published by the Texas Legislature';
const S = (short, name, url, checked = CK, effective = ED) => ({ short, name, url, checked, effective });
const tc = (sec, ch) => S('Tax Code §' + sec, 'Texas Tax Code § ' + sec, 'https://tcss.legis.texas.gov/resources/TX/htm/TX.' + ch + '.htm');
const sources = {
  '31.02': tc('31.02', 31), '33.01': tc('33.01', 33), '33.41': tc('33.41', 33), '33.48': tc('33.48', 33), '33.51': tc('33.51', 33), '33.54': tc('33.54', 33),
  '34.01': tc('34.01', 34), '34.011': tc('34.011', 34), '34.015': tc('34.015', 34), '34.02': tc('34.02', 34), '34.03': tc('34.03', 34), '34.04': tc('34.04', 34),
  '34.05': tc('34.05', 34), '34.06': tc('34.06', 34), '34.21': tc('34.21', 34), '34.22': tc('34.22', 34),
  r646a: S('TRCP 646a', 'Texas Rules of Civil Procedure, Rule 646a (sale of real property)', 'https://www.txcourts.gov/media/1463426/texas-rules-of-civil-procedure.pdf', CK, 'current rules PDF, Supreme Court of Texas'),
  r647: S('TRCP 647', 'Texas Rules of Civil Procedure, Rule 647 (notice of sale of real estate)', 'https://www.txcourts.gov/media/1463426/texas-rules-of-civil-procedure.pdf', CK, 'current rules PDF, Supreme Court of Texas'),
  r652: S('TRCP 652–653', 'Texas Rules of Civil Procedure, Rules 652–653 (purchaser failing to comply; resale)', 'https://www.txcourts.gov/media/1463426/texas-rules-of-civil-procedure.pdf', CK, 'current rules PDF, Supreme Court of Texas'),
  '7425': S('26 USC 7425', '26 U.S.C. § 7425 (redemption by the United States)', 'https://www.law.cornell.edu/uscode/text/26/7425', CK, 'current U.S. Code'),
  harris: S('Harris TO', 'Harris County Tax Office: tax sales', 'https://www.hctax.net/Property/TaxSales', '2026-11-02', ''),
  denton: S('Denton SO', 'Denton County: Sheriff’s Sale', 'https://www.dentoncounty.gov/840/Sheriffs-Sale', '2026-11-02', ''),
  kaufman: S('Kaufman', 'Kaufman County: Tax Sales/Auctions', 'https://www.kaufmancounty.net/532/Tax-SalesAuctions', '2026-11-02', ''),
  fema: S('FEMA', 'FEMA National Flood Hazard Layer', 'https://msc.fema.gov/portal/search', CK, ''),
  nwi: S('NWI', 'U.S. Fish and Wildlife Service National Wetlands Inventory', 'https://www.fws.gov/program/national-wetlands-inventory/wetlands-mapper', CK, '')
};
const SIM = '!! SIMULATED. Every number below is made up to teach the method. No real property, purchase or payout is described.';

const modules = [
// 1
{ id: 'm1', title: 'How Texas tax sales work', free: true, lessons: [
{ id: 'tx-what', title: 'Texas sells the property, not a lien', body: `
Texas does not sell tax liens. After a court judgment, a **sheriff or constable sells the property itself** at public auction [[34.01]]. The buyer gets a deed, not a certificate. There is **no interest rate**. If the former owner redeems, the buyer instead receives a **redemption premium** of 25% or 50%, set by law [[34.21]].

## Who does what
- **Taxing units** (county, school district, city and others), usually through their attorneys, sue to foreclose the tax lien [[33.41]].
- **The district court** enters the judgment and orders the sale.
- **The sheriff or a constable** sells the property, calculates the amount due and executes the deed [[34.01]].
- **The county assessor-collector** may register bidders and issues the "no delinquent taxes" statement every buyer needs [[34.011]] [[34.015]].
- **The district clerk** holds excess proceeds and handles claims [[34.03]] [[34.04]].

## What the buyer receives
The deed gives the buyer the defendant's interest, including the right to use and possess the property. It is subject to the owner's right of redemption, certain earlier recorded covenants and easements, and certain covenant liens [[34.01]]. The deed "may be impeached only for fraud" [[34.01]].

?? Open {{u:/liens/states/state/?s=TX|our Texas page}} and find two counties' sale pages. Note whether each sale is in person or online.

Foundations refresher: {{f:deeds|Buying at tax deed auctions}}.` },
{ id: 'tx-path', title: 'From unpaid bill to auction: the Texas timeline', body: `
- **Due on receipt; delinquent if unpaid before February 1** of the next year [[31.02]].
- **Penalty and interest**: a 6% penalty for the first month, plus 1% a month until July. A tax still unpaid on July 1 has a 12% total penalty. Interest of 1% a month keeps running until it is paid [[33.01]].
- **Lawsuit**: any time after delinquency, a taxing unit may sue to foreclose the lien [[33.41]]. Court costs and the cost of finding parties and legal descriptions can be added [[33.48]].
- **Judgment and order of sale**: the court orders the property sold. The officer receives the order. Endorsing it with the date and time counts as the levy [[34.01]].
- **Notice**: the sale is published once a week for 3 consecutive weeks, with the first notice at least 20 days before the sale [[r647]]. Defendants get written notice too [[34.01]].
- **Sale day**: the first Tuesday of the month, between 10 a.m. and 4 p.m., at the courthouse door unless the court orders otherwise [[r646a]]. Commissioners courts may authorize online auctions [[34.01]].
- **Deed filed**: the redemption clock starts when the buyer's deed is filed for record [[34.21]].

= Example: 2024 taxes unpaid → delinquent February 1, 2025
= Suit filed later in 2025 → judgment → order of sale
= Sale on a first Tuesday after 3 weeks of notice
= Deed filed → redemption: 180 days, or 2 years for homesteads, farmland and mineral interests

?? Using the Texas calendar, list the next three first Tuesdays. Then check one county's page for which of those dates it has a sale.` },
{ id: 'tx-compare', title: 'Texas versus Florida: why the playbook changes', body: `
Florida sells a **lien** at a rate auction. Texas sells the **property** at a price auction [[34.01]].

- **What you earn**: in Florida, interest at your bid rate with a 5% minimum. In Texas, a flat **25% or 50% premium** if the owner redeems, or the property if they do not [[34.21]].
- **Redemption window**: Florida certificates can be redeemed until a deed buyer pays in full, years later. Texas allows **180 days**, or **2 years** for homesteads, farmland and mineral interests, counted from the deed filing [[34.21]].
- **Cash at risk**: in Texas you pay the full bid on sale day, often thousands of dollars, and you may own a house with people living in it.
- **Who runs the sale**: in Florida, the tax collector and the clerk. In Texas, the sheriff or constable under a court order [[34.01]].

>> In Texas you are buying real estate that might be bought back from you. Study it like a house purchase, not a bond.

?? Write three sentences explaining to a friend why an 18% Florida certificate and a 25% Texas premium are not comparable numbers. Then check {{f:math|Foundations: Return math}}.` }
], quiz: [
  { q: 'What does a buyer at a Texas tax sale receive?', a: ['A lien certificate earning interest', 'A deed to the property, subject to redemption', 'A share of the taxes'], c: 1, why: 'See [[34.01]] and [[34.21]].' },
  { q: 'When are Texas property taxes delinquent?', a: ['April 1', 'If unpaid before February 1 of the next year', 'On the bill date'], c: 1, why: 'See [[31.02]].' },
  { q: 'When are in-person Texas execution sales held?', a: ['Any weekday', 'The first Tuesday of the month, 10 a.m. to 4 p.m.', 'June 1'], c: 1, why: 'See [[r646a]].' }
]},
// 2
{ id: 'm2', title: 'Finding notices, lists, results and rules', lessons: [
{ id: 'tx-notices', title: 'Where Texas sale notices and lists appear', body: `
## Required notices
- **Newspaper**: once a week for 3 consecutive weeks, with the first at least 20 days before the sale [[r647]]. If no newspaper will publish it at the legal rate, notices are posted in three public places, including the courthouse door, at least 20 days before the sale [[34.01]].
- **Defendants**: written notice under Rule 21a. A failure to send or receive it does not by itself void the sale [[34.01]].
- **Contents**: the authority for the sale, the date, time and place, and a brief property description. Field notes are not required [[34.01]] [[r647]].

## Where investors actually look
1. **The county tax office or sheriff and constable pages.** Harris County lists its monthly sales [[harris]]. Denton County posts its sheriff's sales and online auction link [[denton]].
2. **The taxing units' delinquent-tax attorneys.** Many publish the sale lists. [[?Which law firm publishes each county's list varies. Follow the county's own link.]]
3. **Results.** [[?Few counties publish results in one place. Ask the officer or check the recorded deeds after the sale.]]

## Canceled sales are normal
Owners pay, and properties come off the list up to sale day. Always re-check the morning of the sale.

?? From {{u:/liens/states/state/?s=TX|our Texas page}}, open Harris and Denton. Write down for each: where the list is posted, how bidding happens (in person or online), and the next sale date.` },
{ id: 'tx-columns', title: 'Reading a Texas sale list', body: `
Texas lists come from court cases, so they read like a docket. Column names vary by county. [[?Check each list's own legend.]] These facts are on almost every list because the law requires or uses them:

- **Cause (case) number and style**, for example "County v. Owner". You will use this to find the judgment.
- **Property description**: acres and original survey, a subdivision name and lot, or a reference to the description in the judgment [[34.01]].
- **Account number**: the appraisal district's property ID.
- **Adjudged value**: the value the court found. The minimum bid uses the **lesser** of the amount due under the judgment or this value [[34.01]].
- **Judgment amount or minimum bid**: taxes, penalties, interest, court costs and sale costs. Sale costs include advertising, any auctioneer's commission and deed recording fees [[34.01]].
- **Precinct or officer**: which constable or the sheriff is selling.

## Worked reading (made-up row)
= Cause 2025-12345 · State of Texas et al. v. Doe
= Lot 7, Block 3, Example Addition · Acct 0123450000007
= Adjudged value $48,000 · Judgment and costs $9,850 · Constable Pct 4
= Minimum opening = lesser of $9,850 or $48,000 = $9,850 [[34.01]]

?? Find one real Texas sale list from a county on our Texas page and label its columns using the list above.` },
{ id: 'tx-ids', title: 'Texas property IDs and legal descriptions', body: `
Each county's **appraisal district** assigns account numbers. Formats differ across the 254 counties. Rural land is often described by **acres and original survey** (an abstract number) rather than a lot and block [[34.01]].

## Rules
1. Match the appraisal account number **and** the legal description in the judgment. If they disagree, the judgment controls what is being sold.
2. Look the account up on the appraisal district's map. Do the acres and shape match the judgment?
3. "Undivided interest" or "mineral interest" means you are not buying a whole surface lot. Mineral interests even get the longer 2-year redemption [[34.21]].
4. An owner may ask the officer to split the property and sell only part of it, up to four portions [[34.01]]. Watch for sale notices that describe a portion.

?? Pick a Texas county from our Texas page, open its appraisal district map and find any rural tract described by an abstract number. Write down the acres and the survey name.

Foundations refresher: {{f:parcels|Parcel IDs}}.` }
], quiz: [
  { q: 'How many weeks of newspaper notice are required before a Texas execution sale?', a: ['1', '3 consecutive weeks', '6'], c: 1, why: 'See [[r647]].' },
  { q: 'The minimum bid is based on which amount?', a: ['The higher of the judgment or the adjudged value', 'The lesser of the amount due or the adjudged value', 'The appraisal district value'], c: 1, why: 'See [[34.01]].' },
  { q: 'Which redemption period applies to a mineral interest sold to an investor?', a: ['180 days', '2 years', 'None'], c: 1, why: 'See [[34.21]].' }
]},
// 3
{ id: 'm3', title: 'Registering, bidding and paying', lessons: [
{ id: 'tx-register', title: 'Registration and the no-delinquent-taxes statement', body: `
## Bidder registration (where the county adopts it)
A commissioners court may require bidders to register with the county assessor-collector before the sale. The assessor-collector can require your name and address, valid ID, written proof of authority if you bid for someone else, and other reasonable information [[34.011]].

## The statement every buyer needs
The officer **may not deliver a deed** unless the buyer shows an **unexpired written statement** from the county assessor-collector. It must show no delinquent taxes owed to the county, and none known or reported to any school district or city with territory in the county [[34.015]]. You request it in writing, and the request must identify property you own in those taxing units [[34.015]].

## Practical steps
1. Request the statement days before the sale. [[?How long a statement stays valid and how fast it is issued are set locally. Ask the assessor-collector.]]
2. Register if the county requires it.
3. Bring ID and the payment form the officer accepts. [[?Accepted forms of payment are set by each officer. Read the posted terms.]]

?? Find one Texas county's bidder registration page. Does it require the statement before you bid, or before the deed is delivered?` },
{ id: 'tx-bidding', title: 'How bidding works and what the minimum is', body: `
## The auction
The officer sells to the highest bidder, in person or online where the commissioners court has authorized online auctions under its own rules [[34.01]].

## The minimum
The officer works out the total due under the judgment: taxes, penalties, interest, other amounts the judgment awards, court costs and sale costs [[34.01]]. If no bid covers **the lesser of that total or the adjudged value**, the taxing unit may end the sale. Otherwise the property is **bid off to the taxing unit** [[34.01]].

## Struck-off property is not lost
Property bid off to a taxing unit can be resold later, publicly or privately, sometimes for less than the judgment [[34.05]]. Module 4 covers this.

## Ties and increments
[[?Bid increments and how ties are resolved are set by each officer's terms of sale. Read them before you bid.]]

## Worked example (made-up)
= Judgment total and costs: $9,850 · adjudged value: $48,000
= Opening must cover $9,850 [[34.01]]
= Bidding runs: $10,000 → $15,000 → $21,500 → winning bid $22,000
= Excess over the judgment amounts (about $12,150, before other costs) becomes excess proceeds held for claimants [[34.02]] [[34.03]]

?? Using the example, what happens if the highest bid is $9,000 and the taxing unit does not end the sale?` },
{ id: 'tx-pay', title: 'Paying, and what happens if a winner does not', body: `
## Paying
Texas sales follow execution-sale rules unless the Tax Code says otherwise [[34.01]]. [[?Payment timing and form (for example, cash or certified funds, same day) come from each officer's posted terms.]] You get the deed only after you show the no-delinquent-taxes statement [[34.015]].

## A winner who does not pay
A bidder who fails to comply with the terms of sale **is liable to pay 20% of the value of the property** plus costs. If the property brings less at the next sale, they also owe the defendant the loss [[r652]]. The officer resells the same day if there is time, or readvertises and sells it as before [[r652]].

!! In Texas a "practice bid" you cannot pay for can cost you 20% of the property's value. Never bid without the funds in hand.

?? Calculate the possible liability for failing to pay on a property valued at $60,000, then write down how you would prove your funds before bidding.` }
], quiz: [
  { q: 'What must a buyer show before the officer delivers the deed?', a: ['A real estate license', 'An unexpired statement of no delinquent taxes from the county assessor-collector', 'A survey'], c: 1, why: 'See [[34.015]].' },
  { q: 'If no bid covers the lesser of the amount due or the adjudged value, and the taxing unit does not end the sale:', a: ['It is sold anyway at the best bid', 'It is bid off to the taxing unit', 'It is given away'], c: 1, why: 'See [[34.01]].' },
  { q: 'A winner who fails to pay can be liable for:', a: ['Nothing', '20% of the property’s value plus costs', 'Their whole bid twice'], c: 1, why: 'See [[r652]].' }
]},
// 4
{ id: 'm4', title: 'Struck-off property, resales and excess proceeds', lessons: [
{ id: 'tx-struck', title: 'Struck-off property and taxing-unit resales', body: `
When there is no sufficient bid, the property is bid off to the taxing unit that asked for the sale, for the lesser of the judgment amount or the adjudged market value [[34.01]]. The unit takes title for itself and the other taxing units, subject to the owner's redemption right [[34.01]].

## Resales
- The taxing unit may sell the property **at any time by public or private sale** [[34.05]].
- It may ask the sheriff or a constable to hold a public resale. If it has not sold within 6 months after the redemption period ends, other taxing units can request one [[34.05]].
- Some resales may be for **any amount** [[34.05]].
- A resale is still **subject to the owner's right of redemption**. For struck-off property, the period starts when the deed to the taxing unit is filed [[34.05]].

## Where to find resale lists
Many large counties post a separate "resale" or "struck-off" list next to their monthly sale. [[?Names and locations vary. Follow the county tax office or sheriff page.]]

## How resale money is used
The taxing unit first keeps reasonable costs of keeping and marketing the property. The rest is shared as the statute directs [[34.06]].

?? On a Texas county's tax sale page, look for a resale or struck-off list. How do its minimum bids compare with the original judgments?` },
{ id: 'tx-excess', title: 'Excess proceeds: who can claim them, and for how long', body: `
Sale money is applied in a fixed order: advertising, attorney-ad-litem fees, court costs, officer fees, the units' party and description expenses, then taxes, penalties and interest, and so on [[34.02]]. Anything left is **excess proceeds**, paid into the court registry [[34.02]].

## Notice and holding
If the excess is over $25, the clerk must notify the former owner within 31 days of receiving it, at their last known address [[34.03]]. The clerk holds excess proceeds for **2 years** after the sale unless the court orders otherwise [[34.03]].

## Claims
Anyone, including a taxing unit, may file a petition in the same court **before the second anniversary of the sale** [[34.04]]. Copies must be served at least 20 days before the hearing [[34.04]]. The court pays claimants in a set order: first a buyer whose sale was voided, then taxing units for later or omitted taxes, then other lienholders by priority, and so on [[34.04]].

>> As a buyer, excess proceeds are generally not yours. They belong to the people with claims to the property.

?? Write the claim order in your own words, in five lines or fewer.` }
], quiz: [
  { q: 'Can a taxing unit resell struck-off property privately?', a: ['No, never', 'Yes, by public or private sale', 'Only after 10 years'], c: 1, why: 'See [[34.05]].' },
  { q: 'How long does the clerk generally hold excess proceeds?', a: ['120 days', '2 years after the sale', 'Forever'], c: 1, why: 'See [[34.03]].' },
  { q: 'Does the owner’s right of redemption apply to a taxing-unit resale?', a: ['Yes', 'No', 'Only for commercial land'], c: 0, why: 'See [[34.05]].' }
]},
// 5
{ id: 'm5', title: 'Researching the property', lessons: [
{ id: 'tx-research', title: 'Researching a Texas property with maps', body: `
PricePocketAsset has **no Texas sale listings yet**, so our parcel cards and Land Information tool do not cover Texas properties. You will use public maps directly. The method is the same one taught in the Florida course.

## The checklist
1. **Appraisal district map**: find the account, then check the outline, acres and improvements.
2. **Aerial**: the appraisal district map usually has an aerial layer. Look for a house, a driveway, a road along the edge.
3. **Flood**: search the address on the FEMA map [[fema]]. Note the zone and how much of the lot it covers.
4. **Wetlands**: the National Wetlands Inventory mapper [[nwi]].
5. **Access**: is there a public road along the boundary, or only a private drive?
6. **Zoning and restrictions**: cities zone. Much unincorporated Texas land has no zoning but may have **deed restrictions**, which can survive the sale [[34.01]].

## Distinguish "no overlap" from "not checked"
Write "no mapped wetlands" only after you looked. If a map would not load, write "not checked".

?? Choose a Texas address from any public sale list. Complete all six steps and record the sources and the date you checked each.

Foundations refresher: {{f:gis|GIS and parcel maps}} and {{f:diligence|Due diligence}}.` },
{ id: 'tx-value', title: 'Adjudged value, appraisal value and real value', body: `
Three numbers appear around a Texas sale:
- **Adjudged value**: the value found in the judgment. It caps the minimum the taxing unit must accept [[34.01]].
- **Appraisal district market value**: the district's yearly estimate.
- **What it would actually sell for**, as-is, possibly with occupants and a redemption cloud.

None of these is your price. For your maximum bid, start from a conservative as-is value and subtract everything in Module 7.

## Why the gap matters
A house with a $180,000 appraisal can carry a $9,000 judgment. The minimum is $9,000, but competition may push bids far higher. Your edge is research, not the minimum.

?? For one property on a Texas list, write down the adjudged value, the appraisal district value and your own as-is estimate. Explain any difference over 25%.` }
], quiz: [
  { q: 'Does PricePocketAsset currently have Texas parcel cards?', a: ['Yes, for every county', 'No. Use the appraisal district and federal maps directly', 'Only for Harris'], c: 1, why: 'We say plainly when our tools do not cover a state yet.' },
  { q: 'A wetlands map would not load. What do you write?', a: ['No wetlands', 'Not checked', 'All wetlands'], c: 1, why: 'Never record "no overlap" for something you could not check.' },
  { q: 'Which value caps the minimum the taxing unit must accept?', a: ['Adjudged value', 'Your estimate', 'Zillow'], c: 0, why: 'See [[34.01]].' }
]},
// 6
{ id: 'm6', title: 'Title and property risks', lessons: [
{ id: 'tx-survive', title: 'What the Texas tax deed does and does not clear', body: `
The deed vests title to the defendant's interest, including use and possession, **subject only to** [[34.01]]:
- the owner's right of redemption;
- recorded restrictive covenants running with the land, recorded **before January 1 of the year the tax lien arose**;
- a recorded lien arising under such a covenant (for example, an association lien) that the foreclosure judgment did not extinguish;
- valid easements of record recorded before January 1 of the year the tax lien arose.

## Only the defendant's interest
You get what the **defendants in the suit** owned. A co-owner or lienholder who was not a party may not be bound. Read the judgment's party list.

## Federal tax liens
If the United States holds a junior federal tax lien and was given proper notice, it may have **120 days from the sale**, or the local redemption period if longer, to redeem [[7425]].

## Challenges to the sale
The deed may be impeached only for fraud [[34.01]]. Most actions about title against the buyer must be brought within **1 year** of the deed being filed, or **2 years** for homesteads and special-appraisal land [[33.54]]. When that time passes, the buyer has full title [[33.54]].

?? Pull a real judgment from a Texas sale (the district clerk's records) and list every defendant. Who might hold an interest but is missing from the list?` },
{ id: 'tx-possession', title: 'Occupants, possession and homesteads', body: `
## Possession
The judgment provides for a **writ of possession** to the buyer, issued **no sooner than 20 days** after the buyer's deed is filed. The officer then puts the buyer in possession, subject to any required notice to vacate [[33.51]].

## But redemption still applies
During the redemption period the owner can buy the property back [[34.21]]. Money you spend on repairs may not be repaid. Redemption repays your bid, the deed recording fee, and taxes, penalties, interest and costs you paid, plus the premium [[34.21]]. [[?Whether particular repair or insurance costs count as "costs" should be confirmed with a Texas attorney.]]

## Homesteads
For a homestead, farmland or mineral interest, the owner has **2 years** to redeem [[34.21]], and challenges to title can be brought for 2 years [[33.54]]. Expect to hold the property without being able to sell it cleanly during that time.

?? Write a 2-year holding plan for a redeemable homestead you bought: insurance, taxes, securing the property, and what you will not spend money on.` },
{ id: 'tx-pass', title: 'Texas properties to pass on', body: `
- **Fractional or mineral interests** sold as "undivided interest". There is no surface you can use, and a 2-year redemption applies [[34.21]].
- **Strips and slivers** with no road frontage, common in older subdivisions.
- **Properties with association liens** that survive under recorded covenants [[34.01]].
- **Homesteads with occupants**, when you need the cash back quickly. The 2-year redemption and the possession process tie up your money [[34.21]] [[33.51]].
- **Properties where a necessary party is missing from the judgment.** You may not get clear title.

## The test
If you could not resell it as-is within a year, and you would not be happy holding it for two, pass.

?? Scan one Texas list and mark each property with B (research further) or P (pass), giving one reason for each P.` }
], quiz: [
  { q: 'Which survives a Texas tax deed?', a: ['Every recorded lien', 'Restrictive covenants recorded before January 1 of the year the tax lien arose', 'Nothing at all'], c: 1, why: 'See [[34.01]].' },
  { q: 'When can a writ of possession issue?', a: ['Immediately', 'No sooner than 20 days after the buyer’s deed is filed', 'After 2 years'], c: 1, why: 'See [[33.51]].' },
  { q: 'How long is the usual limit for title actions against the buyer of non-homestead property?', a: ['1 year after the deed is filed', '10 years', 'No limit'], c: 0, why: 'See [[33.54]].' }
]},
// 7
{ id: 'm7', title: 'Deal math', lessons: [
{ id: 'tx-premium', title: 'Redemption premium math, line by line', body: `
If the owner redeems, they pay you the **aggregate total**: your bid, the deed recording fee, and the taxes, penalties, interest and costs you paid on the property. They also pay a **premium on that total** [[34.21]]:
- Homestead, farmland or mineral interest: **25% in year 1, 50% in year 2**.
- All other property: within **180 days**, and the premium **may not exceed 25%**.

## Example A (simulated): non-homestead redeemed in month 2
= Bid $22,000 + recording fee $40 + taxes you paid $0 = aggregate $22,040
= Premium 25%: $5,510.00
= You receive $27,550.00 for about 2 months of holding
= Total return: 25% · annualized: about 150%

## Example B (simulated): homestead redeemed in month 23
= Same $22,040 aggregate · year-2 premium 50%: $11,020.00
= Total return 50% over 23 months · annualized about 26%

## Example C (simulated): not redeemed
= No premium. You own the property, with the costs and risks of Modules 6 and 9.

>> The premium is a one-time percentage, not interest. Fast redemptions produce big annualized numbers that you cannot plan on.

?? Recompute Example B with the owner redeeming in month 11. Then use the {{t:calc|calculator}} with months set to 11 to compare.` },
{ id: 'tx-costs', title: 'When costs erase the profit', body: `
${SIM}

## Scenario: the fixer that gets redeemed
= Winning bid on a non-homestead house: $40,000 · recording fee $40
= You spend $6,500 on a roof patch, locks, cleanup and insurance
= The owner redeems on day 170
= Repaid: $40,040 aggregate + 25% premium ($10,010) = $50,050 [[34.21]]
= Your cash in: $46,540 → profit $3,510, **if** none of the $6,500 is counted as reimbursable costs
= Add the cost of the cash you had tied up and your time → close to break-even

## Scenario: the bidding war
= Same property, bidding pushed to $62,000 by a competitor... and you won
= As-is resale value: $70,000 · selling costs 8% ($5,600) · holding 12 months ($4,000)
= If not redeemed: 70,000 − 62,000 − 5,600 − 4,000 = **−$1,600**
= If redeemed: you earn the premium, so you win only when the owner pays you

!! The worst Texas deals are the ones that only work if the owner redeems. Your maximum bid must work even if nobody redeems.

?? Using the second scenario, find the highest bid at which you would still break even if the property is not redeemed.` },
{ id: 'tx-maxbid', title: 'Setting a Texas maximum bid', body: `
Build the number for the case where **nobody redeems**. Treat any premium as a bonus.

= Conservative as-is resale value
= − Costs to take possession (writ process, any notice to vacate) [[33.51]]
= − Title work (a title policy may require waiting out limitation periods) [[33.54]]
= − Surviving association liens and pre-lien covenant obligations [[34.01]]
= − Holding costs through the redemption period: 180 days or 2 years [[34.21]]
= − Repairs needed to sell · − selling costs · − your required profit
= = Maximum bid

## Worked example (made-up numbers)
= As-is value $120,000 (non-homestead)
= Possession and legal: −$2,500 · title work: −$1,500
= Association lien: −$1,800 · holding 9 months: −$5,400
= Repairs: −$15,000 · selling 8%: −$9,600 · profit: −$20,000
= Maximum bid: **$64,200**

?? Rework the example as a homestead, with 2 years of holding at $600 a month. How far does the maximum bid fall?

Foundations refresher: {{f:bidlimit|Bid limits}}.` }
], quiz: [
  { q: 'A non-homestead is redeemed after 100 days. The premium may be at most:', a: ['25%', '50%', '18% a year'], c: 0, why: 'See [[34.21]].' },
  { q: 'Your maximum bid should work in which case?', a: ['Only if the owner redeems', 'Even if nobody redeems', 'Only for homesteads'], c: 1, why: 'Redemption is not in your control.' },
  { q: 'A year-2 homestead redemption pays what premium?', a: ['25%', '50%', 'Nothing'], c: 1, why: 'See [[34.21]].' }
]},
// 8
{ id: 'm8', title: 'Redemption', lessons: [
{ id: 'tx-who', title: 'Who can redeem in Texas', body: `
The **owner** of the property sold may redeem [[34.21]]. A person claiming ownership may redeem if they held title, or possessed the property themselves or through a tenant, either when the foreclosure suit began or when the property was sold. A defect in their chain of title does not defeat the offer [[34.22]].

## What they pay you
Your bid, the deed recording fee, and the taxes, penalties, interest and costs you paid, plus the premium [[34.21]].

## If they cannot find you
If you cannot be found, live outside the county, disagree about the amount or refuse to give a quitclaim, the owner can pay the **county assessor-collector** with an affidavit [[34.21]]. Keep your contact details current with the tax office.

?? Write the list of documents you would ask a person to show before accepting a redemption payment directly.` },
{ id: 'tx-clock', title: 'When the redemption clock starts and ends', body: `
- **Starts**: the day the **buyer's deed is filed for record**, not the sale day [[34.21]]. Record your deed promptly.
- **Homestead, farmland, mineral interest**: ends on the **second anniversary** of the filing [[34.21]].
- **Everything else**: ends on the **180th day** after the filing [[34.21]].
- **Struck-off property later resold**: the period runs from the taxing unit's deed filing, or the resale deed, depending on the case [[34.05]] [[34.21]].

## Which category applies?
It depends on the use **when the suit or warrant application was filed**: whether it was a residence homestead or farmland then [[34.21]]. Check the appraisal district's exemption history for that year.

= Deed filed March 10, 2027 (non-homestead) → last day about September 6, 2027 (180 days)
= Deed filed March 10, 2027 (homestead) → last day March 10, 2029

?? Count 180 days from a deed date you choose. Write down the date, the year-1 and year-2 premium cut-off for a homestead, and when you would order a title update.` },
{ id: 'tx-verify', title: 'Verifying a redemption and closing the file', body: `
1. **Payment received.** Confirm the amount against the statute's formula [[34.21]].
2. **A quitclaim or release** back to the owner, as your attorney advises. [[?The exact paperwork to clear the record after a Texas redemption should be confirmed with a Texas attorney.]]
3. **Check the assessor-collector**, in case the owner redeemed through the affidavit process [[34.21]].
4. **Record the outcome** in {{t:portfolio|My portfolio}} with the source and the date.

!! Never record a property as redeemed because a listing disappeared or someone told you so. Get the payment or a recorded document.

?? Draft a one-paragraph "file closed" note for a simulated redemption: what was paid, when, by whom, and how you verified it.` }
], quiz: [
  { q: 'The redemption clock starts on:', a: ['The sale day', 'The day the buyer’s deed is filed for record', 'January 1'], c: 1, why: 'See [[34.21]].' },
  { q: 'Can someone with only possession through a tenant redeem?', a: ['Yes, if they had it when the suit began or at the sale', 'No', 'Only with a lawyer'], c: 0, why: 'See [[34.22]].' },
  { q: 'If the buyer cannot be found, the owner can redeem through:', a: ['The newspaper', 'The county assessor-collector, with an affidavit', 'Nobody'], c: 1, why: 'See [[34.21]].' }
]},
// 9
{ id: 'm9', title: 'What happens after you win', lessons: [
{ id: 'tx-after', title: 'From the gavel to the recorded deed', body: `
1. **Pay** according to the officer's terms. A failure risks 20% liability [[r652]].
2. **Show the no-delinquent-taxes statement**. No statement, no deed [[34.015]].
3. **Receive and record the deed.** Recording starts the redemption clock [[34.21]].
4. **Insure and secure** the property right away.
5. **Possession**: a writ can issue no sooner than 20 days after the deed is filed [[33.51]].
6. **Calendar** the end of the redemption period (180 days or 2 years) and the end of the limitation periods for title challenges (1 or 2 years) [[34.21]] [[33.54]].
7. **Do not** spend heavily on improvements until redemption has ended.

?? Turn the seven steps into dated tasks for a simulated deed recorded today.` },
{ id: 'tx-outcomes', title: 'The possible endings', body: `
- **Redeemed**: you receive the aggregate plus the premium [[34.21]]. Hand the property back as your attorney advises.
- **Not redeemed**: after the period, your title is subject only to the items the deed survives [[34.01]]. Once limitations run, claims are cut off [[33.54]].
- **Sale challenged**: fraud is the only ground to impeach the deed [[34.01]]. Other claims face the limitation periods [[33.54]]. If a sale is voided, a buyer who wins an action against the taxing units comes first in the excess-proceeds claims [[34.04]].
- **You failed to pay**: liability and a resale [[r652]].

?? Rank the four endings from best to worst for a buyer who bid the maximum from Module 7, and say why.` }
], quiz: [
  { q: 'What starts the redemption clock?', a: ['Paying the officer', 'Recording the deed', 'Getting the keys'], c: 1, why: 'See [[34.21]].' },
  { q: 'What is the only ground to impeach the deed?', a: ['Low price', 'Fraud', 'Late notice'], c: 1, why: 'See [[34.01]].' },
  { q: 'Should you remodel during the redemption period?', a: ['Yes, right away', 'Usually not. The owner can still redeem.', 'Only the kitchen'], c: 1, why: 'Redemption repays defined amounts [[34.21]]. Improvements may not be repaid.' }
]},
// 10
{ id: 'm10', title: 'Local differences inside Texas', lessons: [
{ id: 'tx-local', title: 'Comparing verified county procedures', body: `
Each county runs its own sale, within the Tax Code and the execution rules. Three procedures, from each county's own pages (checked 2026-11-02):

## Harris County: in person, run by constables
Sales are held on the **first Tuesday** of each month at the **Bayou City Event Center**, **10:00 a.m. to 4:00 p.m.**, run by the county's eight constables [[harris]].

## Denton County: online, run by the sheriff
Sales are held **online through GovEase**, on the first Tuesday of each month, starting at **10:00 a.m.** [[denton]].

## Kaufman County: online when there is property to sell
Sales are online on the first Tuesday of the month, **if there is property to sell** [[kaufman]].

## Why it matters
- In person, you must be in the room, with funds, by the officer's deadline.
- Online, read the platform's deposit, registration and buyer's-premium terms. [[?Platform fees and deposits for each county were not verified.]]
- All three counties still rely on the same statute for the minimum bid, deeds and redemption [[34.01]] [[34.21]].

?? For one of these counties, find the current month's list and the posted terms of sale. Note one rule that differs from the other two counties.` },
{ id: 'tx-offices', title: 'Which office for what', body: `
- **"Is this property still on the sale?"** → the selling officer (sheriff or constable) or the taxing unit's attorney.
- **"I need the no-delinquent-taxes statement or bidder registration."** → county assessor-collector [[34.015]] [[34.011]].
- **"What does the judgment say?"** → district clerk (the case file).
- **"Excess proceeds."** → district clerk and court [[34.03]] [[34.04]].
- **"Redemption when the buyer can't be found."** → county assessor-collector [[34.21]].
- **"Value and exemptions."** → county appraisal district.
- **"Flood."** → FEMA map [[fema]], then the local floodplain office.

?? Build a contact sheet for one Texas county with the five offices above and their links.` }
], quiz: [
  { q: 'Where does Harris County hold its sales?', a: ['Online only', 'In person at the Bayou City Event Center', 'At the appraisal district'], c: 1, why: 'See [[harris]].' },
  { q: 'Where do you get the statement of no delinquent taxes?', a: ['District clerk', 'County assessor-collector', 'Constable'], c: 1, why: 'See [[34.015]].' },
  { q: 'What stays the same across Texas counties?', a: ['The auction location', 'The statutory redemption rules', 'Platform fees'], c: 1, why: 'Redemption comes from [[34.21]].' }
]},
// 11
{ id: 'm11', title: 'Case studies', lessons: [
{ id: 'tx-case-win', title: 'Case 1 (simulated): a well-priced non-homestead', body: `
${SIM}

A vacant duplex lot in a small city. Adjudged value $38,000, judgment and costs $6,200. Research: city zoning allows a duplex, the FEMA map shows Zone X, there are no mapped wetlands, and it fronts a paved street. The judgment names the owner and the one recorded lienholder.

= Maximum bid (no redemption assumed): resale $34,000 − title $1,500 − holding 6 months $900 − selling $2,700 − profit $8,000 = $20,900
= Winning bid: $18,500 · recording $40
= Owner redeems on day 95: 25% on $18,540 = $4,635 → receives $23,175 [[34.21]]
= If not redeemed: sell at $34,000 → about $8,000 or more of profit after costs

The bid worked both ways. That is the goal.` },
{ id: 'tx-case-pass', title: 'Case 2 (simulated): a cheap mineral interest', body: `
${SIM}

A sale notice offers an "undivided 1/64 mineral interest" in a 160-acre tract. The minimum is $1,100.
- You would not get any surface land.
- The owner has **2 years** to redeem a mineral interest [[34.21]], so a resale is slow.
- Value depends on production you cannot verify from public tax records.

**Pass**, unless you specialize in minerals and can value the interest.` },
{ id: 'tx-case-unknown', title: 'Case 3 (simulated): when the homestead question blocks a decision', body: `
${SIM}

A single-family house with an adjudged value of $160,000. The judgment is for $14,000. The current appraisal record shows no homestead exemption, but the owner's mailing address is the property address.

## The missing fact
Redemption depends on whether it was a **residence homestead when the suit was filed** [[34.21]]. If it was, the owner has 2 years and title challenges can come for 2 years [[33.54]]. If not, it is 180 days and 1 year.

## Decision: need more information
Before setting a maximum bid, check the appraisal district's exemption history for the year the suit was filed and read the petition. The right bid differs by tens of thousands of dollars between the two answers.

?? Write the two maximum bids, homestead and not, using Module 7's formula with your own assumptions.` }
], quiz: [
  { q: 'In Case 1, why did the bid "work both ways"?', a: ['It was profitable whether or not the owner redeemed', 'The owner promised to redeem', 'The premium was 50%'], c: 0, why: 'A maximum bid built for "no redemption" turns redemption into a bonus.' },
  { q: 'Why is the homestead question so important in Case 3?', a: ['It changes the redemption period and the limitation period', 'It changes the paint color', 'It sets the minimum bid'], c: 0, why: 'See [[34.21]] and [[33.54]].' },
  { q: 'Which cases are simulated?', a: ['All three', 'None', 'Only Case 1'], c: 0, why: 'We have no verified Texas outcome records, so we say so.' }
]},
// 12
{ id: 'm12', title: 'Final project', lessons: [
{ id: 'tx-project', title: 'Final project: research a Texas sale property and decide', body: `
## Your assignment
Pick a real property on a current Texas county sale list (from a county on {{u:/liens/states/state/?s=TX|our Texas page}}) and write a decision memo with these six parts:
1. **The listing**: county, cause number, account number, legal description, adjudged value, judgment total, sale date and officer, list source and date checked.
2. **Verification**: match the appraisal account and legal description to the judgment, and confirm the outline and acres on the appraisal district map.
3. **Land risks**: flood, wetlands, road access and zoning or deed restrictions, each with a source and date, or "not checked".
4. **Title risks**: parties in the judgment, surviving covenants, association liens and easements recorded before January 1 of the lien year [[34.01]], federal liens [[7425]], and homestead status when the suit was filed [[34.21]].
5. **Math**: the Module 7 maximum bid assuming no redemption, plus the premium you would receive at 3 months and, if it applies, 18 months [[34.21]].
6. **Decision**: Bid with a maximum, Pass, or "need more information", in three sentences.

## Worked answer (simulated property)
${SIM}
1. Example County, Cause 2026-0001, account 1000-200-0300, Lot 3 Block 2 Example Addn, adjudged value $72,000, judgment total $8,400, Constable Pct 2, first Tuesday next month. List checked today.
2. Account and legal description match the judgment. Outline 0.21 acre on the appraisal map.
3. Flood Zone X (FEMA, checked today). No mapped wetlands. Fronts a city street. Zoned single-family.
4. Defendants: the owner and a 2019 mortgage holder. An association covenant recorded in 1998 survives. No federal lien found. No homestead exemption in the suit year.
5. Maximum bid: $66,000 as-is − $3,000 title and possession − $2,400 holding − $5,280 selling − $14,000 profit = **$41,320**. At $41,320 plus $40 recording, a 25% premium at 3 months is **$10,340**. The 18-month case does not apply (non-homestead, 180 days).
6. **Bid, up to $41,300.** It works if not redeemed. Watch for the association's lien amount before the sale.

## Grading rubric (100 points)
- Listing copied exactly, with source and date: **15**
- Account, legal description and judgment matched: **15**
- Land risks with sources, unknowns marked: **15**
- Title risks, including homestead in the suit year: **20**
- Maximum bid math shown, built for no redemption: **20**
- Clear decision that follows from the evidence: **15**

80 or more passes. An invented fact presented as real caps the score at 60.` }
], quiz: [
  { q: 'Your maximum bid in the project must assume:', a: ['The owner redeems', 'Nobody redeems', 'A 50% premium'], c: 1, why: 'Redemption is a bonus, not a plan.' },
  { q: 'Which year’s homestead status matters for the redemption period?', a: ['The year the suit was filed', 'This year', 'The year you sell'], c: 0, why: 'See [[34.21]].' },
  { q: 'What caps your project score at 60?', a: ['A typo', 'Presenting an invented fact as real', 'Choosing Pass'], c: 1, why: 'Simulated content must be labeled.' }
]}
];

const exercise = {
  title: 'Bid or Pass: a simulated Texas sale property',
  simulated: true,
  label: '**SIMULATED.** PricePocketAsset has no verified Texas listing yet, so this exercise uses made-up facts. No real property, purchase or payout is described.',
  lien: null,
  calc: { amount: 52040, rate: 25, months: 4, fees: 0, from: 'Simulated Texas sale: $52,000 bid + $40 recording' },
  facts: [
    ['Property', 'Single-family house, 0.18 acre, city street frontage (simulated)'],
    ['Adjudged value', '$118,000 (simulated)'],
    ['Judgment total', '$11,600, taxes, penalties, interest and costs (simulated)'],
    ['Homestead in suit year', 'Yes, per the appraisal district exemption history (simulated)'],
    ['Occupied', 'Yes, by the former owner (simulated)'],
    ['Flood / wetlands', 'Zone X · no mapped wetlands (simulated)'],
    ['Association', 'Recorded 2004 covenant with assessment lien, about $2,300 unpaid (simulated)']
  ],
  brief: `
Decide your **maximum bid** for this house, assuming nobody redeems, then choose Bid or Pass and explain. Use the {{t:calc|calculator}} to test the premium if the owner redeems. Remember: it was a homestead in the suit year [[34.21]], it is occupied [[33.51]], and the association covenant predates the lien year [[34.01]].`,
  walkthrough: `
${SIM}

## 1. Category
Homestead in the suit year → **2-year** redemption with a 25% or 50% premium [[34.21]], and 2-year title limitations [[33.54]].

## 2. No-redemption maximum
= As-is resale after 2 years: $125,000 (assumption)
= Possession (occupied; writ no sooner than 20 days after filing) and legal: −$4,000 [[33.51]]
= Association lien that survives: −$2,300 [[34.01]]
= Holding 24 months (taxes, insurance, securing): −$14,400
= Repairs after possession: −$18,000 · selling 8%: −$10,000 · profit: −$22,000
= **Maximum ≈ $54,300**

## 3. If redeemed
= At a $52,000 bid + $40: year 1 premium 25% = $13,010 · year 2 premium 50% = $26,020 [[34.21]]

## 4. A reasonable answer
**Bid up to about $54,000, or Pass** if you cannot hold the cash for 2 years or do not want to handle an occupied homestead. Strong answers recognize the 2-year period, the occupant, the surviving association lien and the need to build the bid for no redemption.`
};

export default {
  id: 'tx', state: 'TX', title: 'Texas Tax Sales: The Complete Course', status: 'published', checked: CK,
  review: 'Pilot course. Rules are cited to the Texas Tax Code and the Texas Rules of Civil Procedure, checked ' + CK + '. County procedures were checked on 2026-11-02. Items marked "Needs review" were not verified. Case studies and the exercise are simulated because we have no verified Texas outcome records. This course has not yet had an outside legal review.',
  intro: 'How Texas sells the property itself after a court judgment: notices, registration, the minimum bid, struck-off resales, excess proceeds, research, the redemption premium math, possession and the risks. Every rule cited to the Tax Code and the court rules.',
  sources, modules, exercise,
  glossary: [
    ['Tax foreclosure sale', 'A court-ordered auction of the property for delinquent taxes, run by a sheriff or constable.'],
    ['Order of sale', 'The court’s order directing the officer to sell. Endorsing it counts as the levy.'],
    ['Adjudged value', 'The value found in the judgment. It caps the minimum the taxing unit must accept.'],
    ['Bid off / struck off', 'Property taken by a taxing unit when no sufficient bid is received.'],
    ['Resale', 'A taxing unit’s later sale of struck-off property, publicly or privately.'],
    ['Redemption premium', '25% (first year) or 50% (second year) on the aggregate total; at most 25% for 180-day property.'],
    ['Aggregate total', 'Bid + deed recording fee + taxes, penalties, interest and costs paid by the buyer.'],
    ['Residence homestead', 'An owner’s principal residence. It gets a 2-year redemption and 2-year limitations.'],
    ['Excess proceeds', 'Sale money left after the judgment and costs. Held 2 years for claims.'],
    ['Statement of no delinquent taxes', 'From the county assessor-collector. Required before the deed is delivered.'],
    ['Writ of possession', 'A court writ that puts the buyer in possession, no sooner than 20 days after the deed is filed.'],
    ['Cause number', 'The court case number for the tax suit.'],
    ['Appraisal district', 'The county agency that values property and keeps account numbers and maps.'],
    ['Original survey / abstract', 'How rural Texas land is identified in legal descriptions.']
  ],
  links: [
    ['Texas Tax Code Chapter 34 (sales, redemption)', 'https://tcss.legis.texas.gov/resources/TX/htm/TX.34.htm', 'statute'],
    ['Texas Tax Code Chapter 33 (delinquency, suits, possession)', 'https://tcss.legis.texas.gov/resources/TX/htm/TX.33.htm', 'statute'],
    ['Texas Rules of Civil Procedure (Rules 646a, 647, 652, 653)', 'https://www.txcourts.gov/media/1463426/texas-rules-of-civil-procedure.pdf', 'court rules'],
    ['Our Texas page: county sale links', '/liens/states/state/?s=TX', 'site'],
    ['Harris County Tax Office: tax sales', 'https://www.hctax.net/Property/TaxSales', 'county'],
    ['Denton County: Sheriff’s Sale', 'https://www.dentoncounty.gov/840/Sheriffs-Sale', 'county'],
    ['FEMA Flood Map Service Center', 'https://msc.fema.gov/portal/search', 'federal']
  ],
  checklists: {
    research: ['Cause number, account number and legal description match', 'Defendants in the judgment listed, and missing parties noted', 'Outline and acres on the appraisal district map', 'Aerial: structures, access, occupancy signs', 'FEMA zone with date checked', 'Wetlands with date checked', 'Road frontage, with legal access confirmed or flagged', 'Zoning or deed restrictions, and covenants recorded before January 1 of the lien year', 'Association liens', 'Federal tax liens', 'Homestead, farmland or mineral status in the suit year', 'Sale still on the list the morning of the sale'],
    bid: ['Registered (if required) and statement of no delinquent taxes in hand', 'Funds in the form the officer accepts', 'Maximum bid built for "no redemption"', 'Redemption period known (180 days or 2 years)', 'Premium worked out at 3 and 18 months', 'Possession plan (writ no sooner than 20 days)', 'Holding budget through redemption', 'Risk of 20% liability if you fail to pay understood', 'Deed recording plan (it starts the clock)', 'Everything logged in My portfolio']
  }
};
