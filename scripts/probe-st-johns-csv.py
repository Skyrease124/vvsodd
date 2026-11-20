#!/usr/bin/env python3
"""Read only: inspect St Johns official tax collector unpaid certificate CSV."""
import csv,io,json,urllib.request
URL='https://sjctax.us/downloads/Unredeemed_County_Individual_Certificates.csv'
def main():
    req=urllib.request.Request(URL,headers={'User-Agent':'PricePocketAsset source verification','Accept':'text/csv,*/*'})
    with urllib.request.urlopen(req,timeout=25) as response:
        if response.url != URL:raise ValueError('Unexpected redirect')
        data=response.read(15*1024*1024+1)
    if len(data)>15*1024*1024:raise ValueError('File too large')
    decoded=data.decode('utf-8-sig',errors='replace')
    sample=next(csv.reader(io.StringIO(decoded)),[])
    print(json.dumps({'url':URL,'bytes':len(data),'headers':sample[:100],'lines':decoded.count('\n')},indent=2))
if __name__=='__main__':main()
