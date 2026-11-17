#!/usr/bin/env python3
"""Builds kinvest-liens/liens/states/upcoming-sales.json: the "Upcoming Tax Sales" listings for Florida counties.

Three clearly separate sale types:
  taxdeed - upcoming tax deed auctions, from official clerk sale lists/notices in tools/taxsales/sources/*.json
  otc     - county-held tax certificates (over the counter), reused from the existing liens-<county>.js listings
  laft    - Lands Available for Taxes, from official clerk lists in tools/taxsales/sources/*.json (type "laft")

Each listing is keyed by county|type|parcel|certificate (or sale id), so the same item is never listed twice.
A listing that was present in the previous build but is missing from a newer copy of the SAME official list is kept
with status "gone" ("No longer listed · outcome unconfirmed"), unless the county itself marked it redeemed/canceled/etc.
Run:  python3 tools/taxsales/build.py
"""
import glob, json, os, re, sys, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
STATES = os.path.join(ROOT, 'kinvest-liens', 'liens', 'states')
OUT = os.path.join(STATES, 'upcoming-sales.json')
SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sources')

REGISTRY_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'counties.json')
HEALTH_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'health.json')


def load_registry(path=REGISTRY_FILE):
    return json.load(open(path))['counties']


def load_health(path=HEALTH_FILE):
    try:
        return json.load(open(path)).get('counties', {})
    except (OSError, ValueError):
        return {}


# county name -> its liens-<file>.js name (county-held certificate lists)
COUNTIES = {r['county']: {'file': r.get('file') or r['county'].lower().replace(' ', ''), 'links': r['links']} for r in load_registry()}
STATUSES = {'scheduled', 'redeemed', 'canceled', 'rescheduled', 'postponed', 'withdrawn', 'sold', 'gone', 'available'}
# A change to a sale is only recorded when an official source confirms it (a named source, its link and the date it said so).
CONFIRMED = {'canceled', 'rescheduled', 'postponed'}


def confirmation(c, fallback):
    c = c or fallback
    assert c and c.get('name') and str(c.get('url', '')).startswith('https://') and c.get('date'), 'a canceled/rescheduled/postponed status needs confirmedBy {name, url, date}: %r' % (c,)
    return {'name': c['name'], 'url': c['url'], 'date': c['date']}


def key(county, typ, parcel, ident):
    return '|'.join([county, typ, str(parcel).strip().upper(), str(ident).strip().upper()])


def liens_rows(fname):
    """Existing county-held (OTC) listings from liens-<county>.js (one JSON object per lien)."""
    try:
        s = open(os.path.join(STATES, 'liens-%s.js' % fname), encoding='utf-8').read()
    except OSError:
        return []
    out = []
    for m in re.finditer(r'\{[^{}]*"parcel"[^{}]*\}', s):
        try:
            out.append(json.loads(m.group(0)))
        except ValueError:
            pass
    return out


def last_checked(fname):
    try:
        t = json.load(open(os.path.join(STATES, 'timeline', fname + '.json')))
        lv = t.get('lastVerified') or {}
        return lv.get('at') or t.get('updated') or '', lv.get('sourceUrl') or '', lv.get('sourceName') or ''
    except (OSError, ValueError):
        return '', '', ''


def build(prev=None, sources_dir=SRC, today=None, registry=None, health=None):
    today = today or datetime.date.today().isoformat()
    registry = registry if registry is not None else load_registry()
    health = health if health is not None else load_health()
    events = []
    prev_by_key = {l['key']: l for l in (prev or {}).get('listings', [])}
    listings, seen = [], set()
    imported_sales = set()

    # 1. official sale lists / LAFT lists
    for path in sorted(glob.glob(os.path.join(sources_dir, '*.json'))):
        src = json.load(open(path))
        county, typ = src['county'], src['type']
        assert typ in ('taxdeed', 'laft'), path
        sale_id = src.get('saleId') or ''
        imported_sales.add((county, typ, sale_id))
        official = {'name': src['source']['name'], 'url': src['source']['url'], 'date': src['source'].get('published') or src['source'].get('checked') or today}
        ev = src.get('event') or {}
        ev_status = ev.get('status', 'scheduled')
        assert ev_status in ('scheduled', 'rescheduled', 'postponed', 'canceled'), (path, ev_status)
        ev_conf = confirmation(ev.get('confirmedBy'), None) if ev_status in CONFIRMED else None
        if typ == 'taxdeed':
            events.append({'key': '|'.join([county, typ, sale_id or src.get('saleDate', '')]), 'county': county, 'state': src.get('state', 'FL'), 'type': typ, 'saleId': sale_id,
                           'saleDate': src.get('saleDate', ''), 'saleTime': src.get('saleTime', ''), 'tz': src.get('tz', 'ET'), 'status': ev_status,
                           'newDate': ev.get('newDate', ''), 'newTime': ev.get('newTime', ''), 'note': ev.get('note', ''), 'confirmedBy': ev_conf,
                           'items': len(src['items']), 'auctionUrl': src.get('auctionUrl', ''), 'officialPage': src.get('officialPage', ''),
                           'source': src['source']['name'], 'sourceUrl': src['source']['url'], 'published': src['source'].get('published', ''), 'checked': src['source'].get('checked', today)})
        for it in src['items']:
            st = it.get('status', 'scheduled')
            assert st in STATUSES, (path, st)
            if st == 'scheduled' and ev_status in CONFIRMED:       # the whole sale was changed by a confirmed notice
                st = ev_status
                it = dict(it, statusNote=it.get('statusNote') or ev.get('note', ''), newDate=it.get('newDate') or ev.get('newDate', ''), newTime=it.get('newTime') or ev.get('newTime', ''), confirmedBy=ev_conf)
            conf = confirmation(it.get('confirmedBy'), official) if st in CONFIRMED else None
            k = key(county, typ, it['parcel'], it.get('cert') or it.get('deedNo') or sale_id)
            if k in seen:
                continue
            seen.add(k)
            l = {'key': k, 'county': county, 'state': src.get('state', 'FL'), 'type': typ, 'saleId': sale_id,
                 'saleDate': src.get('saleDate', ''), 'saleTime': src.get('saleTime', ''), 'tz': src.get('tz', 'ET'),
                 'parcel': it['parcel'], 'cert': it.get('cert', ''), 'status': st,
                 'auctionUrl': src.get('auctionUrl', ''), 'officialPage': src.get('officialPage', ''),
                 'source': src['source']['name'], 'sourceUrl': src['source']['url'], 'published': src['source'].get('published', ''),
                 'checked': src['source'].get('checked', today), 'liveCalendar': src['source'].get('liveCalendar', '')}
            for f in ('statusNote', 'openingBid', 'openingBidNote', 'owner', 'ownerAddress', 'situs', 'legal', 'homestead', 'assessed', 'newDate', 'newTime', 'deedNo', 'offeredDate'):
                if it.get(f) not in (None, ''):
                    l[f] = it[f]
            if st == 'rescheduled' and not l.get('newDate'):
                raise AssertionError('a rescheduled listing needs a confirmed newDate: %s' % k)
            if conf:
                l['confirmedBy'] = conf
                if st == 'rescheduled':
                    l['oldDate'] = l['saleDate']
            listings.append(l)

    # 2. existing county-held (OTC) listings, reused as-is
    for r_ in registry:
        county, cfg = r_['county'], {'file': r_.get('file') or r_['county'].lower().replace(' ', '')}
        if 'otc' not in r_.get('integrated', []):
            continue                  # only counties whose county-held list is marked integrated in counties.json
        chk, url, name = last_checked(cfg['file'])
        for r in liens_rows(cfg['file']):
            if (r.get('state') or 'FL') != 'FL' or (r.get('county') and r['county'] != county):
                continue
            k = key(county, 'otc', r['parcel'], r.get('cert') or '')
            if k in seen:
                continue
            seen.add(k)
            l = {'key': k, 'county': county, 'state': 'FL', 'type': 'otc', 'saleId': '', 'saleDate': '', 'saleTime': '', 'tz': 'ET',
                 'parcel': r['parcel'], 'cert': r.get('cert', ''), 'certYear': r.get('certYear', ''), 'status': 'available',
                 'openingBid': r.get('amount'), 'openingBidNote': 'Listed amount on the county-held certificate list',
                 'auctionUrl': '', 'officialPage': r.get('source') or url, 'source': name or ('%s County: county-held certificate list' % county),
                 'sourceUrl': r.get('source') or url, 'checked': chk}
            for f, g in (('owner', 'owner'), ('ownerAddress', 'address')):
                if r.get(g):
                    l[f] = r[g]
            listings.append(l)
        imported_sales.add((county, 'otc', ''))

    # 3. items that vanished from a newer copy of the same official list
    for k, old in prev_by_key.items():
        if k in seen:
            continue
        if (old['county'], old['type'], old.get('saleId', '')) not in imported_sales:
            listings.append(old)          # that list was not re-imported this time: keep as it was
            continue
        if old['status'] in ('scheduled', 'available', 'gone'):
            g = dict(old, status='gone', statusNote='No longer listed · outcome unconfirmed',
                     goneSince=old.get('goneSince') or today, lastSeen=old.get('lastSeen') or old.get('checked', ''))
            listings.append(g)
        else:
            listings.append(old)          # county already confirmed its outcome; keep that

    # cross-link the same parcel listed under more than one sale type
    by_parcel = {}
    for l in listings:
        by_parcel.setdefault((l['county'], l['parcel'].upper()), []).append(l)
    for group in by_parcel.values():
        if len(group) > 1:
            for l in group:
                other = sorted({o['type'] for o in group if o['type'] != l['type']})
                if other:
                    l['alsoListed'] = other
                else:
                    l.pop('alsoListed', None)

    order = {'taxdeed': 0, 'laft': 1, 'otc': 2}
    listings.sort(key=lambda l: (order[l['type']], l.get('saleDate') or '9999', l['county'], l['parcel']))
    outc = {}
    for r in registry:
        outc[r['county']] = {'state': r.get('state', 'FL'), 'links': r['links'], 'calendar': r.get('calendar'), 'integrated': r.get('integrated', []), 'auctionSite': r.get('auctionSite', ''),
                             'probed': bool(r.get('probe')), 'health': health.get(r['county'])}
    events.sort(key=lambda e: (e['saleDate'] or '9999', e['county']))
    return {'built': today, 'counties': outc, 'events': events, 'listings': listings}


if __name__ == '__main__':
    prev = None
    if os.path.exists(OUT):
        prev = json.load(open(OUT))
    out = build(prev)
    json.dump(out, open(OUT, 'w'), separators=(',', ':'))
    c = {}
    for l in out['listings']:
        c[(l['county'], l['type'], l['status'])] = c.get((l['county'], l['type'], l['status']), 0) + 1
    for k in sorted(c):
        print(k, c[k])
