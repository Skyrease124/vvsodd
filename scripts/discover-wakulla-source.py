#!/usr/bin/env python3
"""Resolve the active Wakulla county certificate XLSX from the tax collector's page."""
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

LANDING = "https://wakullatax.com/online-services"

class LinkParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.href = None
        self.label = []
        self.links = []
    def handle_starttag(self, tag, attrs):
        if tag == "a":
            self.href = dict(attrs).get("href")
            self.label = []
    def handle_data(self, data):
        if self.href is not None:
            self.label.append(data)
    def handle_endtag(self, tag):
        if tag == "a" and self.href is not None:
            self.links.append((" ".join(self.label).strip(), self.href))
            self.href = None
            self.label = []

def resolve_from_html(html, base=LANDING):
    parser = LinkParser()
    parser.feed(html)
    candidates = []
    for label, href in parser.links:
        if "download county certificate list" not in " ".join(label.lower().split()):
            continue
        url = urljoin(base, href)
        parsed = urlparse(url)
        if parsed.scheme != "https" or parsed.hostname not in ("wakullatax.com", "www.wakullatax.com"):
            raise ValueError("Unapproved Wakulla certificate download host")
        if not parsed.path.lower().endswith(".xlsx") or not parsed.path.startswith("/s/"):
            raise ValueError("Unexpected Wakulla certificate download file type")
        candidates.append(url)
    if len(candidates) != 1:
        raise ValueError(f"Expected one Wakulla XLSX link; found {len(candidates)}")
    return candidates[0]

def discover_url(fetcher=None):
    if fetcher is not None:
        return resolve_from_html(fetcher(LANDING))
    request = Request(LANDING, headers={"User-Agent": "PricePocketAsset/1.0 source verification", "Accept": "text/html"})
    with urlopen(request, timeout=20) as response:
        if response.url.rstrip("/") != LANDING:
            raise ValueError("Unexpected county source page redirect")
        html = response.read(2 * 1024 * 1024 + 1)
    if len(html) > 2 * 1024 * 1024:
        raise ValueError("Wakulla source page exceeds size limit")
    return resolve_from_html(html.decode("utf-8", errors="replace"))
