// Iowa: annual tax sale of parcels for the total amount due; bidders compete on the smallest percentage of the parcel;
// 2% a month on redemption; notice of expiration and a 90-day redemption window; treasurer's deed. Batch 1.
const CK = '2026-11-11', ED = 'Iowa Code 2026 (legis.iowa.gov PDF, printed 2025-12-09)';
const S = (short, name, url, checked = CK, effective = ED) => ({ short, name, url, checked, effective });
const ic = sec => S('Iowa Code ' + sec, 'Iowa Code § ' + sec, 'https://www.legis.iowa.gov/docs/code/' + sec + '.pdf');
const sources = {
  '446.7': ic('446.7'), '446.9': ic('446.9'), '446.15': ic('446.15'), '446.16': ic('446.16'), '446.17': ic('446.17'), '446.18': ic('446.18'), '446.19': ic('446.19'),
  '446.23': ic('446.23'), '446.25': ic('446.25'), '446.29': ic('446.29'), '446.31': ic('446.31'), '446.32': ic('446.32'), '446.37': ic('446.37'),
  '447.1': ic('447.1'), '447.7': ic('447.7'), '447.8': ic('447.8'), '447.9': ic('447.9'), '447.10': ic('447.10'), '448.8': ic('448.8'), '447.12': ic('447.12'), '447.13': ic('447.13'),
  '448.1': ic('448.1'), '448.3': ic('448.3'), '448.6': ic('448.6'), '448.10': ic('448.10'), '448.11': ic('448.11'),
  scott: S('Scott Co.', 'Scott County Treasurer: 2026 Annual Tax Sale', 'https://www.scottcountyiowa.gov/treasurer/post/2026/06/15/2026-annual-tax-sale', CK, '2026 sale'),
  woodbury: S('Woodbury Co.', 'Woodbury County Treasurer: Tax Sale', 'https://www.woodburycountyiowa.gov/treasurer/tax_sale/', CK, '2026 sale'),
  fema: S('FEMA', 'FEMA National Flood Hazard Layer', 'https://msc.fema.gov/portal/search', CK, ''),
  nwi: S('NWI', 'U.S. Fish and Wildlife Service National Wetlands Inventory', 'https://www.fws.gov/program/national-wetlands-inventory/wetlands-mapper', CK, '')
};
const SIM = '!! SIMULATED. Every number below is made up to teach the method. No real parcel, purchase or payout is described.';

const modules = [
{ id: 'm1', title: 'How Iowa’s tax sale works', free: true, lessons: [
{ id: 'ia-what', title: 'What Iowa sells: a certificate with a fixed 24% clock', body: `
Iowa holds one **annual tax sale** each June. The treasurer offers each delinquent parcel, one at a time, **for the total amount due** (taxes, interest, fees and costs) [[446.7]] [[446.15]]. The winner receives a **certificate of purchase** [[446.29]] and earns **2% a month** on redemption [[447.1]].

## The twist: bidding is not about the rate
In most lien states, bidders compete on interest. Iowa's interest is fixed. Bidders compete on **the smallest percentage of the parcel** they will accept if a deed is ever issued. The minimum bid is 1% [[446.16]]. That percentage **is not a discount and not a yield**. It is the share of the land you would own if the owner never redeems [[446.16]].

## Who does what
- **County treasurer**: advertises, runs the sale, issues certificates, takes redemptions, accepts subsequent taxes and executes the deed [[446.7]] [[446.29]] [[447.1]] [[448.1]].
- **Certificate holder**: serves the notice of expiration of the right of redemption and requests the deed [[447.9]] [[448.1]].
- **District court**: hears equitable actions to challenge a deed or to redeem after a deed [[447.8]] [[448.6]].

>> Most Iowa certificates are redeemed. The 24% a year simple rate is where the money is made. The percentage you bid only matters if nobody redeems.

?? Open {{u:/liens/states/state/?s=IA|our Iowa page}} and find where the third-Monday-in-June sale is described. Write down the next sale date.

Foundations refresher: {{f:basics|What tax liens and tax deeds are}}.` },
{ id: 'ia-calendar', title: 'The Iowa calendar from delinquency to deed', body: `
- **By May 1**: the treasurer mails notice of the sale to the person the parcel is taxed to [[446.9]].
- **One to three weeks before the sale**: the treasurer publishes the date, time and place in an official county newspaper, with the amounts [[446.9]].
- **Third Monday in June**: the annual sale, unless the treasurer picks another June date for good cause [[446.7]]. The sale continues day to day while there are bidders [[446.17]].
- **Adjourned sales**: leftover parcels can be offered again at intervals of no more than two months, until the next annual sale [[446.25]].
- **1 year and 9 months after the sale**: the holder may serve a notice of expiration of the right of redemption [[447.9]].
- **90 days after service is complete**: the right of redemption ends [[447.12]].
- **Within 90 days after that**: the holder must return the certificate and pay the deed and recording fees, or the treasurer cancels the certificate [[448.1]].
- **3 years after the sale**: if no affidavit of service has been filed, the treasurer cancels the sale [[446.37]].

## Worked timeline (simulated)
= Sale: June 21, 2027 · interest starts in the month of sale (June) [[447.1]]
= Earliest notice of expiration: March 2029 (1 year 9 months)
= Redemption ends: 90 days after notice service completes
= Hard stop: June 2030 (3 years) unless an affidavit of service is filed [[446.37]]

?? Using a June 21, 2027 sale date, write the earliest notice date and the 3-year cancellation date.` },
{ id: 'ia-ends', title: 'The three ways an Iowa certificate ends', body: `
## 1. Redemption (the usual ending)
The owner (or another person entitled) pays the amount for which the parcel sold, the certificate fee and **2% a month**, plus later taxes you paid with the same interest, plus certain costs [[447.1]] [[447.13]].

## 2. Treasurer's deed
After the notice period and the 90-day window run out without redemption, the treasurer makes a deed when you return the certificate and pay the fees [[448.1]]. The deed gives you the percentage of the parcel that you bid [[446.16]].

## 3. Cancellation
If you do nothing for 3 years after the sale and never file the affidavit of service, the treasurer cancels the sale [[446.37]]. If you miss the 90-day deed window after the redemption period, the certificate is also canceled [[448.1]].

?? For each ending, write who pays you and when.` }
], quiz: [
  { q: 'What do Iowa bidders compete on?', a: ['The lowest interest rate', 'The smallest percentage of the parcel', 'The highest price'], c: 1, why: 'See [[446.16]].' },
  { q: 'Interest on an Iowa certificate is:', a: ['Fixed at 2% a month, counting part of a month as a full month', 'Whatever you bid', '5% a year'], c: 0, why: 'See [[447.1]].' },
  { q: 'When is the annual sale?', a: ['April 1', 'Third Monday in June (unless a different June date is set for good cause)', 'December'], c: 1, why: 'See [[446.7]].' }
]},
{ id: 'm2', title: 'Finding notices, lists and results', lessons: [
{ id: 'ia-notices', title: 'Where Iowa sale notices and lists appear', body: `
## Required notices
- **Mail** to the person the parcel is taxed to, by May 1 [[446.9]].
- **Newspaper** publication in an official county newspaper, one to three weeks before the sale [[446.9]].
- Both must show a clear description, the amount delinquent for each year, interest and fees as a single sum, and the statement that the right to redeem expires and a deed may issue [[446.9]].

## Where to look
1. **The county treasurer's tax sale page.** Woodbury County explains that its sale is online on the third Monday of June, that delinquent parcels are advertised around June 1 and posted online, and that the official parcel list is on GovEase [[woodbury]]. Scott County publishes the date, place and registration deadline [[scott]].
2. **Public bidder and adjourned lists.** Woodbury posts separate lists for each [[woodbury]].
3. **The Iowa Treasurers' site** for county contacts. Our Iowa page links it.

## You do the research
Woodbury's page says plainly: the investor is responsible for all research on parcels [[woodbury]].

?? Open one county treasurer's page and write down (1) the sale date, (2) the registration deadline and (3) where the official list lives.` },
{ id: 'ia-columns', title: 'Reading an Iowa sale list', body: `
Lists are built from what the statute requires in the notice [[446.9]]:
- **Parcel (and description)**: clear and concise enough to tell it from every other parcel [[446.9]]. Descriptions may differ from the one in the deed.
- **Taxed to**: the person the parcel is taxed to. Owners' names appear on notices but we do not copy them into our site.
- **Amount**: the single sum of delinquent taxes for each year, interest, fees and the service fee [[446.9]]. This is what you pay if you win.
- **Marks**: items offered under the public bidder provision may be marked with an "s" or an asterisk [[446.9]].

## What the amount contains
Taxes, interest, fees and costs [[446.7]]. Your certificate fee is added to the redemption amount [[447.1]].

## A quick reading (simulated row)
= Parcel 0123-45-678 · Lot 4, Block 9, Example Addn · taxed to J. Doe
= Taxes for 2024 and 2025 plus interest, fees and service fee: $2,415.00
= Offered separately for $2,415.00 [[446.15]]

?? Pick a county list and label each column using the above.` },
{ id: 'ia-ids', title: 'Iowa parcel numbers and what to match', body: `
Iowa counties use their own parcel ID formats. Many counties publish GIS maps and assessor records online.

## A routine
1. Copy the parcel ID exactly.
2. Find the parcel on the county assessor or GIS map. Compare size and shape with the description.
3. Beware "partial parcels" or descriptions that include only a part of a lot.
4. Remember what you buy: **the percentage you bid, of the parcel described** [[446.16]].

## Why partial interests matter
If you win at 1%, a deed would give you an undivided 1% of the parcel. That is a very small interest in land. Think about it before bidding low.

?? Pick one parcel from a county list and find it on the county map. Write the acres and the nearest road.

Foundations refresher: {{f:parcels|Parcel IDs}}.` }
], quiz: [
  { q: 'When must the treasurer mail the sale notice?', a: ['By May 1', 'The week of the sale', 'After the sale'], c: 0, why: 'See [[446.9]].' },
  { q: 'Woodbury County says who is responsible for researching parcels?', a: ['The county', 'The investor', 'The assessor'], c: 1, why: 'See [[woodbury]].' },
  { q: 'What does a 1% winning bid mean if a deed issues?', a: ['A 1% return', 'An undivided 1% interest in the parcel', 'A 1% discount'], c: 1, why: 'See [[446.16]].' }
]},
{ id: 'm3', title: 'Registering, bidding and paying', lessons: [
{ id: 'ia-register', title: 'Who may bid and how registration works', body: `
## Eligibility
Only persons as defined in Iowa Code 4.1 can register to bid, bid or own a certificate. A person other than an individual must have a **federal tax identification number** and either a **designation of agent for service of process** on file with the secretary of state or a verified statement filed with the county recorder [[446.16]].

## Fees
The treasurer may charge a **reasonable registration fee**. The total fees cannot exceed the total costs of the tax sale [[446.16]].

## What counties require
- **Scott County (2026)**: in-person sale at 8:30 a.m. on June 15 in the Board Room, Davenport. Investors had to **pre-register before June 8** [[scott]].
- **Woodbury County (2026)**: online sale from 9:00 to 10:30 a.m. on June 15. Registration ran from May 18 to June 10, and the listing is on GovEase [[woodbury]].

[[?Deposit amounts, forms and any buyer fees are in each county's terms and conditions. Read the current ones.]]

?? Create a calendar for a June sale: when registration opens, when it closes, and when you will finish research.` },
{ id: 'ia-bidding', title: 'Bidding the percentage, ties and what you are really bidding on', body: `
## The rule
The person who offers to pay the total amount due **for the smallest percentage of the parcel** is the purchaser. The percentage cannot be less than 1% [[446.16]]. Ties at the lowest percentage are settled by **random selection** [[446.16]].

## Example (simulated)
= Parcel total due: $3,000.00 · bids: 100%, 60%, 25%, 25%
= The two 25% bidders tie → random selection picks one [[446.16]]
= Both bidders would pay $3,000.00 either way

## What this does to your strategy
- Your **interest is the same** no matter what percentage you win with: 2% a month [[447.1]].
- A **lower percentage means a smaller stake** if a deed ever issues.
- A **100% bid** wins nothing against a competitor bidding lower. Bidding 100% only makes sense where nobody else is bidding.

## Parcels nobody bids on
If the parcel is offered under the public bidder provision and there is no bid, the **county bids the total amount due** and holds the certificate [[446.19]].

?? Imagine competitors bidding 100%, 40%, 10% and 1%. At which percentage would you stop, and why?` },
{ id: 'ia-pay', title: 'Paying and what happens if you do not', body: `
## Payment
The purchaser must **immediately pay** the county treasurer the total amount bid. Funds receivable in payment of taxes are accepted [[446.23]]. If you do not pay, the parcel is **offered again** as if no sale had been made [[446.23]].

## Certificate fee
The treasurer prepares the certificate of purchase, describing the parcel, the total amount due and that payment has been made. Only one parcel per certificate. The certificate fee is set under section 331.552 [[446.29]].

## Records
The delinquent tax lien transfers with the certificate and expires when the certificate expires [[446.29]] [[446.16]].

!! "Immediately" means have funds ready. Ask the county what forms of payment it accepts on sale day. [[?Accepted payment forms differ. Read the terms and conditions.]]

?? Build a payment plan: how much you can spend, and how you will pay on the day.` }
], quiz: [
  { q: 'Ties at the smallest percentage are settled by:', a: ['First bid received', 'Random selection', 'Highest registration number'], c: 1, why: 'See [[446.16]].' },
  { q: 'If a winner does not pay, the parcel is:', a: ['Forgiven', 'Offered again as if no sale had been made', 'Sold to the second bidder'], c: 1, why: 'See [[446.23]].' },
  { q: 'What does the county do if nobody bids on a public bidder parcel?', a: ['Cancels the taxes', 'Bids the total amount due and holds the certificate', 'Sells it at half price'], c: 1, why: 'See [[446.19]].' }
]},
{ id: 'm4', title: 'Public bidder, adjourned and county-held certificates', lessons: [
{ id: 'ia-public', title: 'Public bidder sales and adjourned sales', body: `
## Adjourned sales
When all advertised parcels have been offered and some remain unsold for lack of bidders, the treasurer adjourns the sale for no more than two months, then repeats, until the next regular sale or until all parcels are sold [[446.25]]. Woodbury calls these parcels ones where no investor paid the taxes at the last sale [[woodbury]].

## Public bidder sales
On the day of the regular sale, the treasurer offers parcels that **have been advertised and offered for one year or more** and remain unsold [[446.18]]. If no bid, or less than the total, the county bids the total and holds the certificate [[446.19]]. Woodbury's page describes public bidder parcels as ones advertised two years, with the county holding the certificate, and directs inquiries to the Board of Supervisors [[woodbury]].

## What changes for you
- These parcels have gone unsold. The reasons usually appear in your research.
- A **shorter redemption timeline** applies after a public bidder sale: notice can be served after **9 months**, not 1 year 9 months [[447.9]].

?? Find a county's public bidder and adjourned lists. Compare the amounts with the assessed values.` },
{ id: 'ia-county-held', title: 'Buying county-held certificates by assignment', body: `
When a county holds a certificate, it may **assign** it for the total amount due as of the assignment date, or compromise the amount and assign it, **by written agreement** filed with the treasurer [[446.31]]. The assignee pays an assignment fee of **$10** on county-held certificates (versus $100 on certificates held by individuals; $10 for estates) [[446.31]].

## The clock after assignment
After assignment of a county-held certificate, the sale is canceled **3 years from the date the assignment is recorded** unless an affidavit of service has been filed [[446.31]] [[446.37]].

## What to ask the county
1. Which certificates does the county hold, and at what total?
2. Will it compromise the amount?
3. Who must approve (treasurer, supervisors)?

!! County-held means nobody wanted it at sale. Research it twice.

?? Write three questions you would ask a county treasurer about one county-held certificate.` },
{ id: 'ia-subsequent', title: 'Paying subsequent taxes', body: `
The purchaser may pay taxes for a **subsequent year** beginning **one month and fourteen days** after an installment becomes delinquent. The treasurer gives a receipt [[446.32]]. A payment must be recorded by **5:00 p.m. on the last business day of the month** for that month's interest to accrue, unless the treasurer sets a different deadline [[446.32]]. The postmark never counts [[446.32]].

## Why pay
Subsequent taxes earn **the same 2% a month** from the month of payment, and the owner must repay them to redeem [[447.1]]. Paying protects the property from a second tax sale.

## Worked example (simulated)
= Original certificate $3,000, sale in June 2027
= Subsequent-year taxes of $1,200 paid in October 2028
= Redemption in June 2029: original interest from June 2027 (25 months counting the month of sale and the month of redemption as whole months) · subsequent interest from October 2028 (9 months)
= Interest on original: 3,000 × 2% × 25 = $1,500.00
= Interest on subsequent: 1,200 × 2% × 9 = $216.00

?? Recompute the example if the redemption happens in August 2029 instead. Count months carefully.` }
], quiz: [
  { q: 'What is the assignment fee on a county-held certificate?', a: ['$10', '$100', 'None'], c: 0, why: 'See [[446.31]].' },
  { q: 'When may subsequent taxes be paid?', a: ['Anytime', 'Beginning one month and 14 days after an installment becomes delinquent', 'Only in June'], c: 1, why: 'See [[446.32]].' },
  { q: 'Subsequent taxes earn:', a: ['The same 2% a month from the month of payment', '0%', '5% a year'], c: 0, why: 'See [[447.1]].' }
]},
{ id: 'm5', title: 'Researching the parcel', lessons: [
{ id: 'ia-research', title: 'Researching an Iowa parcel with public maps', body: `
PricePocketAsset has **no Iowa parcel listings yet**, so our cards and the parcel record panel do not cover Iowa. You will use the county's own tools and federal maps. The method matches the Florida and Arizona courses.

## The checklist
1. **County GIS or assessor map**: find the parcel, check shape, acres, buildings and the owner of record.
2. **Aerial**: most county maps have an aerial layer. Look for structures and the nearest road.
3. **Flood**: search the address on the FEMA map [[fema]]. Iowa has many river floodplains.
4. **Wetlands**: the National Wetlands Inventory mapper [[nwi]].
5. **Access**: public road or only a private drive or easement?
6. **Zoning**: county or city zoning office.

## Mark the unknowns
Write "not checked" for anything you could not load. Never write "no overlap" without looking.

?? Pick a parcel on a county list and complete the six steps with sources and dates.

Foundations refresher: {{f:gis|GIS and parcel maps}}.` },
{ id: 'ia-percent', title: 'The percentage you bid and the land you might own', body: `
Because the percentage is your share of the land, treat your bid as a decision about **how much land you want** if the owner never redeems.

## Three cases
- **A parcel you want at 100%.** Few investors will let you bid 100% if competition exists. Expect lower bids.
- **A parcel you would take a small share of.** Bidding 1% means co-owning with the former owner (an undivided interest) [[446.16]].
- **A parcel you do not want at any share.** Do not bid.

## Why it matters
An undivided interest is hard to use or sell. A court action to partition land is a legal matter. [[?How a small undivided interest from a tax deed is handled in Iowa should be confirmed with an Iowa attorney.]]

## A decision rule
Only bid a percentage you could live with owning, not the percentage you guess will win.

?? For a $4,000 lien on land valued at $20,000, what is the value of a 25% interest? What would you want to know before accepting it?` },
{ id: 'ia-title', title: 'Title: what a treasurer’s deed carries with it', body: `
The deed vests the former owner's interest in the purchaser, **subject to restrictive covenants from prior conveyances in the chain of title**, and subject to the rights of a **holder of a certificate from a later tax sale**. It also cancels suspended taxes [[448.3]].

## Notice problems void the deed
If an **owner of record, or the person the parcel is taxed to,** proves they were not properly served with the notice of expiration, the deed is **void**. If another person entitled to notice was not served, the deed stands but is subject to that person's rights [[448.3]].

## Challenging a deed
Only through an **equitable action in district court**, and only by someone who had title at the time of the sale and has paid all amounts due [[448.6]].

## What to pull
1. The chain of title and recorded covenants.
2. Recorded easements and liens.
3. Whether another certificate exists on the parcel.

?? Pick an Iowa county recorder's site and find how to search for recorded covenants on a parcel.` }
], quiz: [
  { q: 'A deed is void if which person was not properly served with notice?', a: ['The owner of record or the person taxed', 'A neighbor', 'The assessor'], c: 0, why: 'See [[448.3]].' },
  { q: 'Do prior restrictive covenants survive an Iowa treasurer’s deed?', a: ['Yes', 'No', 'Only for farms'], c: 0, why: 'See [[448.3]].' },
  { q: 'How can a treasurer’s deed be challenged?', a: ['By equitable action in district court', 'By letter', 'It cannot'], c: 0, why: 'See [[448.6]].' }
]},
{ id: 'm6', title: 'Title and property risks', lessons: [
{ id: 'ia-risks', title: 'The main risks of an Iowa certificate', body: `
- **Notice defects.** If the owner was not properly served, the deed fails [[448.3]]. Use an attorney who serves notices correctly.
- **Time limits.** Miss the 90-day deed window after redemption ends, and the certificate is canceled [[448.1]]. Let 3 years pass without an affidavit of service, and the sale is canceled [[446.37]].
- **Small undivided interests.** A deed gives only the percentage you bid [[446.16]].
- **Wrongful sales.** If a parcel is sold when no tax was due, the county holds the purchaser harmless, and a mistaken sale does not convey title [[448.10]] [[448.11]].
- **Legal disability.** An owner with a legal disability may redeem after a deed by equitable action within one year of the disability being removed [[447.7]].
- **Post-deed redemption claims** exist for people who were not properly served or who acquired an interest during the 90 days [[447.8]].

## What it means
A tax deed in Iowa is strong, but only if the notice chain was perfect. Budget for an attorney.

?? List five documents you would keep to prove your notice chain.` },
{ id: 'ia-pass', title: 'Iowa certificates to pass on', body: `
- Parcels where the **amount due is more than the land is worth**.
- **Land with no access** (landlocked) or mostly in a floodway [[fema]].
- **Tiny strips** and odd remnants.
- **Parcels in active nuisance or infraction proceedings**. The treasurer will not even offer parcels with pending municipal infraction citations or certain chapter 657 petitions [[446.7]].
- **Parcels held by governments** are not sold at all, and any sale is void [[446.7]].
- **Parcels you would not want a small undivided share of**, if you plan to bid low [[446.16]].

?? Mark ten parcels from a county list B (research) or P (pass), with one reason for each P.` }
], quiz: [
  { q: 'A parcel owned by a city appears on the list. What does the statute say?', a: ['It can be sold', 'It is not offered and a sale would be void', 'It sells at half price'], c: 1, why: 'See [[446.7]].' },
  { q: 'If you miss the 90-day window to request the deed after redemption ends:', a: ['Nothing', 'The treasurer cancels the certificate', 'You get an extension'], c: 1, why: 'See [[448.1]].' },
  { q: 'A sale mistakenly made where no tax was due:', a: ['Conveys title anyway', 'Does not convey title, and the purchaser is made whole', 'Is final'], c: 1, why: 'See [[448.8]] and [[448.10]].' }
]},
{ id: 'm7', title: 'Deal math', lessons: [
{ id: 'ia-math', title: 'The 2% a month math, line by line', body: `
Interest is **2% per month, counting each fraction of a month as a whole month, from the month of sale** [[447.1]]. Interest is at least $1 and rounds to the nearest dollar [[447.1]]. Redemption must be received on or before the last day of the month to avoid another month of interest [[447.1]].

## Example A (simulated): redeemed in month 7
= Amount sold for: $2,500.00 + certificate fee $10 (example)
= Months counted: the month of sale and each month through redemption → 7
= Interest: 2,510 × 2% × 7 = $351.40 → $351
= Owner pays: $2,861.00 plus any notice costs [[447.13]]
= Return on $2,510: 14.0% in about 6 elapsed months · annualized about 24%

## Example B (simulated): redeemed in month 24
= Interest: 2,510 × 2% × 24 = $1,204.80 → $1,205
= Total return 48% · annualized 24%

## Example C: the first month trap
= Buy on June 21, owner redeems June 28 → 1 month counted [[447.1]]
= Interest: 2,510 × 2% = $50.20 → $50 for 7 days

>> Iowa interest is simple and fixed. The return depends on timing, and any fraction of a month counts in full.

[[?The statute counts each fraction of a month as an entire month from the month of sale. Ask the treasurer how the month of sale and the month of redemption are counted in the payoff, and use the county's payoff figure.]]

?? Redo Example A for a redemption in month 13 and check with the {{t:calc|calculator}} (enter 24% as the annual rate).

Foundations refresher: {{f:math|Return math}}.` },
{ id: 'ia-costs', title: 'When costs and risks erase the profit', body: `
${SIM}

## Scenario: the tiny parcel
= Amount due: $180 · interest 2% a month · redeemed in 4 months
= Interest: 180 × 2% × 4 = $14.40 → $14
= Fixed costs: your own wire $25, registration fee example $20
= Net: −$31, before time

## Scenario: the deed path
= $3,000 certificate, nobody redeems
= After 1 year 9 months, you serve notice by regular and certified mail, record search up to $300 by an attorney or participating abstractor, plus mailing and any publication [[447.9]] [[447.13]]
= You may add those costs to the redemption amount, but if the owner never redeems you bear them
= 90 days later: deed fee $25 plus recording [[448.1]]
= You get a deed to the percentage you bid. At 25%, that is a quarter of land worth $20,000 = $5,000 of value, before an attorney and partition costs

!! A low percentage can leave you with a legal headache worth less than the legal fees.

?? Recompute the second scenario at 100% and at 10%.` },
{ id: 'ia-maxbid', title: 'Setting a percentage and a maximum amount', body: `
Because you always pay the full amount due, your decisions are **which parcels** and **what percentage**.

## A working method
1. **Value the land** conservatively as-is.
2. **Check coverage**: amount due ÷ value. Above 50% is a warning.
3. **Choose the share you could live with** if a deed issues: your minimum useful interest.
4. **Cost the deed path**: attorney, record search up to $300 (added to the redemption amount if redeemed) [[447.13]], deed fee [[448.1]], recording and notices.
5. **Decide if interest alone justifies the cash** at 24% simple, given the month counting [[447.1]].

## Worked example (simulated)
= Land value $20,000 · amount due $3,000 → coverage 15% (comfortable)
= Share you would accept: 50% = $10,000 of value
= Deed path cost: $2,500 → net value $7,500 vs $3,000 in → deed path is fine
= Bid 50% or higher; below 25% you would not want the result

?? Repeat for a parcel worth $6,000 with $3,000 due.` }
], quiz: [
  { q: 'Interest for a redemption 7 days after a June sale counts as:', a: ['7 days', 'One whole month', 'Nothing'], c: 1, why: 'See [[447.1]].' },
  { q: 'Which costs can be added to the redemption amount?', a: ['Notice service costs and a record search up to $300', 'Your travel', 'A profit margin'], c: 0, why: 'See [[447.13]].' },
  { q: 'Is the percentage you bid a yield?', a: ['Yes', 'No. It is your share of the parcel if a deed issues.', 'Only above 50%'], c: 1, why: 'See [[446.16]].' }
]},
{ id: 'm8', title: 'Redemption', lessons: [
{ id: 'ia-who', title: 'Who can redeem, and the amount', body: `
A parcel may be redeemed **at any time before the right of redemption expires** by paying the county treasurer the amount for which it sold, the certificate fee, and **2% a month** interest, plus later amounts you paid with the same interest [[447.1]]. After you file the notice of expiration, only those people who **were required to be served** (or who got an interest after the notice was filed) can redeem [[447.9]].

## Who must be served
The person in possession and the person the parcel is taxed to, **plus** mortgagees, contract vendors, recorded lessors, others with recorded interests, and the city where the parcel sits [[447.9]]. A nonresident may appoint a resident agent for service [[447.9]].

## The treasurer holds the money
Payment goes to the treasurer, to be held subject to your order [[447.1]].

?? List the people who must be served under [[447.9]].` },
{ id: 'ia-clock', title: 'The notice of expiration and the 90-day window', body: `
## When you may serve
After **1 year and 9 months** from the sale (or 9 months after a public bidder sale; 3 months after certain housing-related sales) [[447.9]].

## How
By **both regular and certified mail** to the last known address. Service is complete when the notice is deposited in the mail and postmarked. Publication is allowed only if service cannot be made, and the affidavit must say why [[447.9]] [[447.10]].

## The affidavit
Service is complete only after you file an **affidavit** with the treasurer showing the service and costs [[447.12]]. The right of redemption does not expire until **90 days after service is complete** [[447.12]]. A redemption counts only if received (or entered online) before the close of business on the 90th day, with a weekend/holiday extension to the next business day. The postmark does not count [[447.12]].

!! A mistake in this chain can void your deed [[448.3]].

?? Write a dated checklist for a notice mailed on a Monday, with the 90th day and any weekend adjustment.` },
{ id: 'ia-verify', title: 'Verifying a redemption and getting paid', body: `
1. **Redemption record**: the treasurer enters redemption in the county system and holds the money subject to your order [[447.1]].
2. **Amount check**: compare to the formula, including 2% a month, later taxes and permitted costs [[447.1]] [[447.13]].
3. **Costs not filed** before redemption cannot be collected through the treasurer. You must file the statement of costs in time, or sue for them [[447.13]].
4. **Record it** in {{t:portfolio|My portfolio}}.

!! If a certificate vanishes from a list, that does not prove redemption. Ask the treasurer.

?? Write the steps you would take if a redemption payment does not match your math.` }
], quiz: [
  { q: 'How long is the redemption window after service of the notice is complete?', a: ['30 days', '90 days', '1 year'], c: 1, why: 'See [[447.12]].' },
  { q: 'How must the notice be mailed?', a: ['Regular mail only', 'Both regular mail and certified mail', 'Email'], c: 1, why: 'See [[447.9]].' },
  { q: 'Costs not filed with the treasurer before redemption:', a: ['Are collected anyway', 'Cannot be collected by the treasurer', 'Are doubled'], c: 1, why: 'See [[447.13]].' }
]},
{ id: 'm9', title: 'After you win', lessons: [
{ id: 'ia-after', title: 'From the sale to the deed', body: `
1. **Pay immediately** and receive the certificate [[446.23]] [[446.29]].
2. **Record it** in {{t:portfolio|My portfolio}}: parcel, amount, percentage, date.
3. **Pay subsequent taxes** when allowed, to protect the parcel and earn interest [[446.32]].
4. **At 1 year 9 months**, serve the notice of expiration by regular and certified mail, and file the affidavit [[447.9]] [[447.12]].
5. **After 90 days** with no redemption, return the certificate and pay the deed and recording fees within 90 days [[448.1]].
6. **The treasurer records the deed** before delivering it. The deed fee is $25 [[448.1]].
7. **After the deed**: title review, insurance, and the consequences of your percentage [[446.16]].

?? Turn the seven steps into dated tasks for a June 21, 2027 sale.` },
{ id: 'ia-outcomes', title: 'The possible endings', body: `
- **Redeemed**: you receive the amount plus 2% a month and later taxes [[447.1]].
- **Deed issued**: you own the percentage you bid, subject to prior covenants and later-sale certificate holders [[448.3]] [[446.16]].
- **Deed void**: if the owner or taxed person was not properly served [[448.3]].
- **Certificate canceled**: you missed a deadline [[448.1]] [[446.37]].
- **Mistaken sale**: refunded [[448.11]], or the county makes you whole [[448.10]].
- **Post-deed action**: equitable actions to redeem by people not properly served or with a legal disability [[447.7]] [[447.8]].

?? Rank these from best to worst for an investor, and say which you can control.` }
], quiz: [
  { q: 'What is the treasurer’s deed fee?', a: ['$25', '$250', 'Free'], c: 0, why: 'See [[448.1]].' },
  { q: 'After the redemption period ends, how long do you have to request the deed?', a: ['90 days', '1 year', '5 years'], c: 0, why: 'See [[448.1]].' },
  { q: 'Which ending is outside your control?', a: ['Redemption', 'Serving notice on time', 'Paying the deed fee'], c: 0, why: 'The owner decides whether to redeem.' }
]},
{ id: 'm10', title: 'Local differences inside Iowa', lessons: [
{ id: 'ia-local', title: 'Comparing Scott and Woodbury counties', body: `
Both counties run the third-Monday-in-June sale [[446.7]], but they do it very differently (from each county's own page, checked ${CK}).

## Scott County: in person
- **Where and when**: Board Room, Scott County Administrative Center, 600 W. 4th St., Davenport, 8:30 a.m., Monday June 15, 2026 [[scott]].
- **Registration**: pre-registration **required**, before June 8 [[scott]].

## Woodbury County: online
- **Where and when**: online, 9:00 to 10:30 a.m., June 15, 2026 [[woodbury]].
- **Registration**: May 18 to June 10, 2026, with the official parcel list on GovEase [[woodbury]].
- **Taxpayers' deadlines**: payments to avoid publication by May 20, and in certified funds from May 18 to June 12 [[woodbury]].
- **Public bidder** and **adjourned** parcels have separate lists [[woodbury]].

## What to compare each year
Registration window and fees, in person or online, payment forms, adjourned-sale rules and how the county sells county-held certificates.

?? Pick two Iowa counties and fill in the same table. Use "not posted" where needed.` },
{ id: 'ia-offices', title: 'Which office for what', body: `
- **"Is this parcel still on the sale?"** → county treasurer [[446.7]].
- **"Redemption amount?"** → county treasurer [[447.1]].
- **"County-held certificates?"** → county treasurer or board of supervisors [[446.31]] [[woodbury]].
- **"Notice and deed."** → county treasurer [[447.12]] [[448.1]].
- **"Recorded covenants and liens."** → county recorder.
- **"Value and map."** → county assessor and GIS.
- **"Challenging a deed."** → district court [[448.6]].

?? Build a contact sheet for one Iowa county.` }
], quiz: [
  { q: 'Which county required pre-registration for an in-person sale?', a: ['Scott', 'Woodbury', 'Neither'], c: 0, why: 'See [[scott]].' },
  { q: 'Where is Woodbury’s official parcel list posted?', a: ['GovEase', 'A newspaper only', 'Nowhere'], c: 0, why: 'See [[woodbury]].' },
  { q: 'What do both counties follow?', a: ['Iowa Code ch. 446–448', 'Federal sale rules', 'No rules'], c: 0, why: 'See [[446.7]].' }
]},
{ id: 'm11', title: 'Case studies', lessons: [
{ id: 'ia-case-win', title: 'Case 1 (simulated): a certificate that paid', body: `
${SIM}

A home with a county value of $150,000 owes $2,200 in delinquent taxes. Two bidders bid down to 40% and 40%. The tie is settled by random draw [[446.16]], and the simulated investor wins.

## Math
= Amount paid: $2,200 + $10 certificate fee (example)
= Owner redeems in month 9
= Interest: 2,210 × 2% × 9 = $397.80 → $398 [[447.1]]
= Owner pays $2,608 plus any notice costs [[447.13]]
= Return: 18% in about 8 months → annualized about 27% by elapsed months (24% by the statute's month counting)

## Why it worked
Valuable owner-occupied homes nearly always redeem. The percentage you bid never mattered.` },
{ id: 'ia-case-pass', title: 'Case 2 (simulated): a tempting small share', body: `
${SIM}

A listed parcel: $2,900 due, land worth $6,000. A competitor bids 10%. To win, you would need to bid 9% or less.

## The check
- 9% of $6,000 = $540 of value if a deed issues.
- Your cash in: $2,900 plus costs of notice, a record search up to $300 and a $25 deed [[447.13]] [[448.1]].
- If the owner redeems, you earn 2% a month. If not, you own a 9% sliver worth $540.

## Decision: Pass
The only reason to bid is interest. If the owner is unlikely to redeem, the downside is a tiny share of low-value land.` },
{ id: 'ia-case-unknown', title: 'Case 3 (simulated): when missing information blocks a decision', body: `
${SIM}

A parcel with $4,800 due and an assessed value of $40,000. The description says "that part of the NE 1/4 lying south of the county road."

## What is missing
1. How much land is "that part"? Acreage is not stated.
2. Is there recorded access to the county road?
3. Are there other certificates on it?

## Decision: need more information
Without the acreage and access, you cannot value the land or choose a percentage. Ask the county for the assessor's record and find the parcel on the county map.` }
], quiz: [
  { q: 'In Case 1, how are ties settled?', a: ['By random selection', 'By the earlier registration', 'By the higher bid'], c: 0, why: 'See [[446.16]].' },
  { q: 'Why pass in Case 2?', a: ['The share you would own is small and the value low', 'The interest rate is too high', 'The county said no'], c: 0, why: 'Low percentage, low value.' },
  { q: 'These cases are:', a: ['All simulated', 'All real', 'Real except Case 1'], c: 0, why: 'We have no Iowa listing records on our site.' }
]},
{ id: 'm12', title: 'Final project', lessons: [
{ id: 'ia-project', title: 'Final project: research an Iowa parcel and decide', body: `
## Your assignment
Choose a parcel from a current Iowa county sale list and write a one-page memo:
1. **The listing**: county, parcel ID exactly as written, description, amount due, sale date, list source and date checked.
2. **Verification**: parcel on the county map, acres, shape, nearest road.
3. **Land risks**: flood, wetlands, access and zoning, with sources and dates.
4. **Title risks**: recorded covenants, other certificates, nuisance proceedings, who must be served [[447.9]].
5. **Math**: interest at 6 and 24 months (2% a month), the deed-path cost and the share you would accept [[447.1]] [[446.16]].
6. **Decision**: Bid (with a percentage floor), Pass or need more information.

## Worked answer (simulated)
${SIM}
1. Example County, parcel 100-200, $3,000 due, sale June 21, 2027. List checked today.
2. 2.1 acres on the GIS map; gravel road frontage.
3. FEMA Zone X; no mapped wetlands; zoned agricultural.
4. No recorded covenants; no other certificates. Owner of record and taxed person identified.
5. 6 months: 3,010 × 2% × 6 = $361. 24 months: $1,445. Deed path about $2,500 with a record search at the $300 cap [[447.13]]. Share accepted: 50% of $10,000 value.
6. **Bid at 50% or higher.** Below 25% I would pass.

## Grading rubric (100 points)
- Listing copied exactly with source and date: **15**
- Parcel verified on the map: **15**
- Land risks with sources, unknowns marked: **20**
- Title and notice risks: **15**
- Math shown line by line, including the share: **20**
- Decision that follows from the evidence: **15**

80 or more passes. An invented fact presented as real caps the score at 60.` }
], quiz: [
  { q: 'What caps the score at 60?', a: ['An invented fact presented as real', 'A late submission', 'Choosing Pass'], c: 0, why: 'Every number needs a source.' },
  { q: 'Your project math must include:', a: ['The share you would accept', 'Only the interest', 'A guess'], c: 0, why: 'The percentage drives what a deed gives you [[446.16]].' },
  { q: 'Which persons must be listed as needing service?', a: ['The persons listed in section 447.9', 'Nobody', 'Only the owner'], c: 0, why: 'See [[447.9]].' }
]}
];

const exercise = {
  title: 'Bid or Pass: a simulated Iowa parcel',
  simulated: true,
  label: '**SIMULATED.** PricePocketAsset has no verified Iowa listing yet, so this exercise uses made-up facts. No real parcel, purchase or payout is described.',
  lien: null,
  calc: { amount: 3010, rate: 24, months: 12, fees: 0, from: 'Simulated Iowa certificate: $3,000 + $10 fee at 2% a month' },
  facts: [
    ['Parcel', '3.0 acres, unimproved, gravel road frontage (simulated)'],
    ['Total amount due', '$3,000.00 (simulated)'],
    ['Assessed value', '$9,000 (simulated)'],
    ['Competing bids so far', '100%, 60%, 25% (simulated)'],
    ['Flood / wetlands', 'FEMA Zone X · no mapped wetlands (simulated)'],
    ['Other certificates', 'None known (simulated)']
  ],
  brief: `
Decide whether you would bid, and at what **percentage floor**. Enter the **most total cash you would put in** (the amount due plus your costs if a deed path is needed), choose Bid or Pass and explain. Remember: interest is 2% a month no matter your percentage [[447.1]], and a deed gives only the percentage you bid [[446.16]].`,
  walkthrough: `
${SIM}

## 1. Interest
= $3,010 × 2% × 12 months = $722.40 → $722 [[447.1]]
= Annualized: 24%

## 2. The share question
Coverage = 3,000 ÷ 9,000 = 33%. At a 25% share, a deed would give you $2,250 of value, **less than you paid**. At 60% you would have $5,400 of value.

## 3. Deed-path cost
= Notice by regular and certified mail, record search up to $300 [[447.13]], deed fee $25 [[448.1]], attorney fees: example $2,000 → about $2,400

## 4. A reasonable answer
**Bid only if you can win at a share you would accept (at least about 60%)**, mostly for the interest. If competitors push the share below 40%, Pass. Strong answers note that interest is the same at any share, and that a small undivided interest could leave you with less than you paid.`
};

export default {
  id: 'ia', state: 'IA', title: 'Iowa Tax Sales: The Complete Course', status: 'published', checked: CK,
  review: 'Batch 1. Rules cited to the Iowa Code 2026 (chapters 446, 447 and 448), read in full for the sections cited, checked ' + CK + '. County procedures from the Scott and Woodbury treasurer pages. Items marked "Needs review" were not verified. The case studies and exercise are simulated because we have no verified Iowa listing or outcome records. No outside legal review yet.',
  intro: 'How Iowa sells tax certificates each June by the smallest percentage of the parcel, how the fixed 2% a month interest works, how notices, the 90-day window and the treasurer’s deed work, and how to research and decide. Every rule cited to the Iowa Code.',
  sources, modules, exercise,
  glossary: [
    ['Annual tax sale', 'The June sale of delinquent parcels for the total amount due.'],
    ['Total amount due', 'Taxes, interest, fees and costs on a parcel.'],
    ['Smallest percentage', 'The winning bid: the share of the parcel the buyer would own on a deed. Minimum 1%.'],
    ['Certificate of purchase', 'The record that you bought the parcel at tax sale.'],
    ['Public bidder sale', 'Parcels advertised and offered a year or more without a bidder. The county bids the total and holds the certificate.'],
    ['Adjourned sale', 'A later sale of unsold parcels, no more than two months apart.'],
    ['Notice of expiration of right of redemption', 'The notice the holder serves; redemption ends 90 days after service is complete.'],
    ['Affidavit of service', 'The holder’s sworn proof of service, filed with the treasurer.'],
    ['Treasurer’s deed', 'The deed issued after the redemption period, for a $25 fee.'],
    ['Subsequent taxes', 'Later years’ taxes the holder pays, earning 2% a month.'],
    ['Undivided interest', 'A share of the whole parcel, not a specific piece of land.'],
    ['Equitable action', 'A court action in district court used to challenge a deed or redeem after delivery.']
  ],
  links: [
    ['Iowa Code Chapter 446 (tax sales)', 'https://www.legis.iowa.gov/docs/code/446.pdf', 'statute'],
    ['Iowa Code Chapter 447 (redemption)', 'https://www.legis.iowa.gov/docs/code/447.pdf', 'statute'],
    ['Iowa Code Chapter 448 (tax deeds)', 'https://www.legis.iowa.gov/docs/code/448.pdf', 'statute'],
    ['Scott County Treasurer: 2026 Annual Tax Sale', 'https://www.scottcountyiowa.gov/treasurer/post/2026/06/15/2026-annual-tax-sale', 'county'],
    ['Woodbury County Treasurer: Tax Sale', 'https://www.woodburycountyiowa.gov/treasurer/tax_sale/', 'county'],
    ['Our Iowa page', '/liens/states/state/?s=IA', 'site'],
    ['FEMA Flood Map Service Center', 'https://msc.fema.gov/portal/search', 'federal']
  ],
  checklists: {
    research: ['Parcel ID and description copied exactly', 'Found on the county GIS map; acres and shape checked', 'Amount due versus value', 'Flood with source and date', 'Wetlands with source and date', 'Access to a public road', 'Recorded covenants and easements', 'Other certificates', 'Who must be served for notice', 'Nuisance or infraction proceedings', 'Confirm the parcel is still on the sale'],
    bid: ['Registered for this county’s sale', 'Funds ready to pay immediately', 'Share (percentage) I would accept written down', 'Interest worked out at 6, 12 and 24 months with whole-month counting', 'Deed-path cost estimated (notices, record search, deed fee)', 'Plan to serve notice at 1 year 9 months', 'Everything logged in My portfolio']
  }
};
