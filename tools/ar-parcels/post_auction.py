#!/usr/bin/env python3
"""Arkansas COSL "Post Auction Sales" lists -> kinvest-liens/liens/states/ar-cosl-post.js
Source: https://cosl.org/Home/PostAuction (one page per county: PostAuctionView?county=NAME). Honest User-Agent, one request every 2 s.
Only parcels that are also in our current COSL auction list (ar-cosl-data.js) are kept, so a stale post-auction row can never create a listing.
Adds: delinquent year, back taxes due, named lienholders. The page's per-parcel links go to a third-party site and are NOT used.
Run:  python3 tools/ar-parcels/post_auction.py
"""
import html, json, os, re, time, urllib.parse, urllib.request, datetime, collections

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
STATES = os.path.join(ROOT, 'kinvest-liens', 'liens', 'states')
UA = 'PricePocketAsset research (https://pricepocketasset.com)'
BASE = 'https://cosl.org/Home/'


def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=45).read().decode('utf-8', 'replace')


def parse(page):
    i = page.find('Taxes Due</div>')
    if i < 0: return None
    cols = [html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', c))).strip() for c in re.findall(r'<div class="col-sm">(.*?)</div>', page[i:], re.S)]
    return [cols[k:k + 7] for k in range(0, len(cols) - 6, 7)]   # delYear, parcel, legal, acres, liens, owner, taxesDue


def norm(c): return re.sub(r'[^a-z]', '', c.lower())


if __name__ == '__main__':
    ours = json.loads(re.search(r'AR_COSL = (\[.*?\]);\n', open(os.path.join(STATES, 'ar-cosl-data.js'), encoding='utf8').read(), re.S).group(1))
    have = {(norm(d[0]), str(d[1])) for d in ours}
    names = sorted(set(urllib.parse.unquote(n) for n in re.findall(r'PostAuctionView\?county=([A-Za-z%0-9. ]+)', get(BASE + 'PostAuction'))))
    out, stats, bad = {}, {}, []
    for n in names:
        time.sleep(2)
        try: rows = parse(get(BASE + 'PostAuctionView?county=' + urllib.parse.quote(n)))
        except Exception as e: bad.append((n, str(e)[:60])); continue
        if rows is None: bad.append((n, 'no table')); continue
        kept = 0
        for r in rows:
            if (norm(n), r[1]) not in have: continue
            try: due = float(r[6].replace(',', '').replace('$', '') or 0)
            except ValueError: continue
            out['%s|%s' % (n.title().replace('St ', 'St '), r[1])] = [int(r[0]) if r[0].isdigit() else r[0], due, r[4][:500], r[2][:200]]
            kept += 1
        stats[n] = (len(rows), kept)
    day = datetime.date.today().isoformat()
    open(os.path.join(STATES, 'ar-cosl-post.js'), 'w', encoding='utf8').write(
        '// Arkansas COSL Post Auction Sales lists (https://cosl.org/Home/PostAuction), checked %s. Parcels also in our current auction list only.\n'
        '// "County|parcel": [delinquent year, back taxes due, lienholders named by COSL, COSL legal text]. Built by tools/ar-parcels/post_auction.py.\n'
        'const AR_COSL_POST = {checked: "%s", counties: %d, rows: %s};\n' % (day, day, len(stats), json.dumps(out, separators=(',', ':'))))
    tot = sum(a for a, b in stats.values()); kept = sum(b for a, b in stats.values())
    print(len(stats), 'counties;', tot, 'rows on COSL pages;', kept, 'matched to our list (of', len(have), ')'); print('problems:', bad)
    print(sorted(((a - b), n) for n, (a, b) in stats.items() if a - b > 0)[-8:])
