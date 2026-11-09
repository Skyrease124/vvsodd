// The Liens & Deeds Master Class. Lessons 1-3 are free; 4-10 are sent only to members (see netlify/functions/learn.mjs).
// Educational only. Rules differ by state and change; every lesson points people back to the state pages and the county.
// Each lesson: id, title, mins, free, intro, sections [{h, p:[...]}], takeaways [...], tryIt {text, href}, quiz [{q, a:[...], c: correct index, why}].
export const LESSONS = [
  {
    id: 'basics', title: 'What tax liens and tax deeds are', mins: 6, free: true,
    intro: 'Every property owner owes property tax. When they don’t pay, the county still needs that money for schools, roads and police. Tax sales are how counties collect it, and that is where investors come in.',
    sections: [
      { h: 'The problem the county has', p: ['Property tax pays for local services. When an owner falls behind, the county can’t wait years for the money, so state law lets it sell the debt or the property to someone else.'] },
      { h: 'A tax lien: you buy the debt', p: ['In a tax lien state, you pay the owner’s overdue tax to the county. In return you get a certificate (a lien) on the property.', 'The owner still owns the property. To clear the lien they must pay back what you paid plus interest or a penalty set by state law. That repayment is called redemption.', 'If the owner never pays within the time the law allows, you can usually start a process to take the property. Most of the time, though, the owner pays.'] },
      { h: 'A tax deed: you buy the property', p: ['In a tax deed state, the county sells the property itself at auction after the owner has been behind for a set time. The winning bidder gets a deed.', 'You are buying real estate, usually with no chance to inspect inside, and you take on everything that comes with it.'] },
      { h: 'Redeemable deeds: a mix of both', p: ['A few states (for example Georgia and Texas) sell a deed, but the owner can still buy it back for a period by paying your price plus a set premium. If they don’t, you keep the property.'] },
      { h: 'Who actually makes money', p: ['Lien investors mostly earn interest when owners redeem. Deed investors earn by buying property below its value. Both can lose money if they skip research, which is what the rest of this course is about.'] }
    ],
    takeaways: ['A lien = you buy the tax debt and earn interest when the owner pays.', 'A deed = you buy the property itself at auction.', 'Redeemable deed = you buy the property, but the owner can still buy it back for a while.', 'Most liens get paid off; getting the property is the exception.'],
    tryIt: { text: 'Tap a state on the map to see whether it sells liens, deeds or redeemable deeds.', href: '/#map' },
    quiz: [
      { q: 'You buy a tax lien certificate. Who owns the property right after the sale?', a: ['You do', 'The original owner still does', 'The county does'], c: 1, why: 'A lien is a claim for money. The owner keeps the property unless they never redeem and you complete the legal process.' },
      { q: 'What usually happens with a tax lien?', a: ['The owner pays it back with interest', 'The investor gets the house', 'The county cancels it'], c: 0, why: 'Most owners redeem. Plan on earning interest, not on getting property.' },
      { q: 'In a tax deed sale, what do you buy?', a: ['Only the tax debt', 'The property itself', 'A share of county taxes'], c: 1, why: 'A tax deed sale transfers the property to the winning bidder.' }
    ]
  },
  {
    id: 'returns', title: 'How liens earn money: rates, penalties and bidding', mins: 7, free: true,
    intro: 'The rate on the certificate is not always what you earn. How the auction works in your state decides your real return.',
    sections: [
      { h: 'Interest vs. penalty', p: ['Some states pay interest by the year or month (Iowa: 2% a month, 24% a year). Others pay a flat penalty no matter how fast the owner pays (Texas and Georgia redeemable deeds pay a set premium). A flat penalty is great if the owner pays in a month and weak if they take years.'] },
      { h: 'Bid-down states', p: ['In Florida, Arizona, New Jersey and Illinois, bidders compete by lowering the interest rate. Florida starts at 18% and can be bid down to 0.25%. Popular liens often end up far below the maximum.', 'Florida guarantees a 5% minimum on most certificates when redeemed (unless bid to 0%), so a low bid still earns something on a fast redemption.'] },
      { h: 'Premium bidding', p: ['In Colorado and some other states, the rate is fixed by law and bidders compete by paying extra above the tax owed. That extra (the premium) usually earns no interest and may not be refunded, so overbidding quietly cuts your return.'] },
      { h: 'Other auction methods', p: ['Some counties pick winners by rotation or random draw, or bid down the percentage of ownership. Always read the county’s sale rules before you register.'] },
      { h: 'Fees eat small liens', p: ['Registration fees, per-certificate fees, wire fees and your own time matter. A $50 lien at 18% earns about $9 a year. A $15 fee wipes out most of it.'] }
    ],
    takeaways: ['Know whether your state pays interest or a flat penalty.', 'In bid-down states, the rate you win at is what you earn, not the maximum.', 'In premium states, the premium usually earns nothing.', 'Fees matter most on small liens.'],
    tryIt: { text: 'Use the calculator with the face amount, rate and months to see real dollars, not percentages.', href: '/liens/#calculator' },
    quiz: [
      { q: 'In a bid-down state like Florida, what do bidders compete on?', a: ['Who pays the most', 'Who accepts the lowest interest rate', 'Who registers first'], c: 1, why: 'The lowest rate wins, so the rate you earn is often well below the 18% maximum.' },
      { q: 'In a premium-bid state, does the premium you pay above face earn interest?', a: ['Yes, at the full rate', 'Usually no', 'Only after 3 years'], c: 1, why: 'Premiums usually earn nothing and may not be refunded. Overbidding lowers your real return.' },
      { q: 'A flat 25% penalty is best for the investor when the owner redeems…', a: ['Very quickly', 'After many years', 'It makes no difference'], c: 0, why: 'A flat penalty doesn’t grow with time, so a fast redemption means a high yearly return.' }
    ]
  },
  {
    id: 'states', title: 'Lien states, deed states and how to read a state page', mins: 6, free: true,
    intro: 'Every state writes its own rules. Before you look at a single property, learn the system, the rate, the redemption period and the sale timing for that state.',
    sections: [
      { h: 'The four things to know first', p: ['1) System: lien, deed, redeemable deed, or a hybrid. 2) Rate or penalty and how bidding works. 3) Redemption period: how long the owner has to pay you back. 4) When and where sales happen, and whether they are online.'] },
      { h: 'Examples', p: ['Florida: liens, up to 18%, bid down; after 2 years the holder can apply for a tax deed. Arizona: liens up to 16%, bid down; 3 years before you can foreclose. Iowa: fixed 24% a year. California and Michigan: deed states, no interest paid to investors. Georgia and Texas: redeemable deeds with set premiums.'] },
      { h: 'Counties run the sales', p: ['The state sets the rules, but each county (or city) runs its own sale, posts its own list and sets its own registration steps, deposits and dates. Two counties in the same state can feel very different.'] },
      { h: 'Rules change', p: ['States change rates and timelines. Always check the county’s current sale notice and the statute linked on each state page before you bid.'] }
    ],
    takeaways: ['Learn the system, rate, redemption period and sale timing first.', 'The county runs the sale, so read its own rules.', 'Rules change. Confirm before every sale.'],
    tryIt: { text: 'Open a state page and find its system, rate, redemption period and statute link.', href: '/liens/states/' },
    quiz: [
      { q: 'Who usually runs the actual tax sale?', a: ['The federal government', 'Each county or city', 'A national bank'], c: 1, why: 'States set the rules; counties run the sales and post the lists.' },
      { q: 'Which is a deed state where investors earn no interest?', a: ['Iowa', 'California', 'Florida'], c: 1, why: 'California sells tax deeds. Iowa and Florida are lien states.' },
      { q: 'Before bidding, you should confirm the rules…', a: ['Once, years ago', 'With the county’s current sale notice', 'On a forum'], c: 1, why: 'Rules and dates change. The county’s current notice is the source.' }
    ]
  },
  {
    id: 'sale', title: 'How a tax sale works, step by step', mins: 8, free: false,
    intro: 'From the delinquent list to holding a certificate: what actually happens, and where beginners trip up.',
    sections: [
      { h: '1. The list is published', p: ['Weeks before the sale, the county publishes the delinquent list (newspaper, website or the auction site). Many owners pay before the sale, so the list shrinks every day.'] },
      { h: '2. Register and deposit', p: ['You register as a bidder, give a W-9 (or W-8 if not a US person), and often put down a deposit, commonly 10% of what you plan to buy. Deadlines are strict.'] },
      { h: '3. Research and choose', p: ['This is where money is made or lost. Pick parcels, then check each one (see the due diligence lesson). Skip what you can’t verify.'] },
      { h: '4. Bid', p: ['Most sales are online now. You set a bid (a rate, a premium or an amount). Some sites let you set a lowest rate you’ll accept and bid for you automatically.'] },
      { h: '5. Pay and receive', p: ['Winners pay within the deadline. You receive the certificate (often electronic). Keep the records: certificate number, parcel, amount, rate and date.'] },
      { h: 'After the sale: county-held liens', p: ['Liens nobody buys often go to the county. Some counties sell these county-held or over-the-counter liens later at the full rate, first come first served. These are often leftovers, like slivers, strips and mineral rights, so check them extra carefully.'] }
    ],
    takeaways: ['Lists shrink as owners pay before the sale.', 'Registration, W-9 and deposits have hard deadlines.', 'Research before bidding, not after.', 'County-held liens can be bought later, but are often leftovers.'],
    tryIt: { text: 'Open a county list and look at the How to buy steps for a lien.', href: '/liens/states/state/?s=FL' },
    quiz: [
      { q: 'Why does the delinquent list get shorter before the sale?', a: ['The county deletes random parcels', 'Owners pay their taxes', 'Investors buy early'], c: 1, why: 'Paying the taxes removes the parcel from the sale.' },
      { q: 'What do most counties require before you can bid?', a: ['A real estate license', 'Registration and a tax form like a W-9', 'Owning property in the county'], c: 1, why: 'Registration and a W-9 (or W-8) are standard; many also want a deposit.' },
      { q: 'County-held liens are often…', a: ['The best lots in the county', 'Leftovers nobody wanted at auction', 'Only for government buyers'], c: 1, why: 'They went unsold for a reason. Check each one carefully.' }
    ]
  },
  {
    id: 'redemption', title: 'Redemption: when the owner pays you back', mins: 6, free: false,
    intro: 'Redemption is how most lien investments end, and it is the outcome you should plan for.',
    sections: [
      { h: 'How the money flows', p: ['The owner (or their mortgage lender) pays the county the tax plus interest and fees. The county then pays you. You usually don’t deal with the owner directly.'] },
      { h: 'Lenders often pay', p: ['If there is a mortgage, the lender often pays the taxes to protect its loan. That is good for you: quick, reliable redemption.'] },
      { h: 'Your clock and your costs', p: ['Your return depends on how long it takes. In interest states, longer is more money; in flat-penalty states, faster is better.', 'Some states require the investor to pay later years’ taxes too (subsequent taxes) to protect their position. Those also earn interest.'] },
      { h: 'Don’t contact or pressure owners', p: ['Many states forbid lien holders from contacting owners about payment or entering the property. Let the county handle redemption.'] }
    ],
    takeaways: ['Most liens end with redemption: plan for it.', 'Mortgage lenders often redeem quickly.', 'Know whether your state pays more for time or a flat amount.', 'Don’t pressure owners or go onto the property.'],
    tryIt: { text: 'Add a lien to My portfolio to track its redemption deadline and estimated interest.', href: '/portfolio/' },
    quiz: [
      { q: 'Who usually pays the investor when a lien is redeemed?', a: ['The owner hands you cash', 'The county pays you', 'Your bank'], c: 1, why: 'Redemption goes through the county, which then pays the certificate holder.' },
      { q: 'Why is a mortgage on the property often good for a lien holder?', a: ['The lender often pays the taxes', 'It doubles the interest rate', 'It lets you foreclose sooner'], c: 0, why: 'Lenders protect their loans by paying overdue taxes.' },
      { q: 'May you visit the property to ask the owner to pay?', a: ['Yes, always', 'Many states forbid it; let the county handle it', 'Only on weekends'], c: 1, why: 'Contacting or entering is often prohibited. It also creates risk for you.' }
    ]
  },
  {
    id: 'property', title: 'When the owner doesn’t pay: getting the property', mins: 7, free: false,
    intro: 'If the redemption period ends unpaid, you may be able to take the property. It is a legal process with costs, not an automatic prize.',
    sections: [
      { h: 'Tax deed application or foreclosure', p: ['In some states (Florida, for example) you apply for a tax deed; the county then holds a deed auction where others can outbid you, and you are paid off if they do. In others (Arizona, for example) you file a foreclosure lawsuit after the waiting period.'] },
      { h: 'Costs you pay up front', p: ['Application fees, title searches, notices, court and attorney costs and any other certificates on the parcel. These can exceed the lien itself on a cheap lot.'] },
      { h: 'Title is often not clean', p: ['A deed from a tax process may not be insurable at first. Many buyers need a quiet title action (a court case) before a title company will insure it or a buyer will buy it.'] },
      { h: 'People and buildings', p: ['If someone lives there, removing them takes a legal eviction. Buildings may be damaged or carry code fines.'] }
    ],
    takeaways: ['Getting the property is a legal process with real costs.', 'In deed-application states, others can outbid you at the deed auction.', 'Expect to need a quiet title before you can resell easily.'],
    tryIt: { text: 'Read your state’s redemption and deed rules on its state page before buying.', href: '/liens/states/' },
    quiz: [
      { q: 'After a Florida tax deed application, can someone else end up with the property?', a: ['No, it is yours automatically', 'Yes, others can outbid you at the deed auction', 'Only the county can'], c: 1, why: 'The deed auction is open. If someone outbids you, you are paid off.' },
      { q: 'What often has to happen before a tax deed property is easy to resell?', a: ['Nothing', 'A quiet title action', 'A new survey only'], c: 1, why: 'Title companies often require quiet title before insuring.' },
      { q: 'Can the costs of getting a cheap lot exceed the lien amount?', a: ['Yes', 'No, costs are capped at the lien', 'Only in deed states'], c: 0, why: 'Fees, notices and legal costs can be larger than a small lien.' }
    ]
  },
  {
    id: 'diligence', title: 'Due diligence: red flags before you buy', mins: 9, free: false,
    intro: 'Cheap liens are often cheap for a reason. This checklist is what separates investors from people who get stuck.',
    sections: [
      { h: 'Is it really land you would want?', p: ['Watch for slivers and strips (a 10-foot drainage strip), road rights-of-way, common areas, condo units in troubled buildings, and mineral-rights-only parcels. If the owner wouldn’t pay $50 to keep it, ask why.'] },
      { h: 'Access, flood and wetlands', p: ['No mapped road can mean landlocked. A high-risk flood zone brings insurance and building rules. Wetlands can stop building altogether. Use Land Information on every listing.'] },
      { h: 'Value vs. debt', p: ['Compare the county value with the lien and any other certificates on the same parcel. Several unpaid years in a row is a warning sign.'] },
      { h: 'Other claims', p: ['Look for other liens, code-enforcement fines, environmental problems and bankruptcy. A bankruptcy filing can pause redemption and your rights.'] },
      { h: 'Look at it', p: ['Use satellite and street view, and drive by if you can. Never go onto the property or disturb occupants.'] }
    ],
    takeaways: ['Skip slivers, strips, mineral-only and landlocked lots unless you understand them.', 'Check flood, wetlands and road access on every lot.', 'Many unpaid years and a low value are warning signs.', 'If you can’t verify it, don’t buy it.'],
    tryIt: { text: 'Open How to buy on any lien and read its Land Information section.', href: '/liens/states/county/?c=Manatee' },
    quiz: [
      { q: 'A $40 county-held lien on a 10-foot-wide strip with no road is most likely…', a: ['A hidden gem', 'Hard to use or sell', 'Guaranteed profit'], c: 1, why: 'Strips with no access are why the lien went unsold.' },
      { q: 'Wetlands on a lot can…', a: ['Limit or stop building', 'Double the value', 'Lower the tax rate'], c: 0, why: 'Wetlands often need permits and may block building.' },
      { q: 'A parcel has 6 certificates outstanding. This suggests…', a: ['The owner always pays on time', 'Years of unpaid taxes: research carefully', 'The county made an error'], c: 1, why: 'Many unpaid years often means the owner has walked away, sometimes because the land has problems.' }
    ]
  },
  {
    id: 'risks', title: 'The big risks nobody mentions', mins: 7, free: false,
    intro: 'Liens are often called safe. They are secured by real property, but these risks catch people every year.',
    sections: [
      { h: 'Worthless collateral', p: ['A lien is only as good as the property behind it. If the land is worthless, nobody redeems and the property is not worth taking.'] },
      { h: 'Federal tax liens and bankruptcy', p: ['If the IRS has a lien on the property, the US government generally keeps a right to redeem for 120 days after a tax deed sale. A bankruptcy filing pauses collection and can delay or change your payoff.'] },
      { h: 'Money tied up', p: ['Your money may be locked up for years. Don’t invest money you might need soon.'] },
      { h: 'Losing your lien', p: ['Missing a deadline (for example, when a certificate expires in Florida after 7 years without a deed application) can mean losing it. Errors in the sale can lead to a refund with little or no interest.'] },
      { h: 'Scams', p: ['Be wary of sellers of tax lien lists, courses promising easy property, and anyone asking you to wire money for a lien. Buy only from the county or its official auction site.'] }
    ],
    takeaways: ['Bad land = bad lien.', 'IRS liens and bankruptcies can change the outcome.', 'Expect money to be tied up for years.', 'Track every deadline.', 'Buy only through the county or its official site.'],
    tryIt: { text: 'Set reminders in My portfolio for each certificate’s key dates.', href: '/portfolio/' },
    quiz: [
      { q: 'After a tax deed sale on a property with an IRS lien, the US government generally has…', a: ['No rights', 'A 120-day right to redeem', 'Ownership'], c: 1, why: 'Federal law gives the US a right to redeem for 120 days in many cases.' },
      { q: 'Where should you buy a tax lien?', a: ['From the county or its official auction site', 'From a stranger by wire transfer', 'From a social media ad'], c: 0, why: 'Only the county (or its official site) sells real tax liens.' },
      { q: 'What happens if you miss a key deadline on a certificate?', a: ['Nothing', 'You can lose it', 'The rate doubles'], c: 1, why: 'Some certificates expire if you don’t act in time.' }
    ]
  },
  {
    id: 'deeds', title: 'Buying at tax deed auctions', mins: 7, free: false,
    intro: 'Tax deed auctions sell the property itself. Prices can be low, but you are buying a property you usually can’t inspect.',
    sections: [
      { h: 'How deed auctions work', p: ['The opening bid usually covers back taxes and costs. Bidding goes up from there. You often must pay in full within a day or so, so have funds ready before you bid.'] },
      { h: 'What may survive the sale', p: ['Depending on the state, some things can stay attached: other government liens, certain easements, IRS redemption rights and sometimes HOA claims. Find out before you bid.'] },
      { h: 'Surplus goes to the old owner', p: ['If the property sells for more than the taxes and costs, the extra (surplus) usually belongs to the former owner or lienholders, not the county.'] },
      { h: 'After you win', p: ['You may need a quiet title action, an eviction if it is occupied, and repairs. Insurance and taxes are now yours from day one.'] }
    ],
    takeaways: ['You usually can’t inspect inside; price in the unknowns.', 'Have full payment ready before bidding.', 'Find out what liens and claims survive.', 'Budget for quiet title, eviction and repairs.'],
    tryIt: { text: 'Check a deed state like California or Michigan on the map.', href: '/#map' },
    quiz: [
      { q: 'At a tax deed auction, the opening bid usually covers…', a: ['The full market value', 'Back taxes and sale costs', 'Nothing; it starts at $0'], c: 1, why: 'The minimum bid is usually the taxes and costs owed.' },
      { q: 'If a deed sells for more than what was owed, the surplus usually goes to…', a: ['The county', 'The former owner or lienholders', 'The winning bidder'], c: 1, why: 'Surplus belongs to the former owner or other lienholders.' },
      { q: 'Before bidding on a deed, you should…', a: ['Assume all liens are wiped out', 'Find out what claims survive', 'Skip research to save time'], c: 1, why: 'Some claims can survive the sale, depending on the state.' }
    ]
  },
  {
    id: 'plan', title: 'Your first purchase plan', mins: 6, free: false,
    intro: 'Put it all together into a simple plan you can follow for your first sale.',
    sections: [
      { h: '1. Pick one state and one county', p: ['Learn its system, rate, redemption period, sale dates and registration steps. Read the statute and the county’s rules.'] },
      { h: '2. Set a budget you can leave alone', p: ['Use money you won’t need for years. Spread it over several liens instead of one big one.'] },
      { h: '3. Screen and research', p: ['Use the screener to shortlist, then check each lot: Land Information, county records, value vs. debt and other certificates. Cross off anything you can’t verify.'] },
      { h: '4. Bid with a limit', p: ['Decide your lowest acceptable rate or highest premium before the sale and stick to it.'] },
      { h: '5. Track and report', p: ['Record every certificate in your portfolio. Interest you earn is usually taxable income. Keep records for your tax preparer.'] }
    ],
    takeaways: ['Start with one county you understand.', 'Spread a budget you can leave alone for years.', 'Set your bid limits before the sale.', 'Track everything; interest is usually taxable.'],
    tryIt: { text: 'Shortlist liens with the screener, then save them as favorites.', href: '/liens/states/county/?c=Palm%20Beach' },
    quiz: [
      { q: 'A good first step is to…', a: ['Bid in ten states at once', 'Learn one county well', 'Buy the cheapest lien you see'], c: 1, why: 'Knowing one county’s rules and lists well beats spreading thin.' },
      { q: 'When should you decide your bid limit?', a: ['During the auction', 'Before the sale starts', 'After you win'], c: 1, why: 'Setting limits ahead keeps emotion out of bidding.' },
      { q: 'Interest earned on tax liens is usually…', a: ['Tax free', 'Taxable income', 'Paid only in property'], c: 1, why: 'Treat it as taxable income and keep records. Ask a tax professional.' }
    ]
  }
];
export const outline = () => LESSONS.map(l => ({ id: l.id, title: l.title, mins: l.mins, free: !!l.free }));
