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
 },
 "IL": {
  "sale": {
   "title": "Tax sale (Illinois)",
   "when": "Counties run their own annual sale (usually in the fall; Cook County has been delayed to December 2026). Many counties are now buying the liens themselves instead of selling them to investors.",
   "steps": [
    "After a court judgment against unpaid parcels, the county collector holds the annual tax sale and offers each parcel’s unpaid tax separately.",
    "Bidders bid the penalty down. No bid can be above 9% of the tax (35 ILCS 200/21-215, P.A. 102-363, effective January 1, 2022). Older summaries that say 18% are out of date.",
    "The penalty is charged for each six-month period the lien is outstanding, so how long it stays unredeemed matters. Check the exact formula in 35 ILCS 200/21-355 before you bid.",
    "Certificates issued from 2024 give the owner 2½ years to redeem (1 year for vacant land, buildings with 7+ units, and commercial or industrial property). Certificates issued on or after July 10, 2026 give 3 years (TaxLien.io’s reading of 35 ILCS 200/21-350; confirm it).",
    "A 2026 law (P.A. 104-553) lets a county buy all its delinquent real estate taxes itself, so private buyers can be left with only mobile-home taxes. Check with the county before you register."
   ],
   "links": [
    [
     "35 ILCS 200/21-215 (penalty bid cap)",
     "https://lrb.ilga.gov/legislation/ilcs/documents/003502000K21-215.htm"
    ],
    [
     "35 ILCS 200/21-350 (redemption)",
     "https://lrb.ilga.gov/legislation/ilcs/documents/003502000K21-350.htm"
    ],
    [
     "35 ILCS 200/21-355 (redemption amount)",
     "https://lrb.ilga.gov/legislation/ilcs/documents/003502000K21-355.htm"
    ],
    [
     "Cook County Treasurer: tax sale information",
     "https://www.cookcountytreasurer.com/taxsalegeneralinformation.aspx"
    ]
   ]
  },
  "sales": {
   "title": "Announced 2026 county tax sales",
   "note": "From each county treasurer’s own page (checked November 2, 2026). Tax buyers must register ahead of time. Delinquent lists are usually in local newspapers or on request, not online. Confirm the date with the county.",
   "source": "https://www.cookcountytreasurer.com/taxsalegeneralinformation.aspx",
   "checked": "2026-11-02",
   "rows": [
    {
     "town": "Cook County",
     "county": "",
     "date": "2026-12-01",
     "dateText": "Expected December 2026",
     "time": "",
     "how": "Annual sale; Treasurer says the date was delayed by P.A. 104-0460",
     "link": "https://www.cookcountytreasurer.com/taxsalegeneralinformation.aspx",
     "linkText": "Cook County Treasurer"
    },
    {
     "town": "St. Clair County",
     "county": "",
     "date": "2026-11-02",
     "time": "9:00 AM",
     "how": "County holds all real estate taxes; only mobile-home taxes offered to buyers",
     "link": "https://www.co.st-clair.il.us/departments/treasurer/tax-sale",
     "linkText": "St. Clair County Treasurer"
    },
    {
     "town": "McLean County",
     "county": "",
     "date": "2026-11-06",
     "time": "10:00 AM",
     "how": "County holds all real estate taxes; only mobile-home taxes offered to buyers",
     "link": "https://www.mcleancountyil.gov/401/Annual-Tax-Sale",
     "linkText": "McLean County Treasurer"
    },
    {
     "town": "Henry County",
     "county": "",
     "date": "2026-11-06",
     "time": "10:00 AM",
     "how": "County holds all real estate taxes; only mobile-home taxes offered to buyers",
     "link": "https://www.henrycty.com/278/Annual-Tax-Sale---2026-Tax-Sale-is-Novem",
     "linkText": "Henry County Treasurer"
    }
   ]
  }
 },
 "IN": {
  "sale": {
   "title": "Tax sale (Indiana)",
   "when": "Each county sets its own date. The three 2026 sales we found were in September and October.",
   "steps": [
    "The county auditor advertises the unpaid parcels and mails notices to owners. Parcels are sold in an annual county sale, in person or online.",
    "No parcel sells for less than the minimum bid: the unpaid taxes and assessments, penalties, and costs (IC 6-1.1-24).",
    "You earn a set premium, not annual interest. If the owner redeems within 6 months, they repay 110% of the minimum bid. After 6 months it is 115%. Anything you bid above the minimum is repaid too, with 5% a year interest on that extra (county tax sale notices, IC 6-1.1-25-2).",
    "Taxes you pay after the sale are added to the redemption amount, with 5% a year interest.",
    "The owner has 1 year to redeem. For certificates the county itself holds, it is shorter. After the redemption period you must petition the court for a deed within strict deadlines or the lien can end.",
    "If you paid more than the minimum bid and the property is not redeemed, the extra sits in a surplus fund. The former owner can claim it."
   ],
   "links": [
    [
     "Indiana Code, Title 6 (IC 6-1.1-24 and 6-1.1-25)",
     "https://iga.in.gov/laws/2026/ic/titles/6"
    ],
    [
     "SRI Services (runs many county sales)",
     "https://sriservices.com/"
    ]
   ]
  },
  "sales": {
   "title": "Announced 2026 county tax sales",
   "note": "From each county’s own page (checked November 2, 2026). All three have already happened. Parcel lists are published by the county, and they usually name owners, so we do not copy them. Next year’s dates will appear on the county auditor or treasurer pages.",
   "source": "https://www.hamiltoncounty.in.gov/452/Real-Property-Tax-Sale",
   "checked": "2026-11-02",
   "rows": [
    {
     "town": "Porter County",
     "county": "",
     "date": "2026-10-21",
     "time": "",
     "how": "Online, October 21–22",
     "link": "https://www.portercountyin.gov/1036/Tax-SaleCertificate-Sale",
     "linkText": "Porter County Auditor"
    },
    {
     "town": "Hamilton County",
     "county": "",
     "date": "2026-10-08",
     "time": "10:00 AM",
     "how": "In person, Noblesville",
     "link": "https://www.hamiltoncounty.in.gov/452/Real-Property-Tax-Sale",
     "linkText": "Hamilton County Auditor"
    },
    {
     "town": "Hancock County",
     "county": "",
     "date": "2026-09-18",
     "time": "10:00 AM",
     "how": "Online (SRI, zeusauction.com)",
     "link": "https://www.hancockin.gov/606/Tax-Sale",
     "linkText": "Hancock County Treasurer"
    }
   ]
  }
 },
 "IA": {
  "sale": {
   "title": "Tax sale (Iowa)",
   "when": "Every county sells on the third Monday in June (June 21, 2027), unless the treasurer picks a different June date for good cause (Iowa Code 446.7).",
   "steps": [
    "The county treasurer offers every parcel with delinquent taxes at a public sale, one parcel at a time, for the total amount due (taxes, interest, fees and costs).",
    "There is no bidding on the interest rate. The person who will accept the smallest percentage of the parcel wins, and the lowest allowed bid is 1%. Ties are settled by random draw (Iowa Code 446.16).",
    "The winner earns interest of 2% a month (24% a year), counting any part of a month as a full month, from the month of sale (Iowa Code 447.1).",
    "The percentage you bid is not a discount or a yield. It is the share of the parcel you would get if a treasurer’s deed is ever issued.",
    "After 1 year and 9 months, the holder can serve a notice. The owner then has 90 days to redeem or a deed can be issued (Iowa Code 447.9). Certificates the county holds can be assigned to others (Iowa Code 446.31)."
   ],
   "links": [
    [
     "Iowa Code 446.7 (annual sale)",
     "https://www.legis.iowa.gov/docs/code/446.7.pdf"
    ],
    [
     "Iowa Code 446.16 (bidding)",
     "https://www.legis.iowa.gov/docs/code/446.16.pdf"
    ],
    [
     "Iowa Code 447.1 (redemption, 2% a month)",
     "https://www.legis.iowa.gov/docs/code/447.1.pdf"
    ],
    [
     "Iowa Code 447.9 (notice of expiration)",
     "https://www.legis.iowa.gov/docs/code/447.9.pdf"
    ],
    [
     "Iowa Code 446.31 (assignment)",
     "https://www.legis.iowa.gov/docs/code/446.31.pdf"
    ],
    [
     "Iowa State Treasurers Association",
     "https://www.iowatreasurers.org"
    ]
   ]
  },
  "sales": {
   "title": "2026 county tax sales we confirmed",
   "note": "From each county treasurer’s own page (checked November 2, 2026). There are 99 counties and each posts its own notice. Parcel lists name owners and addresses, so we do not copy them.",
   "source": "https://www.iowatreasurers.org",
   "checked": "2026-11-02",
   "rows": [
    {
     "town": "Scott County",
     "county": "",
     "date": "2026-06-15",
     "time": "8:30 AM",
     "how": "In person, Davenport (pre-registration required)",
     "link": "https://www.scottcountyiowa.gov/treasurer/post/2026/06/15/2026-annual-tax-sale",
     "linkText": "Scott County Treasurer"
    },
    {
     "town": "Woodbury County",
     "county": "",
     "date": "2026-06-15",
     "time": "9:00 AM",
     "how": "Online, 9:00 to 10:30 AM",
     "link": "https://www.woodburycountyiowa.gov/treasurer/tax_sale/",
     "linkText": "Woodbury County Treasurer"
    }
   ]
  },
  "counts": {
   "title": "Woodbury County: open certificates the county holds, by sale year",
   "note": "Certificates nobody bought at the June sale stay with the county. This is the county’s own “Public Bidder Parcel Listing” as of July 8, 2026, counted by sale year. We count them only; the list also names owners and gives no dollar amounts, so we do not copy individual parcels. Ask the county treasurer about assignment.",
   "source": "https://www.woodburycountyiowa.gov/treasurer/tax_sale/",
   "checked": "2026-11-02",
   "head": [
    "Sale year",
    "Open county-held certificates"
   ],
   "rows": [
    [
     2000,
     5
    ],
    [
     2001,
     8
    ],
    [
     2002,
     5
    ],
    [
     2003,
     2
    ],
    [
     2005,
     1
    ],
    [
     2006,
     8
    ],
    [
     2007,
     13
    ],
    [
     2008,
     13
    ],
    [
     2010,
     5
    ],
    [
     2011,
     20
    ],
    [
     2012,
     20
    ],
    [
     2013,
     23
    ],
    [
     2014,
     13
    ],
    [
     2015,
     24
    ],
    [
     2016,
     21
    ],
    [
     2017,
     6
    ],
    [
     2018,
     15
    ],
    [
     2019,
     13
    ],
    [
     2021,
     3
    ]
   ]
  }
 },
 "MD": {
  "sale": {
   "title": "Tax sale (Maryland)",
   "when": "Each county and Baltimore City runs its own annual sale. Most are in May and June (the state schedule is below). Dates are added to the state list as counties announce them.",
   "steps": [
    "The county collector sells a certificate of sale against the property, not the property itself, at a public auction (Tax-Property Article 14-817).",
    "Bidders bid up the price, not the rate. The bid can never be less than the taxes, interest, penalties and sale costs owed. Many collectors also charge a high-bid premium (20% of the amount by which the bid exceeds a set value, such as 40% of the property’s full cash value). The premium is refunded without interest if the owner redeems (14-817).",
    "You earn the county’s redemption rate on the amount you paid toward the taxes. The default is 6% a year, but each county may set its own (14-820). For owner-occupied homes the rate cannot be more than 10% a year.",
    "You can ask a court to foreclose the owner’s right to redeem after 6 months (9 months for an owner-occupied home), after sending the required notices (14-833).",
    "The certificate is void unless foreclosure is started within 2 years of the certificate date (14-820)."
   ],
   "links": [
    [
     "MD Dept. of Assessments and Taxation: tax sale schedule",
     "https://dat.maryland.gov/Pages/Tax-Sale-Schedule.aspx"
    ],
    [
     "Tax-Property 14-817 (the sale)",
     "https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gtp&section=14-817&enactments=false"
    ],
    [
     "Tax-Property 14-820 (redemption rate)",
     "https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gtp&section=14-820&enactments=false"
    ],
    [
     "Tax-Property 14-833 (foreclosure)",
     "https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gtp&section=14-833&enactments=false"
    ],
    [
     "Baltimore City tax sale site",
     "https://taxsale.baltimorecity.gov"
    ]
   ]
  },
  "sales": {
   "title": "2026 tax sale dates by county",
   "note": "From the Maryland Department of Assessments and Taxation’s tax sale schedule (checked November 2, 2026). Howard County’s own page says its sale was held June 10; the state list shows June 3. All of these have passed. Next year’s dates are added to the state list as counties announce them.",
   "source": "https://dat.maryland.gov/Pages/Tax-Sale-Schedule.aspx",
   "checked": "2026-11-02",
   "rows": [
    {
     "town": "St. Mary’s",
     "county": "",
     "date": "2026-03-06",
     "time": "",
     "how": "",
     "link": "https://dat.maryland.gov/Pages/Tax-Sale-Schedule.aspx",
     "linkText": "State schedule"
    },
    {
     "town": "Frederick",
     "county": "",
     "date": "2026-05-11",
     "time": "",
     "how": "",
     "link": "https://dat.maryland.gov/Pages/Tax-Sale-Schedule.aspx",
     "linkText": "State schedule"
    },
    {
     "town": "Prince George’s",
     "county": "",
     "date": "2026-05-11",
     "time": "",
     "how": "",
     "link": "https://dat.maryland.gov/Pages/Tax-Sale-Schedule.aspx",
     "linkText": "State schedule"
    },
    {
     "town": "Charles",
     "county": "",
     "date": "2026-05-12",
     "time": "",
     "how": "",
     "link": "https://dat.maryland.gov/Pages/Tax-Sale-Schedule.aspx",
     "linkText": "State schedule"
    },
    {
     "town": "Baltimore City",
     "county": "",
     "date": "2026-05-18",
     "time": "",
     "how": "",
     "link": "https://dat.maryland.gov/Pages/Tax-Sale-Schedule.aspx",
     "linkText": "State schedule"
    },
    {
     "town": "Garrett",
     "county": "",
     "date": "2026-05-18",
     "time": "",
     "how": "",
     "link": "https://dat.maryland.gov/Pages/Tax-Sale-Schedule.aspx",
     "linkText": "State schedule"
    },
    {
     "town": "Queen Anne’s",
     "county": "",
     "date": "2026-05-19",
     "time": "",
     "how": "",
     "link": "https://dat.maryland.gov/Pages/Tax-Sale-Schedule.aspx",
     "linkText": "State schedule"
    },
    {
     "town": "Dorchester",
     "county": "",
     "date": "2026-05-19",
     "time": "",
     "how": "",
     "link": "https://dat.maryland.gov/Pages/Tax-Sale-Schedule.aspx",
     "linkText": "State schedule"
    },
    {
     "town": "Talbot",
     "county": "",
     "date": "2026-05-20",
     "time": "",
     "how": "",
     "link": "https://dat.maryland.gov/Pages/Tax-Sale-Schedule.aspx",
     "linkText": "State schedule"
    },
    {
     "town": "Kent",
     "county": "",
     "date": "2026-05-21",
     "time": "",
     "how": "",
     "link": "https://dat.maryland.gov/Pages/Tax-Sale-Schedule.aspx",
     "linkText": "State schedule"
    },
    {
     "town": "Calvert",
     "county": "",
     "date": "2026-05-22",
     "time": "",
     "how": "",
     "link": "https://dat.maryland.gov/Pages/Tax-Sale-Schedule.aspx",
     "linkText": "State schedule"
    },
    {
     "town": "Allegany",
     "county": "",
     "date": "2026-05-28",
     "time": "",
     "how": "",
     "link": "https://dat.maryland.gov/Pages/Tax-Sale-Schedule.aspx",
     "linkText": "State schedule"
    },
    {
     "town": "Cecil",
     "county": "",
     "date": "2026-06-01",
     "time": "",
     "how": "",
     "link": "https://dat.maryland.gov/Pages/Tax-Sale-Schedule.aspx",
     "linkText": "State schedule"
    },
    {
     "town": "Washington",
     "county": "",
     "date": "2026-06-02",
     "time": "",
     "how": "",
     "link": "https://dat.maryland.gov/Pages/Tax-Sale-Schedule.aspx",
     "linkText": "State schedule"
    },
    {
     "town": "Anne Arundel",
     "county": "",
     "date": "2026-06-03",
     "time": "",
     "how": "",
     "link": "https://dat.maryland.gov/Pages/Tax-Sale-Schedule.aspx",
     "linkText": "State schedule"
    },
    {
     "town": "Harford",
     "county": "",
     "date": "2026-06-03",
     "time": "",
     "how": "",
     "link": "https://dat.maryland.gov/Pages/Tax-Sale-Schedule.aspx",
     "linkText": "State schedule"
    },
    {
     "town": "Montgomery",
     "county": "",
     "date": "2026-06-08",
     "time": "",
     "how": "",
     "link": "https://dat.maryland.gov/Pages/Tax-Sale-Schedule.aspx",
     "linkText": "State schedule"
    },
    {
     "town": "Worcester",
     "county": "",
     "date": "2026-06-09",
     "time": "",
     "how": "",
     "link": "https://dat.maryland.gov/Pages/Tax-Sale-Schedule.aspx",
     "linkText": "State schedule"
    },
    {
     "town": "Wicomico",
     "county": "",
     "date": "2026-06-09",
     "time": "",
     "how": "",
     "link": "https://dat.maryland.gov/Pages/Tax-Sale-Schedule.aspx",
     "linkText": "State schedule"
    },
    {
     "town": "Howard",
     "county": "",
     "date": "2026-06-10",
     "time": "",
     "how": "",
     "link": "https://dat.maryland.gov/Pages/Tax-Sale-Schedule.aspx",
     "linkText": "State schedule"
    },
    {
     "town": "Somerset",
     "county": "",
     "date": "2026-06-11",
     "time": "",
     "how": "",
     "link": "https://dat.maryland.gov/Pages/Tax-Sale-Schedule.aspx",
     "linkText": "State schedule"
    },
    {
     "town": "Carroll",
     "county": "",
     "date": "2026-06-26",
     "time": "",
     "how": "",
     "link": "https://dat.maryland.gov/Pages/Tax-Sale-Schedule.aspx",
     "linkText": "State schedule"
    },
    {
     "town": "Caroline",
     "county": "",
     "date": "2026-08-21",
     "time": "",
     "how": "",
     "link": "https://dat.maryland.gov/Pages/Tax-Sale-Schedule.aspx",
     "linkText": "State schedule"
    },
    {
     "town": "Baltimore County",
     "county": "",
     "date": "2026-08-27",
     "time": "",
     "how": "",
     "link": "https://dat.maryland.gov/Pages/Tax-Sale-Schedule.aspx",
     "linkText": "State schedule"
    }
   ]
  },
  "tables": [
   {
    "title": "Redemption rate set by state law",
    "note": "Maryland law sets a default rate for each county (Tax-Property 14-820). A county may fix a different rate by its own law, and most large counties do, so check the county’s notice before bidding. The rate for owner-occupied homes cannot be over 10%.",
    "source": "https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gtp&section=14-820&enactments=false",
    "checked": "2026-11-02",
    "head": [
     "County",
     "Default rate in the statute"
    ],
    "rows": [
     [
      "Carroll",
      "14% a year"
     ],
     [
      "Calvert, Caroline, Dorchester, Garrett",
      "10% a year"
     ],
     [
      "All other counties and Baltimore City",
      "6% a year"
     ]
    ]
   },
   {
    "title": "Anne Arundel County: past sale results",
    "note": "Totals from the county’s own published sale results lists (2025 had no sale; it was postponed). The lists also name owners and bidders, so we copy only the totals. “Taxes owed” is the lien. “Winning bids” is what bidders agreed to pay, which in Maryland is usually far above the taxes owed. The extra comes back without interest if the owner redeems, so the return comes only from the redemption rate on the taxes.",
    "source": "https://www.aacounty.org/finance/tax-sale",
    "checked": "2026-11-02",
    "head": [
     "Sale year",
     "Liens sold",
     "Taxes owed",
     "Winning bids",
     "Median bid vs. assessed value",
     "Liens with a premium"
    ],
    "rows": [
     [
      2026,
      "958",
      "$5,353,640",
      "$270,748,237",
      "65%",
      "93%"
     ],
     [
      2024,
      "852",
      "$2,460,786",
      "$170,227,866",
      "61%",
      "95%"
     ],
     [
      2023,
      "724",
      "$2,116,043",
      "$159,904,984",
      "66%",
      "92%"
     ],
     [
      2022,
      "1,194",
      "$4,050,609",
      "$283,425,085",
      "77%",
      "90%"
     ],
     [
      2021,
      "455",
      "$2,323,112",
      "$93,962,165",
      "74%",
      "87%"
     ]
    ]
   },
   {
    "title": "Anne Arundel County: liens left after the June 3, 2026 sale",
    "note": "The county’s “liens remaining from our June 3, 2026 tax sale” list (dated October 23, 2026). We show the totals only. See the county page for the list and its auction site.",
    "source": "https://www.aacounty.org/finance/tax-sale",
    "checked": "2026-11-02",
    "head": [
     "Liens remaining",
     "Taxes owed",
     "Estimated total due"
    ],
    "rows": [
     [
      "82",
      "$671,481",
      "$737,478"
     ]
    ]
   }
  ]
 },
 "TX": {
  "sale": {
   "title": "Tax sale (Texas)",
   "when": "Sales are held on the first Tuesday of every month (Tax Code 34.01). The first Tuesdays ahead: November 3 and December 1, 2026, then January 5, February 2 and March 2, 2027. Each county decides whether it has a sale that month.",
   "steps": [
    "After a court judgment against unpaid taxes, a sheriff or constable sells the property at auction. In-person sales run between 10 a.m. and 4 p.m. at the place the county sets, such as the courthouse. A county may also run the auction online (Tax Code 34.01).",
    "You buy a deed to the property, not a lien. There is no interest. Instead, the former owner can buy the property back, and you are repaid your price plus a premium.",
    "Homesteads, farm land and mineral interests: the owner has 2 years from the day your deed is filed. The premium is 25% of the total if they redeem in year one, and 50% in year two (Tax Code 34.21(a)).",
    "All other property: the owner has only 180 days from the day your deed is filed, and the premium cannot be more than 25% (Tax Code 34.21(e)).",
    "The amount repaid includes what you bid, the deed recording fee, and any taxes, penalties and costs you paid, plus the premium. Until the redemption period ends you may not have full control of the property, so ask a Texas attorney before you bid."
   ],
   "links": [
    [
     "Texas Tax Code, Chapter 34 (sales and redemption)",
     "https://tcss.legis.texas.gov/resources/TX/htm/TX.34.htm"
    ],
    [
     "Harris County Tax Office: tax sales",
     "https://www.hctax.net/Property/TaxSales"
    ],
    [
     "Denton County: sheriff’s sale",
     "https://www.dentoncounty.gov/840/Sheriffs-Sale"
    ],
    [
     "Jefferson County: delinquent tax sale",
     "https://jeffcotax.com/property-tax/delinquent-tax-sale/"
    ],
    [
     "Kaufman County: tax sales",
     "https://www.kaufmancounty.net/532/Tax-SalesAuctions"
    ]
   ]
  },
  "sales": {
   "title": "Upcoming and recent county sales",
   "note": "From each county’s own page (checked November 2, 2026). Texas has 254 counties; these are only a few. Sales can be canceled when owners pay, and dates change, so confirm with the county. Property lists name owners, so we do not copy them.",
   "source": "https://www.hctax.net/Property/TaxSales",
   "checked": "2026-11-02",
   "rows": [
    {
     "town": "Jefferson County",
     "county": "",
     "date": "2026-12-01",
     "time": "",
     "how": "Original sheriff sale (county lists Dec 1, 2026; subject to change)",
     "link": "https://jeffcotax.com/property-tax/delinquent-tax-sale/",
     "linkText": "Jefferson County Tax Office"
    },
    {
     "town": "Harris County",
     "county": "",
     "date": "2026-11-03",
     "time": "10:00 AM to 4:00 PM",
     "how": "First Tuesday of each month, Bayou City Event Center, run by the eight constables",
     "link": "https://www.hctax.net/Property/TaxSales",
     "linkText": "Harris County Tax Office"
    },
    {
     "town": "Denton County",
     "county": "",
     "date": "2026-11-03",
     "time": "10:00 AM",
     "how": "Online through GovEase; first Tuesday of each month",
     "link": "https://www.dentoncounty.gov/840/Sheriffs-Sale",
     "linkText": "Denton County Sheriff"
    },
    {
     "town": "Kaufman County",
     "county": "",
     "date": "2026-11-03",
     "time": "10:00 AM",
     "how": "Online, first Tuesday of the month if there is property to sell",
     "link": "https://www.kaufmancounty.net/532/Tax-SalesAuctions",
     "linkText": "Kaufman County"
    }
   ]
  },
  "tables": [
   {
    "title": "Redemption: how long the owner has and what you earn",
    "note": "Straight from Texas Tax Code 34.21. The premium is a percentage of the total the owner repays (your bid, the deed recording fee, and taxes, penalties, interest and costs you paid). It is a one-time premium, not yearly interest.",
    "source": "https://tcss.legis.texas.gov/resources/TX/htm/TX.34.htm",
    "checked": "2026-11-02",
    "head": [
     "Property type",
     "Owner can redeem for",
     "Premium to the buyer"
    ],
    "rows": [
     [
      "Homestead, farm land or mineral interest",
      "2 years from the deed filing",
      "25% in year 1, 50% in year 2"
     ],
     [
      "All other property",
      "180 days from the deed filing",
      "Up to 25%"
     ]
    ]
   }
  ]
 },
 "OH": {
  "sale": {
   "title": "Tax certificate sales (Ohio)",
   "when": "There is no statewide sale date, and certificate sales are optional. Each county treasurer decides whether to sell tax certificates at all, and when.",
   "steps": [
    "Unpaid real property taxes become a lien. After parcels are on the delinquent land list, the county treasurer may select some and sell their liens as tax certificates (R.C. 5721.31).",
    "At an auction the bidding starts at 18% simple interest a year and goes down in steps of one-quarter of 1% to 0%. The lowest rate wins. Bidders must register and pay a $500 cash registration fee (R.C. 5721.32).",
    "Instead of an auction, the treasurer may sell many certificates in a negotiated sale to one or a few buyers. The rate can be set up to 18%, and the deal can include a premium or discount and different foreclosure timing, up to 6 years (R.C. 5721.30, 5721.33). Large counties often do this, so individual certificates are not offered.",
    "A certificate holder can ask to start foreclosure beginning 1 year after the date the certificate was sold (R.C. 5721.37). Before that, the owner can redeem by paying the certificate price plus the certificate interest, and the treasurer can set up a payment plan of up to 1 year (R.C. 5721.38).",
    "Every county can also foreclose on delinquent land itself and sell the property at a sheriff’s sale, whether or not it sells certificates."
   ],
   "links": [
    [
     "R.C. 5721.32 (certificate auction)",
     "https://codes.ohio.gov/ohio-revised-code/section-5721.32"
    ],
    [
     "R.C. 5721.33 (negotiated sale)",
     "https://codes.ohio.gov/ohio-revised-code/section-5721.33"
    ],
    [
     "R.C. 5721.37 (foreclosure)",
     "https://codes.ohio.gov/ohio-revised-code/section-5721.37"
    ],
    [
     "R.C. 5721.38 (right to redeem)",
     "https://codes.ohio.gov/ohio-revised-code/section-5721.38"
    ],
    [
     "R.C. 5721.30 (definitions, rate)",
     "https://codes.ohio.gov/ohio-revised-code/section-5721.30"
    ]
   ]
  },
  "tables": [
   {
    "title": "How some large Ohio counties sell certificates",
    "note": "Cuyahoga County’s row is from its own treasurer page, which we read. Montgomery and Franklin pages blocked our tools, so those rows come from TaxLien.io’s summary of the county pages; check them yourself. Many other counties sell none.",
    "source": "https://cuyahogacounty.gov/treasury/delinquency/tax-lien-certificate-sales",
    "checked": "2026-11-02",
    "head": [
     "County",
     "How it sells",
     "Source we used"
    ],
    "rows": [
     [
      "Cuyahoga",
      "In bulk by negotiated sale, not one certificate at a time. The county page lists 2026 certificates as sold.",
      "Cuyahoga County Treasurer page (read)"
     ],
     [
      "Montgomery",
      "Negotiated sale held December 12, 2025; certificates are not offered individually.",
      "TaxLien.io summary (county page not opened)"
     ],
     [
      "Franklin",
      "Annual tax lien sale; the 2025 sale was November 3, 2025.",
      "TaxLien.io summary (county page not opened)"
     ]
    ]
   }
  ]
 },
 "CO": {
  "sale": {
   "title": "Tax lien sale (Colorado)",
   "when": "Each county treasurer sells liens once a year in the fall for the previous year’s unpaid taxes. The 2026 sales run through mid to late November (see the table below). Each county sets its own date, usually online or in person.",
   "steps": [
    "You buy the tax lien, not the property. The buyer receives a certificate of purchase.",
    "Nobody bids the interest rate. It is set by formula: 9 points above the Federal Reserve discount rate on September 1, rounded to a whole percent. The discount rate was 3.75% on September 1, 2026, so liens sold in 2026 pay 13%. It was 14% in 2025 and 15% in 2024 (Denver and Boulder County pages).",
    "Instead, buyers bid a premium on top of the taxes. The premium goes to the county, earns no interest, and is not refunded if the owner redeems (Eagle and Logan County pages). Winning premiums averaged 5.6% of the lien in Boulder County’s 2025 sale.",
    "The buyer pays the full advertised price (taxes, interest, advertising fee and a small certificate fee that varies by county) plus the premium. Interest runs from the sale date, and part of a month counts as a month.",
    "The owner can redeem any time and the buyer is repaid the lien plus interest. The buyer can apply for a treasurer’s deed 3 years after the sale, for example November 2029 for liens sold in November 2026 (Denver). A deed application goes to a public auction, and Denver asks for a $2,500 deposit."
   ],
   "links": [
    [
     "Colorado Revised Statutes, Title 39 (property tax)",
     "https://leg.colorado.gov/colorado-revised-statutes"
    ],
    [
     "Colorado Division of Banking: interest rates set by the Bank Commissioner",
     "https://banking.colorado.gov/public-notices/interest-rates-set-by-the-bank-commissioner"
    ],
    [
     "Denver tax lien sale",
     "https://www.denvergov.org/Government/Departments/Department-of-Finance/Our-Divisions/Treasury/Property-Taxes/Real-Estate-Delinquent-Taxes-and-Tax-Lien-Sale"
    ],
    [
     "Boulder County tax lien sale",
     "https://bouldercounty.gov/property-and-land/treasurer/taxes/tax-lien-sale/"
    ]
   ]
  },
  "sales": {
   "title": "2026 county tax lien sales",
   "note": "From each county treasurer’s own page (checked November 2, 2026). These are only some of Colorado’s 64 counties. Registration and deposit deadlines come before the sale day, so check each page. Properties and lists name owners, so we do not copy them.",
   "source": "https://www.jeffco.us/2438/Internet-Sale-Information",
   "checked": "2026-11-02",
   "rows": [
    {
     "town": "Denver County",
     "county": "",
     "date": "2026-11-05",
     "dateText": "Early November 2026 (county says usually the first part of November)",
     "time": "",
     "how": "Public auction of 2025 taxes",
     "link": "https://www.denvergov.org/Government/Departments/Department-of-Finance/Our-Divisions/Treasury/Property-Taxes/Real-Estate-Delinquent-Taxes-and-Tax-Lien-Sale",
     "linkText": "Denver Treasury"
    },
    {
     "town": "Mesa County",
     "county": "",
     "date": "2026-11-06",
     "time": "",
     "how": "Online; deposit due October 23, payment due November 9",
     "link": "https://www.mesacounty.us/departments-and-services/treasurer/tax-sale-information",
     "linkText": "Mesa County Treasurer"
    },
    {
     "town": "Eagle County",
     "county": "",
     "date": "2026-11-10",
     "time": "",
     "how": "Online (RealAuction); register by November 3 at 2 p.m.",
     "link": "https://www.eaglecounty.us/departments___services/office_of_the_treasurer/tax_lien_sale.php",
     "linkText": "Eagle County Treasurer"
    },
    {
     "town": "Jefferson County",
     "county": "",
     "date": "2026-11-12",
     "time": "",
     "how": "Online (SRI/Zeus), November 12 and 13; register by November 10",
     "link": "https://www.jeffco.us/2438/Internet-Sale-Information",
     "linkText": "Jefferson County Treasurer"
    },
    {
     "town": "Boulder County",
     "county": "",
     "date": "2026-11-13",
     "time": "8:30 AM",
     "how": "In person; registration opens 7:30 a.m.",
     "link": "https://bouldercounty.gov/property-and-land/treasurer/taxes/tax-lien-sale/",
     "linkText": "Boulder County Treasurer"
    },
    {
     "town": "Elbert County",
     "county": "",
     "date": "2026-11-17",
     "time": "",
     "how": "Backup date November 24 in case of bad weather",
     "link": "https://www.elbertcounty-co.gov/321/Tax-Lien-Sale",
     "linkText": "Elbert County Treasurer"
    },
    {
     "town": "Gunnison County",
     "county": "",
     "date": "2026-11-17",
     "time": "8:00 AM to 5:00 PM",
     "how": "Online (Zeus); registration closes November 16; $12 online fee per account",
     "link": "https://gunnisoncounty.org/213/Online-Tax-Lien-Sale",
     "linkText": "Gunnison County Treasurer"
    },
    {
     "town": "Logan County",
     "county": "",
     "date": "2026-11-19",
     "time": "10:00 AM",
     "how": "In person, Sterling; unsold parcels open to buy through November 24",
     "link": "https://www.logancountyco.gov/208/Tax-Liens-Sale",
     "linkText": "Logan County Treasurer"
    }
   ]
  },
  "tables": [
   {
    "title": "Boulder County: past tax lien sales",
    "note": "Totals from Boulder County Treasurer’s own “Prior Year Sale Information” table. The interest rate is the formula rate for that year. The average premium is what bidders paid on top of the taxes, and it is not refunded.",
    "source": "https://bouldercounty.gov/property-and-land/treasurer/taxes/tax-lien-sale/",
    "checked": "2026-11-02",
    "head": [
     "Sale date",
     "Interest rate",
     "Investors at sale",
     "Properties at auction",
     "Average premium",
     "Taxes collected"
    ],
    "rows": [
     [
      "Nov 14, 2025",
      "14%",
      "25",
      "520",
      "5.6%",
      "$5,676,650"
     ],
     [
      "Nov 8, 2024",
      "15%",
      "29",
      "591",
      "6.0%",
      "$3,800,832"
     ],
     [
      "Nov 17, 2023",
      "15%",
      "32",
      "488",
      "7.0%",
      "$2,329,831"
     ],
     [
      "Nov 16, 2022",
      "12%",
      "37",
      "446",
      "7.6%",
      "$2,470,113"
     ],
     [
      "Nov 5, 2021",
      "9%",
      "42",
      "402",
      "7.5%",
      "$2,918,713"
     ]
    ]
   }
  ]
 },
 "GA": {
  "sale": {
   "title": "Tax sale (Georgia)",
   "when": "Sales are held on the first Tuesday of the month, usually 10 a.m. to 4 p.m. at the courthouse. Each county decides which months it holds a sale (Fulton monthly; Gwinnett only a few times a year).",
   "steps": [
    "You buy the property itself, not a lien. The winner gets a tax deed right away, but the owner can still take it back.",
    "The opening bid is the taxes owed. Bidders bid the price up, and winning bids are usually many times the taxes owed (see Gwinnett County’s results below).",
    "For at least 12 months the owner can redeem by repaying the whole bid plus a premium of 20% for the first year (or part of it) and 10% more for each later year (O.C.G.A. 48-4-42, as summarized by TaxLien.io; the statute site blocked our tools).",
    "The owner’s right does not end on its own. The buyer can end it by serving a barment notice after the first year, or it ends after about 4 years.",
    "If you bid more than the taxes owed, the extra goes into excess funds, which the owner may claim unless the bid is redeemed. Georgia also has a separate judicial foreclosure process for some properties."
   ],
   "links": [
    [
     "O.C.G.A. Title 48, Chapter 4 (tax sales)",
     "https://law.justia.com/codes/georgia/title-48/chapter-4/"
    ],
    [
     "O.C.G.A. 48-4-42 (redemption premium)",
     "https://law.justia.com/codes/georgia/title-48/chapter-4/article-3/section-48-4-42/"
    ],
    [
     "Fulton County Sheriff: tax sales",
     "https://fultoncountyga.gov/inside-fulton-county/fulton-county-departments/sheriff/tax-sales"
    ],
    [
     "Georgia Department of Revenue: interest rate notice (9.75% for 2026)",
     "https://dor.georgia.gov/admin-2026-01-annual-notice-interest-rate-adjustment"
    ]
   ]
  },
  "sales": {
   "title": "Upcoming and recent county sales",
   "note": "From each county’s own page (checked November 2, 2026). Georgia has 159 counties; these are only a few. Sales can be pulled when owners pay, so confirm with the county. Sale lists name owners, so we do not copy them.",
   "source": "https://tax.chathamcountyga.gov/TaxSaleList",
   "checked": "2026-11-02",
   "rows": [
    {
     "town": "Fulton County",
     "county": "",
     "date": "2026-11-03",
     "time": "10:00 AM to 4:00 PM",
     "how": "Sheriff, courthouse steps, 136 Pryor St. SW, Atlanta; monthly on the first Tuesday",
     "link": "https://fultoncountyga.gov/inside-fulton-county/fulton-county-departments/sheriff/tax-sales",
     "linkText": "Fulton County Sheriff"
    },
    {
     "town": "Chatham County",
     "county": "",
     "date": "2026-11-03",
     "time": "10:00 AM to 4:00 PM",
     "how": "Savannah Civic Center, Bryan Room",
     "link": "https://tax.chathamcountyga.gov/TaxSaleList",
     "linkText": "Chatham County Tax Commissioner"
    },
    {
     "town": "Richmond County",
     "county": "",
     "date": "2026-11-03",
     "time": "",
     "how": "Tax levy sale (Augusta)",
     "link": "https://arctax.com/property/tax-sale-lists/",
     "linkText": "Richmond County Tax Commissioner"
    },
    {
     "town": "DeKalb County",
     "county": "",
     "date": "2026-11-03",
     "dateText": "First Tuesday of months it schedules",
     "time": "12:00 PM",
     "how": "Courthouse steps, Decatur",
     "link": "https://dekalbtaxga.gov/property-tax/tax-sales/",
     "linkText": "DeKalb County Tax Commissioner"
    },
    {
     "town": "Gwinnett County",
     "county": "",
     "date": "2026-12-01",
     "time": "",
     "how": "Listed as upcoming (earlier entries show “tentatively scheduled”)",
     "link": "https://www.gwinnetttaxcommissioner.com/property-tax/delinquent_tax/tax-liens-tax-sales",
     "linkText": "Gwinnett Tax Commissioner"
    }
   ]
  },
  "tables": [
   {
    "title": "Gwinnett County: past tax sale results, 2021 to 2026",
    "note": "Totals from Gwinnett County Tax Commissioner’s own “Tax Sale Results” file. The file also names owners, addresses and buyers, so we copy totals only. “Taxes owed” is the starting bid. The multiple is the middle winning bid divided by taxes owed. Gwinnett holds few sales a year, so some years are small (2023 had 11 parcels; 2026 has 4 so far).",
    "source": "https://www.gwinnetttaxcommissioner.com/property-tax/delinquent_tax/tax-liens-tax-sales",
    "checked": "2026-11-02",
    "head": [
     "Sale year",
     "Parcels offered",
     "No bid",
     "Taxes owed (starting bids)",
     "Winning bids",
     "Typical winning bid vs. taxes owed"
    ],
    "rows": [
     [
      2026,
      4,
      0,
      "$4,092",
      "$44,400",
      "10.4×"
     ],
     [
      2025,
      18,
      0,
      "$190,521",
      "$1,140,771",
      "5.8×"
     ],
     [
      2024,
      30,
      0,
      "$151,782",
      "$2,206,001",
      "13.5×"
     ],
     [
      2023,
      11,
      0,
      "$140,190",
      "$270,493",
      "3.9×"
     ],
     [
      2022,
      66,
      0,
      "$360,912",
      "$3,162,746",
      "5.9×"
     ],
     [
      2021,
      106,
      8,
      "$320,923",
      "$4,142,530",
      "6.0×"
     ]
    ]
   }
  ]
 }
};
