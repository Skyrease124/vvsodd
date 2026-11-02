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
 },
 "SC": {
  "sale": {
   "title": "Delinquent tax sale (South Carolina)",
   "when": "Counties sell once a year, mostly in the fall. The four 2026 sales we confirmed run from November 2 to December 8 (see the table below).",
   "steps": [
    "The code describes a sale of the delinquent property itself, not a lien certificate. The county tax collector advertises and sells it at a public auction (S.C. Code 12-51-40).",
    "You bid on the property. The sale is made for the taxes, penalties, assessments and costs, and bidders offer more. You usually must be present and register first, and some counties charge a bidder fee (Lancaster’s is $25).",
    "The owner, a grantee, or a mortgage or judgment creditor has 12 months from the sale to redeem (S.C. Code 12-51-90(A)).",
    "If they redeem, you are repaid your bid plus a one-time lump sum of interest, not a yearly rate. It is 3% of the bid in the first three months, 6% in months 4 to 6, 9% in months 7 to 9, and 12% in the last three months (12-51-90(B)).",
    "The interest can never be more than the opening bid on the property, so it is capped when you bid far above the taxes owed (12-51-90(B)). If nobody redeems in 12 months, the buyer gets a tax deed."
   ],
   "links": [
    [
     "S.C. Code Title 12, Chapter 51 (delinquent tax sales)",
     "https://www.scstatehouse.gov/code/t12c051.php"
    ],
    [
     "Charleston County: delinquent tax sale",
     "https://www.charlestoncounty.gov/departments/delinquent-tax/tax-sale.php"
    ],
    [
     "Richland County: tax sale",
     "https://www.richlandcountysc.gov/Property-Business/Taxes/Delinquent-Taxes/Tax-Sale"
    ],
    [
     "Lancaster County: tax sale procedures",
     "https://www.lancastercountysc.gov/198/Tax-Sale-Procedures"
    ],
    [
     "Saluda County: delinquent tax sale",
     "https://saludacounty.sc.gov/departments/tax-collector/delinquent-tax-sale"
    ]
   ]
  },
  "sales": {
   "title": "2026 county tax sales",
   "note": "From each county’s own page (checked November 2, 2026). South Carolina has 46 counties, and these are only some of them. Spartanburg’s page blocked our tools, so it is not listed. Property lists name owners, so we do not copy them.",
   "source": "https://www.richlandcountysc.gov/Property-Business/Taxes/Delinquent-Taxes/Tax-Sale",
   "checked": "2026-11-02",
   "rows": [
    {
     "town": "Richland County",
     "county": "",
     "date": "2026-11-02",
     "time": "10 a.m. to 6 p.m. (Mon), 9 a.m. on (Tue)",
     "how": "In person, Township Auditorium, 1703 Taylor St., Columbia; two days, Nov 2–3",
     "link": "https://www.richlandcountysc.gov/Property-Business/Taxes/Delinquent-Taxes/Tax-Sale",
     "linkText": "Richland County Tax Collector"
    },
    {
     "town": "Charleston County",
     "county": "",
     "date": "2026-11-09",
     "time": "9:00 AM",
     "how": "In person, North Charleston; resumes the following days if needed; no cash accepted for bids",
     "link": "https://www.charlestoncounty.gov/departments/delinquent-tax/tax-sale.php",
     "linkText": "Charleston County Delinquent Tax"
    },
    {
     "town": "Lancaster County",
     "county": "",
     "date": "2026-11-09",
     "time": "9:00 AM",
     "how": "In person, Springdale Recreation Center; online registration opened September 8; $25 fee",
     "link": "https://www.lancastercountysc.gov/198/Tax-Sale-Procedures",
     "linkText": "Lancaster County Delinquent Tax"
    },
    {
     "town": "Saluda County",
     "county": "",
     "date": "2026-12-08",
     "time": "10:00 AM",
     "how": "Tuesday sale; property list published for three weeks before",
     "link": "https://saludacounty.sc.gov/departments/tax-collector/delinquent-tax-sale",
     "linkText": "Saluda County Tax Collector"
    }
   ]
  },
  "tables": [
   {
    "title": "What the owner pays you if they redeem",
    "note": "From S.C. Code 12-51-90(B), read directly. The percentage is a one-time lump sum on the whole bid, based on when in the 12 months the owner redeems. It is capped at the opening bid on the property.",
    "source": "https://www.scstatehouse.gov/code/t12c051.php",
    "checked": "2026-11-02",
    "head": [
     "When the owner redeems",
     "Interest on top of your bid"
    ],
    "rows": [
     [
      "Months 1 to 3",
      "3% of the bid"
     ],
     [
      "Months 4 to 6",
      "6% of the bid"
     ],
     [
      "Months 7 to 9",
      "9% of the bid"
     ],
     [
      "Months 10 to 12",
      "12% of the bid"
     ]
    ]
   }
  ]
 },
 "KY": {
  "sale": {
   "title": "Sale of certificates of delinquency (Kentucky)",
   "when": "Each county clerk holds one sale a year, in the summer and fall. The state list shows the 2026 sales running from July 14 to October 22, 2026 in all 120 counties. Certificates cannot be sold until 90 days after the sheriff turns them over (April 15), and dates must be advertised at least 30 days ahead, so 2027 sales start in mid-July.",
   "steps": [
    "Unpaid property tax bills become delinquent on January 1. By April 15 the sheriff hands them to the county clerk, where they become certificates of delinquency, a lien on the property.",
    "Kentucky does not run an auction. Nobody bids a price or a rate. Registered buyers pay the face amount of the certificate. If you bought a property’s certificate last year, you get first claim on this year’s. The rest are handed out in rounds in an order set by a random drawing, in lots of 5 to 50 depending on the county’s size.",
    "You earn interest of 1% a month (12% a year, simple) on what you paid, starting on the purchase date. You can also add capped fees: up to $115 for the assignment paperwork, and pre-litigation attorney fees on a sliding scale (up to 100% of a small certificate, 70% of a larger one, capped at $350, $560 or $700), added $175 at a time as notices are sent (KRS 134.452).",
    "There is no fixed redemption deadline. The owner can pay you any time before a foreclosure sale. You cannot take enforcement action (other than sending notices) until one year after the bill became delinquent, and you then have 10 years to start a foreclosure.",
    "Foreclosure is through the Circuit Court. The Master Commissioner has the property appraised and sold at public auction, and you are repaid from the proceeds. The property does not simply pass to you."
   ],
   "links": [
    [
     "KY Dept. of Revenue: buying and collecting on certificates (manual, Oct. 2025)",
     "https://revenue.ky.gov/Property/Documents/Basic%20Information%20About%20Becoming%20a%20Potential%20Third%20Party%20Purchaser%20UPDATED%2012-9-2025.pdf"
    ],
    [
     "KY Dept. of Revenue: third party purchaser registration",
     "https://revenue.ky.gov/Property/Pages/Third-Party-Purchaser.aspx"
    ],
    [
     "2026 county clerk tax sale dates (state list)",
     "https://revenue.ky.gov/ClerkNetwork/Documents/Tax%20Sale%20Dates%202026.pdf"
    ],
    [
     "KRS 134.452 (what a buyer can collect)",
     "https://apps.legislature.ky.gov/law/statutes/statute.aspx?id=47033"
    ]
   ]
  },
  "tables": [
   {
    "title": "2026 county clerk sale dates, all 120 counties",
    "note": "From the Kentucky Department of Revenue’s “County Clerk Delinquent Property Tax Sale Dates 2026,” updated September 14, 2026 (checked November 2, 2026). All of these dates have passed. A county can change or cancel a sale, so confirm with the county clerk.",
    "source": "https://revenue.ky.gov/ClerkNetwork/Documents/Tax%20Sale%20Dates%202026.pdf",
    "checked": "2026-11-02",
    "head": [
     "County",
     "2026 sale date"
    ],
    "rows": [
     [
      "Pendleton",
      "Jul 14, 2026"
     ],
     [
      "Clark",
      "Jul 15, 2026"
     ],
     [
      "Kenton",
      "Jul 15, 2026"
     ],
     [
      "Letcher",
      "Jul 15, 2026"
     ],
     [
      "Nicholas",
      "Jul 15, 2026"
     ],
     [
      "Jefferson",
      "Jul 17, 2026"
     ],
     [
      "Lewis",
      "Jul 17, 2026"
     ],
     [
      "Trigg",
      "Jul 17, 2026"
     ],
     [
      "Breckinridge",
      "Jul 20, 2026"
     ],
     [
      "Allen",
      "Jul 21, 2026"
     ],
     [
      "Trimble",
      "Jul 21, 2026"
     ],
     [
      "Crittenden",
      "Jul 22, 2026"
     ],
     [
      "Spencer",
      "Jul 22, 2026"
     ],
     [
      "Marshall",
      "Jul 23, 2026"
     ],
     [
      "Mason",
      "Jul 23, 2026"
     ],
     [
      "Nelson",
      "Jul 23, 2026"
     ],
     [
      "Carroll",
      "Jul 24, 2026"
     ],
     [
      "Fayette",
      "Jul 24, 2026"
     ],
     [
      "Christian",
      "Jul 28, 2026"
     ],
     [
      "Greenup",
      "Jul 28, 2026"
     ],
     [
      "Henry",
      "Jul 29, 2026"
     ],
     [
      "Logan",
      "Jul 29, 2026"
     ],
     [
      "Owen",
      "Jul 29, 2026"
     ],
     [
      "Grant",
      "Aug 3, 2026"
     ],
     [
      "Boone",
      "Aug 4, 2026"
     ],
     [
      "Grayson",
      "Aug 4, 2026"
     ],
     [
      "Montgomery",
      "Aug 4, 2026"
     ],
     [
      "Washington",
      "Aug 4, 2026"
     ],
     [
      "Caldwell",
      "Aug 5, 2026"
     ],
     [
      "Garrard",
      "Aug 5, 2026"
     ],
     [
      "Jackson",
      "Aug 5, 2026"
     ],
     [
      "Webster",
      "Aug 5, 2026"
     ],
     [
      "Oldham",
      "Aug 6, 2026"
     ],
     [
      "Pulaski",
      "Aug 6, 2026"
     ],
     [
      "Rockcastle",
      "Aug 10, 2026"
     ],
     [
      "Ballard",
      "Aug 11, 2026"
     ],
     [
      "Calloway",
      "Aug 11, 2026"
     ],
     [
      "Graves",
      "Aug 11, 2026"
     ],
     [
      "Hickman",
      "Aug 11, 2026"
     ],
     [
      "Bourbon",
      "Aug 12, 2026"
     ],
     [
      "Boyd",
      "Aug 12, 2026"
     ],
     [
      "Campbell",
      "Aug 12, 2026"
     ],
     [
      "Franklin",
      "Aug 12, 2026"
     ],
     [
      "Bell",
      "Aug 13, 2026"
     ],
     [
      "Carlisle",
      "Aug 13, 2026"
     ],
     [
      "Gallatin",
      "Aug 13, 2026"
     ],
     [
      "Todd",
      "Aug 13, 2026"
     ],
     [
      "Bracken",
      "Aug 14, 2026"
     ],
     [
      "Casey",
      "Aug 14, 2026"
     ],
     [
      "Fleming",
      "Aug 14, 2026"
     ],
     [
      "Hardin",
      "Aug 17, 2026"
     ],
     [
      "Fulton",
      "Aug 18, 2026"
     ],
     [
      "Larue",
      "Aug 18, 2026"
     ],
     [
      "Meade",
      "Aug 18, 2026"
     ],
     [
      "Wolfe",
      "Aug 18, 2026"
     ],
     [
      "Elliott",
      "Aug 19, 2026"
     ],
     [
      "Hart",
      "Aug 19, 2026"
     ],
     [
      "Lyon",
      "Aug 19, 2026"
     ],
     [
      "Muhlenberg",
      "Aug 19, 2026"
     ],
     [
      "Anderson",
      "Aug 20, 2026"
     ],
     [
      "Bullitt",
      "Aug 20, 2026"
     ],
     [
      "Daviess",
      "Aug 20, 2026"
     ],
     [
      "Russell",
      "Aug 20, 2026"
     ],
     [
      "Butler",
      "Aug 21, 2026"
     ],
     [
      "Harrison",
      "Aug 21, 2026"
     ],
     [
      "Jessamine",
      "Aug 21, 2026"
     ],
     [
      "McCracken",
      "Aug 21, 2026"
     ],
     [
      "Magoffin",
      "Aug 24, 2026"
     ],
     [
      "McLean",
      "Aug 24, 2026"
     ],
     [
      "Scott",
      "Aug 24, 2026"
     ],
     [
      "Woodford",
      "Aug 24, 2026"
     ],
     [
      "Estill",
      "Aug 25, 2026"
     ],
     [
      "Menifee",
      "Aug 25, 2026"
     ],
     [
      "Robertson",
      "Aug 25, 2026"
     ],
     [
      "Boyle",
      "Aug 26, 2026"
     ],
     [
      "Lincoln",
      "Aug 26, 2026"
     ],
     [
      "Mercer",
      "Aug 26, 2026"
     ],
     [
      "Warren",
      "Aug 26, 2026"
     ],
     [
      "Harlan",
      "Aug 27, 2026"
     ],
     [
      "Henderson",
      "Aug 27, 2026"
     ],
     [
      "Madison",
      "Aug 27, 2026"
     ],
     [
      "Taylor",
      "Aug 27, 2026"
     ],
     [
      "Carter",
      "Aug 28, 2026"
     ],
     [
      "Livingston",
      "Aug 28, 2026"
     ],
     [
      "Shelby",
      "Sep 2, 2026"
     ],
     [
      "Clinton",
      "Sep 8, 2026"
     ],
     [
      "Perry",
      "Sep 8, 2026"
     ],
     [
      "Simpson",
      "Sep 8, 2026"
     ],
     [
      "Breathitt",
      "Sep 9, 2026"
     ],
     [
      "Laurel",
      "Sep 9, 2026"
     ],
     [
      "Bath",
      "Sep 14, 2026"
     ],
     [
      "Hopkins",
      "Sep 14, 2026"
     ],
     [
      "Cumberland",
      "Sep 15, 2026"
     ],
     [
      "Edmonson",
      "Sep 15, 2026"
     ],
     [
      "Metcalfe",
      "Sep 15, 2026"
     ],
     [
      "Union",
      "Sep 15, 2026"
     ],
     [
      "Hancock",
      "Sep 16, 2026"
     ],
     [
      "Morgan",
      "Sep 16, 2026"
     ],
     [
      "Clay",
      "Sep 17, 2026"
     ],
     [
      "Floyd",
      "Sep 17, 2026"
     ],
     [
      "Whitley",
      "Sep 17, 2026"
     ],
     [
      "Lawrence",
      "Sep 22, 2026"
     ],
     [
      "Wayne",
      "Sep 22, 2026"
     ],
     [
      "Barren",
      "Sep 23, 2026"
     ],
     [
      "Knott",
      "Sep 23, 2026"
     ],
     [
      "Lee",
      "Sep 23, 2026"
     ],
     [
      "Monroe",
      "Sep 23, 2026"
     ],
     [
      "Johnson",
      "Sep 24, 2026"
     ],
     [
      "Knox",
      "Sep 24, 2026"
     ],
     [
      "Martin",
      "Sep 25, 2026"
     ],
     [
      "Leslie",
      "Sep 28, 2026"
     ],
     [
      "Adair",
      "Sep 30, 2026"
     ],
     [
      "McCreary",
      "Sep 30, 2026"
     ],
     [
      "Rowan",
      "Sep 30, 2026"
     ],
     [
      "Pike",
      "Oct 7, 2026"
     ],
     [
      "Marion",
      "Oct 14, 2026"
     ],
     [
      "Owsley",
      "Oct 15, 2026"
     ],
     [
      "Powell",
      "Oct 21, 2026"
     ],
     [
      "Green",
      "Oct 22, 2026"
     ],
     [
      "Ohio",
      "Oct 22, 2026"
     ]
    ]
   }
  ]
 },
 "LA": {
  "sale": {
   "title": "Tax lien auctions (Louisiana)",
   "when": "Each parish tax collector (usually the sheriff) advertises the lien auction on or before May 1 of the year after the tax year, or as soon after as possible (La. R.S. 47:2154). The 2026 sales we found were in June (see the table below).",
   "steps": [
    "Louisiana changed its system on January 1, 2026. A constitutional amendment and a rewritten tax sale law (Acts 409 of 2024, 774 of 2024 and 411 of 2025) turned unpaid property tax into a lien that parishes sell as a tax lien certificate. The certificate is not title to the property.",
    "The auction price is the face value of the certificate, which is the delinquent amount. Bidders compete on the monthly interest rate. The most you can bid is 1% a month. Bids go down in steps of 0.1%, and no bid below 0.7% a month is accepted. The lowest rate wins, and ties go to the first bid submitted (R.S. 47:2154).",
    "That is 12% a year at the top and 8.4% a year at the floor, simple interest, not compounded. The law also lets the owner be charged a penalty of up to 5% (Louisiana Constitution, Article VII, Section 25).",
    "The owner keeps the property. To end the lien they pay the face value, the penalty, interest at the winning rate, and costs (R.S. 47:2243). The tax collector files the certificate in the parish mortgage records within 30 days of the auction.",
    "The certificate holder can sue only after the later of 3 years from recording the certificate or 6 months after the required notices (R.S. 47:2266.1). A judgment is carried out by a sheriff’s sale, and the holder is repaid from the proceeds. Money left over goes to the owners.",
    "Sales made before January 1, 2026 still run under the older rules. Ask the parish whether a given 2026 sale was held as a lien auction under the new law or as a tax sale under the old one."
   ],
   "links": [
    [
     "La. R.S. 47:2154 (tax lien auctions)",
     "https://legis.la.gov/Legis/Law.aspx?d=631549"
    ],
    [
     "La. R.S. 47:2266.1 (suit on the certificate)",
     "https://legis.la.gov/Legis/Law.aspx?d=1388659"
    ],
    [
     "La. R.S. 47:2241.1–2247 (ending a lien; termination price)",
     "https://legis.la.gov/Legis/Law.aspx?d=631610"
    ],
    [
     "La. Constitution Art. VII, Section 25 (tax administration)",
     "https://legis.la.gov/Legis/Law.aspx?d=206555"
    ],
    [
     "St. John the Baptist Parish Sheriff: 2026 property tax sale",
     "https://stjohnsheriff.org/2025-property-tax-sale-thursday-june-25-2026/"
    ]
   ]
  },
  "sales": {
   "title": "2026 parish sales we found",
   "note": "Checked November 2, 2026. Louisiana has 64 parishes and each posts its own notice, so this is a small sample. St. John the Baptist’s page was read directly. Lafayette’s page blocked our tools, so that row comes from TaxLien.io’s summary. Delinquent lists name owners, so we do not copy them.",
   "source": "https://stjohnsheriff.org/2025-property-tax-sale-thursday-june-25-2026/",
   "checked": "2026-11-02",
   "rows": [
    {
     "town": "St. John the Baptist Parish",
     "county": "",
     "date": "2026-06-25",
     "time": "9:00 AM to 3:00 PM",
     "how": "Online (Zeus Auction); registration May 27 to June 18",
     "link": "https://stjohnsheriff.org/2025-property-tax-sale-thursday-june-25-2026/",
     "linkText": "St. John Sheriff"
    },
    {
     "town": "Lafayette Parish",
     "county": "",
     "date": "2026-06-10",
     "time": "",
     "how": "Online auction, June 10 to 11 (per TaxLien.io; page not opened)",
     "link": "https://lafayettesheriff.com/services/make-a-payment/taxes/",
     "linkText": "Lafayette Parish Sheriff"
    }
   ]
  },
  "tables": [
   {
    "title": "What the bid range means per year",
    "note": "The monthly rate is simple interest. Multiply by 12 to compare with other states. The 5% owner penalty is on top.",
    "source": "https://legis.la.gov/Legis/Law.aspx?d=631549",
    "checked": "2026-11-02",
    "head": [
     "Winning bid (per month)",
     "Same as per year"
    ],
    "rows": [
     [
      "1.0% (the highest allowed)",
      "12.0%"
     ],
     [
      "0.9%",
      "10.8%"
     ],
     [
      "0.8%",
      "9.6%"
     ],
     [
      "0.7% (the lowest allowed)",
      "8.4%"
     ]
    ]
   }
  ]
 },
 "NE": {
  "sale": {
   "title": "Tax sale (Nebraska)",
   "when": "Real estate with taxes still unpaid on the first Monday of March after they become delinquent can be sold on or after that date (Neb. Rev. Stat. 77-1801). For the next sale that is March 1, 2027. Each county treasurer sets the exact sale day.",
   "steps": [
    "The county treasurer sells the tax lien, not the property. The buyer pays the delinquent taxes, interest and costs and receives a tax sale certificate (77-1807).",
    "Since 2015 nobody bids a rate or a share of the property. The law’s model is a round robin. Tickets are drawn at random to set each buyer’s order, and each registered bidder buys one parcel per round. The treasurer announces the rules at the start, and a land bank can take a parcel with an automatically accepted bid (77-1807).",
    "The rate is fixed by law. Delinquent taxes carry interest at 14% a year (45-104.01), and the owner redeeming pays the certificate amount plus interest at that rate from the purchase date, plus any later taxes you paid with interest (77-1824).",
    "The owner can redeem until you file for a tax deed. You may apply within nine months after the third anniversary of the sale (two years for property found vacant and abandoned), and your treasurer’s deed is allowed only if 110% of the assessed value minus the redemption amount is $25,000 or less. Otherwise you must foreclose in court (77-1837).",
    "Check the county’s own bidder rules each year. Some counties run the sale a little differently within the statute."
   ],
   "links": [
    [
     "Neb. Rev. Stat. 77-1801 (when property is subject to sale)",
     "https://nebraskalegislature.gov/laws/statutes.php?statute=77-1801"
    ],
    [
     "Neb. Rev. Stat. 77-1807 (how the sale is run)",
     "https://nebraskalegislature.gov/laws/statutes.php?statute=77-1807"
    ],
    [
     "Neb. Rev. Stat. 77-1824 (redemption)",
     "https://nebraskalegislature.gov/laws/statutes.php?statute=77-1824"
    ],
    [
     "Neb. Rev. Stat. 77-1837 (tax deed)",
     "https://nebraskalegislature.gov/laws/statutes.php?statute=77-1837"
    ],
    [
     "Neb. Rev. Stat. 45-104.01 (14% interest)",
     "https://nebraskalegislature.gov/laws/statutes.php?statute=45-104.01"
    ],
    [
     "NE Dept. of Revenue: delinquent real property list",
     "https://revenue.nebraska.gov/PAD/real-property/nebraska-delinquent-real-property-list"
    ]
   ]
  },
  "tables": [
   {
    "title": "Delinquent real property by county (2026 list)",
    "note": "Totals from the Nebraska Department of Revenue’s statewide delinquent real property list, built from what each county treasurer submitted in the first week of February 2026 (91 counties had delinquent parcels). The state list also names owners and addresses, so we show only counts and totals. These are unpaid taxes, not certificates already sold. The phone number is the county treasurer’s office, and the link is the county’s own parcel search.",
    "source": "https://revenue.nebraska.gov/PAD/real-property/nebraska-delinquent-real-property-list",
    "checked": "2026-11-02",
    "head": [
     "County",
     "Delinquent parcels",
     "Delinquent tax due",
     "Treasurer phone",
     "County parcel search"
    ],
    "rows": [
     [
      "Douglas",
      "4,569",
      "$7,960,160",
      "(402) 444-7082",
      [
       "Parcel search",
       "http://douglasne.mapping-online.com/DouglasCoNe"
      ]
     ],
     [
      "Lancaster",
      "823",
      "$2,475,832",
      "(402) 441-7499",
      [
       "Parcel search",
       "http://orion.lancaster.ne.gov/"
      ]
     ],
     [
      "Sarpy",
      "792",
      "$1,667,057",
      "(402) 593-2137",
      [
       "Parcel search",
       "https://apps.sarpy.gov/CaptureCZ/CAPortal/CAMA/CAPortal/CZ_MainPage.aspx#down"
      ]
     ],
     [
      "Scotts Bluff",
      "620",
      "$617,854",
      "(308) 436-6617",
      [
       "Parcel search",
       "http://www.nebraskaassessorsonline.us/search.aspx?county=Scotts"
      ]
     ],
     [
      "Gage",
      "444",
      "$386,052",
      "(402) 223-1316",
      [
       "Parcel search",
       "https://gage.gworks.com/"
      ]
     ],
     [
      "Jefferson",
      "408",
      "$351,397",
      "(402) 729-6827",
      [
       "Parcel search",
       "https://jefferson.gworks.com/"
      ]
     ],
     [
      "Dawson",
      "381",
      "$507,399",
      "(308) 324-3241",
      [
       "Parcel search",
       "https://dawson.gworks.com/"
      ]
     ],
     [
      "Adams",
      "327",
      "$556,691",
      "(402) 461-7120",
      [
       "Parcel search",
       "https://adams.nebraskaassessors.com/"
      ]
     ],
     [
      "Thurston",
      "317",
      "$296,714",
      "(402) 385-3058",
      [
       "Parcel search",
       "https://thurston.gworks.com/"
      ]
     ],
     [
      "Cheyenne",
      "315",
      "$210,796",
      "(308) 254-2733",
      [
       "Parcel search",
       "https://cheyenne.gworks.com/"
      ]
     ],
     [
      "Hall",
      "312",
      "$624,645",
      "(308) 385-5025",
      [
       "Parcel search",
       "http://grandislandne.map.beehere.net/"
      ]
     ],
     [
      "Custer",
      "310",
      "$222,437",
      "(308) 872-2921",
      [
       "Parcel search",
       "https://custer.gworks.com/"
      ]
     ],
     [
      "Cass",
      "306",
      "$399,032",
      "(402) 296-9324",
      [
       "Parcel search",
       "https://cass.gworks.com/"
      ]
     ],
     [
      "Washington",
      "288",
      "$482,159",
      "(402) 426-6888",
      [
       "Parcel search",
       "https://washington.gworks.com/"
      ]
     ],
     [
      "Morrill",
      "273",
      "$193,572",
      "(308) 262-1177",
      [
       "Parcel search",
       "https://morrill.gworks.com/"
      ]
     ],
     [
      "Otoe",
      "271",
      "$300,437",
      "(402) 873-9510",
      [
       "Parcel search",
       "https://otoe.gworks.com/"
      ]
     ],
     [
      "Madison",
      "260",
      "$353,798",
      "(402) 454-3311 (133)",
      [
       "Parcel search",
       "https://madison.gworks.com/"
      ]
     ],
     [
      "Dodge",
      "252",
      "$298,456",
      "(402) 727-2750",
      [
       "Parcel search",
       "https://dodge.gworks.com/"
      ]
     ],
     [
      "Red Willow",
      "241",
      "$199,374",
      "(308) 345-6515",
      [
       "Parcel search",
       "https://redwillow.gworks.com/"
      ]
     ],
     [
      "Platte",
      "237",
      "$295,450",
      "(402) 563-4913",
      [
       "Parcel search",
       "https://platte.gworks.com/"
      ]
     ],
     [
      "Nemaha",
      "232",
      "$242,257",
      "(402) 274-3319",
      [
       "Parcel search",
       "http://nemaha.nebraskaassessors.com/"
      ]
     ],
     [
      "Clay",
      "231",
      "$204,804",
      "(402) 762-3505",
      [
       "Parcel search",
       "https://clay.gworks.com/"
      ]
     ],
     [
      "Furnas",
      "227",
      "$135,939",
      "(308) 268-2195",
      [
       "Parcel search",
       "https://furnas.gworks.com/"
      ]
     ],
     [
      "Nuckolls",
      "215",
      "$118,548",
      "(402) 225-4351",
      [
       "Parcel search",
       "https://nuckolls.gworks.com/"
      ]
     ],
     [
      "Lincoln",
      "211",
      "$455,495",
      "(308) 534-4350 (120)",
      [
       "Parcel search",
       "https://lincoln.gworks.com/"
      ]
     ],
     [
      "Dawes",
      "201",
      "$201,429",
      "(308) 432-0105",
      [
       "Parcel search",
       "https://dawes.gworks.com/"
      ]
     ],
     [
      "Cherry",
      "199",
      "$107,272",
      "(402) 376-1580",
      [
       "Parcel search",
       "https://cherry.gworks.com/"
      ]
     ],
     [
      "Buffalo",
      "197",
      "$385,889",
      "(308) 236-1250",
      [
       "Parcel search",
       "https://buffalocounty.ne.gov/BUFFALO-COUNTY-GIS"
      ]
     ],
     [
      "Keith",
      "182",
      "$182,194",
      "(308) 284-3231",
      [
       "Parcel search",
       "https://keith.gworks.com/"
      ]
     ],
     [
      "Holt",
      "179",
      "$149,807",
      "(402) 336-1291",
      [
       "Parcel search",
       "http://holt.nebraskaassessors.com/"
      ]
     ],
     [
      "Franklin",
      "178",
      "$85,964",
      "(308) 425-6265",
      [
       "Parcel search",
       "https://franklin.gworks.com/"
      ]
     ],
     [
      "Sheridan",
      "176",
      "$140,383",
      "(308) 327-5651",
      [
       "Parcel search",
       "https://sheridan.gworks.com/"
      ]
     ],
     [
      "Kimball",
      "171",
      "$128,492",
      "(308) 235-2242",
      [
       "Parcel search",
       "https://kimball.gworks.com/"
      ]
     ],
     [
      "Box Butte",
      "167",
      "$143,920",
      "(308) 762-6975",
      [
       "Parcel search",
       "https://boxbutte.gworks.com/"
      ]
     ],
     [
      "Burt",
      "166",
      "$151,253",
      "(402) 374-2911",
      [
       "Parcel search",
       "https://burt.gworks.com/"
      ]
     ],
     [
      "Dundy",
      "166",
      "$90,564",
      "(308) 423-2346",
      [
       "Parcel search",
       "http://dundy.gworks.com/"
      ]
     ],
     [
      "Richardson",
      "147",
      "$64,675",
      "(402) 245-3511",
      [
       "Parcel search",
       "https://beacon.schneidercorp.com/"
      ]
     ],
     [
      "Pawnee",
      "145",
      "$60,223",
      "(402) 852-2380",
      [
       "Parcel search",
       "https://pawnee.gworks.com/"
      ]
     ],
     [
      "Harlan",
      "142",
      "$108,247",
      "(308) 928-2171",
      [
       "Parcel search",
       "https://harlan.gworks.com/"
      ]
     ],
     [
      "Brown",
      "140",
      "$99,414",
      "(402) 387-2650",
      [
       "Parcel search",
       "https://brown.gworks.com/"
      ]
     ],
     [
      "Saunders",
      "140",
      "$1,123,396",
      "(402) 443-8128",
      [
       "Parcel search",
       "https://saunders.gworks.com/"
      ]
     ],
     [
      "Saline",
      "134",
      "$202,570",
      "(402) 821-2375",
      [
       "Parcel search",
       "https://saline.gworks.com/"
      ]
     ],
     [
      "Webster",
      "129",
      "$102,837",
      "(402) 746-2877",
      [
       "Parcel search",
       "https://webster.gworks.com/"
      ]
     ],
     [
      "Butler",
      "125",
      "$155,512",
      "(402) 367-7450",
      [
       "Parcel search",
       "https://butler.gworks.com/"
      ]
     ],
     [
      "Dakota",
      "123",
      "$292,004",
      "(402) 987-2131",
      [
       "Parcel search",
       "https://dakota.gworks.com/"
      ]
     ],
     [
      "Colfax",
      "122",
      "$173,216",
      "(402) 352-8519",
      [
       "Parcel search",
       "https://beacon.schneidercorp.com/Application.aspx?App=ColfaxCountyNE&PageType=Search"
      ]
     ],
     [
      "Hitchcock",
      "121",
      "$79,582",
      "(308) 334-5500",
      [
       "Parcel search",
       "https://hitchcock.gworks.com/"
      ]
     ],
     [
      "Thayer",
      "110",
      "$38,010",
      "(402) 768-6227",
      [
       "Parcel search",
       "https://thayer.gworks.com/"
      ]
     ],
     [
      "Seward",
      "92",
      "$148,075",
      "(402) 643-4574",
      [
       "Parcel search",
       "https://seward.gworks.com/"
      ]
     ],
     [
      "Johnson",
      "89",
      "$94,531",
      "(402) 335-6310",
      [
       "Parcel search",
       "https://johnson.gworks.com/"
      ]
     ],
     [
      "Garden",
      "87",
      "$75,979",
      "(308) 772-3622",
      [
       "Parcel search",
       "https://garden.gworks.com/"
      ]
     ],
     [
      "Banner",
      "85",
      "$4,908",
      "(308) 436-5260",
      [
       "Parcel search",
       "https://banner.gworks.com/"
      ]
     ],
     [
      "York",
      "85",
      "$110,069",
      "(402) 362-4929",
      [
       "Parcel search",
       "https://york.gworks.com/"
      ]
     ],
     [
      "Knox",
      "83",
      "$65,278",
      "(402) 288-5615",
      [
       "Parcel search",
       "https://knox.gworks.com/"
      ]
     ],
     [
      "Antelope",
      "76",
      "$56,485",
      "(402) 887-4247",
      [
       "Parcel search",
       "https://schneidergis.co/antelopecone"
      ]
     ],
     [
      "Frontier",
      "76",
      "$74,071",
      "(308) 367-8631",
      [
       "Parcel search",
       "https://frontier.gworks.com/"
      ]
     ],
     [
      "Dixon",
      "71",
      "$55,831",
      "(402) 755-5603",
      [
       "Parcel search",
       "https://beacon.schneidercorp.com/"
      ]
     ],
     [
      "Merrick",
      "71",
      "$64,554",
      "(308) 946-2171",
      [
       "Parcel search",
       "https://merrick.gworks.com/"
      ]
     ],
     [
      "Valley",
      "67",
      "$42,103",
      "(308) 728-5606",
      [
       "Parcel search",
       "https://valley.gworks.com/"
      ]
     ],
     [
      "Chase",
      "65",
      "$73,225",
      "(308) 882-7510",
      [
       "Parcel search",
       "https://chase.gworks.com/"
      ]
     ],
     [
      "Sherman",
      "65",
      "$70,444",
      "(308) 745-1513 (101)",
      [
       "Parcel search",
       "https://sherman.gworks.com/"
      ]
     ],
     [
      "Boyd",
      "64",
      "$37,639",
      "(402) 775-2581",
      [
       "Parcel search",
       "https://boyd.gworks.com/"
      ]
     ],
     [
      "Nance",
      "64",
      "$92,889",
      "(308) 536-2165",
      [
       "Parcel search",
       "https://beacon.schneidercorp.com/"
      ]
     ],
     [
      "Phelps",
      "61",
      "$121,662",
      "(308) 995-6115",
      [
       "Parcel search",
       "https://phelps.gworks.com/"
      ]
     ],
     [
      "Pierce",
      "61",
      "$53,108",
      "(402) 329-6335",
      [
       "Parcel search",
       "https://pierce.gworks.com/"
      ]
     ],
     [
      "Greeley",
      "54",
      "$58,470",
      "(308) 428-3535",
      [
       "Parcel search",
       "https://greeley.gworks.com/"
      ]
     ],
     [
      "Polk",
      "54",
      "$64,830",
      "(402) 747-5441",
      [
       "Parcel search",
       "https://polk.gworks.com/"
      ]
     ],
     [
      "Boone",
      "49",
      "$28,818",
      "(402) 395-2513",
      [
       "Parcel search",
       "https://boone.gworks.com/"
      ]
     ],
     [
      "Cedar",
      "48",
      "$37,211",
      "(402) 254-7421",
      [
       "Parcel search",
       "https://cedar.gworks.com/"
      ]
     ],
     [
      "Stanton",
      "48",
      "$86,607",
      "(402) 439-2223",
      [
       "Parcel search",
       "https://beacon.schneidercorp.com/"
      ]
     ],
     [
      "Howard",
      "47",
      "$50,175",
      "(308) 754-4852",
      [
       "Parcel search",
       "https://howard.gworks.com/"
      ]
     ],
     [
      "Sioux",
      "46",
      "$18,728",
      "(308) 668-2422",
      [
       "Parcel search",
       "https://sioux.gworks.com/"
      ]
     ],
     [
      "Kearney",
      "44",
      "$97,169",
      "(308) 832-2730",
      [
       "Parcel search",
       "https://kearney.gworks.com/"
      ]
     ],
     [
      "Thomas",
      "42",
      "$23,460",
      "(308) 645-2262",
      [
       "Parcel search",
       "https://thomas.gworks.com/"
      ]
     ],
     [
      "Rock",
      "33",
      "$14,856",
      "(402) 684-3515",
      [
       "Parcel search",
       "https://rock.gworks.com/"
      ]
     ],
     [
      "Cuming",
      "32",
      "$26,713",
      "(402) 372-6011",
      [
       "Parcel search",
       "https://cuming.gworks.com/"
      ]
     ],
     [
      "Deuel",
      "30",
      "$22,063",
      "(308) 874-3307",
      [
       "Parcel search",
       "https://deuel.gworks.com/"
      ]
     ],
     [
      "Fillmore",
      "30",
      "$51,662",
      "(402) 759-3812",
      [
       "Parcel search",
       "https://fillmore.gworks.com/"
      ]
     ],
     [
      "Wayne",
      "27",
      "$24,805",
      "(402) 375-3885",
      [
       "Parcel search",
       "https://wayne.gworks.com"
      ]
     ],
     [
      "Hayes",
      "24",
      "$12,090",
      "(308) 286-3214",
      [
       "Parcel search",
       "https://hayes.gworks.com/"
      ]
     ],
     [
      "Perkins",
      "24",
      "$29,149",
      "(308) 352-7570",
      [
       "Parcel search",
       "https://perkins.gworks.com/"
      ]
     ],
     [
      "Hamilton",
      "21",
      "$13,090",
      "(402) 694-2291",
      [
       "Parcel search",
       "https://hamilton.gworks.com/"
      ]
     ],
     [
      "Wheeler",
      "21",
      "$6,621",
      "(308) 654-3236",
      [
       "Parcel search",
       "https://wheeler.gworks.com"
      ]
     ],
     [
      "Loup",
      "19",
      "$10,002",
      "(308) 942-3115",
      [
       "Parcel search",
       "https://loup.gworks.com/"
      ]
     ],
     [
      "Gosper",
      "16",
      "$13,665",
      "(308) 785-2450",
      [
       "Parcel search",
       "https://gosper.gworks.com/"
      ]
     ],
     [
      "Garfield",
      "8",
      "$8,610",
      "(308) 346-4125",
      [
       "Parcel search",
       "https://garfield.gworks.com/"
      ]
     ],
     [
      "Hooker",
      "6",
      "$1,213",
      "(308) 546-2245",
      [
       "Parcel search",
       "https://hooker.gworks.com/"
      ]
     ],
     [
      "Blaine",
      "3",
      "$2,265",
      "(308) 547-2222 (202)",
      [
       "Parcel search",
       "https://blaine.gworks.com/"
      ]
     ],
     [
      "Logan",
      "3",
      "$3,068",
      "(308) 636-2441",
      [
       "Parcel search",
       "https://logan.gworks.com/"
      ]
     ],
     [
      "Arthur",
      "2",
      "$432",
      "(308) 764-2201",
      [
       "Parcel search",
       "https://arthur.gworks.com/"
      ]
     ],
     [
      "Grant",
      "1",
      "$5",
      "(308) 458-2422",
      [
       "Parcel search",
       "https://grant.gworks.com/"
      ]
     ]
    ]
   }
  ]
 }
};
