// Colorado: annual tax lien sale with premium bidding; formula interest (9 points over the Fed discount rate);
// since July 1, 2024 a public auction of a "certificate of option for treasurer's deed" (C.R.S. article 11.5) replaces the old treasurer's deed request. Batch 1.
const CK = '2026-11-11', ED = 'Colorado Revised Statutes 2024 (uncertified printout from leg.colorado.gov; check for later amendments)';
const S = (short, name, url, checked = CK, effective = ED) => ({ short, name, url, checked, effective });
const PDF = 'https://leg.colorado.gov/sites/default/files/images/olls/crs2024-title-39.pdf';
const crs = (sec) => S('CRS ' + sec, 'C.R.S. § ' + sec, PDF);
const sources = {
  '39-11-101': crs('39-11-101'), '39-11-102': crs('39-11-102'), '39-11-107': crs('39-11-107'), '39-11-108': crs('39-11-108'), '39-11-109': crs('39-11-109'),
  '39-11-111': crs('39-11-111'), '39-11-115': crs('39-11-115'), '39-11-116': crs('39-11-116'), '39-11-117': crs('39-11-117'), '39-11-118': crs('39-11-118'),
  '39-11-119': crs('39-11-119'), '39-11-122': crs('39-11-122'), '39-11-148': crs('39-11-148'), '39-11-150': crs('39-11-150'), '39-11-151': crs('39-11-151'), '39-11-153': crs('39-11-153'),
  '39-12-103': crs('39-12-103'), '39-12-105': crs('39-12-105'), '39-12-111': crs('39-12-111'), '39-12-113': crs('39-12-113'),
  '11.5-101': crs('39-11.5-101'), '11.5-102': crs('39-11.5-102'), '11.5-104': crs('39-11.5-104'), '11.5-105': crs('39-11.5-105'), '11.5-106': crs('39-11.5-106'),
  '11.5-108': crs('39-11.5-108'), '11.5-109': crs('39-11.5-109'), '11.5-110': crs('39-11.5-110'), '11.5-111': crs('39-11.5-111'), '11.5-112': crs('39-11.5-112'),
  '11.5-113': crs('39-11.5-113'), '11.5-114': crs('39-11.5-114'), '11.5-115': crs('39-11.5-115'), '11.5-116': crs('39-11.5-116'), '11.5-117': crs('39-11.5-117'),
  denver: S('Denver Treasury', 'Denver Treasury: Real Estate Delinquent Taxes and Tax Lien Sale (2026)', 'https://www.denvergov.org/Government/Departments/Department-of-Finance/Our-Divisions/Treasury/Property-Taxes/Real-Estate-Delinquent-Taxes-and-Tax-Lien-Sale', CK, '2026 sale'),
  boulder: S('Boulder TO', 'Boulder County Treasurer: Tax Lien Sale (2026)', 'https://bouldercounty.gov/property-and-land/treasurer/taxes/tax-lien-sale/', CK, '2026 sale'),
  fema: S('FEMA', 'FEMA National Flood Hazard Layer', 'https://msc.fema.gov/portal/search', CK, ''),
  nwi: S('NWI', 'U.S. Fish and Wildlife Service National Wetlands Inventory', 'https://www.fws.gov/program/national-wetlands-inventory/wetlands-mapper', CK, '')
};
const SIM = '!! SIMULATED. Every number below is made up to teach the method. No real certificate, purchase or payout is described.';

const modules = [
{ id: 'm1', title: 'How Colorado’s tax lien system works', free: true, lessons: [
{ id: 'co-what', title: 'What Colorado sells: a lien certificate, bid by premium', body: `
Colorado's county treasurers sell **tax liens**, not the property. Each year the treasurer sells the lien on every delinquent parcel at public auction [[39-11-101]] [[39-11-108]]. The buyer receives a **certificate of purchase** that states the interest rate and the amount paid [[39-11-117]].

## The twist: bidders compete on a premium
The lien goes to the person who pays the taxes, delinquent interest and fees, **or who pays the largest amount in excess of those**. The excess is credited to the county general fund [[39-11-115]]. Denver's page says the buyer does **not recover the premium** over the starting amount [[denver]].

## The interest rate is a formula, not a bid
Redemption interest is **nine percentage points above the Federal Reserve discount rate** (the Kansas City Fed rate), rounded to a whole percent, set each September 1 by the bank commissioner and effective October 1 [[39-12-103]]. Denver says the 2026 rate for certificates sold in November is **13%** (1.08333% a month) [[denver]].

## Who does what
- **County treasurer**: advertises, runs the auction, issues certificates, takes redemptions and, after three years, handles the deed-option auction [[39-11-108]] [[39-12-103]] [[11.5-102]].
- **County commissioners**: choose the newspaper and may sell county-held certificates [[39-11-122]].
- **Clerk and recorder**: records notices and deeds.

>> In Colorado the interest rate is the same for every bidder. What you control is how much premium you are willing to lose.

?? Open {{u:/liens/states/state/?s=CO|our Colorado page}} and find one county treasurer's tax lien sale page. Write down its sale date.

Foundations refresher: {{f:basics|What tax liens and tax deeds are}}.` },
{ id: 'co-calendar', title: 'The Colorado calendar', body: `
- **By September 1**: the treasurer mails notices to people with unpaid taxes, giving a date at least **15 days** after mailing [[39-11-101]].
- **At least four weeks before the sale**: first publication of the notice (three weekly issues), and posting in the treasurer's office for at least four weeks [[39-11-102]].
- **On or before the second Monday in December**: the public auction begins [[39-11-109]]. Counties commonly sell in November (Denver's 2026 auction ran October 12 to November 4; Boulder's was November 13) [[denver]] [[boulder]].
- **Each September 1**: the redemption interest rate is set, effective October 1 [[39-12-103]].
- **After July 1**: a certificate holder may pay the next year's taxes for endorsement on the certificate [[denver]] [[39-11-119]].
- **At least three years after the sale**: the holder may apply for a public auction of a **certificate of option for treasurer's deed** [[11.5-102]].
- **110 to 125 days after the first notice**: that auction [[11.5-105]].

## Worked timeline (simulated)
= Taxes for 2025 unpaid → sale in November 2026
= Interest at the certificate rate runs from the sale date [[39-12-103]]
= Earliest deed-option application: November 2029
= Auction of the option: 110 to 125 days after first notice [[11.5-105]]

?? Using Denver's 2026 timing as a model [[denver]], write the dates for your own simulated purchase.` },
{ id: 'co-ends', title: 'How a Colorado certificate ends', body: `
## 1. Redemption (the usual ending)
The owner or someone with a claim pays the taxes, interest and costs for which the lien sold, **plus redemption interest from the sale date**, plus later taxes you paid with interest [[39-12-103]].

## 2. Deed-option auction (after three years)
You file an application, and the treasurer holds a public auction of a **certificate of option for treasurer's deed**. As the lien holder you can **redeem** your lien from the winning bidder if you act within eight business days [[11.5-102]] [[11.5-111]]. If you do not, and the property is not redeemed, the option holder can demand a treasurer's deed [[11.5-116]].

## 3. Expiration
Denver says a certificate is valid for 15 years [[denver]]. [[?Confirm the validity period for any certificate with the treasurer who issued it.]]

>> The old rule that let a lien holder simply request a deed was replaced on July 1, 2024. Read any older guide with that in mind [[39-11-153]].

?? Write one sentence on how the 2024 change affects the lien holder's profit if the owner never redeems.` }
], quiz: [
  { q: 'How do Colorado bidders compete?', a: ['By bidding down the interest rate', 'By paying a premium above the taxes', 'By lottery'], c: 1, why: 'See [[39-11-115]].' },
  { q: 'How is the redemption rate set?', a: ['By each bidder', '9 points above the Federal Reserve discount rate, rounded', 'It is always 18%'], c: 1, why: 'See [[39-12-103]].' },
  { q: 'What replaced the old treasurer’s deed request on July 1, 2024?', a: ['A public auction of a certificate of option for treasurer’s deed', 'Nothing', 'A mail-in form'], c: 0, why: 'See [[39-11-153]] and [[11.5-102]].' }
]},
{ id: 'm2', title: 'Finding notices, lists and results', lessons: [
{ id: 'co-notices', title: 'Where Colorado sale notices and lists appear', body: `
## Required notices
The notice of sale is published in the newspaper selected by the county commissioners, first at least four weeks before the sale, three weekly issues, and posted in the treasurer's office [[39-11-102]]. It must include a description of the parcels, the date, time and place (or the internet address if online), the location of public computer workstations, and a statement that online bidding rules will be posted [[39-11-102]].

## Where to look
1. **The county treasurer's tax lien sale page.** Denver posts its sale notice, online auction website, bidding window, fees and bidding rules [[denver]]. Boulder posts its sale date, registration time and a list of advertised properties updated each Friday [[boulder]].
2. **The county's online auction platform** when the sale is online (Denver uses its own auction site; others use vendors).
3. **Past sale results.** Boulder publishes a "Prior Year Sale Information" table with investors, properties, average premium and taxes collected [[boulder]].

## You do the research
Investors are buying the lien and must research the property themselves.

?? Open two counties' tax lien pages. Write down for each: sale date, online or in person, registration deadline.` },
{ id: 'co-columns', title: 'Reading a Colorado lien list', body: `
Lists show what the notice must include [[39-11-102]] and what the sale requires [[39-11-115]]:
- **Parcel or schedule number** and description.
- **Tax years** delinquent.
- **Face value**: unpaid taxes, interest, penalties and fees. Denver says the minimum starting bid equals this face value [[denver]].
- **Advertising fee** and other costs added at the sale.
- **Whether the parcel will be sold singly or combined** with contiguous parcels or those in one subdivision [[39-11-115]].

## Fees on top of the bid
Denver lists a **$5 certificate fee** and a **$10 auction fee**, plus the premium [[denver]].

## What you pay if you win
Face value + advertising and fees + **your premium** [[denver]] [[39-11-115]].

?? Pick a county list and calculate the face value plus fees for three liens. Then decide what premium you would accept.` },
{ id: 'co-ids', title: 'Colorado parcel numbers and mineral interests', body: `
Counties use their own parcel or schedule number formats. Copy the ID exactly and match it to the county assessor's record and GIS map.

## Combined parcels
If two or more lots or tracts are valued and assessed as one parcel, the treasurer sells a single lien on that parcel [[39-11-108]]. The treasurer may combine contiguous parcels or parcels in one subdivision as a unit [[39-11-115]].

## Severed mineral interests
Liens on **severed mineral interests** are sold at the same time and place as other liens [[39-11-150]]. Mineral-only parcels give you no surface land. Treat them with extra caution.

?? Find a parcel on a county list that is a mineral interest or combined parcel. Write what you would be buying.

Foundations refresher: {{f:parcels|Parcel IDs}}.` }
], quiz: [
  { q: 'How long before the sale is the first publication?', a: ['At least four weeks', 'One day', 'Six months'], c: 0, why: 'See [[39-11-102]].' },
  { q: 'What is Denver’s minimum starting bid?', a: ['The face value of the lien', 'Zero', 'Double the taxes'], c: 0, why: 'See [[denver]].' },
  { q: 'Are severed mineral interests sold in the same sale?', a: ['Yes', 'No', 'Only in Boulder'], c: 0, why: 'See [[39-11-150]].' }
]},
{ id: 'm3', title: 'Registering, bidding and paying', lessons: [
{ id: 'co-register', title: 'Registration and bidding rules', body: `
The treasurer has **broad powers to set bidding rules**: recognizing buyers in numerical order, in rotation or in the order bids are made, setting the order liens are sold, setting minimum bid increases and a minimum total below which competitive bids are not accepted [[39-11-115]]. Rules must be **announced at the start** of an in-person auction, and **posted at least two weeks** before an online sale [[39-11-115]].

## What counties require
- **Denver (2026)**: bidding from October 12 at 8:00 a.m. to November 4 at 12:00 p.m. on its auction website. Buyers register and deposit electronic funds in advance, must be at least 18, and names must match the certificates [[denver]].
- **Boulder (2026)**: in person on November 13. Registration opens at 7:30 a.m., the sale begins at 8:30 a.m. [[boulder]].

[[?Deposit amounts, tax forms and registration deadlines for each county must be read from that county's current bidding rules.]]

?? Compare Denver's and Boulder's registration processes. List one difference.` },
{ id: 'co-premium', title: 'Premium bidding: what you are really bidding', body: `
## The mechanic
You pay the face amount, plus fees, **plus the premium you bid** [[39-11-115]]. The interest rate is fixed by formula and the same for every bidder [[39-12-103]].

## The premium is lost
The excess over taxes, interest and fees is **credited to the county general fund** [[39-11-115]]. Denver says the buyer does not recover the premium [[denver]]. Interest is paid only on the face amount, not on the premium.

## Denver's rules (2026)
- Minimum bid: the face value.
- Increments: **$1** [[denver]].
- Ties: **random selection** by the auction website [[denver]].

## Worked example (simulated)
= Face value $2,000 + fees $15 (certificate $5, auction $10 [[denver]])
= Winning premium: $120
= You pay $2,135
= Interest runs on $2,000 (and fees as allowed), not the $120 premium [[39-12-103]]
= At 13% for 12 months: 2,000 × 13% = $260 → net of premium: $140 → return on $2,135: 6.6%

>> A premium bid is a price paid for the right to earn the formula rate. The higher the premium, the lower your net return.

?? Compute your net return if the premium were $350 instead.` },
{ id: 'co-pay', title: 'Paying and what happens if you do not', body: `
## Payment
The treasurer may accept cash, negotiable paper or electronic funds transfer, subject to the bidding rules [[39-11-111]]. Denver notes that rejected payments, including for lack of funds, may cancel the bid and may lead to a ban [[denver]].

## If a winner does not pay
- If the auction has not closed, the treasurer may offer the lien again.
- If it has closed, the treasurer may re-advertise for at least a week, or **sue to recover the amount bid**.
- In online sales the treasurer may offer the lien to **another bidder without new advertising**.
- The treasurer may **bar the bidder for up to five years** [[39-11-116]].

## Your certificate
You receive a certificate of purchase stating the property, the rate and the amounts, with columns for subsequent taxes. The certificate fee is set in section 30-1-102 [[39-11-117]]. It is assignable by endorsement [[39-11-118]].

!! Have your funds ready before bidding. A failed payment can mean a lawsuit and a five-year ban.

?? Write your payment plan: where the money sits and how quickly it can move.` }
], quiz: [
  { q: 'Is the premium refunded when the owner redeems?', a: ['No', 'Yes', 'Only in Denver'], c: 0, why: 'See [[39-11-115]] and [[denver]].' },
  { q: 'How long can the treasurer bar a bidder who fails to pay?', a: ['Up to five years', '1 day', 'Never'], c: 0, why: 'See [[39-11-116]].' },
  { q: 'What increments does Denver use?', a: ['$1', '$100', '1%'], c: 0, why: 'See [[denver]].' }
]},
{ id: 'm4', title: 'County-held certificates and later taxes', lessons: [
{ id: 'co-struck', title: 'Struck-off liens and county-held certificates', body: `
If nobody bids, the offering stays open until the sale ends. Then the treasurer **strikes off** the remaining liens to the county (or city or town) for the taxes, interest and fees, and issues the county a certificate [[39-11-108]]. Taxes on that property are not payable until the county gets the money from a sale or redemption [[39-11-108]].

## Buying them later
A county may assign, sell or transfer its certificates **as the board of county commissioners decides by resolution** [[39-11-122]]. A sale of a certificate on property with more than $10,000 in taxes due is not valid until approved by the administrator after published notice [[39-11-122]]. Logan County, for example, lists unsold parcels as open to buy after its sale [[boulder]].

## What to ask the county
1. Which certificates does the county hold, and on what terms will it sell them?
2. Is board approval needed?
3. What interest has accrued?

!! County-held means nobody wanted it. Research it twice.

?? Find one county's page about struck-off or unsold liens.` },
{ id: 'co-subsequent', title: 'Paying later taxes on your certificate', body: `
A holder who wants to pay **subsequent taxes** presents the certificate (or is told the amount if the treasurer holds it). The treasurer records the payment and date and may charge a fee [[39-11-119]]. Denver says buyers may do this after July 1 [[denver]].

## Why it matters
- Subsequent taxes you pay **earn the same redemption interest** and the owner must repay them to redeem [[39-12-103]].
- If subsequent taxes are paid before they become delinquent, interest runs only from their delinquency date [[39-12-103]].
- Paying keeps another buyer from acquiring a competing lien.

## A limit
A holder may redeem a later sale made after their certificate, and the amount is endorsed as subsequent taxes on the original [[39-12-103]].

?? A $3,000 certificate at 13% with $900 of subsequent taxes paid at month 12. How much does the owner owe at month 24?` },
{ id: 'co-assign', title: 'Assignments, records and special liens', body: `
A certificate of purchase is **assignable by endorsement**. An assignment entered on the record of sales in the clerk and recorder's and the treasurer's offices vests all the right and title of the original purchaser in the assignee [[39-11-118]] [[11.5-115]].

## Special liens
No lien created by a tax certificate or certificate of purchase may impair certain special improvement liens. [[?Read 39-11-148 in full before relying on how special improvement liens interact with a tax lien.]] [[39-11-148]]

## Conflicts of interest
Certain county officials and employees may not acquire a tax lien or a property sold under a tax lien [[39-11-151]]. Bids by officials, employees and their immediate families are not accepted at the deed-option auction [[11.5-108]].

?? Record a simulated certificate in {{t:portfolio|My portfolio}} with every date from Module 1.` }
], quiz: [
  { q: 'What happens to unsold liens?', a: ['They are struck off to the county', 'They vanish', 'They go to the state'], c: 0, why: 'See [[39-11-108]].' },
  { q: 'Do subsequent taxes earn the redemption interest rate?', a: ['Yes', 'No', 'Only the first year'], c: 0, why: 'See [[39-12-103]].' },
  { q: 'How is a certificate transferred?', a: ['By endorsement, entered on the record of sales', 'It cannot be', 'By a new auction'], c: 0, why: 'See [[39-11-118]].' }
]},
{ id: 'm5', title: 'Researching the parcel', lessons: [
{ id: 'co-research', title: 'Researching a Colorado lien with public maps', body: `
PricePocketAsset has **no Colorado parcel listings yet**, so our cards and the parcel record panel do not cover Colorado. Use the county assessor's map and federal layers. The method matches the other courses.

## The checklist
1. **County assessor and GIS**: parcel outline, acres, improvements, owner of record.
2. **Aerial**: structures, access, terrain. Colorado parcels can be steep or in the mountains.
3. **Flood**: FEMA map [[fema]].
4. **Wetlands**: NWI mapper [[nwi]].
5. **Access**: public road, or only an easement? Mountain lots often lack legal access.
6. **Water and sewer**: well and septic or a district.
7. **Zoning and subdivision rules**: county planning office.

## Mark the unknowns
Write "not checked" for anything you could not load.

?? Pick a parcel from a county list and complete the checklist with sources and dates.

Foundations refresher: {{f:gis|GIS and parcel maps}}.` },
{ id: 'co-value', title: 'Lien amount versus land value', body: `
Because you have a three-year wait and then an auction, the **value of the land compared with the total owed** decides whether the deed path is attractive.

- **Lien and premium far below the land value**: heavy competition drives premiums up. You may pay a high premium for a lien that will almost surely redeem.
- **Lien near the land value**: the deed path barely pays.
- **Lien above the land value**: only interest is available, and the risk is unrecovered principal.

## Boulder's real data
Boulder's published table shows average winning premiums of 5.6% (2025), 6.0% (2024), 7.0% (2023), 7.6% (2022) and 7.5% (2021), with interest rates of 14%, 15%, 15%, 12% and 9% [[boulder]].

= 2025: 14% interest on average premium 5.6%
= A buyer who redeems in 6 months earns 7% on the face and pays 5.6% as premium → about 1.4% net
= The same buyer redeeming in 12 months earns 14% minus 5.6% → 8.4%

>> Colorado returns depend on how long the owner takes to redeem, because the premium is a fixed cost.

?? Using Boulder's table, compute net returns for the 2024 sale at 6 and 12 months.` },
{ id: 'co-title', title: 'Easements, liens and what the auction clears', body: `
Under the new process, the public auction **divests all junior liens**, subject to the redemption rights in article 11.5. Federal redemption rights remain separate [[11.5-114]].

## What to pull
1. Recorded easements and covenants.
2. Junior liens: they can claim part of any overbid at the deed-option auction if they filed a notice in time [[11.5-109]] [[11.5-113]].
3. Whether the parcel has special assessments.

## Colorado-specific
Many Colorado properties sit within metropolitan districts with their own assessments. Check for district liens. [[?How district assessment liens are treated at a deed-option auction should be confirmed with a Colorado attorney.]]

?? Search one county's recorder for recorded easements on a parcel.` }
], quiz: [
  { q: 'Which is part of premium math?', a: ['It is a fixed cost that lowers net return', 'It earns interest', 'It is refunded'], c: 0, why: 'See [[39-11-115]].' },
  { q: 'Does the deed-option auction divest junior liens?', a: ['Yes, subject to the redemption rights in article 11.5', 'No', 'Only for homes'], c: 0, why: 'See [[11.5-114]].' },
  { q: 'Do mineral-only interests give you surface land?', a: ['No', 'Yes', 'Sometimes always'], c: 0, why: 'See [[39-11-150]].' }
]},
{ id: 'm6', title: 'Title and property risks', lessons: [
{ id: 'co-risks', title: 'The main risks of a Colorado certificate', body: `
- **A fixed premium and a long wait.** If the owner redeems quickly, the premium eats your interest [[39-11-115]] [[39-12-103]].
- **The lien may be erroneous.** If a lien is sold where no tax was due, the buyer is repaid [[39-12-111]]. Denver says erroneous sales pay interest at 2 points above the discount rate, no lower than 8% [[denver]].
- **The rate resets yearly.** Rates have swung from 9% to 15% in five years [[boulder]].
- **Bankruptcy** can stay the deed-option auction [[11.5-106]].
- **Federal redemption rights** are separate [[11.5-114]].
- **The post-2024 deed path** means another bidder can win the option instead of you [[11.5-102]] [[11.5-116]].

## What it means
Colorado certificates are better suited to valuable, owner-occupied properties that nearly always redeem than to cheap vacant lots.

?? Write a one-page risk summary for a simulated certificate.` },
{ id: 'co-owners', title: 'Owners, redemption by others and special cases', body: `
Redemption can come from [[39-12-103]]:
- the owner or the owner's agent, assignee or attorney;
- anyone with a **legal or equitable claim**;
- a **holder of a tax sale certificate**, who may redeem later sales.

An **undivided interest** may be redeemed by paying a ratable share [[39-12-103]] [[39-12-113]].

## Legal disability
Special redemption rights exist for owners under a legal disability. [[?39-12-104 was not reviewed in full.]]

## Occupants
A certificate gives you no right to occupy. [[?Colorado eviction steps after a treasurer's deed were not reviewed. Ask a Colorado attorney.]]

?? List who can redeem and why each might.` },
{ id: 'co-pass', title: 'Colorado certificates to pass on', body: `
- **A high premium for a low-quality lot.** The premium is gone whether or not the owner redeems.
- **Mineral-only interests** [[39-11-150]].
- **Parcels with no legal access** (landlocked mountain lots).
- **Properties in metro districts** with heavy assessments.
- **Parcels where the lien exceeds the land value.**
- **Liens bought only for the premium-free chance of a deed.** After 2024, the deed option goes to auction, and you can be outbid [[11.5-102]].

?? Mark ten parcels from a county list B or P, with a reason for each P.` }
], quiz: [
  { q: 'Who may redeem a Colorado certificate?', a: ['Owner or agent, anyone with a claim, or a certificate holder', 'Only the owner', 'Only the county'], c: 0, why: 'See [[39-12-103]].' },
  { q: 'Can bankruptcy stop the deed-option auction?', a: ['Yes, an automatic stay can', 'No', 'Only in Denver'], c: 0, why: 'See [[11.5-106]].' },
  { q: 'Which properties suit Colorado certificates best?', a: ['Valuable owner-occupied properties that tend to redeem', 'Landlocked lots', 'Mineral strips'], c: 0, why: 'Premium plus time risk.' }
]},
{ id: 'm7', title: 'Deal math', lessons: [
{ id: 'co-math', title: 'Interest and premium math, line by line', body: `
Interest runs at the **certificate rate from the sale date**, with portions of months counted as whole months [[39-12-103]]. Denver says the rate for 2026 sales is 13%, or 1.08333% per month [[denver]].

## Example A (simulated): redeemed in month 10
= Face value $2,000 + fees $15 + premium $100 → you pay $2,115
= Interest on $2,000 face: 2,000 × 1.0833% × 10 = $216.67
= Redemption pays you: 2,000 + 216.67 + fees (returned with interest, example $15.16) = about $2,231.83
= Net profit: 2,231.83 − 2,115 = $116.83 → 5.5% on $2,115 · annualized about 6.6%

## Example B: redeemed in month 2
= Interest: 2,000 × 1.0833% × 2 = $43.33
= Net profit: 2,043.33 + about 15.03 − 2,115 = −$56.64 (a loss)

## Example C: month 36
= Interest: 2,000 × 1.0833% × 36 = $780.00
= Net profit: about $680 → 32% over 3 years · annualized about 10.7%

>> The break-even month for a $100 premium on $2,000 is about month 5. Faster redemptions lose money.

?? Compute the break-even month if the premium were $250.

Foundations refresher: {{f:math|Return math}}.` },
{ id: 'co-costs', title: 'When premiums and fees erase the profit', body: `
${SIM}

## Scenario: many small liens
= 15 liens × $150 face · premium $15 each · fees $15 each
= Cash in: 15 × 180 = $2,700
= Redeemed after 4 months: interest on $150 at 13% = 150 × 1.0833% × 4 = $6.50 each → $97.50
= Net: 97.50 − premiums 225 − (fees returned about $15 × 15 = $225 back) → about −$127

## Scenario: the deed path
= $5,000 lien at 13% held 3 years: interest about $1,950
= Application, deposit, notices and title costs: example $3,500 [[11.5-102]] [[11.5-117]]
= If you are outbid at the deed-option auction, you may redeem your lien [[11.5-111]] and be repaid your amount with interest
= If you win the option and get the deed, you hold land with costs above its value if it is low-value

!! Premiums punish fast redemptions and small liens.

?? Find the premium at which a 12-month redemption breaks even on a $1,500 lien.` },
{ id: 'co-maxbid', title: 'Setting your maximum premium', body: `
You cannot bid the rate, so your decision is **how much premium to accept**.

## A working method
1. Estimate the **likely redemption time** from the property type: owner-occupied homes usually redeem in months.
2. Compute net interest at 6, 12 and 36 months at the current formula rate [[39-12-103]].
3. Subtract fixed fees you do not recover.
4. Set your **maximum premium** at about half your 12-month interest, never above your break-even.

## Worked example (simulated)
= Face $4,000 at 13% → 12-month interest $520 · 6-month interest $260
= Maximum premium: about $200 (it still earns at 12 months, loses at 3 months)

## Discipline
Write the number first. In online sales, enter it as a limit.

?? Set a maximum premium for a $6,000 face at 13%.` }
], quiz: [
  { q: 'On $2,000 face at 13%, interest for 12 months is:', a: ['$260', '$26', '$2,600'], c: 0, why: 'See [[39-12-103]].' },
  { q: 'A fast redemption and a big premium usually mean:', a: ['A loss', 'A big gain', 'A refund'], c: 0, why: 'The premium is not refunded [[39-11-115]].' },
  { q: 'Is interest paid on the premium?', a: ['No', 'Yes', 'Half'], c: 0, why: 'Interest runs on the lien amount [[39-12-103]].' }
]},
{ id: 'm8', title: 'Redemption', lessons: [
{ id: 'co-who', title: 'Who can redeem and what they pay', body: `
Anyone with a legal or equitable claim, the owner or the owner's agent, or a certificate holder can redeem [[39-12-103]]. Redemption may be made **at any time before the execution of a treasurer's deed** (and, under the new process, in the steps described in article 11.5) by paying the treasurer [[39-12-103]] [[11.5-111]]:
- the taxes, delinquent interest and costs for which the lien sold, with redemption interest from the sale date;
- later taxes paid by the purchaser and endorsed on the certificate, with interest;
- statutory fees the purchaser paid, with the same interest.

Portions of months count as whole months [[39-12-103]].

## Your payment
Upon redemption, Denver says it notifies the buyer to return the certificate for payment of the face value plus accrued interest [[denver]]. The treasurer pays redemption money to the person entitled on request [[39-12-103]].

?? List what you would be paid in a redemption in month 14 of a simulated certificate.` },
{ id: 'co-deed-option', title: 'The deed-option auction, step by step', body: `
## Applying
At least **three years** after the sale, a lawful holder files an **application for a public auction of a certificate of option for treasurer's deed** and may be required to deposit costs [[11.5-102]]. Denver asks buyers to return certificates and deposit expense money [[denver]].

## Notices
The treasurer mails notice to the property, creates a mailing list and posts and publishes notice of the auction, 45 to 60 days before it and for three weeks [[11.5-104]]. The auction is held **110 to 125 days** after first publication [[11.5-105]].

## Auction rules
Bids must exceed the amount owed to the lawful holder plus the treasurer's costs, and bids by officials, employees and their immediate families are not accepted [[11.5-108]]. Payment forms include cash, cashier's check, bank check or electronic transfer [[11.5-108]].

## After the auction
- Within **eight business days**, the lawful holder may file a **notice of intent to redeem** their lien from the winning bidder, with the certificate and a statement of the amount [[11.5-111]].
- The treasurer issues a certificate of redemption [[11.5-112]].
- **Overbids** (above what is owed) are paid first to junior lienors who filed in time, then to the property owner [[11.5-109]].

?? Draw a timeline from application to auction using these day counts.` },
{ id: 'co-verify', title: 'Verifying a redemption and your payout', body: `
1. **The certificate of redemption**, issued and recorded by the treasurer [[39-12-105]] [[11.5-112]].
2. **The amount**: compare it with the formula, including per-month interest and any later taxes [[39-12-103]].
3. **Return your certificate** to be paid, or confirm a check was mailed if the county holds it [[denver]].
4. **Record it** in {{t:portfolio|My portfolio}} with the source and date.

!! A lien that disappears from a list is not proof of redemption. Ask the treasurer.

?? Write the steps if a payout does not match your math.` }
], quiz: [
  { q: 'When does the lien holder get to redeem after a deed-option auction?', a: ['By filing a notice of intent within eight business days', 'Never', 'After a year'], c: 0, why: 'See [[11.5-111]].' },
  { q: 'Where do overbids go first?', a: ['Junior lienors who filed in time, then the owner', 'The county only', 'The winner'], c: 0, why: 'See [[11.5-109]].' },
  { q: 'How soon can a lien holder apply for the deed-option auction?', a: ['At least three years after the sale', 'Immediately', 'After 15 years'], c: 0, why: 'See [[11.5-102]].' }
]},
{ id: 'm9', title: 'After you win', lessons: [
{ id: 'co-after', title: 'From the auction to the deed option', body: `
1. **Pay** by the deadline and receive the certificate [[39-11-117]].
2. **Record** it in {{t:portfolio|My portfolio}}.
3. **Pay subsequent taxes** when allowed [[39-11-119]].
4. **At three years**, decide whether to apply for the deed-option auction [[11.5-102]].
5. **File** the application and deposit costs [[11.5-102]] [[11.5-117]].
6. **Watch the notices** and the auction date [[11.5-104]] [[11.5-105]].
7. **At the auction**, expect other bidders. You may redeem your lien if you are outbid [[11.5-111]].
8. **If you win the option**, request the deed [[11.5-116]].

?? Turn the steps into dated tasks for a simulated November 2026 sale.` },
{ id: 'co-outcomes', title: 'The possible endings', body: `
- **Redeemed** (most common): you receive the amount plus interest [[39-12-103]].
- **Outbid at the deed-option auction**: you redeem your lien from the winning bidder, and are repaid [[11.5-111]].
- **You win the option**: you may demand the treasurer's deed, after paying the amounts due [[11.5-116]] [[11.5-115]].
- **Overbid paid out** to junior lienors and the owner [[11.5-109]].
- **Stayed by bankruptcy**: the auction is delayed [[11.5-106]].

?? Rank these outcomes by how much control you have.` }
], quiz: [
  { q: 'If you are outbid at the deed-option auction:', a: ['You may redeem your lien from the winning bidder', 'You lose everything', 'You get the premium back'], c: 0, why: 'See [[11.5-111]].' },
  { q: 'Who can ask for the deed after winning the option?', a: ['The purchaser or lawful holder of the certificate of option', 'The old owner', 'The assessor'], c: 0, why: 'See [[11.5-116]].' },
  { q: 'Is the post-2024 deed path the same as the old one?', a: ['No, it uses a public auction of the option', 'Yes', 'It was repealed'], c: 0, why: 'See [[39-11-153]].' }
]},
{ id: 'm10', title: 'Local differences inside Colorado', lessons: [
{ id: 'co-local', title: 'Comparing Denver and Boulder', body: `
Colorado's 64 counties each run their own sale. Two counties, from their own pages (checked ${CK}):

## Denver
- **Online**. Bidding from October 12, 2026 at 8:00 a.m. to November 4 at 12:00 p.m. on its auction website [[denver]].
- **Buyers** register and deposit funds by EFT in advance [[denver]].
- **Fees**: $5 certificate, $10 auction, plus advertising and the premium. $1 increments. Ties by random selection [[denver]].
- **Rate**: 13% for 2026 sales (1.08333% a month). The certificate is valid for 15 years [[denver]].
- **Deed path**: buyers return certificates and deposit expense money for the deed-option auction [[denver]].

## Boulder County
- **In person**, November 13, 2026. Registration at 7:30 a.m., sale at 8:30 a.m. A list of advertised properties is updated each Friday [[boulder]].
- It publishes a prior-years table with premiums and rates [[boulder]].

## Compare each year
Online versus in person, deposit and registration, fees, increments, tie rules, how county-held certificates are sold.

?? Fill in the same table for a third Colorado county.` },
{ id: 'co-offices', title: 'Which office for what', body: `
- **"Is this lien in the sale?"** → county treasurer [[39-11-101]].
- **"What rate applies?"** → the treasurer, from the bank commissioner's formula [[39-12-103]].
- **"Redemption and payout."** → treasurer [[39-12-103]].
- **"Deed-option auction."** → treasurer [[11.5-102]].
- **"Recorded documents."** → clerk and recorder.
- **"Value and map."** → assessor.
- **"Zoning."** → county planning office.

?? Build a contact sheet for one county.` }
], quiz: [
  { q: 'Which county ran a 2026 online auction from October 12 to November 4?', a: ['Denver', 'Boulder', 'Neither'], c: 0, why: 'See [[denver]].' },
  { q: 'Which county holds the 2026 sale in person with 7:30 registration?', a: ['Boulder', 'Denver', 'Both'], c: 0, why: 'See [[boulder]].' },
  { q: 'What do all counties follow?', a: ['The C.R.S. process', 'Federal rules', 'No rules'], c: 0, why: 'See [[39-11-115]].' }
]},
{ id: 'm11', title: 'Case studies', lessons: [
{ id: 'co-case-win', title: 'Case 1 (simulated): a certificate that paid', body: `
${SIM}

An owner-occupied home with a county value of $420,000 owes $3,100. The simulated investor wins at a $90 premium.

## Math
= Face $3,100 + fees $15 + premium $90 = $3,205
= Owner redeems after 14 months at 13%: 3,100 × 1.0833% × 14 = $470.17
= Received: 3,100 + 470.17 + about $15 fees = $3,585.17
= Net profit: $380 → 11.9% on $3,205 · annualized about 10.2%

## Why it worked
A valuable home, a modest premium and a redemption well past the break-even month.` },
{ id: 'co-case-pass', title: 'Case 2 (simulated): paying a high premium for a poor lot', body: `
${SIM}

A mountain lot: face $1,800, land value $6,000, mapped wetlands on part and an easement-only access road. Competition pushes the premium to $400.

## The check
- Cash in: $1,800 + $400 + fees ≈ $2,215.
- Interest at 13% for 12 months: $234.
- Net after 12 months: about −$166.
- The deed path: three years, an application and costs, ending in land worth $6,000 with access doubts [[11.5-102]].

## Decision: Pass
The premium exceeds the likely interest, and the deed path ends in land with problems.` },
{ id: 'co-case-unknown', title: 'Case 3 (simulated): when missing information blocks a decision', body: `
${SIM}

A listing shows a $2,500 face on a 35-acre parcel with a county value of $90,000. The description says "NE 1/4 of the NE 1/4 except the road."

## What is missing
1. Is there recorded access, or only the road?
2. Is it a metropolitan district with assessments?
3. Does the county planning office allow building?

## Decision: need more information
Without access and district facts, you cannot value the land or choose a premium. Ask the assessor and the planning office.` }
], quiz: [
  { q: 'Why did Case 1 work?', a: ['A valuable home, a modest premium, and a redemption well past break-even', 'The rate was 18%', 'Luck'], c: 0, why: 'Premiums punish fast redemptions.' },
  { q: 'Why pass in Case 2?', a: ['The premium exceeds the likely interest and the deed path ends in a poor lot', 'The rate was too high', 'The county said no'], c: 0, why: 'See [[39-11-115]].' },
  { q: 'These cases are:', a: ['All simulated', 'All real', 'Real except Case 2'], c: 0, why: 'We have no verified Colorado listings.' }
]},
{ id: 'm12', title: 'Final project', lessons: [
{ id: 'co-project', title: 'Final project: research a Colorado lien and decide', body: `
## Your assignment
Choose a parcel from a current Colorado county tax lien list and write a one-page memo:
1. **The listing**: county, parcel or schedule number, description, face value, sale date, list source and date checked.
2. **Verification**: parcel on the county map, acres, nearest road.
3. **Land risks**: flood, wetlands, access, zoning and water, with sources and dates.
4. **Title risks**: easements, special districts, junior liens, bankruptcy.
5. **Math**: interest at 6, 12 and 36 months at this year's rate [[39-12-103]], fixed fees, the maximum premium you would pay and the deed-option path [[11.5-102]].
6. **Decision**: Bid (with a maximum premium), Pass or need more information.

## Worked answer (simulated)
${SIM}
1. Example County, schedule R000123, face $2,600, sale in November, list checked today.
2. 0.25 acre; paved street frontage.
3. FEMA Zone X; no mapped wetlands; zoned residential; city water and sewer.
4. No easements beyond utilities; no district assessments; no junior liens found.
5. At 13%: 6 months $169, 12 months $338, 36 months $1,014. Fees $15. Maximum premium about $150.
6. **Bid up to a $150 premium.**

## Grading rubric (100 points)
- Listing copied exactly with source and date: **15**
- Parcel verified on the map: **15**
- Land risks with sources, unknowns marked: **20**
- Title risks and special districts: **15**
- Math shown line by line, with the premium: **20**
- Decision that follows from the evidence: **15**

80 or more passes. An invented fact presented as real caps the score at 60.` }
], quiz: [
  { q: 'What caps the score at 60?', a: ['An invented fact presented as real', 'A late memo', 'Choosing Pass'], c: 0, why: 'Every number needs a source.' },
  { q: 'Your math must include:', a: ['The maximum premium you would pay', 'Only the rate', 'A guess'], c: 0, why: 'The premium is a fixed, unrefunded cost.' },
  { q: 'Which answers may the memo end with?', a: ['Bid, Pass or need more information', 'Only Bid', 'Only Pass'], c: 0, why: 'Honest gaps are part of the grade.' }
]}
];

const exercise = {
  title: 'Bid or Pass: a simulated Colorado lien',
  simulated: true,
  label: '**SIMULATED.** PricePocketAsset has no verified Colorado listing yet, so this exercise uses made-up facts. No real certificate, purchase or payout is described.',
  lien: null,
  calc: { amount: 4000, rate: 13, months: 12, fees: 215, from: 'Simulated Colorado lien: $4,000 face + $200 premium + fees at 13%' },
  facts: [
    ['Face value', '$4,000 (simulated)'],
    ['Interest rate', '13% for liens sold in 2026 (the real 2026 rate per Denver; the lien itself is simulated) [[denver]]'],
    ['Fees', '$5 certificate + $10 auction (Denver’s 2026 fees) [[denver]]'],
    ['Property', 'Owner-occupied townhome, county value $310,000 (simulated)'],
    ['Premium bids so far', '$150, $220, $300 (simulated)'],
    ['Flood / wetlands', 'Zone X · none mapped (simulated)']
  ],
  brief: `
Decide your **maximum premium**, then Bid or Pass, and explain. Interest runs on the face value at 13% [[39-12-103]], and the premium is not refunded [[39-11-115]]. Think about how fast the owner is likely to redeem.`,
  walkthrough: `
${SIM}

## 1. Break-even by month
Monthly interest on $4,000 at 13% = 4,000 × 1.0833% = $43.33.
= Premium $200 → break-even after about 5 months
= Premium $300 → break-even after about 7 months

## 2. Likely timing
An owner-occupied townhome worth $310,000 usually redeems quickly. Owners often pay within months of the sale.

## 3. A reasonable answer
**Pass at $300, or bid only up to about $150–$200.** At those premiums you need redemption after month 4 to 5 to earn anything. Strong answers mention that the premium is a fixed unrefunded cost, that fast redemption is likely on a valuable home, and that the 13% rate is the same for every bidder [[39-12-103]].`
};

export default {
  id: 'co', state: 'CO', title: 'Colorado Tax Sales: The Complete Course', status: 'published', checked: CK,
  review: 'Batch 1. Rules cited to the Colorado Revised Statutes, 2024 edition (uncertified printout from leg.colorado.gov), including article 11.5 (the post-July 1, 2024 deed-option auction). Later amendments were not checked. County procedures come from the Denver and Boulder treasurer pages, checked ' + CK + '. Items marked "Needs review" were not verified. Case studies and the exercise are simulated because we have no verified Colorado listing or outcome records. No outside legal review yet.',
  intro: 'How Colorado sells tax liens by premium bid at a formula interest rate, how redemption works, how the 2024 deed-option auction changed the path to a deed, how to research a parcel, the math and the risks. Every rule cited to the statute.',
  sources, modules, exercise,
  glossary: [
    ['Tax lien sale', 'The yearly public auction of liens on delinquent parcels.'],
    ['Premium', 'The amount bid above the taxes, interest and fees. It goes to the county and is not refunded.'],
    ['Redemption interest rate', '9 points over the Fed discount rate (Kansas City), rounded, set each September 1.'],
    ['Certificate of purchase', 'The record of the lien purchase, with the rate and amounts.'],
    ['Struck off', 'A lien nobody bought, issued to the county.'],
    ['Subsequent taxes', 'Later years’ taxes the holder pays and endorses on the certificate.'],
    ['Lawful holder', 'The person holding the certificate of purchase (or an assignee or attorney).'],
    ['Certificate of option for treasurer’s deed', 'What the deed-option auction sells. It lets the holder demand a treasurer’s deed.'],
    ['Overbid', 'At the deed-option auction, the amount above what is owed. It goes to junior lienors, then the owner.'],
    ['Junior lien', 'A lien subordinate to the tax lien.'],
    ['Severed mineral interest', 'Mineral rights owned apart from the surface. Their liens are sold in the same sale.'],
    ['Metropolitan district', 'A special district that can levy its own assessments on property.']
  ],
  links: [
    ['Colorado Revised Statutes, Title 39 (2024 edition PDF)', PDF, 'statute'],
    ['Denver Treasury: Tax Lien Sale', 'https://www.denvergov.org/Government/Departments/Department-of-Finance/Our-Divisions/Treasury/Property-Taxes/Real-Estate-Delinquent-Taxes-and-Tax-Lien-Sale', 'county'],
    ['Boulder County Treasurer: Tax Lien Sale', 'https://bouldercounty.gov/property-and-land/treasurer/taxes/tax-lien-sale/', 'county'],
    ['Our Colorado page', '/liens/states/state/?s=CO', 'site'],
    ['FEMA Flood Map Service Center', 'https://msc.fema.gov/portal/search', 'federal']
  ],
  checklists: {
    research: ['Parcel or schedule number copied exactly', 'Found on the county map; acres and shape checked', 'Face value versus land value', 'Flood with source and date', 'Wetlands with source and date', 'Legal access to a public road', 'Zoning from the county or city', 'Metropolitan district assessments', 'Easements and junior liens', 'Mineral-only or combined parcel check', 'Confirm the lien is still in the sale'],
    bid: ['Registered, deposit funded, name spelled correctly', 'Funds ready for the payment deadline', 'This year’s rate looked up', 'Net return worked out at 3, 6, 12 and 36 months', 'Maximum premium written before the sale', 'Plan for the deed-option auction at 3 years', 'Everything logged in My portfolio']
  }
};
