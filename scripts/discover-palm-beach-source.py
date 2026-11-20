#!/usr/bin/env python3
"""Resolve current county-held XLSX from Palm Beach Tax Collector's official webpage."""
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

LANDING='https://www.pbctax.gov/taxes/property-tax/tax-certificates-and-deeds/'
class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.href=None
        self.text=[]
        self.links=[]
    def handle_starttag(self,tag,attrs):
        if tag=='a':
            self.href=dict(attrs).get('href')
            self.text=[]
    def handle_data(self,data):
        if self.href is not None:
            self.text.append(data)
    def handle_endtag(self,tag):
        if tag=='a' and self.href is not None:
            self.links.append((' '.join(self.text).strip(),self.href))
            self.href=None
            self.text=[]
def resolve_from_html(html,base=LANDING):
    parser=Links()
    parser.feed(html)
    candidates=[]
    for text,href in parser.links:
        if 'current county held certificates' not in text.lower():
            continue
        url=urljoin(base,href)
        parsed=urlparse(url)
        if parsed.scheme!='https' or parsed.hostname not in ('www.pbctax.gov','pbctax.gov'):
            raise ValueError('Unapproved current certificate download host')
        if not parsed.path.lower().endswith('.xlsx'):
            raise ValueError('Current certificate link is not XLSX; requires review')
        candidates.append(url)
    if len(candidates)!=1:
        raise ValueError('Expected one official current-certificate XLSX link, found '+str(len(candidates)))
    return candidates[0]
def discover_url(fetcher=None):
    if fetcher is not None:
        return resolve_from_html(fetcher(LANDING))
    req=Request(LANDING,headers={'User-Agent':'PricePocketAsset/1.0 source verification','Accept':'text/html'})
    with urlopen(req,timeout=20) as response:
        if response.url!=LANDING:
            raise ValueError('Unexpected landing-page redirect')
        html=response.read(2*1024*1024+1)
    if len(html)>2*1024*1024:
        raise ValueError('Landing page too large')
    return resolve_from_html(html.decode('utf-8',errors='replace'))
