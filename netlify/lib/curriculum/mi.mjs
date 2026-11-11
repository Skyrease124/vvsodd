// Michigan: no certificate or lien sale. Property is forfeited, foreclosed by circuit court judgment, then sold at county auction.
// Batch 1.
const CK = '2026-11-11', ED = 'Michigan Compiled Laws, complete through PA 114 of 2026 (rendered 2026-10-21)';
const S = (short, name, url, checked = CK, effective = ED) => ({ short, name, url, checked, effective });
const mcl = sec => S('MCL 211.' + sec, 'MCL 211.' + sec + ' (General Property Tax Act)', 'https://www.legislature.mi.gov/Laws/MCL?objectName=mcl-211-' + sec);
const sources = {
  '78': mcl('78'), '78a': mcl('78a'), '78g': mcl('78g'), '78h': mcl('78h'), '78i': mcl('78i'), '78k': mcl('78k'), '78l': mcl('78l'), '78m': mcl('78m'), '78t': mcl('78t'),
  wayne: S('Wayne Co.', 'Wayne County Treasurer: Claims & Auctions', 'https://www.waynecountymi.gov/Services/Property-Taxes/Auctions-Claims', CK, '2026'),
  waynetl: S('Wayne timeline', 'Wayne County Treasurer: Forfeiture/Foreclosure Timeline', 'https://www.waynecountymi.gov/Government/Elected-Officials/Treasurer/Property-Tax-Information/ForfeitureForeclosure-Timeline', CK, ''),
  fema: S('FEMA', 'FEMA National Flood Hazard Layer', 'https://msc.fema.gov/portal/search', CK, ''),
  nwi: S('NWI', 'U.S. Fish and Wildlife Service National Wetlands Inventory', 'https://www.fws.gov/program/national-wetlands-inventory/wetlands-mapper', CK, '')
};
const SIM = '!! SIMULATED. Every number below is made up to teach the method. No real property, purchase or payout is described.';

const modules = [
{ id: 'm1', title: 'How Michigan’s tax foreclosure system works', free: true, lessons: [
{ id: 'mi-what', title: 'Michigan sells the property after a foreclosure, not a lien', body: `
Michigan has **no tax lien certificate sale and no deed-for-taxes auction in the usual sense**. The county treasurer takes the property through **forfeiture** and then a **circuit court foreclosure** by the foreclosing governmental unit (usually the county treasurer). Only after the judgment is final does the unit **sell the property at auction** [[78a]] [[78g]] [[78k]] [[78m]].

## What an investor buys
A **foreclosed property**, at a county auction, for the minimum bid or more. The deed vests fee simple title in the winning bidder (unless the government finds a defect in the foreclosure) [[78m]]. There is **no redemption period** after your purchase, because redemption ended before the foreclosure became effective [[78k]].

## Who does what
- **County treasurer (foreclosing governmental unit)**: records the forfeiture, files the petition, runs the sale [[78g]] [[78h]] [[78m]]. If a county has elected to have the **state** foreclose, the state Department of Treasury runs the sale [[78]] [[78m]].
- **Circuit court**: hears the foreclosure and enters judgment [[78k]].
- **City, village, township and the state**: have **first-refusal** rights before the public auction [[78m]].
- **Claimants**: former owners and others with an interest may claim any remaining proceeds above the minimum bid [[78t]].

>> In Michigan, you buy land with title the court has cleared, in a one-step auction. The risk and the reward are different from a lien state.

?? Open {{u:/liens/states/state/?s=MI|our Michigan page}} and find the county treasurer link for one county. Write the county name and what it says about auctions.

Foundations refresher: {{f:deeds|Buying at tax deed auctions}}.` },
{ id: 'mi-calendar', title: 'The Michigan calendar, from delinquency to auction', body: `
- **March 1** of the year after the tax year: unpaid taxes are returned delinquent to the county treasurer [[78a]].
- **March 1 a year later**: property delinquent for the preceding 12 months or more is **forfeited** to the county treasurer for the total unpaid delinquent taxes, interest, penalties and fees. A **$175 fee** is added to each property [[78g]].
- **Within 45 days after forfeiture**: the treasurer records a certificate of forfeiture with the register of deeds [[78g]].
- **By May 1**: the foreclosing governmental unit starts the title search to identify who must be notified [[78i]].
- **By June 15**: the petition for foreclosure is filed with the circuit court, listing all forfeited, unredeemed property [[78h]].
- **Hearing and judgment**: judgment is entered no later than **March 30** after the hearing, effective **March 31**. Redemption rights end on March 31 (or 21 days after judgment in a contested case) [[78k]].
- **By the first Tuesday in July**: the state may exercise its right of first refusal, followed by cities, villages, townships and counties [[78m]].
- **Third Tuesday in July through the first Tuesday in November**: county auctions [[78m]].

## Worked timeline (simulated)
= 2025 taxes unpaid → returned delinquent March 1, 2026
= Forfeited March 1, 2027
= Petition filed by June 15, 2027 → judgment effective March 31, 2028
= Auctions: July through the first Tuesday in November 2028

?? Using Wayne County's timeline page [[waynetl]], compare its steps with the statute's dates.` },
{ id: 'mi-ends', title: 'How a Michigan tax foreclosure ends', body: `
## 1. The owner redeems (before the deadline)
By paying the total unpaid taxes, interest, penalties, fees plus additional interest and recording and service fees, on or before March 31 after the judgment (or within 21 days in a contested case) [[78g]].

## 2. Foreclosure, then sale
If not paid, fee simple title vests in the foreclosing governmental unit, free of liens and most interests [[78k]]. The unit offers the property to government buyers, then auctions it [[78m]].

## 3. Remaining proceeds go to claimants
If the auction price is higher than the minimum bid and costs, former owners and lienholders can claim the **remaining proceeds** [[78t]].

>> The investor's profit does not depend on interest or a premium. It depends on buying land for less than it is worth, and on the land being what you think it is.

?? Write which of the three endings applies to you as a buyer, and what you must check before bidding.` }
], quiz: [
  { q: 'Does Michigan sell tax liens?', a: ['Yes, certificates', 'No. It forecloses and then auctions the property', 'Yes, at 18%'], c: 1, why: 'See [[78g]], [[78k]] and [[78m]].' },
  { q: 'When is property forfeited to the county treasurer?', a: ['After 12 or more months of delinquency, on March 1', 'Immediately', 'After 10 years'], c: 0, why: 'See [[78g]].' },
  { q: 'When must the petition for foreclosure be filed?', a: ['By June 15', 'By January 1', 'Any time'], c: 0, why: 'See [[78h]].' }
]},
{ id: 'm2', title: 'Finding notices, lists and results', lessons: [
{ id: 'mi-notices', title: 'Where Michigan auction notices appear', body: `
## What the law requires
Notice of the time and location of an auction must be published **at least 30 days before** a sale in a notice publication circulated in the county (or an adjoining county, if none) [[78m]]. Sales may be held at one or more locations and **may be conducted online** [[78m]].

## Where to look
1. **The county treasurer's website.** Wayne County says auctions run in September and October of the year of foreclosure, properties are offered at a minimum bid of all delinquent taxes, penalties and interest, and unsold properties go to the October auction [[wayne]].
2. **The state Department of Treasury**, in counties where the state is the foreclosing unit [[78m]].
3. **Claims lists.** Wayne publishes a list of foreclosed properties for claimants [[wayne]].
4. **Your own calendar**: auctions can start the third Tuesday in July and must end before the first Tuesday in November [[78m]].

## You do the research
Counties usually state that properties are sold as-is. Read the county's auction rules and regulations before you register [[wayne]].

?? From {{u:/liens/states/state/?s=MI|our Michigan page}}, open two counties and write down the auction dates, the platform and the registration rules.` },
{ id: 'mi-columns', title: 'Reading a Michigan auction list', body: `
Lists vary by county, and counties often use online auction sites. These facts are central because the law uses them [[78m]] [[78t]]:
- **Parcel identification number and address (if any).**
- **Legal description.**
- **Minimum bid.** All delinquent taxes, interest, penalties and fees due, and possibly the unit's foreclosure, mailing, publication, legal and auction expenses [[78m]].
- **Opening or reserve** terms and whether the property is offered as a **group** (the group minimum bid is the sum of each) [[78m]].
- **Special notes**: special assessments, environmental issues or demolition status [[wayne]].

## What to compare
The minimum bid against the property's assessed value and your own estimate. Michigan's State Equalized Value is roughly half of market value for many properties. [[?Confirm how a given county's assessed or taxable values relate to market value before using them.]]

?? Pick a county auction list and calculate the minimum bid as a share of assessed value for five parcels.` },
{ id: 'mi-ids', title: 'Michigan parcel numbers and property checks', body: `
Michigan counties use their own parcel number formats. Use the **parcel identification number** in the petition, the foreclosure list and the auction list [[78h]].

## A routine
1. Copy the parcel number exactly.
2. Find the parcel on the county or city GIS.
3. Compare the legal description, size and shape.
4. Check the **street address** if there is one [[78h]]. Vacant lots often have none.
5. Look for **special assessments** that survive foreclosure (future installments) [[78k]].

?? Find one parcel on a county auction list and match it to the county's map.

Foundations refresher: {{f:parcels|Parcel IDs}}.` }
], quiz: [
  { q: 'How far ahead must auction notice be published?', a: ['At least 30 days', '1 day', '1 year'], c: 0, why: 'See [[78m]].' },
  { q: 'Can Michigan auctions be held online?', a: ['Yes, the law allows it', 'No', 'Only in Wayne'], c: 0, why: 'See [[78m]].' },
  { q: 'What does the minimum bid include at least?', a: ['All delinquent taxes, interest, penalties and fees', 'Nothing', 'Only taxes'], c: 0, why: 'See [[78m]].' }
]},
{ id: 'm3', title: 'Registering, bidding and paying', lessons: [
{ id: 'mi-register', title: 'Who may bid: the delinquent-taxes affidavit', body: `
Before the foreclosing unit issues a deed, the buyer must sign and file an **affidavit under penalty of perjury** confirming that [[78m]]:
- the buyer does **not directly or indirectly hold more than a minimal legal interest in any property with delinquent property taxes in the same county**; and
- the buyer is **not directly or indirectly responsible for unpaid civil fines** for certain local ordinance violations in the local unit where the property sits.

If you do not file the affidavit by the payment date, the sale is canceled [[78m]].

## What else counties require
Registration, deposits and platform rules differ by county. Wayne tells bidders to read the auction rules and regulations before registering [[wayne]]. [[?Deposit amounts, ID rules and platform fees must be read from each county's current auction rules.]]

## Before you register
1. Check that you owe no delinquent taxes anywhere in the county.
2. Check your entities. The test covers indirect interests.

?? Draft a short note to yourself listing every entity you control and whether it owes taxes or ordinance fines in a county you want to bid in.` },
{ id: 'mi-bidding', title: 'The minimum bid, highest bid and group sales', body: `
## The rule
Property is sold to the person bidding the **minimum bid**, or if a bid is higher, the **highest amount above the minimum bid** [[78m]]. The unit may sell properties individually or as a group. A group's minimum bid is the sum of each property's minimum [[78m]]. The unit may adopt procedures for the conduct of the sale and payment [[78m]].

## The final sale
If the unit holds more than one sale, the **final** sale (held at least 28 days after the previous one) can have **no minimum bid**, though the unit can set a reasonable opening bid to recover costs [[78m]]. A former interest holder must still pay the minimum bid [[78m]].

## What this does to strategy
- Minimum-bid properties draw many bidders. Bidding stops at your maximum, not at the minimum.
- **Final-sale properties** can sell very cheaply, with competition at its lowest.

## Worked example (simulated)
= Minimum bid $4,200 · bids: $4,200, $5,500, $7,800 → winner $7,800
= $3,600 above the minimum. The remaining proceeds belong to claimants, not to the county [[78t]]

?? Using the example, what is the highest you would bid for a lot you value at $9,000 after costs of $1,800?` },
{ id: 'mi-pay', title: 'Paying, deadlines and canceled sales', body: `
## Payment
The unit **requires full payment at the close of each day's bidding or by a date not more than 21 days after the sale** [[78m]].

## Taxes owed
Before conveyance, the purchaser must give the unit **proof of payment to the local tax collecting unit** of any property taxes owed at the time of sale. If those taxes are not paid within **21 days of the sale**, the unit cancels the sale [[78m]].

## If the sale is canceled
The unit may offer the property to the **next highest bidder** [[78m]].

## The deed
Not more than **14 days** after payment, the unit conveys the property by deed [[78m]]. Wayne says successful bidders receive a **quit claim deed** [[wayne]].

!! Do not bid more than the money you can move within the county's deadline. A canceled sale means you lose the property and possibly your deposit. [[?Deposit forfeiture terms are in each county's auction rules.]]

?? Write the deadlines for a simulated sale: full payment, proof of tax payment, deed.` }
], quiz: [
  { q: 'What must the buyer sign before a deed is issued?', a: ['An affidavit about delinquent taxes and civil fines', 'A mortgage', 'Nothing'], c: 0, why: 'See [[78m]].' },
  { q: 'When is full payment due?', a: ['At the close of each day or within 21 days of the sale', 'After 1 year', 'Never'], c: 0, why: 'See [[78m]].' },
  { q: 'What kind of deed does Wayne say winners get?', a: ['Quit claim deed', 'General warranty deed', 'No deed'], c: 0, why: 'See [[wayne]].' }
]},
{ id: 'm4', title: 'First refusal, unsold and leftover property', lessons: [
{ id: 'mi-first', title: 'Who gets first pick: state, cities and counties', body: `
Before the public auction, **the state has the right of first refusal** on foreclosed property at the **greater of the minimum bid or fair market value**, by the first Tuesday in July after the judgment [[78m]]. If the state declines:
- A **city, village, township or city authority** may buy property in its area (at the greater of minimum bid or fair market value if someone has filed a claim for remaining proceeds, otherwise at the minimum bid) [[78m]].
- If they decline, the **county** (or a county authority) may buy it on the same terms [[78m]].

The unit conveys to the purchasing government within 30 days [[78m]].

## What this means for investors
Good parcels often never reach the auction. What reaches you has been passed over by the state, the municipality and the county.

?? Find a county's list of properties removed before auction. Why might a government buy a parcel?` },
{ id: 'mi-after-auction', title: 'Property left after the auction', body: `
## Post-auction purchases by government
After a sale, and before another sale, a city, village, township or authority may buy any unsold property for the **minimum bid**, then the county [[78m]].

## The last step
By **December 1** of that year, a list of all unsold property is sent to the city, village or township, which may object. By **December 30**, unsold property is transferred to the local government (except properties it objected to) [[78m]]. The unit keeps the rest, or transfers it to a land bank authority, or offers it again [[78m]].

## For investors
Ask the county treasurer or land bank how unsold property is offered after the auction, and at what price. [[?Practices for land-bank and post-auction sales differ by county and were not reviewed.]]

?? Find one county's land bank and note whether it sells to private investors.` },
{ id: 'mi-surplus', title: 'Remaining proceeds and the claims process', body: `
If a property sells for **more than the minimum bid and costs**, the extra is **remaining proceeds** that former owners and other interest holders can claim [[78t]].

## The claim steps
1. **By July 1** after the foreclosure takes effect, a claimant files a notarized **notice of intention to claim** with the foreclosing unit [[78t]].
2. **By January 31** after the sale, the unit sends each claimant a notice with the minimum bid, the sale price, a **sale commission of 5% of the sale amount**, any outstanding tax liens, and the remaining proceeds [[78t]].
3. **From February 1 to May 15**, a claimant files a **motion with the circuit court** [[78t]].

## What it means for a buyer
The extra you bid above the minimum does not go to the county's general fund. It is paid out to claimants after costs [[78m]] [[78t]]. That affects how aggressively counties price and how bidders think about overbidding.

?? Using the example from Module 3, compute the commission (5% of $7,800) and what remains for claimants after the minimum bid. (Other costs may apply.)` }
], quiz: [
  { q: 'Who gets first refusal on foreclosed property?', a: ['The state, then the city, village or township, then the county', 'The highest bidder', 'The former owner'], c: 0, why: 'See [[78m]].' },
  { q: 'The sale commission in the claims process is:', a: ['5% of the sale amount', '1%', '20%'], c: 0, why: 'See [[78t]].' },
  { q: 'When must a claimant file a notice of intention?', a: ['By July 1 after the foreclosure', 'After the sale only', 'Never'], c: 0, why: 'See [[78t]].' }
]},
{ id: 'm5', title: 'Researching the property', lessons: [
{ id: 'mi-research', title: 'Researching a Michigan property with public maps', body: `
PricePocketAsset has **no Michigan listings yet**, so you will use county tools and federal maps. The method matches the other courses.

## The checklist
1. **County and city GIS**: parcel outline, acres, buildings, street frontage.
2. **Aerial**: structures, trees, condition, access.
3. **Street view** from public sources, where available.
4. **Flood**: FEMA map [[fema]]. Michigan has many lake and river properties.
5. **Wetlands**: NWI mapper [[nwi]]. Michigan has extensive wetlands.
6. **Zoning**: the city or township zoning office. Zoning is local.
7. **Utilities and condition**: for a house, assume a structure condition risk and demolition possibility.

## Mark the unknowns
Never write "no overlap" for a layer you could not load.

?? Pick an address from a county auction list and complete steps 1 to 6 with sources and dates.

Foundations refresher: {{f:gis|GIS and parcel maps}} and {{f:diligence|Due diligence}}.` },
{ id: 'mi-condition', title: 'Houses, demolition and environmental risk', body: `
Foreclosed Michigan properties are **sold as-is**. Counties note special assessments, environmental issues and demolition status [[wayne]].

## What survives the foreclosure
The judgment extinguishes liens, including unpaid taxes and special assessments, **except future installments of special assessments** and liens recorded by the state or the unit under the natural resources and environmental protection act [[78k]]. Existing interests are extinguished **except** a visible or recorded easement or right-of-way, private deed restrictions, certain oil and gas interests, and certain environmental restrictions [[78k]].

## Environmental
Foreclosed property can be treated as a facility under environmental law. [[?Liability rules for buyers of tax-foreclosed contaminated property were not reviewed in this course. Ask a Michigan environmental attorney.]]

## For houses
Budget for repairs, possible code enforcement, utility shutoffs and vandalism. Visit from the street. Do not enter without permission.

?? Make a one-page condition checklist you would complete from the sidewalk.` },
{ id: 'mi-value', title: 'Minimum bid versus market value', body: `
Because the winning bid is the minimum or more, the **gap between the minimum bid and market value** is where deals live and die.

## Check three numbers
- **Minimum bid** from the county.
- **Your as-is value**: what a similar lot or house sold for recently, minus your costs.
- **Competition**: past results for this county. Many counties publish prior sale results.

## Rule of thumb
If the minimum bid is already near your as-is value, the property is not a deal even at the minimum.

## Worked example (simulated)
= Minimum bid $6,000 · as-is value $18,000
= Costs: title and deed work $900, taxes owed at sale $600, repairs $3,000, selling 8% $1,440
= Break-even bid: 18,000 − 900 − 600 − 3,000 − 1,440 = $12,060 before profit

?? Pick an auction property and fill in the same three numbers.` }
], quiz: [
  { q: 'What survives a Michigan tax foreclosure judgment?', a: ['Visible or recorded easements, private deed restrictions and certain other interests', 'Every lien', 'Nothing'], c: 0, why: 'See [[78k]].' },
  { q: 'Are Michigan auction properties sold with a warranty of condition?', a: ['No, they are sold as-is', 'Yes', 'Only houses'], c: 0, why: 'Counties note special assessments, environmental issues and demolition status [[wayne]].' },
  { q: 'A break-even bid should consider:', a: ['Costs, taxes owed and repairs', 'Only the minimum bid', 'Only the assessed value'], c: 0, why: 'All costs reduce what you can pay.' }
]},
{ id: 'm6', title: 'Title and property risks', lessons: [
{ id: 'mi-title', title: 'What a Michigan tax foreclosure clears and what it does not', body: `
The judgment says that fee simple title vests absolutely in the foreclosing unit, and that **all liens**, including unpaid tax and special assessment liens, are extinguished, if the forfeited amounts are not paid by the deadline. **Future installments of special assessments** and certain state environmental liens survive [[78k]].

All existing **recorded and unrecorded interests** are extinguished except [[78k]]:
- a visible or recorded **easement or right-of-way**;
- **private deed restrictions**;
- interests of a **lessee** under a recorded oil or gas lease;
- certain preserved **oil and gas** interests owned by someone other than the surface owner;
- interests in property assessable as **personal property**;
- certain environmental restrictions and government interests.

## Notice protects the title
The court must find that everyone entitled to notice and a chance to be heard received it, through mail, personal visits to the property and publication [[78i]] [[78k]].

## Challenges are cut off
Owners of extinguished interests **cannot bring actions to recover the property more than 2 years** after the judgment is effective [[78l]]. Claims to **proceeds** go through the claims process [[78t]].

?? Search the county register of deeds for recorded easements and deed restrictions on one property.` },
{ id: 'mi-occupants', title: 'Occupants and possession', body: `
The foreclosing unit has no right to possession until **April 1** after the judgment (or 22 days after in a contested case) [[78g]]. The auction comes months later, so a house may still be occupied.

## Before you bid
- Look for signs of occupancy.
- Ask the county how it handles occupied properties.
- [[?Eviction steps after a tax foreclosure sale were not reviewed. Ask a Michigan attorney.]]

## After you buy
You hold fee simple title [[78m]]. Removing someone who stayed is your responsibility.

?? Write how you would learn whether a property is occupied without trespassing.` },
{ id: 'mi-pass', title: 'Michigan properties to pass on', body: `
- **Properties with large unpaid special assessments** that will continue [[78k]].
- **Houses needing demolition** where the minimum bid is not far below the cost to demolish.
- **Lots with no street frontage** or only an unrecorded easement.
- **Properties in wetlands or floodplains** [[fema]] [[nwi]].
- **Occupied homes you do not want to evict from.**
- **Parcels where you cannot confirm what the legal description covers.**
- **Properties where your bid would exceed your break-even** after costs.

?? Mark ten auction properties B or P, with a reason for each P.` }
], quiz: [
  { q: 'Which special assessments survive?', a: ['Future installments', 'All of them', 'None'], c: 0, why: 'See [[78k]].' },
  { q: 'How long after the judgment can an extinguished interest holder sue to recover the property?', a: ['No more than 2 years', '10 years', 'Forever'], c: 0, why: 'See [[78l]].' },
  { q: 'When does the foreclosing unit get possession?', a: ['April 1 after the judgment (22 days in contested cases)', 'Immediately', 'Never'], c: 0, why: 'See [[78g]].' }
]},
{ id: 'm7', title: 'Deal math', lessons: [
{ id: 'mi-math', title: 'Auction math, line by line', body: `
No interest or premium is earned. You profit from the **difference between your all-in cost and what you can sell or rent for**.

## Example A (simulated): a vacant lot
= Winning bid: $3,200
= Taxes owed at sale paid to the local unit: $450 [[78m]]
= Deed recording and title search: $300
= Holding 6 months (taxes, mowing): $400
= Selling costs at 8% of $9,000: $720
= All-in cost: 3,200 + 450 + 300 + 400 + 720 = $5,070
= Sale price $9,000 → profit $3,930 · return 77% · annualized about 150%

## Example B (simulated): the repair house
= Bid $12,000 · taxes $1,100 · repairs $18,000 · holding 9 months $2,700 · selling 8% of $55,000 $4,400
= All-in $38,200 → profit $16,800

## Example C: the overbid
= Same house, bid up to $30,000 → all-in $56,200 → loss $1,200

>> The result is set before you bid. The auction price is the only number you control.

?? Redo Example B with repairs of $28,000. Where does your maximum bid land for a $10,000 profit?

Foundations refresher: {{f:math|Return math}}.` },
{ id: 'mi-costs', title: 'When costs erase the profit', body: `
${SIM}

## Scenario: the cheap house
= Winning bid $4,500 on a house worth $30,000 as-is
= Water shutoff lien and code fines owed to the city: $2,800 (check which survive)
= Roof, windows and cleanout: $14,000 · insurance $900 · utilities $600
= Selling 8%: $2,400
= All-in: $25,200 → profit $4,800 on a long project

## Scenario: the bid above minimum
= Minimum $4,000 · you bid $12,000 to win
= The extra $8,000 goes toward claimants and costs, not to the unit [[78m]] [[78t]]
= Break-even as-is value for a lot with $1,500 costs: $13,500 plus selling costs

!! Overbidding on a lot is the fastest way to lose in Michigan. A cheap minimum bid does not set the price.

?? Find the highest bid at which Example A still earns a 30% return.` },
{ id: 'mi-maxbid', title: 'Setting a maximum bid', body: `
= Conservative as-is resale or rental value
= − Taxes owed to the local unit at sale [[78m]]
= − Title and recording costs
= − Surviving easements and special assessments that reduce value [[78k]]
= − Repairs, utilities, insurance, holding costs
= − Selling costs
= − Your required profit
= = Maximum bid

## Worked example (simulated)
= As-is value $24,000 · taxes owed $700 · title $350
= Repairs $6,000 · holding $1,800 · selling 8% $1,920 · profit $5,000
= Maximum bid = 24,000 − 700 − 350 − 6,000 − 1,800 − 1,920 − 5,000 = **$8,230**

## Discipline
Write the number before registering. Bid at or under it.

?? Build the same table for a property you pick from a county list.

Foundations refresher: {{f:bidlimit|Bid limits}}.` }
], quiz: [
  { q: 'Do Michigan auction buyers earn interest or a premium?', a: ['No', 'Yes, 18%', 'Yes, 25%'], c: 0, why: 'You profit from resale or use.' },
  { q: 'Overbidding above the minimum:', a: ['Raises remaining proceeds paid to claimants after costs', 'Goes into the buyer’s pocket', 'Lowers the price'], c: 0, why: 'See [[78t]].' },
  { q: 'Which cost must be paid before the deed?', a: ['Taxes owed on the property at the time of sale', 'A mortgage', 'Nothing'], c: 0, why: 'See [[78m]].' }
]},
{ id: 'm8', title: 'Redemption and the owner’s rights', lessons: [
{ id: 'mi-redeem', title: 'Redemption ends before the auction', body: `
Forfeited property can be redeemed **at any time on or before March 31 after the judgment** (or within 21 days in a contested case) by paying the total unpaid taxes, interest, penalties and fees, plus **additional interest of 1/2% a month** from the March 1 before forfeiture, plus recording and service fees [[78g]]. A person who is not the owner who redeems gets a lien for the amount paid, but no greater title [[78g]].

## For the auction buyer
By the time you can bid, **redemption has ended**. If the owner paid before the deadline, the property is removed from the petition and never reaches auction [[78h]].

## Why it matters
Lists change until the last moment. A property on your list may disappear if the owner pays in full.

?? Check a county's list the morning of an auction and note any parcel removed.` },
{ id: 'mi-contest', title: 'Owner challenges and the limits on them', body: `
An owner can contest the foreclosure for limited reasons, such as: the tax was not authorized, the property was exempt, the tax was paid in time, the tax was assessed fraudulently, or the description was so indefinite that the forfeiture was void [[78k]]. Objections must be filed with the clerk before the hearing [[78k]].

## Hardship and incapacity
The court can withhold property from foreclosure for one year, or extend the redemption period, if the owner is a minor heir, is incompetent, lacks means of support or faces substantial financial hardship [[78k]]. The unit may also withhold such property from the petition [[78h]].

## After the judgment
Owners of extinguished interests have **2 years** to bring any action, and claims to proceeds follow the claims process [[78l]] [[78t]].

?? Write the main differences between a contested and an uncontested foreclosure for timing [[78k]].` },
{ id: 'mi-verify', title: 'Verifying your title before and after', body: `
1. **Before bidding**: ask the county for the foreclosure judgment and the parcel's inclusion. Check the register of deeds for easements and deed restrictions.
2. **Before paying**: confirm the property is still being offered and the amount of taxes owed to the local unit [[78m]].
3. **After the deed**: record it. Order a title search, and consider title insurance. [[?Insurers' treatment of tax foreclosure deeds varies. Ask a Michigan title agent.]]

!! Never assume the foreclosure was perfect. The unit may cancel a sale if it discovers a defect in the foreclosure [[78m]].

?? List the five documents you want in your file for each purchase.` }
], quiz: [
  { q: 'Redemption of forfeited Michigan property ends:', a: ['On or before March 31 after the judgment (21 days in contested cases)', 'After the auction', 'After 5 years'], c: 0, why: 'See [[78g]].' },
  { q: 'What happens if the owner redeems after the petition is filed?', a: ['The property is removed from the petition', 'It still sells', 'The buyer is paid'], c: 0, why: 'See [[78h]].' },
  { q: 'Can the unit cancel a sale for a foreclosure defect?', a: ['Yes', 'No', 'Only in Wayne'], c: 0, why: 'See [[78m]].' }
]},
{ id: 'm9', title: 'After you win', lessons: [
{ id: 'mi-after', title: 'From the gavel to the recorded deed', body: `
1. **Pay** by the close of the day or within 21 days [[78m]].
2. **File the affidavit** about delinquent taxes and civil fines [[78m]].
3. **Prove payment of taxes owed** to the local unit, within 21 days of the sale [[78m]].
4. **Receive the deed** within 14 days of full payment [[78m]].
5. **Record the deed** with the register of deeds.
6. **Insure and secure** the property. Check utilities and any open permits.
7. **Plan the use or resale**, with a title review and any needed repairs.

?? Make a dated task list for a simulated sale date.` },
{ id: 'mi-outcomes', title: 'Possible outcomes', body: `
- **You hold fee simple title**, with the exceptions in [[78k]].
- **Sale canceled**: unpaid taxes, missing affidavit, a foreclosure defect or a failure to pay [[78m]].
- **Remaining proceeds paid to claimants** from the money above the minimum and costs [[78t]].
- **A claimant sues within 2 years** over something other than proceeds, subject to the limits in [[78l]].

?? Rank these outcomes by how much control you have.` }
], quiz: [
  { q: 'How long after full payment must the deed be delivered?', a: ['Not more than 14 days', '1 year', '5 days'], c: 0, why: 'See [[78m]].' },
  { q: 'Which cancels a sale?', a: ['Unpaid property taxes within 21 days of the sale', 'A sunny day', 'A competing bid'], c: 0, why: 'See [[78m]].' },
  { q: 'Do remaining proceeds go to the buyer?', a: ['No, to claimants', 'Yes', 'To the state only'], c: 0, why: 'See [[78t]].' }
]},
{ id: 'm10', title: 'Local differences inside Michigan', lessons: [
{ id: 'mi-local', title: 'What one verified county tells you', body: `
Michigan's 83 counties each run their own auctions within the statute. We verified one county's official pages (checked ${CK}):

## Wayne County
- Auctions are held in **September and October** of the year of foreclosure. Properties are offered for a **minimum bid** of all delinquent taxes, penalties and interest. Unsold properties go to the October auction [[wayne]].
- Winners receive a **quit claim deed** [[wayne]].
- The county publishes a foreclosed-properties list and claims forms, with a **July 1 claim deadline** [[wayne]].
- Its timeline says taxes delinquent more than one year carry **1.5% a month** interest and the **forfeiture fee is $175** plus administrative fees [[waynetl]] [[78g]].

## Statute comparison
The statute allows auctions from the third Tuesday in July to the first Tuesday in November [[78m]]. Wayne uses a narrower window inside it.

## Second county
[[?We could not read a second county's auction page from this environment. Read two counties' current rules before bidding and compare deposit, platform, payment and group-sale terms.]]

?? Compare Wayne with one county you pick, using the table below.` },
{ id: 'mi-offices', title: 'Which office for what', body: `
- **"Is this property on the auction?"** → county treasurer, or the state Department of Treasury in state-foreclosure counties [[78m]].
- **"What do I owe in taxes at sale?"** → the local tax collecting unit [[78m]].
- **"Recorded easements and restrictions."** → county register of deeds.
- **"Zoning, demolition orders."** → city or township.
- **"Claims for remaining proceeds."** → the foreclosing unit and the circuit court [[78t]].
- **"Foreclosure judgment."** → circuit court clerk [[78k]].

?? Build a contact sheet for one county.` }
], quiz: [
  { q: 'What does Wayne give winners?', a: ['A quit claim deed', 'A tax certificate', 'A mortgage'], c: 0, why: 'See [[wayne]].' },
  { q: 'Who runs the sale in a county that elected state foreclosure?', a: ['The state Department of Treasury', 'The township', 'The sheriff'], c: 0, why: 'See [[78m]].' },
  { q: 'What do the 83 counties share?', a: ['The statute', 'The auction date', 'The platform'], c: 0, why: 'See [[78m]].' }
]},
{ id: 'm11', title: 'Case studies', lessons: [
{ id: 'mi-case-win', title: 'Case 1 (simulated): a well-bought lot', body: `
${SIM}

A vacant residential lot with water access, as-is value $14,000. Minimum bid $2,800. Research: street frontage, no mapped wetlands, no flood zone, no special assessments.

## Math
= Maximum bid worked out in advance: 14,000 − taxes owed $400 − title $300 − holding $500 − selling $1,120 − profit $3,000 = $8,680
= Winning bid: $6,200
= All-in: 6,200 + 400 + 300 + 500 + 1,120 = $8,520
= Sale at $14,000 → profit $5,480 · return 64%

## Why it worked
A clean lot, a maximum bid set from costs, and a bid well below it.` },
{ id: 'mi-case-pass', title: 'Case 2 (simulated): the cheap house with hidden costs', body: `
${SIM}

A house, minimum bid $3,500. The county notes a pending demolition status and a special assessment. Rough value as-is: $9,000 if repaired, $0 if demolished.

## The check
- Demolition cost estimate: $12,000.
- Special assessment: future installments survive [[78k]].
- Repairs to a sale-ready state: $25,000 for a house worth $60,000 repaired.

## Decision: Pass
The cost to demolish or repair exceeds the likely value, and surviving assessments add to it.` },
{ id: 'mi-case-unknown', title: 'Case 3 (simulated): a lot with an unclear boundary', body: `
${SIM}

A $2,200 minimum-bid lot described as "part of lot 14 beginning at a point 40 feet east of the SW corner." The county map shows a thin rectangle.

## What is missing
1. How wide is the strip really, and does it touch a street?
2. Are there recorded easements across it [[78k]]?
3. Does the township require a minimum lot size for building?

## Decision: need more information
Without frontage and zoning answers, you cannot value it. Contact the township zoning office and the register of deeds.` }
], quiz: [
  { q: 'Why was Case 1 a good bid?', a: ['The maximum bid came from costs and the bid stayed well below it', 'It was the lowest bid', 'Luck'], c: 0, why: 'Discipline before bidding.' },
  { q: 'Why pass in Case 2?', a: ['Demolition and repair costs exceed the likely value', 'The county said no', 'The bid was too low'], c: 0, why: 'See [[78k]].' },
  { q: 'These cases are:', a: ['All simulated', 'All real', 'Real except Case 3'], c: 0, why: 'We have no verified Michigan listings or results.' }
]},
{ id: 'm12', title: 'Final project', lessons: [
{ id: 'mi-project', title: 'Final project: research a Michigan auction property and decide', body: `
## Your assignment
Choose a property from a current Michigan county auction list and write a one-page memo:
1. **The listing**: county, parcel number, address (if any), legal description, minimum bid, auction date and platform, list source and date checked.
2. **Verification**: parcel on the county map, acres, shape, street frontage.
3. **Land risks**: flood, wetlands, zoning and access, with sources and dates.
4. **Title and condition risks**: easements and deed restrictions that survive [[78k]], special assessments, taxes owed at sale [[78m]], occupancy, demolition or code status.
5. **Math**: your all-in cost and maximum bid.
6. **Decision**: Bid (with a maximum), Pass or need more information.

## Worked answer (simulated)
${SIM}
1. Example County, parcel 12-34-567-890, vacant lot, minimum bid $3,000, online auction in September. List checked today.
2. 0.18 acre; frontage on a paved street.
3. FEMA Zone X; no mapped wetlands; residential zoning.
4. A recorded 10-ft utility easement across the rear; no special assessments; $350 taxes owed at sale [[78m]].
5. Value $12,000 − taxes $350 − title $300 − holding $500 − selling $960 − profit $3,000 = **$6,890 maximum**.
6. **Bid up to $6,800.**

## Grading rubric (100 points)
- Listing copied exactly with source and date: **15**
- Parcel verified on the map: **15**
- Land risks with sources, unknowns marked: **20**
- Title and condition risks, including what survives: **15**
- Math shown line by line: **20**
- Decision that follows from the evidence: **15**

80 or more passes. An invented fact presented as real caps the score at 60.` }
], quiz: [
  { q: 'What caps the score at 60?', a: ['An invented fact presented as real', 'A late memo', 'Choosing Pass'], c: 0, why: 'Every number needs a source.' },
  { q: 'Your math must include:', a: ['Taxes owed at sale and all costs', 'Only the minimum bid', 'A guess'], c: 0, why: 'See [[78m]].' },
  { q: 'Which answers can the memo end with?', a: ['Bid, Pass or need more information', 'Only Bid', 'Only Pass'], c: 0, why: 'Honesty about gaps is part of the grade.' }
]}
];

const exercise = {
  title: 'Bid or Pass: a simulated Michigan auction property',
  simulated: true,
  label: '**SIMULATED.** PricePocketAsset has no verified Michigan listing yet, so this exercise uses made-up facts. No real property, purchase or payout is described.',
  lien: null,
  calc: { amount: 9000, rate: 0, months: 6, fees: 1200, from: 'Simulated Michigan auction: $9,000 bid plus costs' },
  facts: [
    ['Property', 'Single-family house, 0.15 acre, paved street (simulated)'],
    ['Minimum bid', '$4,000 (simulated)'],
    ['County assessed value', '$14,000 (simulated)'],
    ['Condition', 'Vacant, boarded windows, roof damage (simulated)'],
    ['Taxes owed at sale to the local unit', '$800 (simulated)'],
    ['Special assessments', 'One future installment of about $350 survives [[78k]] (simulated)'],
    ['Flood / wetlands', 'Zone X · no mapped wetlands (simulated)']
  ],
  brief: `
Decide your **maximum bid**, then Bid or Pass, and explain. Assume a repaired as-is resale value of $55,000, repairs of $28,000, holding six months, and selling costs of 8%. Remember the buyer must pay taxes owed on the property before the deed [[78m]], and future special assessment installments survive [[78k]].`,
  walkthrough: `
${SIM}

## 1. Build the maximum bid
= Resale value $55,000
= − Repairs $28,000 · − taxes owed $800 [[78m]] · − assessment installment $350 [[78k]]
= − Title and recording $500 · − holding 6 months $2,400 · − selling 8% $4,400
= − Required profit $8,000
= Maximum bid: 55,000 − 28,000 − 800 − 350 − 500 − 2,400 − 4,400 − 8,000 = **$10,550**

## 2. Competition
The minimum is $4,000. Many bidders will go well above it. If bids exceed about $10,500, walk away.

## 3. A reasonable answer
**Bid, with a hard maximum near $10,500**, only if you can confirm condition and repair costs. Pass if the roof damage hides structural problems you cannot price. Strong answers include the taxes owed at sale, the surviving installment and the margin for repair surprises.`
};

export default {
  id: 'mi', state: 'MI', title: 'Michigan Tax Foreclosure Auctions: The Complete Course', status: 'published', checked: CK,
  review: 'Batch 1. Rules cited to the Michigan Compiled Laws (General Property Tax Act, MCL 211.78 to 211.78t), read from legislature.mi.gov, checked ' + CK + '. One county (Wayne) was verified from its own pages; a second could not be read. Items marked "Needs review" were not verified. Case studies and the exercise are simulated because we have no verified Michigan listing or outcome records. No outside legal review yet.',
  intro: 'How Michigan forfeits and forecloses tax-delinquent property in circuit court and then sells it at county auction: the calendar, first-refusal rights, minimum bids, the buyer affidavit, what survives, remaining proceeds and how to research and decide. Every rule cited to the statute.',
  sources, modules, exercise,
  glossary: [
    ['Forfeiture', 'Delinquent property passes to the county treasurer on March 1 after 12 months or more of delinquency.'],
    ['Foreclosing governmental unit', 'Usually the county treasurer, or the state if the county elected state foreclosure.'],
    ['Petition for foreclosure', 'The single court filing, due by June 15, listing all forfeited property.'],
    ['Judgment of foreclosure', 'The circuit court order that vests title in the unit if the amounts are not paid by March 31 (or 21 days after in a contested case).'],
    ['Minimum bid', 'All delinquent taxes, interest, penalties and fees, and possibly the unit’s costs.'],
    ['Right of first refusal', 'The state’s first chance to buy at the greater of the minimum bid or fair market value.'],
    ['Remaining proceeds', 'Sale money above the minimum bid and costs, claimable by former owners and interest holders.'],
    ['Quit claim deed', 'A deed with no warranties about title. Wayne County gives these to auction winners.'],
    ['Special assessment', 'A charge for local improvements. Future installments survive foreclosure.'],
    ['Land bank', 'A public authority that can hold and sell unsold foreclosed property.'],
    ['Contested case', 'A foreclosure in which a person files objections; redemption ends 21 days after judgment.']
  ],
  links: [
    ['Michigan General Property Tax Act, MCL 211.78 to 211.78t', 'https://www.legislature.mi.gov/Laws/MCL?objectName=mcl-211-78', 'statute'],
    ['Wayne County Treasurer: Claims & Auctions', 'https://www.waynecountymi.gov/Services/Property-Taxes/Auctions-Claims', 'county'],
    ['Wayne County Treasurer: Forfeiture/Foreclosure Timeline', 'https://www.waynecountymi.gov/Government/Elected-Officials/Treasurer/Property-Tax-Information/ForfeitureForeclosure-Timeline', 'county'],
    ['Our Michigan page', '/liens/states/state/?s=MI', 'site'],
    ['FEMA Flood Map Service Center', 'https://msc.fema.gov/portal/search', 'federal']
  ],
  checklists: {
    research: ['Parcel number and legal description copied exactly', 'Found on the county map; acres and frontage checked', 'Minimum bid versus my as-is value', 'Flood with source and date', 'Wetlands with source and date', 'Zoning from the city or township', 'Easements and deed restrictions at the register of deeds', 'Special assessments (future installments survive)', 'Taxes owed to the local unit at sale', 'Occupancy and condition from the street', 'Demolition or code status', 'Confirm the property is still on the auction'],
    bid: ['Delinquent-tax and civil-fine affidavit can be signed truthfully', 'Registered under the county’s rules', 'Funds ready (full payment at close or within 21 days)', 'Taxes owed to the local unit ready (within 21 days)', 'Maximum bid worked out from all costs', 'Plan for occupants and condition', 'Deed recording plan (within 14 days of payment)', 'Everything logged in My portfolio']
  }
};
