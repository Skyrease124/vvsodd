// New York City tax lien sale lists, summarized from the Department of Finance open data file (Tax_Lien_Sale_Lists, downloaded 2026-11-07).
// Only counts are kept: no owner names, no addresses, no amounts (the file has none). Properties are counted once per list by borough/block/lot.
const NYC_HISTORY = {
 "source": "NYC Department of Finance: Tax Lien Sale Lists open data file (downloaded 2026-11-07) and the official Final Sale list PDFs for 2019, 2021 and 2025",
 "rows": 264142,
 "properties": 56396,
 "reachedSale": 9766,
 "note": "Counts of properties (borough/block/lot) on each monthly notice list. The file has no dollar amounts or owner names. It covers four yearly cycles: 2019, 2020, 2021 and 2025. The Final Sale lists are the combined regular and subsequent sales, labeled NYCTL (the NYC Tax Lien Trust). 2020 has no Final Sale list in the file, and the 2021 lists do not fill in the water-debt flag.",
 "sale2025": "The 2025 lien sale was held on June 3, 2025 (NYC Department of Finance).",
 "links": [
  [
   "NYC Department of Finance: lien sales",
   "https://www.nyc.gov/site/finance/property/property-lien-sales.page"
  ],
  [
   "2025 Final Sale list (PDF)",
   "https://www.nyc.gov/assets/finance/downloads/pdf/lien_sale/2025/2025-final-sale.pdf"
  ],
  [
   "2021 Final Sale list (PDF)",
   "https://www.nyc.gov/assets/finance/downloads/pdf/lien_sale/2021/2021-final-sale.pdf"
  ],
  [
   "2019 Final Sale list (PDF)",
   "https://www.nyc.gov/assets/finance/downloads/pdf/lien_sale/2019/2019-final-sale.pdf"
  ]
 ],
 "boroughNames": [
  "Manhattan",
  "Bronx",
  "Brooklyn",
  "Queens",
  "Staten Island"
 ],
 "cycles": [
  {
   "year": 2019,
   "stages": {
    "90": 22019,
    "60": 17386,
    "30": 14389,
    "10": 11967,
    "sale": 3724
   },
   "sameCycleSale": 3724,
   "boroughs": {
    "90": {
     "Manhattan": 1697,
     "Bronx": 3269,
     "Brooklyn": 9205,
     "Queens": 6099,
     "Staten Island": 1749
    },
    "sale": {
     "Manhattan": 317,
     "Bronx": 515,
     "Brooklyn": 1488,
     "Queens": 1051,
     "Staten Island": 353
    }
   },
   "waterOnly": {
    "90": 44.2,
    "sale": 22.0
   },
   "taxClass": {
    "90": {
     "1": 12019,
     "2": 5190,
     "4": 4810
    },
    "sale": {
     "1": 1950,
     "2": 735,
     "4": 1039
    }
   }
  },
  {
   "year": 2020,
   "stages": {
    "90": 18907,
    "60": 15718,
    "30": 9678,
    "10": 9112,
    "sale": null
   },
   "sameCycleSale": null,
   "boroughs": {
    "90": {
     "Manhattan": 1621,
     "Bronx": 2909,
     "Brooklyn": 7864,
     "Queens": 4975,
     "Staten Island": 1538
    },
    "sale": null
   },
   "waterOnly": {
    "90": 41.1,
    "sale": null
   },
   "taxClass": {
    "90": {
     "1": 10208,
     "2": 4485,
     "4": 4214
    },
    "sale": null
   }
  },
  {
   "year": 2021,
   "stages": {
    "90": 11194,
    "60": 9870,
    "30": 8791,
    "10": 7530,
    "sale": 2841
   },
   "sameCycleSale": 2841,
   "boroughs": {
    "90": {
     "Manhattan": 1373,
     "Bronx": 1324,
     "Brooklyn": 4519,
     "Queens": 2817,
     "Staten Island": 1161
    },
    "sale": {
     "Manhattan": 363,
     "Bronx": 298,
     "Brooklyn": 1148,
     "Queens": 760,
     "Staten Island": 272
    }
   },
   "waterOnly": {
    "90": null,
    "sale": null
   },
   "taxClass": {
    "90": {
     "1": 3657,
     "2": 3295,
     "4": 4242
    },
    "sale": {
     "1": 1201,
     "2": 705,
     "4": 935
    }
   }
  },
  {
   "year": 2025,
   "stages": {
    "90": 29972,
    "60": 26511,
    "30": 21546,
    "10": 18445,
    "sale": 4545
   },
   "sameCycleSale": 4545,
   "boroughs": {
    "90": {
     "Manhattan": 2756,
     "Bronx": 4880,
     "Brooklyn": 12078,
     "Queens": 8237,
     "Staten Island": 2021
    },
    "sale": {
     "Manhattan": 483,
     "Bronx": 676,
     "Brooklyn": 1663,
     "Queens": 1431,
     "Staten Island": 292
    }
   },
   "waterOnly": {
    "90": 40.7,
    "sale": 17.6
   },
   "taxClass": {
    "90": {
     "1": 15142,
     "2": 8875,
     "4": 5955
    },
    "sale": {
     "1": 2149,
     "2": 1126,
     "4": 1270
    }
   }
  }
 ]
};
