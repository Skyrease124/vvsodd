// DE, AR, ND, NH, RI, DC, ME, MT, UT, TN (Knox County) added 2026-11-09 from the linked statute/agency/county pages.
// OK (Oklahoma County), WV, KS, ID, NM, WY added 2026-11-09 from the linked statute/agency/county pages.
// WA, OR, MN, VA, AL added 2026-11-09 from the linked statute/agency pages.
// MI, NY, NC, CA sale steps added 2026-11-09 from the statute and county pages linked in each entry (CA from LA County TTC pages; state code pages were not reachable).
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
 },
 "MS": {
  "sale": {
   "title": "Land sale for unpaid taxes (Mississippi)",
   "when": "By state law each county sells on either the first Monday in April or the last Monday in August, and most use August (Lee County Tax Collector, citing Miss. Code 27-41-49 to 27-41-89). Next: April 5, 2027 or August 30, 2027. The 2026 August sales were on August 31.",
   "steps": [
    "The county tax collector sells land on which taxes were not paid. Many counties run the sale online through GovEase, and registration opens August 1. Lists are printed in a local newspaper in early August.",
    "The opening amount is the taxes plus penalty. Bidders then bid the price up. Large counties see heavy overbidding. Lee County says about 3,000 parcels sell with substantial overbidding and over 100 bidders present.",
    "What you buy is the land, subject to a 2-year redemption period. The owner stays the legal owner during that time, and you cannot take possession (Lee, Harrison and Lamar County pages).",
    "If the owner redeems, you are repaid the taxes and penalty you paid plus interest of 1.5% per month on that base amount. Your overbid is not repaid and earns nothing (Lee, Itawamba, Jackson and Lamar County pages).",
    "If nobody redeems within 2 years, you can apply to the Chancery Clerk for a tax deed. The clerk sends registered letters to the owner and any lien holders during the redemption period (Lee County). Most owners or lenders redeem.",
    "Some county pages call this a “lien” sale. It is a sale of the land with a right to buy it back, so we call it a redeemable deed."
   ],
   "links": [
    [
     "Lee County Tax Collector: tax sale",
     "https://leecotaxcollector.com/tax-sale"
    ],
    [
     "Itawamba County Tax Collector: tax sale",
     "https://itawamba.gov/tax-collector/"
    ],
    [
     "Jackson County: annual sale of delinquent taxes",
     "https://www.co.jackson.ms.us/376/Annual-Sale-of-Delinquent-Taxes"
    ],
    [
     "Lauderdale County: 2026 delinquent tax sale dates",
     "https://www.lauderdalecounty.org/tax-collector-announces-dates-for-2026-delinquent-tax-sale/"
    ],
    [
     "Harrison County Chancery Clerk: land redemption",
     "https://www.harrisoncountymschanceryclerk.gov/landredemption.asp"
    ],
    [
     "Mississippi Secretary of State: tax-forfeited lands",
     "https://www.sos.ms.gov/public-lands/tax-forfeited-lands"
    ]
   ]
  },
  "sales": {
   "title": "2026 county sales and what is next",
   "note": "From each county’s own page (checked November 2, 2026). Mississippi has 82 counties, and these are only some. Lists name owners, so we do not copy them.",
   "source": "https://leecotaxcollector.com/tax-sale",
   "checked": "2026-11-02",
   "rows": [
    {
     "town": "Most counties",
     "county": "",
     "date": "2027-04-05",
     "dateText": "April 5 or August 30, 2027 (first Monday in April or last Monday in August)",
     "time": "",
     "how": "Next sale under the state schedule",
     "link": "https://leecotaxcollector.com/tax-sale",
     "linkText": "Lee County explanation"
    },
    {
     "town": "Lauderdale County",
     "county": "",
     "date": "2026-08-31",
     "time": "8:30 AM",
     "how": "Online (GovEase); register by August 28",
     "link": "https://www.lauderdalecounty.org/tax-collector-announces-dates-for-2026-delinquent-tax-sale/",
     "linkText": "Lauderdale County Tax Collector"
    },
    {
     "town": "Lee County",
     "county": "",
     "date": "2026-08-31",
     "time": "8:30 AM",
     "how": "Last Monday in August; about 3,000 parcels in a typical year; online (GovEase)",
     "link": "https://leecotaxcollector.com/tax-sale",
     "linkText": "Lee County Tax Collector"
    },
    {
     "town": "Itawamba County",
     "county": "",
     "date": "2026-08-31",
     "time": "8:30 AM",
     "how": "Last Monday in August every year; online (GovEase)",
     "link": "https://itawamba.gov/tax-collector/",
     "linkText": "Itawamba County Tax Collector"
    }
   ]
  },
  "tables": [
   {
    "title": "Example: what you get back if the owner redeems (made-up numbers)",
    "note": "An illustration of the rule on this page, not a real sale. You bid $5,000 on land whose taxes and penalty total $1,000. The $4,000 above that is the overbid. If the owner redeems after 12 months, interest is 1.5% a month on the $1,000 base only.",
    "source": "https://www.co.jackson.ms.us/376/Annual-Sale-of-Delinquent-Taxes",
    "checked": "2026-11-02",
    "head": [
     "Item",
     "Amount"
    ],
    "rows": [
     [
      "You pay at the sale",
      "$5,000"
     ],
     [
      "Base (taxes and penalty)",
      "$1,000"
     ],
     [
      "Overbid (not repaid)",
      "$4,000"
     ],
     [
      "Interest, 12 months at 1.5% a month on the base",
      "$180"
     ],
     [
      "You get back",
      "$1,180"
     ],
     [
      "Result for you",
      "$3,820 less than you paid"
     ]
    ]
   }
  ]
 },
 "MO": {
  "sale": {
   "title": "Collector’s tax sale (Missouri)",
   "when": "Every county sells on the fourth Monday in August (RSMo 140.150). The 2026 sale was August 24. The next is August 23, 2027.",
   "steps": [
    "Land with delinquent taxes is offered at a public sale run by the county collector. Parcels can come off the list when owners pay, right up to the sale.",
    "You bid the price up. The bid cannot be less than the taxes, interest, penalty and costs due. You receive a certificate of purchase.",
    "The interest rate is written in the certificate and cannot be more than 10% a year. It applies only to the taxes and costs you paid. No interest is owed on anything you bid above that amount, and taxes you pay later earn 8% a year (RSMo 140.340).",
    "The owner, a lienholder or the occupant has an absolute right to redeem for 1 year. After that they keep a defeasible right to redeem until you get the deed (RSMo 140.340).",
    "At least 90 days before you can get the deed, you must send redemption notices by first-class and certified mail, after a title search (RSMo 140.405). You must have the deed made and recorded within 18 months of the sale, or your lien ends (RSMo 140.410).",
    "If nobody bids, the parcel is offered again at the next year’s sale. After two years with no bid, a third offering sells it to the highest bidder, with a minimum of what is owed and only 90 days to redeem. After that there is no redemption at all (RSMo 140.250)."
   ],
   "links": [
    [
     "RSMo 140.150 (sale on the fourth Monday in August)",
     "https://revisor.mo.gov/main/OneSection.aspx?section=140.150"
    ],
    [
     "RSMo 140.340 (redemption and interest)",
     "https://revisor.mo.gov/main/OneSection.aspx?section=140.340"
    ],
    [
     "RSMo 140.405 (redemption notice before the deed)",
     "https://revisor.mo.gov/main/OneSection.aspx?section=140.405"
    ],
    [
     "RSMo 140.410 (deed within 18 months)",
     "https://revisor.mo.gov/main/OneSection.aspx?section=140.410"
    ],
    [
     "RSMo 140.250 (third offering)",
     "https://revisor.mo.gov/main/OneSection.aspx?section=140.250"
    ],
    [
     "Jefferson County Collector: land sale FAQs",
     "https://www.jeffcomo.gov/faq.aspx?TID=53"
    ]
   ]
  },
  "sales": {
   "title": "Sales we confirmed",
   "note": "Checked November 2, 2026. Missouri has 114 counties and the City of St. Louis, and each posts its own notice. Lists name owners, so we do not copy them.",
   "source": "https://www.colecounty.org/179/Delinquent-Tax-Certificate-Sale",
   "checked": "2026-11-02",
   "rows": [
    {
     "town": "All counties",
     "county": "",
     "date": "2027-08-23",
     "time": "",
     "how": "Next statewide sale: fourth Monday in August 2027",
     "link": "https://revisor.mo.gov/main/OneSection.aspx?section=140.150",
     "linkText": "RSMo 140.150"
    },
    {
     "town": "Cole County",
     "county": "",
     "date": "2026-08-24",
     "time": "",
     "how": "Annual sale; county posted its 2026 results",
     "link": "https://www.colecounty.org/179/Delinquent-Tax-Certificate-Sale",
     "linkText": "Cole County Collector"
    }
   ]
  },
  "tables": [
   {
    "title": "Cole County 2026: what happens to parcels nobody wants",
    "note": "Counted from the county’s own 2026 “Delinquent Tax Sale Results.” The list names owners and buyers, so we copy only counts. Of 17 parcels offered, 10 drew no bid. Some had been offered many times: the county’s list shows offerings numbered up to 8th. A parcel that nobody bids on stays on the list and is offered again.",
    "source": "https://www.colecounty.org/179/Delinquent-Tax-Certificate-Sale",
    "checked": "2026-11-02",
    "head": [
     "Parcels offered",
     "Drew no bid",
     "Sold",
     "Highest offering number"
    ],
    "rows": [
     [
      "17",
      "10",
      "7",
      "8th"
     ]
    ]
   },
   {
    "title": "Example: why an overbid hurts (made-up numbers)",
    "note": "An illustration of RSMo 140.340, not a real sale. The taxes and costs on a parcel are $2,000 and competition pushes the winning bid to $8,000. If the owner redeems at the end of the year, interest of 10% runs only on the $2,000.",
    "source": "https://revisor.mo.gov/main/OneSection.aspx?section=140.340",
    "checked": "2026-11-02",
    "head": [
     "Item",
     "Amount"
    ],
    "rows": [
     [
      "You pay at the sale",
      "$8,000"
     ],
     [
      "Taxes and costs (earn 10%)",
      "$2,000"
     ],
     [
      "Overbid (earns nothing)",
      "$6,000"
     ],
     [
      "Interest after 1 year",
      "$200"
     ],
     [
      "You get back",
      "$8,200"
     ],
     [
      "Your return on the $8,000 you advanced",
      "2.5%"
     ]
    ]
   }
  ]
 },
 "MI": {
 "sale": {
  "title": "Tax foreclosure auctions (Michigan)",
  "when": "Taxes go delinquent March 1, the property is forfeited the next March 1, owners can redeem until March 31 after the foreclosure judgment, and counties auction from the third Tuesday in July through the first Tuesday in November (MCL 211.78k, 211.78m).",
  "steps": [
   "On March 1, property with taxes delinquent 12 months or more is forfeited to the county treasurer, which adds a $175 fee (MCL 211.78g).",
   "The circuit court enters a foreclosure judgment by March 30. The owner's right to redeem ends March 31 (21 days after judgment in a contested case) (MCL 211.78k).",
   "The state, then local governments and land banks, get first chance to buy. Then the county treasurer (or its agent) auctions the rest, often online, between the third Tuesday in July and the first Tuesday in November (MCL 211.78m).",
   "The minimum bid covers all delinquent taxes, interest, penalties and fees, and may include auction costs. Payment is due quickly (same day or within 21 days), and the buyer must sign an affidavit about other tax-delinquent property (MCL 211.78m).",
   "The buyer gets a deed within about 14 days of full payment, sold as is. Wayne County, for example, gives a quit claim deed with no warranties.",
   "If the sale brings more than the minimum bid and costs, the former owner can claim the remaining proceeds by filing a notice of intent by July 1 after the foreclosure (MCL 211.78t)."
  ],
  "links": [
   [
    "MCL 211.78g (forfeiture, redemption)",
    "https://www.legislature.mi.gov/Laws/MCL?objectName=mcl-211-78g"
   ],
   [
    "MCL 211.78k (foreclosure judgment)",
    "https://www.legislature.mi.gov/Laws/MCL?objectName=mcl-211-78k"
   ],
   [
    "MCL 211.78m (auctions, minimum bid)",
    "https://www.legislature.mi.gov/Laws/MCL?objectName=mcl-211-78m"
   ],
   [
    "MCL 211.78t (remaining proceeds)",
    "https://www.legislature.mi.gov/Laws/MCL?objectName=mcl-211-78t"
   ],
   [
    "Wayne County: auctions and claims",
    "https://www.waynecountymi.gov/Services/Property-Taxes/Auctions-Claims"
   ],
   [
    "Wayne County: forfeiture and foreclosure timeline",
    "https://www.waynecountymi.gov/Government/Elected-Officials/Treasurer/Property-Tax-Information/ForfeitureForeclosure-Timeline"
   ]
  ]
 }
},
 "NY": {
 "sale": {
  "title": "Tax foreclosure (New York, outside New York City)",
  "when": "Counties and other tax districts foreclose under Real Property Tax Law Article 11. The owner's redemption period generally ends two years after the lien date (RPTL 1110). New York City runs its own lien sales, which are not covered here.",
  "steps": [
   "The owner can redeem by paying the tax lien plus charges to the enforcing officer before the redemption period ends, generally two years after the lien date. Districts can lengthen it for homes and farms or shorten it to one year for vacant, abandoned homes (RPTL 1110).",
   "If nobody answers the foreclosure petition, the court enters a final judgment giving the tax district the property and directing a deed (RPTL 1136).",
   "Before conveying to anyone else, the district may choose to give the property back to the former owner if they pay all taxes, penalties, interest and charges (RPTL 1136).",
   "When a court-directed sale is needed, it is a public auction by the enforcing officer, advertised once a week for at least three weeks in a local newspaper (RPTL 1136).",
   "Anyone claiming surplus money from the sale files a written claim with the court clerk before the sale report is confirmed (RPTL 1135)."
  ],
  "links": [
   [
    "RPTL 1110 (redemption)",
    "https://www.nysenate.gov/legislation/laws/RPT/1110"
   ],
   [
    "RPTL 1135 (surplus)",
    "https://www.nysenate.gov/legislation/laws/RPT/1135"
   ],
   [
    "RPTL 1136 (judgment and sale)",
    "https://www.nysenate.gov/legislation/laws/RPT/1136"
   ]
  ]
 }
},
 "NC": {
 "sale": {
  "title": "Tax foreclosure sales (North Carolina)",
  "when": "Counties foreclose either by a court action (G.S. 105-374) or in rem through the clerk (G.S. 105-375). Sales are public auctions, followed by 10-day upset bid periods (G.S. 1-339.25).",
  "steps": [
   "Court route: the county sues in superior court, like a mortgage foreclosure. A commissioner sells at public auction to the highest bidder, free and clear except listed liens (G.S. 105-374).",
   "In rem route: the tax collector files a certificate with the clerk at least 30 days after the liens were advertised. After notice, it is docketed as a judgment, and the sheriff can sell under execution between three months and two years later (G.S. 105-375).",
   "After the sale, anyone can raise the bid by at least 5% (minimum $750) with a deposit, within 10 days. Each new upset bid opens another 10 days (G.S. 1-339.25).",
   "Your winning bid is not final until the upset period ends with no higher bid and the sale is confirmed.",
   "Money left after costs, taxes and other liens is paid as the court directs, or held by the clerk for anyone entitled to it (G.S. 105-374)."
  ],
  "links": [
   [
    "G.S. 105-374 (foreclosure action)",
    "https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_105/GS_105-374.html"
   ],
   [
    "G.S. 105-375 (in rem)",
    "https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_105/GS_105-375.html"
   ],
   [
    "G.S. 1-339.25 (upset bids)",
    "https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/BySection/Chapter_1/GS_1-339.25.html"
   ]
  ]
 }
},
 "CA": {
 "sale": {
  "title": "Tax-defaulted property auctions (California, as Los Angeles County describes it)",
  "when": "After 5 years in default for homes (3 for non-residential commercial property), the county Treasurer and Tax Collector has the power to sell at public auction. These steps come from Los Angeles County's official pages; other counties follow the same state law, but confirm locally.",
  "steps": [
   "Unpaid taxes start a 5-year waiting period for residential property and 3 years for non-residential commercial property. After that the Treasurer and Tax Collector can sell (LA County TTC).",
   "The auction is advertised for three weeks and on the county website. Owners and parties of interest get notice, and the sale is at least 45 days after notice by registered mail.",
   "The minimum bid is the amount needed to pay the taxes, fees and costs. It can be lowered if the property was offered before.",
   "The owner can stop the sale by paying all defaulted taxes in full by 5:00 p.m. on the last business day before the auction.",
   "The winner gets a tax deed, recorded about 60 to 70 days later. Property is sold as is, and the county does not clear other liens (it lists known IRS and other liens for information). Sales can be challenged for one year, and most title companies won't insure before then.",
   "Money left over (excess proceeds) can be claimed by parties of interest. The county mails notice within 90 days after the sale if it is over $150."
  ],
  "links": [
   [
    "LA County TTC: auction general information",
    "https://ttc.lacounty.gov/auction-general-information/"
   ],
   [
    "LA County TTC: auction FAQ",
    "https://ttc.lacounty.gov/auction-frequently-asked-questions/"
   ],
   [
    "LA County TTC: excess proceeds",
    "https://ttc.lacounty.gov/notice-of-excess-proceeds/"
   ]
  ]
 }
},
 "WA": {
 "sale": {
  "title": "County tax foreclosure (Washington)",
  "when": "After taxes are three years delinquent, the county treasurer forecloses in court and sells at a public (often online) auction. Owners can pay until the close of business the day before the sale (RCW 84.64).",
  "steps": [
   "When taxes are three years delinquent, the treasurer files certificates of delinquency in court and forecloses in the county's name. Owners get notice and time to pay (RCW 84.64.050).",
   "The owner or anyone with a recorded interest can redeem by paying the taxes, interest and costs until the close of business the day before the sale (RCW 84.64.060, 84.64.070).",
   "The treasurer holds a public auction, in person or online (RCW 84.64.080, 84.64.225). Property is sold as is, with no warranty of title, zoning or size.",
   "The minimum bid is the total taxes, interest and costs (RCW 84.64.080).",
   "If the winning bid is higher than the minimum, the extra goes to the record owner if they apply within three years of the sale. After that it goes to the county (RCW 84.64.080)."
  ],
  "links": [
   [
    "RCW chapter 84.64 (full text)",
    "https://app.leg.wa.gov/RCW/default.aspx?cite=84.64&full=true"
   ],
   [
    "RCW 84.64.080 (sale, minimum bid, surplus)",
    "https://app.leg.wa.gov/RCW/default.aspx?cite=84.64.080"
   ]
  ]
 }
},
 "OR": {
 "sale": {
  "title": "County tax foreclosure (Oregon)",
  "when": "Property can be foreclosed once three years have passed since the earliest delinquency. The court sells it to the county, the owner has two more years to redeem, and then the county deeds it to itself and may sell it (ORS 312, ORS 275).",
  "steps": [
   "Foreclosure is allowed once three years have passed from the earliest delinquency. The tax collector publishes a foreclosure list and mails notice to owners, who have 30 days to answer (ORS 312.010, 312.040, 312.070).",
   "The court enters judgment and orders the property sold directly to the county. Investors do not buy at this stage (ORS 312.100).",
   "The owner, heirs or lienholders can still redeem for two years after the judgment by paying the amount owed plus interest, a 5% penalty and a fee. The county sends notice at least a year before the deadline (ORS 312.120, 312.125).",
   "If not redeemed, the tax collector deeds the property to the county, and redemption rights end (ORS 312.200).",
   "The county can then order the sheriff to sell it at public auction, after four weekly notices, at or above a minimum price it sets. Payment can be cash, or 10% down with installments. Unsold property can be sold privately (ORS 275.110 to 275.200)."
  ],
  "links": [
   [
    "ORS chapter 312 (foreclosure)",
    "https://www.oregonlegislature.gov/bills_laws/ors/ors312.html"
   ],
   [
    "ORS chapter 275 (county land sales)",
    "https://www.oregonlegislature.gov/bills_laws/ors/ors275.html"
   ]
  ]
 }
},
 "MN": {
 "sale": {
  "title": "Tax forfeiture and county land auctions (Minnesota)",
  "when": "Land with long-unpaid taxes forfeits to the state. Since 2024, counties must first offer forfeited parcels at a public auction within about six months (Minn. Stat. 282.005).",
  "steps": [
   "Owners behind on taxes can confess judgment and pay over time (usually 10% down and nine yearly payments). Missing payments for 60 days makes the land subject to forfeiture (Minn. Stat. 279.37).",
   "When the redemption period runs out, the land forfeits to the state. The redemption period is set by Minn. Stat. 281.17, which we have not yet checked in full.",
   "The former owner can ask to buy it back for the taxes and costs within six months of forfeiture (longer for homesteads), if the county board approves (Minn. Stat. 282.241).",
   "The county must then offer the parcel at a public auction, which can be online, within six months, with at least 30 days' notice. The minimum bid is the taxes, assessments, penalties, interest and costs (Minn. Stat. 282.005).",
   "Money above the minimum bid goes to the former owner and other interested parties who claim it within six months of the county's notice (Minn. Stat. 282.005)."
  ],
  "links": [
   [
    "Minn. Stat. 279.37 (confession of judgment)",
    "https://www.revisor.mn.gov/statutes/cite/279.37"
   ],
   [
    "Minn. Stat. 282.005 (auction and surplus)",
    "https://www.revisor.mn.gov/statutes/cite/282.005"
   ],
   [
    "Minn. Stat. 282.241 (repurchase)",
    "https://www.revisor.mn.gov/statutes/cite/282.241"
   ]
  ]
 }
},
 "VA": {
 "sale": {
  "title": "Judicial sale of tax-delinquent land (Virginia)",
  "when": "Once taxes are delinquent on December 31 after the second anniversary of the due date (sooner for blighted property or land assessed at $100,000 or less), the locality can sue and the court sells the land (Va. Code 58.1-3965).",
  "steps": [
   "The locality sends the owner notice at least 30 days before suing, offering a payment plan of up to 72 months, and publishes the list (Va. Code 58.1-3965).",
   "The locality files suit in circuit court, naming everyone with an interest, and the land is sold like any court-ordered judicial sale (Va. Code 58.1-3967).",
   "The owner can stop the sale at any time before the sale date by paying all taxes, penalties, interest, costs and attorney fees. Partial payment doesn't count (Va. Code 58.1-3965, 58.1-3974).",
   "The treasurer can pause the sale for an installment plan of up to 72 months. If the owner defaults, the sale can go ahead without new notice (Va. Code 58.1-3965).",
   "Money left after the taxes and costs goes to the former owner or heirs. If nobody claims it within two years after the sale is confirmed, it goes to the locality (Va. Code 58.1-3967)."
  ],
  "links": [
   [
    "Va. Code 58.1-3965 (when land can be sold)",
    "https://law.lis.virginia.gov/vacode/title58.1/chapter39/section58.1-3965/"
   ],
   [
    "Va. Code 58.1-3967 (court sale, surplus)",
    "https://law.lis.virginia.gov/vacode/title58.1/chapter39/section58.1-3967/"
   ],
   [
    "Va. Code 58.1-3974 (redemption)",
    "https://law.lis.virginia.gov/vacode/title58.1/chapter39/section58.1-3974/"
   ]
  ]
 }
},
 "AL": {
 "sale": {
  "title": "Buying state-held tax-delinquent land (Alabama Department of Revenue)",
  "when": "Alabama counties hold yearly tax sales, but we have only confirmed the state's own process: the Department of Revenue sells land it holds from past sales, by price quote, all year.",
  "steps": [
   "Property taxes in Alabama are based on an October 1 lien date and are due the following October 1 (Alabama Department of Revenue).",
   "The Department of Revenue posts county lists (transcripts) of state-held tax-delinquent land, updated weekly, without street addresses.",
   "To buy, apply online for a price quote. The quote is emailed, and payment must be sent within 10 calendar days.",
   "If the state has held it under three years you get an assignment of the tax sale certificate; over three years you get a tax deed.",
   "The Department says neither gives clear title, and suggests talking to an attorney. County tax sale rules (rates, bidding, redemption) are in the Code of Alabama Title 40, Chapter 10, which we have not yet checked."
  ],
  "links": [
   [
    "Alabama Dept. of Revenue: tax-delinquent property and land sales",
    "https://revenue.alabama.gov/property-tax/tax-delinquent-property-and-land-sales/"
   ],
   [
    "Alabama Dept. of Revenue: property tax",
    "https://revenue.alabama.gov/division/property-tax/"
   ]
  ]
 }
},
 "OK": {
 "sale": {
  "title": "Tax resale auction (Oklahoma, as Oklahoma County describes it)",
  "when": "Oklahoma County holds a yearly resale auction in June for property sold earlier for unpaid taxes (the 2026 sale started June 8, 2026). These steps come from the Oklahoma County Treasurer's page; confirm with your county.",
  "steps": [
   "Taxes on real property are a lien for seven years from when they became due (68 O.S. 3101).",
   "Unpaid property taxes add 18% a year interest, charged at 1.5% a month (Oklahoma County Treasurer).",
   "The owner or a lienholder can redeem any time before the resale auction starts (68 O.S. 3113, as quoted by Oklahoma County).",
   "At the resale, bidders pay cash. The lowest acceptable bid is two-thirds of the assessed value or the total taxes, penalties, interest and costs, whichever is less.",
   "If nobody bids, the property is deeded to the county, which can sell it later. Buyers get a tax deed after recording, not a warranty deed, so buyer beware."
  ],
  "links": [
   [
    "68 O.S. 3101 (tax lien for 7 years)",
    "https://www.oscn.net/applications/oscn/DeliverDocument.asp?citeid=93152"
   ],
   [
    "Oklahoma County Treasurer (resale information)",
    "https://www.oklahomacounty.org/Elected-Offices/Treasurer"
   ]
  ]
 }
},
 "WV": {
 "sale": {
  "title": "State Auditor tax sales (West Virginia)",
  "when": "Each year the State Auditor certifies delinquent land between March 1 and August 1, then auctions it at the county courthouse within 90 days (W. Va. Code 11A-3-44, 11A-3-45). The old sheriff's sale law (11A-3-5) is repealed.",
  "steps": [
   "Between March 1 and August 1, the State Auditor certifies the list of delinquent and nonentered land in each county, adding a $25 charge per tract (11A-3-44).",
   "Bidders register in advance with the Auditor's office, or sign a notarized affidavit on sale day. The Auditor can refuse people with their own tax delinquencies or code violations (11A-3-45).",
   "Each tract is sold at public auction at the county courthouse to the highest eligible bidder, within 90 days after certification. Pay the Auditor by check, cash or money order by close of business that day (11A-3-45).",
   "The owner or any lienholder can redeem before the auction by paying the taxes, interest and charges (11A-3-47).",
   "After the Auditor approves your purchase, you have 120 days to prepare the list of people to notify and deposit the costs, or you lose the purchase. A 60-day extension costs $100 or 10% of the price, whichever is more (11A-3-52). How long owners can redeem after the sale is set in 11A-3-54 to 59, which we have not yet checked."
  ],
  "links": [
   [
    "W. Va. Code 11A-3-44 (certification)",
    "https://code.wvlegislature.gov/11A-3-44/"
   ],
   [
    "W. Va. Code 11A-3-45 (auction)",
    "https://code.wvlegislature.gov/11A-3-45/"
   ],
   [
    "W. Va. Code 11A-3-47 (redemption before sale)",
    "https://code.wvlegislature.gov/11A-3-47/"
   ],
   [
    "W. Va. Code 11A-3-52 (purchaser deadlines)",
    "https://code.wvlegislature.gov/11A-3-52/"
   ]
  ]
 }
},
 "KS": {
 "sale": {
  "title": "Tax foreclosure auctions (Kansas)",
  "when": "When land the county bid in at a tax sale is still unpaid on September 1 of the second year after that sale, the county sues in district court and the property is later auctioned (K.S.A. 79-2801). Sedgwick County, for example, holds a yearly auction.",
  "steps": [
   "Land with unpaid taxes is bid in by the county at the delinquent tax sale. Investors don't buy liens.",
   "If it is still unredeemed on September 1 of the second year after that sale, the county commissioners order a foreclosure suit in district court. For lower-value property the county can choose whether to sue (K.S.A. 79-2801).",
   "In Sedgwick County, properties two and a half or three and a half years delinquent are selected, and a $400 foreclosure fee is added. Owners can pay through the close of business the day before the sale.",
   "The sale is an open auction. The buyer pays a $21 deed-registration fee, and the sheriff's deed usually comes about 120 days later.",
   "Owners or lienholders can still challenge the sale in district court afterward (Sedgwick County)."
  ],
  "links": [
   [
    "K.S.A. 79-2801 (foreclosure action)",
    "https://www.ksrevisor.gov/statutes/chapters/ch79/079_028_0001.html"
   ],
   [
    "Sedgwick County: tax foreclosure auctions",
    "https://www.sedgwick.gov/treasurer/tax-foreclosure-auctions/"
   ]
  ]
 }
},
 "ID": {
 "sale": {
  "title": "County tax deeds and auctions (Idaho)",
  "when": "If taxes aren't paid within three years of becoming delinquent, the county takes a tax deed, then auctions the property within 14 months (Idaho Code 63-1005, 31-808).",
  "steps": [
   "If property isn't redeemed within three years of the delinquency date, the county tax collector issues a tax deed to the county, after mailing notice 2 to 5 months ahead and recording an affidavit (63-1005).",
   "The tax deed gives the county the owner's interest, free of recorded mortgages, liens and leases when proper notice was given (63-1009).",
   "The owner or a party in interest can still redeem until the county signs a sale contract or deeds it away, but no later than 14 months after the tax deed (63-1007).",
   "The county commissioners advertise the auction at least 10 days ahead, set a minimum bid covering all taxes, interest and costs, and sell to the highest bidder within 14 months of the tax deed (31-808).",
   "Money left after taxes and costs goes first to parties in interest, then to the former owner. The county sends notice within 30 days, and claims are due within 60 days (31-808)."
  ],
  "links": [
   [
    "Idaho Code 63-1005 (tax deed)",
    "https://legislature.idaho.gov/statutesrules/idstat/Title63/T63CH10/SECT63-1005/"
   ],
   [
    "Idaho Code 63-1007 (redemption)",
    "https://legislature.idaho.gov/statutesrules/idstat/Title63/T63CH10/SECT63-1007/"
   ],
   [
    "Idaho Code 63-1009 (effect of deed)",
    "https://legislature.idaho.gov/statutesrules/idstat/Title63/T63CH10/SECT63-1009/"
   ],
   [
    "Idaho Code 31-808 (county auction, excess)",
    "https://legislature.idaho.gov/statutesrules/idstat/Title31/T31CH8/SECT31-808/"
   ]
  ]
 }
},
 "NM": {
 "sale": {
  "title": "State auctions of tax-delinquent property (New Mexico)",
  "when": "The state Taxation and Revenue Department's Property Tax Division auctions delinquent property when title research and collection are done. There is no fixed schedule, and not every county has a sale every year.",
  "steps": [
   "Sales are scheduled as title research and other collection efforts finish. Notices, terms and property lists are posted on the Department's auction page.",
   "The minimum bid is the total taxes, penalty, interest and costs due.",
   "Register on sale day from 8 a.m. until the auction starts at 10 a.m. Bidding is oral and in person (or by a notarized agent). Pay by cashier's check, money order, or a check with a bank letter of guarantee.",
   "The buyer gets a state tax deed, which works like a quitclaim deed. The sale clears only the tax lien, not other liens, and property is sold as is.",
   "Former owners have no right to redeem, but they have two years to challenge the sale in court (7-38-70). A federal IRS lien can carry a 120-day redemption period."
  ],
  "links": [
   [
    "NM Taxation and Revenue: delinquent property tax auctions",
    "https://www.tax.newmexico.gov/businesses/property-tax-overview/delinquent-property-tax-auctions/"
   ]
  ]
 }
},
 "WY": {
 "sale": {
  "title": "County tax sales (Wyoming)",
  "when": "County treasurers advertise the sale three weeks in a row, starting at least four weeks before the sale and before the first week of September, then sell at the courthouse (W.S. 39-13-108(e)).",
  "steps": [
   "Unpaid taxes bear 18% a year interest until paid (W.S. 39-13-108(b)).",
   "The treasurer publishes the sale list once a week for three weeks; the first notice runs at least four weeks before the sale (W.S. 39-13-108(e)(ii)).",
   "At the courthouse sale (9 a.m. to 5 p.m.), anyone who pays the taxes, interest, penalties and costs on a parcel buys a certificate of purchase and must pay right away. Unsold parcels are bid in for the county, and the county can later sell those certificates (W.S. 39-13-108(e)(iii)).",
   "The owner can redeem until a valid tax deed application is accepted, by paying the sale amount plus 3% plus 15% a year interest, plus any later taxes you paid (also at 15%) (W.S. 39-13-109(e)).",
   "You can apply for a tax deed no sooner than four and no later than six years after the sale, after giving the required notice to occupants and the owner at least three months before applying (W.S. 39-13-108(e)(v))."
  ],
  "links": [
   [
    "Wyoming Statutes Title 39 (PDF; see 39-13-108 and 39-13-109)",
    "https://wyoleg.gov/statutes/compress/title39.pdf"
   ]
  ]
 }
},
 "DE": {
 "sale": {
  "title": "Sheriff's tax sales (Delaware)",
  "when": "Counties can collect unpaid taxes by a court monition and sheriff's sale. After the court approves the sale, the owner has 60 days to redeem by paying the price plus 15% (9 Del. C. 8722-8729). Kent and Sussex also have an older method with a one-year redemption at 20% (9 Del. C. 8776).",
  "steps": [
   "The county files a praecipe in Superior Court, and a monition issues to the sheriff (9 Del. C. 8722).",
   "The sheriff posts the monition on the property and returns it to the court within 10 days (8724).",
   "If the taxes aren't paid, a writ can issue 20 days after the sheriff's return, ordering the sheriff to sell the property (8725). The county finance office can approve or reject the final bid, and some counties require a bidder certificate (8726).",
   "The owner can redeem within 60 days after the court approves the sale by paying the purchase price plus 15% and costs (8729).",
   "If not redeemed, the buyer petitions the court for a deed (8727, 8728). In Kent and Sussex's other method, no deed issues until a year after the sale, and redemption costs 20% interest (8776)."
  ],
  "links": [
   [
    "9 Del. C. Chapter 87, Subchapter II (monition sales)",
    "https://delcode.delaware.gov/title9/c087/sc02/index.html"
   ],
   [
    "9 Del. C. Chapter 87, Subchapter IV (Kent and Sussex)",
    "https://delcode.delaware.gov/title9/c087/sc04/index.html"
   ]
  ]
 }
},
 "AR": {
 "sale": {
  "title": "Commissioner of State Lands auctions (Arkansas)",
  "when": "County collectors certify tax-delinquent parcels to the Arkansas Commissioner of State Lands, which offers them at public auctions by county; unsold parcels can be bought afterward online.",
  "steps": [
   "Delinquent parcels are certified by the county collector to the Commissioner of State Lands and listed in its public auction catalog by county, date and time.",
   "The minimum bid is the tax due, calculated through the date of sale.",
   "Thirty days after an auction, parcels that didn't sell can be bought from the Commissioner's office through its online post-auction sales.",
   "Buyers receive a limited warranty deed. The Commissioner does not insure or promise clear or marketable title.",
   "Money above the taxes, penalties, interest and costs can be claimed by the former owner one year after the sale. How long owners have to redeem is not stated on these pages, so check the Commissioner's rules."
  ],
  "links": [
   [
    "Arkansas Commissioner of State Lands: buyers guide",
    "https://cosl.org/Home/Buyers"
   ],
   [
    "Arkansas Commissioner of State Lands",
    "https://cosl.org"
   ]
  ]
 }
},
 "ND": {
 "sale": {
  "title": "County tax foreclosure and annual land sales (North Dakota)",
  "when": "Counties foreclose their own tax liens. Notice goes out by June 1 for taxes two or more years past due, foreclosure happens October 1, and the county sells tax-deeded land at its annual sale starting the third Tuesday of November (N.D.C.C. 57-28). The old tax-sale and redemption chapters (57-24, 57-26) were repealed in 1999.",
  "steps": [
   "Investors don't buy tax liens in North Dakota. The chapters on selling land for delinquent taxes (57-24) and redemption from tax sales (57-26) were repealed in 1999.",
   "By June 1 each year, the county auditor sends a notice of foreclosure for property with taxes two or more years past due. The foreclosure date is October 1 after the notice (57-28-01, 57-28-02).",
   "After foreclosure, the auditor issues a tax deed to the county, free of most encumbrances (57-28-09).",
   "The county holds its annual sale starting the third Tuesday of November, after posting notice 15 days ahead and publishing it at least 10 days ahead. Each parcel sells at auction for at least a set minimum price, for cash or 25% down with up to 10 years of payments. People who owe delinquent taxes in any county can't win (57-28-13 to 57-28-15).",
   "The former owner or close family can repurchase while the county still holds the title (57-28-19)."
  ],
  "links": [
   [
    "N.D.C.C. chapter 57-28 (PDF)",
    "https://ndlegis.gov/cencode/t57c28.pdf"
   ],
   [
    "N.D.C.C. chapter 57-24 (repealed, PDF)",
    "https://ndlegis.gov/cencode/t57c24.pdf"
   ]
  ]
 }
},
 "NH": {
 "sale": {
  "title": "Real estate tax liens and tax deeds (New Hampshire)",
  "when": "In towns that adopted the tax lien procedure, the tax collector executes a lien when taxes aren't paid by December 1. The owner can redeem at 14% a year until the collector gives a deed, which can happen 2 years after the lien (RSA 80:59, 80:69, 80:76).",
  "steps": [
   "If a town has adopted the tax lien procedure, the tax collector can put a real estate tax lien on property whose taxes aren't paid in full by December 1 after assessment. That lien comes before all other liens (RSA 80:59).",
   "Anyone with a legal interest can redeem before the deed is given by paying the lien plus 14% a year interest on the whole recorded lien (RSA 80:69).",
   "Two years after the lien is executed, the collector deeds unredeemed land to the lienholder (usually the town). The town can refuse the deed, and the lien then stays in place (RSA 80:76).",
   "If the town later sells the property, it can keep only the back taxes, interest, costs and penalty. It must file in superior court within 60 days so any excess goes to the people entitled to it (RSA 80:88)."
  ],
  "links": [
   [
    "RSA 80:59 (lien procedure)",
    "https://gc.nh.gov/rsa/html/V/80/80-59.htm"
   ],
   [
    "RSA 80:69 (redemption, 14%)",
    "https://gc.nh.gov/rsa/html/V/80/80-69.htm"
   ],
   [
    "RSA 80:76 (tax deed)",
    "https://gc.nh.gov/rsa/html/V/80/80-76.htm"
   ],
   [
    "RSA 80:88 (excess proceeds)",
    "https://gc.nh.gov/rsa/html/V/80/80-88.htm"
   ]
  ]
 }
},
 "RI": {
 "sale": {
  "title": "Municipal tax sales (Rhode Island)",
  "when": "The city or town tax collector sells land for unpaid taxes. Owners can redeem by paying the purchase price plus a penalty and interest, and after one year the buyer can petition the court to end redemption rights (R.I. Gen. Laws 44-9).",
  "steps": [
   "The tax collector advertises and sells land for unpaid taxes (R.I. Gen. Laws 44-9-7). We have not yet read the sale and notice sections in full.",
   "Owners entitled to notice can redeem. The penalty is 10% of the purchase price within six months, plus 1% of the price for each month after, plus 1% a month interest (44-9-19).",
   "After one year from the sale, the buyer can petition the superior court to foreclose all rights of redemption (44-9-25).",
   "Until that court case ends, the owner can still redeem, so plan on your money being tied up."
  ],
  "links": [
   [
    "R.I. Gen. Laws chapter 44-9 index",
    "https://webserver.rilegislature.gov/Statutes/TITLE44/44-9/INDEX.htm"
   ],
   [
    "44-9-19 (redemption)",
    "https://webserver.rilegislature.gov/Statutes/TITLE44/44-9/44-9-19.htm"
   ],
   [
    "44-9-25 (petition to foreclose)",
    "https://webserver.rilegislature.gov/Statutes/TITLE44/44-9/44-9-25.htm"
   ]
  ]
 }
},
 "DC": {
 "sale": {
  "title": "Real property tax sales (District of Columbia)",
  "when": "The Mayor (Office of Tax and Revenue) sends delinquency notices by May 1 and sells at public auction. Owners can redeem until a court foreclosure of the right of redemption is final; buyers can file to foreclose 6 months after the sale (D.C. Code 47-1341 to 47-1370).",
  "steps": [
   "By May 1 the District mails tax delinquency notices, and a final notice at least 2 weeks before a property is offered at the tax sale (47-1341).",
   "Sales are public auctions to the highest bidder. Bidders must have 20% of the purchase price on deposit, and property can't sell for less than the taxes owed (47-1346).",
   "The owner or anyone with an interest can redeem until a court judgment foreclosing redemption is final, by paying what the buyer paid (minus surplus) with interest, plus other listed amounts (47-1360, 47-1361). The interest rate is not stated on that page.",
   "Six months after the sale, the buyer can file a court complaint to foreclose the right of redemption (47-1370).",
   "A 2025 DC law (D.C. Law 26-41) changes parts of this process, but the code notes some of it has not been put in place yet. Check the current rules before bidding."
  ],
  "links": [
   [
    "D.C. Code 47-1341 (notices)",
    "https://code.dccouncil.gov/us/dc/council/code/sections/47-1341"
   ],
   [
    "D.C. Code 47-1346 (auction, deposit)",
    "https://code.dccouncil.gov/us/dc/council/code/sections/47-1346"
   ],
   [
    "D.C. Code 47-1360 (redemption)",
    "https://code.dccouncil.gov/us/dc/council/code/sections/47-1360"
   ],
   [
    "D.C. Code 47-1370 (foreclosure)",
    "https://code.dccouncil.gov/us/dc/council/code/sections/47-1370"
   ]
  ]
 }
},
 "ME": {
 "sale": {
  "title": "Municipal tax lien foreclosure (Maine)",
  "when": "Towns record a tax lien certificate, and if the taxes aren't paid within 18 months, the lien forecloses automatically and the town owns the property (36 M.R.S. 942, 943). Towns that later sell must use a broker and return excess money to the former owner (36 M.R.S. 943-C).",
  "steps": [
   "Between 8 months and one year after taxes are committed, the tax collector sends a 30-day demand. If unpaid, a tax lien certificate is recorded at the registry of deeds (36 M.R.S. 942).",
   "The certificate creates a tax lien mortgage. If it isn't paid within 18 months after recording, it is deemed foreclosed and redemption ends. Notice goes out 30 to 45 days before that date (36 M.R.S. 943).",
   "After that, the town holds title. Investors don't buy liens here.",
   "If the town sells to someone other than the former owner, it must give notice at least 90 days before listing, list with a licensed broker, and sell by quitclaim deed within 12 months (36 M.R.S. 943-C).",
   "Sale money above the taxes, interest, fees and foreclosure costs goes to the former owner (36 M.R.S. 943-C)."
  ],
  "links": [
   [
    "36 M.R.S. 942 (lien certificate)",
    "https://www.legislature.maine.gov/statutes/36/title36sec942.html"
   ],
   [
    "36 M.R.S. 943 (18-month foreclosure)",
    "https://legislature.maine.gov/statutes/36/title36sec943.html"
   ],
   [
    "36 M.R.S. 943-C (sale, excess to former owner)",
    "https://legislature.maine.gov/statutes/36/title36sec943-C.html"
   ]
  ]
 }
},
 "MT": {
 "sale": {
  "title": "Tax liens and assignments (Montana)",
  "when": "The county treasurer attaches a tax lien to delinquent property by the first working day in August. Investors can take an assignment of a county-held lien, and if it isn't redeemed within about 3 years, the assignee can get a tax deed (MCA 15-17-125, 15-17-323, 15-18-111, 15-18-211).",
  "steps": [
   "By the first working day in August, the county treasurer attaches a tax lien to properties with delinquent taxes. The county holds it unless it is assigned (MCA 15-17-125).",
   "Anyone can have a county-held lien assigned to them by sending the required mail notice and paying the delinquent taxes, penalties, interest and costs (MCA 15-17-323).",
   "The owner, an occupant or any interested party can redeem by the first working day in August, 3 years after the lien was attached (2 years for certain vacant lots with special assessments) (MCA 15-18-111).",
   "Between May 1 and May 30 of the year redemption expires, the required notices must be given (MCA 15-18-212).",
   "If it isn't redeemed in time, the treasurer issues the assignee a tax deed for a $25 fee plus costs (MCA 15-18-211). The interest rate is not stated in these sections, so check with the county."
  ],
  "links": [
   [
    "MCA 15-17-125 (lien attachment)",
    "https://mca.legmt.gov/bills/mca/title_0150/chapter_0170/part_0010/section_0250/0150-0170-0010-0250.html"
   ],
   [
    "MCA 15-17-323 (assignment)",
    "https://mca.legmt.gov/bills/mca/title_0150/chapter_0170/part_0030/section_0230/0150-0170-0030-0230.html"
   ],
   [
    "MCA 15-18-111 (redemption)",
    "https://mca.legmt.gov/bills/mca/title_0150/chapter_0180/part_0010/section_0110/0150-0180-0010-0110.html"
   ],
   [
    "MCA 15-18-211 (tax deed)",
    "https://mca.legmt.gov/bills/mca/title_0150/chapter_0180/part_0020/section_0110/0150-0180-0020-0110.html"
   ]
  ]
 }
},
 "UT": {
 "sale": {
  "title": "County May/June tax sales (Utah)",
  "when": "After taxes are four years delinquent, the county auditor sells the property at a tax sale in May or June; owners can redeem any time before that sale (Utah Code 59-2-1346, 59-2-1351).",
  "steps": [
   "Anyone can redeem on the owner's behalf any time before the May or June tax sale held after four years of delinquency, by paying all taxes, charges, interest, penalties and costs (59-2-1346).",
   "The county auditor schedules the sale in May or June, at the courthouse door or online in the same format, after giving at least four weeks of notice (59-2-1351).",
   "Bids must cover all taxes, charges, penalties, interest and costs. A bid for less than the whole parcel can win if it pays the full amount for the smallest portion, but strips that block access are rejected (59-2-1351.1).",
   "Winning bidders can't back out. The county legislative body can reject all bids (59-2-1351.1).",
   "The auditor issues a tax deed in fee simple. Money above what was owed is handled as unclaimed property for the former owner to claim (59-2-1351.1). Property with no buyer is struck off to the county (59-2-1351.3)."
  ],
  "links": [
   [
    "Utah Code Title 59, Chapter 2, Part 13 (PDF; see 59-2-1346, 1351, 1351.1)",
    "https://le.utah.gov/xcode/Title59/Chapter2/C59-2-P13_1800010118000101.pdf"
   ]
  ]
 }
},
 "TN": {
 "sale": {
  "title": "Delinquent tax sales (Tennessee, as Knox County describes it)",
  "when": "In Tennessee the courts handle delinquent tax sales; in Knox County, sale dates are set by court proceedings and run by the Clerk and Master. These steps come from the Knox County Trustee's page; confirm with your county.",
  "steps": [
   "Tax sale dates are set by court proceedings and posted by the county (Knox County Trustee).",
   "The Clerk and Master runs the sale and accepts cash, certified funds, cashier's check, money order or ACH only.",
   "Bidders must be fully current on their own property taxes.",
   "Winning bidders put down a deposit (the minimum bid plus 30% of the winning bid, per Knox County) and pay the rest within 10 days.",
   "Properties that don't sell on sale day can be offered again in a rebid. Redemption rules come from state law (Tenn. Code 67-5-2701), which we have not yet read."
  ],
  "links": [
   [
    "Knox County Trustee: tax sale",
    "https://trustee.knoxcounty.org/services/tax-sale"
   ]
  ]
 }
}
};
