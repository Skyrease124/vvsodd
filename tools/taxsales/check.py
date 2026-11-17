#!/usr/bin/env python3
"""Records whether each county's official page answers, so the site can say "Status unverified" with the last successful check time.

For every county in counties.json that has a `probe` {url, contains}: fetch the page with an honest User-Agent (no browser spoofing),
and record ok / failed in tools/taxsales/health.json. A failed probe never overwrites the last successful time.
Counties whose sites refuse automated requests have probe = null: they are not probed, and the site says so.
Run:  python3 tools/taxsales/check.py     then     python3 tools/taxsales/build.py
"""
import datetime, json, os, ssl, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
UA = 'PricePocketAsset research (https://pricepocketasset.com)'


def probe(url, contains=None, opener=None):
    """-> (ok, status, note)"""
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    try:
        r = (opener or urllib.request.urlopen)(req, timeout=25)
        status = getattr(r, 'status', 200)
        body = r.read(400000).decode('utf-8', 'replace').lower()
    except Exception as e:                                   # network error, HTTP error, timeout
        return False, getattr(e, 'code', 0) or 0, str(e)[:120]
    if status != 200:
        return False, status, 'HTTP %s' % status
    if contains and contains.lower() not in body:
        return False, status, 'page answered but the expected text was not found (the page may have changed)'
    return True, status, ''


def run(registry, old, now, prober=probe):
    out = {}
    for r in registry:
        p = r.get('probe')
        if not p:
            continue
        ok, status, note = prober(p['url'], p.get('contains'))
        prev = old.get(r['county']) or {}
        out[r['county']] = {'ok': ok, 'status': status, 'note': note, 'url': p['url'], 'lastAttempt': now,
                            'lastSuccess': now if ok else prev.get('lastSuccess', '')}
    return out


if __name__ == '__main__':
    reg = json.load(open(os.path.join(HERE, 'counties.json')))['counties']
    path = os.path.join(HERE, 'health.json')
    try:
        old = json.load(open(path)).get('counties', {})
    except (OSError, ValueError):
        old = {}
    now = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    res = run(reg, old, now)
    json.dump({'checked': now, 'counties': res}, open(path, 'w'), indent=1)
    for c, h in sorted(res.items()):
        print(c, 'OK' if h['ok'] else 'FAILED', h['status'], h['note'])
