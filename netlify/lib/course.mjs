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
    example: "Made-up numbers: an owner owes $1,000 in back tax. In a lien state you pay the county $1,000 and hold a certificate at 12% a year. If the owner pays you back after 6 months, you get $1,000 plus about $60 interest (1,000 × 12% × 0.5), so $1,060. You never owned the house.",
    mistakes: ["Expecting to get the house. Most liens are paid off.", "Thinking a lien is risk-free. The owner can pay late, never pay, or the property can be worth less than the debt.", "Assuming every state works the same way."],
    checklist: ["Is my state a lien, deed or redeemable-deed state?", "Who runs the sale: the county or the city?", "How long does the owner have to pay back (redemption)?"],
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
    example: "Made-up numbers: a $2,000 lien. If you win at the 18% maximum and the owner pays after 9 months, interest is about $270 (2,000 × 18% × 0.75). If competition bids it down to 6%, the same lien earns about $90. Premium states: if you pay $1,300 for a $1,000 lien and the $300 premium is not refunded, a 10% year gives you $1,100 back on $1,300 paid, a loss.",
    mistakes: ["Planning on the maximum rate in a bid-down state.", "Overbidding premiums.", "Ignoring fees on small liens.", "Forgetting the money is tied up until the owner pays."],
    checklist: ["Does this state pay interest or a flat penalty?", "Is bidding by lowest rate or by premium?", "What are the registration and per-certificate fees?", "What is my real return after fees?"],
    tool: "calc",
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
    example: "Compare two states on the same four things. State A: lien, bid-down to a maximum, 3 years before foreclosure, one online sale a year. State B: deed, no interest, auction after a set delinquency time. Same word, tax sale, very different plans.",
    mistakes: ["Using one state's rules in another.", "Trusting an old article or forum post.", "Skipping the county's own sale notice."],
    checklist: ["System, rate or penalty, redemption period, sale timing: written down for my state.", "Statute link opened and checked.", "County's current sale notice read."],
    takeaways: ['Learn the system, rate, redemption period and sale timing first.', 'The county runs the sale, so read its own rules.', 'Rules change. Confirm before every sale.'],
    tryIt: { text: 'Open a state page and find its system, rate, redemption period and statute link.', href: '/liens/states/' },
    quiz: [
      { q: 'Who usually runs the actual tax sale?', a: ['The federal government', 'Each county or city', 'A national bank'], c: 1, why: 'States set the rules; counties run the sales and post the lists.' },
      { q: 'Which is a deed state where investors earn no interest?', a: ['Iowa', 'California', 'Florida'], c: 1, why: 'California sells tax deeds. Iowa and Florida are lien states.' },
      { q: 'Before bidding, you should confirm the rules…', a: ['Once, years ago', 'With the county’s current sale notice', 'On a forum'], c: 1, why: 'Rules and dates change. The county’s current notice is the source.' }
    ]
  },
  {
    "id": "terms",
    "title": "Auction terms you will hear on sale day",
    "mins": 6,
    "free": false,
    "intro": "Every tax sale has its own words. Learn them once and any county’s rules become readable.",
    "sections": [
      {
        "h": "Before the sale",
        "p": [
          "Delinquent list or sale list: the parcels being offered. Advertisement or notice: the legally required publication. Registration: signing up to bid, often with a tax form such as a W-9. Deposit: money the county holds to make sure winners pay."
        ]
      },
      {
        "h": "During the sale",
        "p": [
          "Opening bid or minimum bid: the lowest acceptable bid. Bid-down: bidders compete on a lower interest rate (lien states such as Florida). Premium bidding: bidders pay more than the amount owed. Proxy bid: your maximum, entered ahead and bid for you automatically by the platform. Struck off or bid off: no sufficient bid, so the county or taxing unit takes it."
        ]
      },
      {
        "h": "After the sale",
        "p": [
          "Certificate or deed: what the winner receives. Redemption: the owner (or another allowed person) paying off the debt. Redemption period: how long they have. Surplus or excess proceeds: sale money above what was owed, held for claimants."
        ]
      }
    ],
    "takeaways": [
      "Know whether your state auctions a rate (lien) or a price (deed).",
      "“Struck off” means nobody bid enough and the government holds it.",
      "Redemption period and surplus rules differ by state; the state courses cite each one."
    ],
    "tryIt": {
      "text": "Open the Florida or Texas full course and find three of these terms in the first module.",
      "href": "/learn/tracker/"
    },
    "quiz": [
      {
        "q": "In a bid-down auction, bidders compete on…",
        "a": [
          "A lower interest rate",
          "A higher price",
          "Who registered first"
        ],
        "c": 0,
        "why": "Lien states such as Florida auction the rate down."
      },
      {
        "q": "“Struck off” means…",
        "a": [
          "The winner paid early",
          "No sufficient bid, so the government took it",
          "The parcel was removed by the owner"
        ],
        "c": 1,
        "why": "Unsold parcels go to the county or taxing unit."
      },
      {
        "q": "A proxy bid is…",
        "a": [
          "Your maximum, entered ahead for the platform to bid for you",
          "A bid by a lawyer",
          "An illegal bid"
        ],
        "c": 0,
        "why": "Online platforms bid up or down to your limit."
      }
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
    example: "A typical timeline (it varies): the list is published about a month ahead, registration closes days before, the sale runs online over a day or two, and payment is due within a short deadline. Miss one date and you miss the sale.",
    mistakes: ["Registering at the last minute.", "Not reading the county's terms.", "Bidding on parcels you did not research.", "Not having funds ready by the payment deadline."],
    checklist: ["Registered and W-9 filed.", "Deposit sent and confirmed.", "Parcels researched and shortlisted.", "Funds ready for the payment deadline.", "Records saved: certificate number, parcel, amount, rate, date."],
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
    example: "Made-up dates: you buy a lien on March 1 in a state with a 2-year redemption period. The window is estimated to end March 1 two years later. Interest is usually owed up to the day the owner pays, so the exact payoff comes from the county, not from your own math.",
    mistakes: ["Not tracking the redemption end date.", "Assuming foreclosure starts automatically.", "Not saving notices and mail from the county.", "Forgetting that interest income may be taxable."],
    checklist: ["End of redemption date saved in My portfolio.", "County contact saved.", "Know what the next step is if nobody pays.", "Ask a tax professional about reporting the interest."],
    tool: "calc",
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
    example: "If the owner never pays, a lien holder usually has to take legal steps, such as notices and a foreclosure or deed application, before getting the property. This takes time and money, and the result can still leave other claims on the property. Ask a local attorney.",
    mistakes: ["Assuming the certificate alone gives you the property.", "Skipping the notice and deadline steps.", "Assuming title is clean afterward. Many buyers need a quiet title action.", "Not budgeting legal costs."],
    checklist: ["State steps from foreclosure to deed read.", "Local real estate attorney identified.", "Budget for notices, legal fees and title work.", "Plan for occupants and back taxes."],
    takeaways: ['Getting the property is a legal process with real costs.', 'In deed-application states, others can outbid you at the deed auction.', 'Expect to need a quiet title before you can resell easily.'],
    tryIt: { text: 'Read your state’s redemption and deed rules on its state page before buying.', href: '/liens/states/' },
    quiz: [
      { q: 'After a Florida tax deed application, can someone else end up with the property?', a: ['No, it is yours automatically', 'Yes, others can outbid you at the deed auction', 'Only the county can'], c: 1, why: 'The deed auction is open. If someone outbids you, you are paid off.' },
      { q: 'What often has to happen before a tax deed property is easy to resell?', a: ['Nothing', 'A quiet title action', 'A new survey only'], c: 1, why: 'Title companies often require quiet title before insuring.' },
      { q: 'Can the costs of getting a cheap lot exceed the lien amount?', a: ['Yes', 'No, costs are capped at the lien', 'Only in deed states'], c: 0, why: 'Fees, notices and legal costs can be larger than a small lien.' }
    ]
  },
  {
    "id": "parcels",
    "title": "Parcel IDs: matching the right land",
    "mins": 6,
    "free": false,
    "intro": "A parcel ID is how every county record finds one piece of land. Getting it slightly wrong means researching the wrong property.",
    "sections": [
      {
        "h": "What a parcel ID is",
        "p": [
          "Counties assign each parcel a number (called a PIN, folio, strap, account or parcel number). Formats differ by county and can differ between the tax collector, the appraiser and statewide maps."
        ]
      },
      {
        "h": "Formatting traps",
        "p": [
          "Dashes and spaces may be dropped or kept; leading zeros matter; some counties use a separate account number. In our Florida data, Palm Beach lists drop dashes on the statewide map, Leon keeps double spaces, and Hillsborough and Escambia use account numbers that must be cross-walked to the map’s ID."
        ]
      },
      {
        "h": "How to verify a match",
        "p": [
          "Copy the ID exactly, look it up on the county appraiser site, and compare the legal description, acreage and owner. If two parcels could match, stop and ask the county."
        ]
      }
    ],
    "example": "Real example: Palm Beach list ID 74-43-43-16-00-001-0340 is stored as 74434316000010340 on the Florida statewide parcel map; the digits match, only the dashes differ.",
    "mistakes": [
      "Retyping an ID and dropping a zero.",
      "Assuming the map’s ID and the list’s ID use the same format.",
      "Bidding when two parcels could match."
    ],
    "checklist": [
      "ID copied exactly",
      "Matched on the county site",
      "Legal description and acres agree",
      "Any format difference written down"
    ],
    "takeaways": [
      "Copy, never retype.",
      "Match on more than the number: legal description and size too.",
      "Ambiguous match means stop."
    ],
    "tryIt": {
      "text": "Tap Show on map on any Florida listing and compare the list ID with the “Official parcel ID”.",
      "href": "/liens/states/county/?c=Palm%20Beach"
    },
    "quiz": [
      {
        "q": "Why keep leading zeros?",
        "a": [
          "They look neat",
          "They are part of the official ID and lookups fail without them",
          "They mean the parcel is vacant"
        ],
        "c": 1,
        "why": "IDs must match character for character."
      },
      {
        "q": "Two parcels could match your ID. What do you do?",
        "a": [
          "Pick the cheaper one",
          "Stop and confirm with the county",
          "Bid on both"
        ],
        "c": 1,
        "why": "An ambiguous match can mean buying the wrong land."
      },
      {
        "q": "Besides the number, what should agree?",
        "a": [
          "Legal description and acreage",
          "The owner’s phone",
          "Nothing"
        ],
        "c": 0,
        "why": "Several facts together confirm the match."
      }
    ]
  },
  {
    "id": "gis",
    "title": "GIS and parcel maps: what they show and what they don’t",
    "mins": 7,
    "free": false,
    "intro": "Parcel maps (GIS) let you see a lot’s shape, neighbors, roads, flood zones and wetlands in minutes. They are powerful and approximate.",
    "sections": [
      {
        "h": "Layers that matter",
        "p": [
          "Parcel boundaries (county or statewide), aerial imagery (on our site: USGS NAIP with its capture date), FEMA flood hazard zones, U.S. Fish and Wildlife wetlands, Census roads, and local zoning where published."
        ]
      },
      {
        "h": "Reading overlap",
        "p": [
          "Check the whole lot, not one point. A lot can be 10% in a high-risk flood zone and 90% outside it. Our parcel records show the share of the lot in each zone."
        ]
      },
      {
        "h": "Limits",
        "p": [
          "Outlines are not surveys. A road on a map is not proof of legal access. “Data unavailable” is not the same as “no problem found”. Imagery can be years old."
        ]
      }
    ],
    "example": "Leon County parcel 1308202020000: 40% FEMA Zone A, 24.6% mapped wetland, no mapped road within about 65 ft. All visible in one click on our map.",
    "mistakes": [
      "Treating a map outline as a survey.",
      "Reading “unavailable” as “clear”.",
      "Assuming a mapped road means legal access."
    ],
    "checklist": [
      "Outline, size and shape checked",
      "Flood share with source and date",
      "Wetlands with source and date",
      "Road frontage noted; access unverified",
      "Zoning from the local office"
    ],
    "takeaways": [
      "Use the whole boundary.",
      "Separate “no overlap” from “not checked”.",
      "Maps start research; records finish it."
    ],
    "tryIt": {
      "text": "Open a Florida listing, tap Show on map, and read every line of the Land checks.",
      "href": "/liens/states/county/?c=Leon"
    },
    "quiz": [
      {
        "q": "A layer says “data unavailable”. That means…",
        "a": [
          "No risk",
          "It was not checked",
          "High risk"
        ],
        "c": 1,
        "why": "Unavailable is not the same as clear."
      },
      {
        "q": "Is a parcel outline a survey?",
        "a": [
          "Yes",
          "No, it is approximate",
          "Only in Florida"
        ],
        "c": 1,
        "why": "GIS outlines can be off by several feet."
      },
      {
        "q": "Does a mapped road prove legal access?",
        "a": [
          "Yes",
          "No",
          "Only if paved"
        ],
        "c": 1,
        "why": "Legal access needs a recorded right or public road status."
      }
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
    example: "A parcel looks cheap. Checks: is it a real lot or a strip or sliver? Is there a road? Is it in a high-risk flood zone? Are there wetlands? Is it only mineral rights or an easement? Any one of these can make a cheap parcel worthless. Use Land Information on the county list before you bid.",
    mistakes: ["Falling in love with a low price.", "Bidding on slivers, easements or mineral-only parcels.", "Skipping the flood and wetlands check.", "Assuming there is road access.", "Not looking for other liens, such as IRS or other taxes."],
    checklist: ["Parcel is a real, buildable or usable lot.", "Road access confirmed.", "Flood zone checked.", "Wetlands checked.", "Not mineral rights only or an easement.", "Other liens and bankruptcy checked.", "County and the official records confirm the details."],
    drill: [{"q": "Made-up scenario: a parcel is listed at $200 and the map shows a long, 5-foot-wide strip. What is the likely issue?", "a": ["It is a bargain lot", "It is probably a strip or sliver nobody can use", "The strip has road access"], "c": 1, "why": "Very narrow strips are often leftovers between properties and have little or no use."}, {"q": "Made-up scenario: the Land Information check shows a mapped high-risk flood zone. What should you do?", "a": ["Ignore it", "Treat it as a warning: price in insurance and building limits, or skip it", "Bid higher"], "c": 1, "why": "High-risk flood zones can mean required insurance and building limits. Pre-check, then confirm with the county."}],
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
    example: "A lien can fail to pay off as planned: the owner files bankruptcy, the property is worth less than the debt, the county made an error, or a senior claim comes first. Spreading small amounts across several liens limits the damage of one surprise, though it does not remove the risk.",
    mistakes: ["Putting too much money in one lien.", "Assuming the county guarantees payment.", "Forgetting tied-up cash.", "Ignoring bankruptcy and government liens."],
    checklist: ["Money I can afford to tie up for years.", "Limit per parcel decided.", "Know the bankruptcy and senior-lien risks.", "Not borrowing to bid."],
    drill: [{"q": "Made-up scenario: a lien looks great but the owner files for bankruptcy. What usually happens to your timing?", "a": ["Nothing changes", "Payment can be delayed or limited", "You are paid early"], "c": 1, "why": "Bankruptcy can pause collection and change how you are paid. Ask an attorney."}],
    takeaways: ['Bad land = bad lien.', 'IRS liens and bankruptcies can change the outcome.', 'Expect money to be tied up for years.', 'Track every deadline.', 'Buy only through the county or its official site.'],
    tryIt: { text: 'Set reminders in My portfolio for each certificate’s key dates.', href: '/portfolio/' },
    quiz: [
      { q: 'After a tax deed sale on a property with an IRS lien, the US government generally has…', a: ['No rights', 'A 120-day right to redeem', 'Ownership'], c: 1, why: 'Federal law gives the US a right to redeem for 120 days in many cases.' },
      { q: 'Where should you buy a tax lien?', a: ['From the county or its official auction site', 'From a stranger by wire transfer', 'From a social media ad'], c: 0, why: 'Only the county (or its official site) sells real tax liens.' },
      { q: 'What happens if you miss a key deadline on a certificate?', a: ['Nothing', 'You can lose it', 'The rate doubles'], c: 1, why: 'Some certificates expire if you don’t act in time.' }
    ]
  },
  {
    "id": "bidlimit",
    "title": "Bid limits: setting your maximum before the sale",
    "mins": 7,
    "free": false,
    "intro": "The most important number in any auction is the one you decide before it starts.",
    "sections": [
      {
        "h": "For deed sales",
        "p": [
          "Start from a conservative as-is resale value. Subtract title work, surviving liens, possession costs, holding costs through any redemption period, repairs, selling costs, transfer taxes and your required profit. What is left is your maximum."
        ]
      },
      {
        "h": "For lien sales",
        "p": [
          "Decide your lowest acceptable rate by thinking about how long redemption may take and what the deed path would cost if nobody redeems."
        ]
      },
      {
        "h": "Discipline",
        "p": [
          "Write the maximum down. Enter it as a proxy bid where possible. Do not chase a parcel past it."
        ]
      }
    ],
    "example": "Made-up example: resale $40,000 − title $3,000 − code lien $1,200 − holding $1,800 − selling $3,200 − profit $8,000 = $22,800 before transfer taxes.",
    "mistakes": [
      "Bidding from the county value instead of an as-is resale value.",
      "Leaving out holding costs during redemption.",
      "Raising the limit in the heat of the auction."
    ],
    "checklist": [
      "As-is value from comparable sales",
      "Every cost line filled in",
      "Profit target set",
      "Maximum written before the sale"
    ],
    "takeaways": [
      "Build the bid for the bad case.",
      "Every cost line counts.",
      "Write it down; do not move it."
    ],
    "tryIt": {
      "text": "Build a maximum-bid table using the Florida or Texas course’s worked example.",
      "href": "/learn/tracker/"
    },
    "quiz": [
      {
        "q": "Where should a deed-sale maximum bid start?",
        "a": [
          "The county assessed value",
          "A conservative as-is resale value",
          "The opening bid"
        ],
        "c": 1,
        "why": "Assessed values can be far from what a buyer will pay."
      },
      {
        "q": "Which cost is often forgotten?",
        "a": [
          "Holding costs during the redemption period",
          "The auction’s address",
          "The weather"
        ],
        "c": 0,
        "why": "Redemption periods can tie up cash for months or years."
      },
      {
        "q": "During the auction you should…",
        "a": [
          "Raise your limit if it feels right",
          "Stick to the written maximum",
          "Bid on everything"
        ],
        "c": 1,
        "why": "Discipline protects you from overpaying."
      }
    ]
  },
  {
    "id": "math",
    "title": "Return math: total vs annualized, and when costs win",
    "mins": 7,
    "free": false,
    "intro": "A 25% return in two years and 25% in two months are very different. So are percentages before and after costs.",
    "sections": [
      {
        "h": "Total return",
        "p": [
          "Total return = what you got back minus what you put in, divided by what you put in."
        ]
      },
      {
        "h": "Annualized return",
        "p": [
          "Annualized ≈ total return × 12 ÷ months held (simple). It lets you compare short and long holds, but fast redemptions inflate it and you cannot plan on them."
        ]
      },
      {
        "h": "Costs",
        "p": [
          "Include fees, wires, transfer taxes, recording, your time and the cost of cash sitting idle. Small deals can be wiped out by fixed costs."
        ]
      }
    ],
    "example": "Made-up example: $2,400 in, $2,580 back after 10 months → total 7.5%, annualized 9%. The same $180 profit after 30 months annualizes to 3%.",
    "mistakes": [
      "Comparing a lien rate to a deed premium without adjusting for time.",
      "Ignoring fixed costs on small certificates.",
      "Planning on the best-case redemption timing."
    ],
    "checklist": [
      "Total return computed",
      "Annualized at slow and fast timings",
      "All costs included",
      "Worst-case timing considered"
    ],
    "takeaways": [
      "Always compute both total and annualized.",
      "Fixed costs hurt small deals most.",
      "Plan on slow outcomes."
    ],
    "tryIt": {
      "text": "Use the calculator to compare the same profit over 6 months and 24 months.",
      "href": "/#calculator"
    },
    "quiz": [
      {
        "q": "$1,000 in, $1,100 back after 6 months. Annualized (simple)?",
        "a": [
          "10%",
          "20%",
          "5%"
        ],
        "c": 1,
        "why": "10% × 12 ÷ 6 = 20%."
      },
      {
        "q": "Why can fast redemptions mislead?",
        "a": [
          "They inflate annualized returns you cannot count on",
          "They are illegal",
          "They lower total returns"
        ],
        "c": 0,
        "why": "You do not control redemption timing."
      },
      {
        "q": "Fixed costs matter most on…",
        "a": [
          "Large deals",
          "Small deals",
          "No deals"
        ],
        "c": 1,
        "why": "A $50 cost is 10% of a $500 deal."
      }
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
    example: "At a deed auction you bid for the property. There is usually no inspection inside and no refund if it turns out to be a problem. A low opening bid may be far from the final price, and you may still owe back taxes, liens or fees depending on the state.",
    mistakes: ["Bidding without seeing the site or checking the land.", "Not budgeting for title work and clearing occupants.", "Assuming the price is only the opening bid.", "Missing the payment deadline."],
    checklist: ["Property viewed from the street and on a map.", "Land Information checked.", "Maximum bid decided in advance and kept.", "Funds ready by the deadline.", "Know what happens to other liens in my state."],
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
    example: "A simple first plan: pick one state and one county, read its sale rules, shortlist a few parcels, check each one, set a small budget you can afford to tie up, and write down your maximum bid before the sale. Then track everything in My portfolio.",
    mistakes: ["Going big on the first sale.", "Not writing a budget and maximum bid before bidding.", "Skipping record keeping.", "Not asking a professional about tax or legal questions."],
    checklist: ["One county chosen.", "Rules and dates written down.", "Small budget set.", "Shortlist checked on Land Information.", "Maximum bid per parcel written.", "Records ready in My portfolio."],
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

// Final exam: 20 questions drawn from every lesson quiz and drill. Members only (see learn.mjs).
export const EXAM_PASS = 16;
export function examQuestions() {
  const all = [];
  LESSONS.forEach(l => { (l.quiz || []).forEach(q => all.push(q)); (l.drill || []).forEach(q => all.push(q)); });
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
  return all.slice(0, 20);
}
