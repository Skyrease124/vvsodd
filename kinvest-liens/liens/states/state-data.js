// Extra state-level data: sale rules and official past-sale totals. Every figure carries a source and the date checked.
const STATE_DATA = {
 "AZ": {
  "sale": {
   "title": "Tax lien sale (Arizona)",
   "when": "Every February (A.R.S. 42-18112). Pima County’s 2026 online sale ran on February 26, 2026.",
   "steps": [
    "Delinquent parcels are advertised and the county treasurer holds the lien sale in February each year.",
    "Bidding starts at 16% and goes down in 1% steps. A 0% bid is allowed (Pima County Treasurer, 2026 sale).",
    "The winner pays the full amount (taxes, interest, penalties) plus fees, and earns the bid rate as simple interest starting the first day of the month after the purchase (A.R.S. 42-18114).",
    "The owner can redeem by paying the lien plus interest. The holder cannot start a foreclosure until 3 years after the sale (A.R.S. 42-18201)."
   ],
   "links": [
    [
     "A.R.S. 42-18112 (time of sale)",
     "https://www.azleg.gov/ars/42/18112.htm"
    ],
    [
     "A.R.S. 42-18114 (purchaser)",
     "https://www.azleg.gov/ars/42/18114.htm"
    ],
    [
     "A.R.S. 42-18201 (foreclosure)",
     "https://www.azleg.gov/ars/42/18201.htm"
    ],
    [
     "Maricopa County Treasurer: tax lien information",
     "https://treasurer.maricopa.gov/TaxLienInformation/"
    ],
    [
     "Pima County Treasurer: tax lien sale",
     "https://www.to.pima.gov/taxLienSale/"
    ]
   ]
  },
  "history": {
   "title": "Maricopa County: past tax lien sales by tax year",
   "note": "Official totals from the Maricopa County Treasurer’s “Tax Sale History” (copied November 2, 2026). These are totals, not individual liens. “Tax value” is the tax amount the liens covered; the rate is the average bid rate. Tax years before 2015 are left out because the dollar totals on the source look incomplete.",
   "source": "https://treasurer.maricopa.gov/TaxLienInformation/",
   "checked": "2026-11-02",
   "rows": [
    {
     "year": 2024,
     "sold": 16948,
     "value": 28900902.89,
     "rate": 5.58,
     "outstanding": 10278,
     "redeemed": 6670
    },
    {
     "year": 2023,
     "sold": 15991,
     "value": 25755228.17,
     "rate": 6.37,
     "outstanding": 4664,
     "redeemed": 11327
    },
    {
     "year": 2022,
     "sold": 15193,
     "value": 21706729.43,
     "rate": 5.6,
     "outstanding": 2093,
     "redeemed": 13100
    },
    {
     "year": 2021,
     "sold": 13828,
     "value": 19400543.4,
     "rate": 2.84,
     "outstanding": 716,
     "redeemed": 13112
    },
    {
     "year": 2020,
     "sold": 14623,
     "value": 20670099.24,
     "rate": 2.74,
     "outstanding": 550,
     "redeemed": 14073
    },
    {
     "year": 2019,
     "sold": 14989,
     "value": 21432426.21,
     "rate": 3.54,
     "outstanding": 497,
     "redeemed": 14492
    },
    {
     "year": 2018,
     "sold": 15651,
     "value": 21225297.62,
     "rate": 4.02,
     "outstanding": 495,
     "redeemed": 15156
    },
    {
     "year": 2017,
     "sold": 16033,
     "value": 20214613.9,
     "rate": 4.06,
     "outstanding": 388,
     "redeemed": 15645
    },
    {
     "year": 2016,
     "sold": 17476,
     "value": 21983298.44,
     "rate": 3.81,
     "outstanding": 350,
     "redeemed": 17126
    },
    {
     "year": 2015,
     "sold": 17536,
     "value": 20690071.94,
     "rate": 4.48,
     "outstanding": 363,
     "redeemed": 17173
    }
   ]
  }
 },
 "NJ": {
  "sale": {
   "title": "Tax sale (New Jersey)",
   "when": "There is no statewide sale date. Each of New Jersey’s 566 municipalities must hold at least one tax sale a year if it has unpaid taxes (NJ Division of Local Government Services). Ask the town tax collector, or see the list of announced sales below.",
   "steps": [
    "Your town, not the county, sells the lien. What is sold is a tax sale certificate, not the property.",
    "Bidding starts at 18% interest and is bid down. When it reaches the bottom, bidders instead offer a premium. The premium earns no interest and is held by the town for up to 5 years (NJ DCA; N.J.S.A. 54:5-33).",
    "The winner pays the taxes and interest right away and should record the certificate at the County Clerk within about 90 days of the sale.",
    "If the owner redeems, the holder gets the interest plus a redemption penalty of 2%, 4% or 6% depending on the certificate amount. After 2 years the holder can start a court action to foreclose.",
    "A 2024 law (P.L. 2024, c.39) changed the foreclosure process, including sheriff and internet sales. Read it before you rely on the older summaries."
   ],
   "links": [
    [
     "NJ DCA: Elements of Tax Sales (older summary)",
     "https://www.nj.gov/dca/divisions/dlgs/programs/tax_collector_docs/elements_of_tax_sales_nj.pdf"
    ],
    [
     "P.L. 2024, c.39 (foreclosure changes)",
     "https://pub.njleg.gov/Bills/2024/PL24/39_.HTM"
    ],
    [
     "TCTANJ: announced tax sales",
     "https://tctanj.org/cn/webpage.cfm?tpid=14659"
    ]
   ]
  },
  "sales": {
   "title": "Announced municipal tax sales",
   "note": "Copied from the Tax Collectors & Treasurers Association of NJ “Tax Sales” page (page updated October 20, 2026). Only towns that submit notices appear, so this is a small part of all sales. Parcel lists are on each town’s own site, and some are behind a browser check. Confirm the date with the tax collector.",
   "source": "https://tctanj.org/cn/webpage.cfm?tpid=14659",
   "checked": "2026-11-02",
   "rows": [
    {
     "town": "Borough of Dunellen",
     "county": "Middlesex",
     "date": "2026-11-24",
     "time": "8:30 AM",
     "how": "Online auction",
     "link": "https://dunellen.newjerseytaxsale.com",
     "linkText": "Parcel list"
    },
    {
     "town": "Township of Hampton",
     "county": "Sussex",
     "date": "2026-11-18",
     "time": "10:00 AM",
     "how": "In person, 1 Rumsey Way, Newton",
     "link": "https://www.hamptontownshipnj.info",
     "linkText": "Township site"
    },
    {
     "town": "Township of Maplewood",
     "county": "",
     "date": "2026-10-21",
     "time": "",
     "how": "Online auction",
     "link": "https://maplewood.newjerseytaxsale.com/",
     "linkText": "Parcel list"
    },
    {
     "town": "Township of Jefferson",
     "county": "Morris",
     "date": "2026-10-22",
     "time": "10:00 AM",
     "how": "In person, Lake Hopatcong",
     "link": "http://www.jeffersontownship.net",
     "linkText": "Township site"
    },
    {
     "town": "Borough of Woodcliff Lake",
     "county": "",
     "date": "2026-10-22",
     "time": "10:00 AM",
     "how": "In person, 188 Pascack Road",
     "link": "https://wclnj.com/government/public-notices",
     "linkText": "Public notices"
    }
   ]
  }
 }
};
