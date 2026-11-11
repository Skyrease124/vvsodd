#!/usr/bin/env python3
"""HOA status backfill (Florida first). Resumable, idempotent, and the same command is used for new imports.

  python3 tools/fl-parcels/hoa_backfill.py                 # every listed Florida parcel not yet processed
  python3 tools/fl-parcels/hoa_backfill.py --refresh       # recompute every decision (cached roll leads are reused)
  python3 tools/fl-parcels/hoa_backfill.py --refresh-leads # also re-query the county roll for association leads
  python3 tools/fl-parcels/hoa_backfill.py --county Leon   # one county

Reads:  work/listings.json (via export-listings.js), parcels/<county>.json (parcel backfill), hoa/registry/*.json (reviewed declarations)
Writes: kinvest-liens/liens/states/hoa/<county-slug>.json, hoa/declarations.json, tools/fl-parcels/hoa-report.md|json, hoa-review-queue.csv
A parcel is 'confirmed' ONLY by a validated registry entry. Everything else is 'possible' (a lead exists) or 'unknown'.
"""
import argparse, concurrent.futures as cf, csv, datetime, json, os, re, subprocess, sys, threading
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, 'hoa'))
from net import fetch
import core, fl as fladapter
from backfill import CO_NO, slug

ROOT = os.path.abspath(os.path.join(HERE, '../..'))
STATES = os.path.join(ROOT, 'kinvest-liens/liens/states')
ADAPTERS = {'FL': fladapter}   # add 'GA': ga_adapter etc. when another state's local records are wired in
TODAY = datetime.date.today().isoformat()

def load(p, d):
    try: return json.load(open(p))
    except Exception: return d
def save(p, o):
    os.makedirs(os.path.dirname(p), exist_ok=True); t = p + '.tmp'
    with open(t, 'w') as f: json.dump(o, f, separators=(',', ':'), sort_keys=True)
    os.replace(t, p)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--refresh', action='store_true'); ap.add_argument('--refresh-leads', action='store_true'); ap.add_argument('--county'); ap.add_argument('--workers', type=int, default=6)
    ap.add_argument('--registry', default=os.path.join(HERE, 'hoa/registry')); ap.add_argument('--out', default=os.path.join(STATES, 'hoa')); ap.add_argument('--listings'); ap.add_argument('--parcels', default=os.path.join(STATES, 'parcels')); ap.add_argument('--no-leads', action='store_true'); ap.add_argument('--report-dir', default=HERE)
    a = ap.parse_args()
    os.makedirs(os.path.join(HERE, 'work'), exist_ok=True)
    listings = json.load(open(a.listings)) if a.listings else json.loads(subprocess.check_output(['node', os.path.join(HERE, 'export-listings.js')]))
    reg, bad = core.load_registry(a.registry)
    for name, pr in bad: print('REGISTRY REJECTED', name, pr)
    reg_ids = sorted(e['id'] for e in reg)
    adapter = ADAPTERS['FL']
    cache_path = os.path.join(HERE, 'work/hoa-leads.json'); cache = load(cache_path, {}); lock = threading.Lock()
    by = {}
    for x in listings: by.setdefault(x['county'], []).append(x)
    summary = {}
    for county in sorted(by):
        if a.county and county != a.county: continue
        if county not in CO_NO: continue
        outp = os.path.join(a.out, slug(county) + '.json'); prev = load(outp, {}); recs = prev.get('p', {})
        # recompute when asked, when the registry changed, or when a parcel is new
        stale = a.refresh or prev.get('registry') != reg_ids
        pf = load(os.path.join(a.parcels, slug(county) + '.json'), {}).get('p', {})
        todo = [x for x in by[county] if stale or x['parcel'] not in recs]
        parsed = {}
        for x in todo:
            r = pf.get(x['parcel']) or {}
            parsed[x['parcel']] = adapter.parse_legal(x.get('desc', ''), r.get('legal', ''))
        # leads: one query per distinct subdivision, cached and resumable
        subs = sorted({(county, core.norm_name(p['sub'])) for p in parsed.values() if p['sub'] and p['kind'] == 'plat'})
        def lead(cs):
            k = cs[0] + '|' + cs[1]
            if k in cache and not a.refresh_leads: return
            if a.no_leads: return
            try: L = adapter.find_leads(fetch, CO_NO[county], cs[1])
            except Exception as e: return  # leave uncached so a rerun retries
            with lock: cache[k] = L
        if subs and not a.no_leads:
            with cf.ThreadPoolExecutor(a.workers) as ex: list(ex.map(lead, subs))
            save(cache_path, cache)
        for x in todo:
            p = parsed[x['parcel']]; r = pf.get(x['parcel']) or {}
            rec = {'sub': p['sub'] or '', 'phase': p['phase'] or '', 'block': p['block'] or '', 'lot': p['lot'] or '', 'kind': p['kind']}
            parcel = {'county': county, 'sub': p['sub'], 'phase': p['phase'], 'block': p['block'], 'lot': p['lot']}
            if p['kind'] == 'mineral': d = {'st': 'unknown', 'note': 'Mineral or subsurface rights only: there is no surface lot.'}
            elif not p['sub'] or core.norm_name(p['sub']) in ('WEST', 'EAST', 'NORTH', 'SOUTH', 'E', 'W', 'N', 'S'): d = {'st': 'unknown', 'note': 'The legal description does not name a subdivision.'}
            else:
                k = county + '|' + core.norm_name(p['sub'])
                st_ = core.tokens(p['sub'])
                good = [x for x in cache.get(k, []) if st_ and (st_ & core.tokens(x.get('assoc', ''))) and fladapter.ASSOC.search((x.get('assoc') or '').upper())]
                d = core.decide(parcel, good, reg)
            rec.update(d); rec['ck'] = TODAY; recs[x['parcel']] = rec
        recs = {k: recs[k] for k in sorted(p['parcel'] for p in by[county]) if k in recs}
        save(outp, {'county': county, 'updated': TODAY, 'registry': reg_ids, 'p': recs})
        summary[county] = recs
    # public declaration details (validated entries only)
    save(os.path.join(a.out, 'declarations.json'), {'updated': TODAY, 'decls': {e['id']: core.public_entry(e) for e in reg}})
    report(summary, by, a.report_dir, bad, a.county)

def report(summary, by, rdir, bad, only):
    rows, queue = [], {}
    for county in sorted(by):
        if county not in summary:
            continue
        R = summary[county]; r = {'county': county, 'parcels': len(by[county]), 'confirmed': 0, 'possible': 0, 'unknown': 0, 'no_subdivision': 0, 'mineral': 0, 'leads': 0}
        for pid, x in R.items():
            r[x['st']] += 1
            if x['st'] == 'unknown' and x.get('kind') == 'mineral': r['mineral'] += 1
            elif x['st'] == 'unknown' and not x.get('sub'): r['no_subdivision'] += 1
            if x['st'] == 'possible' and x.get('ev'): r['leads'] += 1
            if x['st'] in ('possible',) and not x.get('decl'):
                q = queue.setdefault((county, x['sub']), {'county': county, 'subdivision': x['sub'], 'association': x.get('assoc', ''), 'listings': 0}); q['listings'] += 1
        rows.append(r)
    tot = {k: sum(r[k] for r in rows) for k in ('parcels', 'confirmed', 'possible', 'unknown', 'no_subdivision', 'mineral', 'leads')}
    json.dump({'generated': TODAY, 'counties': rows, 'total': tot, 'rejected_registry_entries': [[n, p] for n, p in bad]}, open(os.path.join(rdir, 'hoa-report.json'), 'w'), indent=1)
    cols = ['parcels', 'confirmed', 'possible', 'unknown', 'no_subdivision', 'mineral', 'leads']
    md = ['# Florida HOA status coverage report', '', 'Generated ' + TODAY + ' by tools/fl-parcels/hoa_backfill.py. Counts are unique parcels.', '',
          '| County | ' + ' | '.join(c.replace('_', ' ') for c in cols) + ' |', '|' + '---|' * (len(cols) + 1)]
    for r in rows + [dict(tot, county='**Total**')]: md.append('| ' + r['county'] + ' | ' + ' | '.join(str(r[c]) for c in cols) + ' |')
    md += ['', '**Confirmed** needs a reviewed recorded declaration in `hoa/registry/`. **Possible** means a lead exists (an official-roll association owner tied to the subdivision, or a reviewed declaration that does not clearly cover the lot). **Unknown** means the records checked did not establish whether an HOA applies; most of these have no subdivision in the legal description, or are mineral interests.', '',
           'Review queue (subdivisions with a lead, most listings first): `hoa-review-queue.csv`. Reviewing one declaration lifts every lot it covers.']
    open(os.path.join(rdir, 'hoa-report.md'), 'w').write('\n'.join(md) + '\n')
    with open(os.path.join(rdir, 'hoa-review-queue.csv'), 'w') as f:
        w = csv.writer(f); w.writerow(['county', 'subdivision', 'association_lead', 'listings'])
        for q in sorted(queue.values(), key=lambda q: -q['listings']): w.writerow([q['county'], q['subdivision'], q['association'], q['listings']])
    print(open(os.path.join(rdir, 'hoa-report.md')).read())

if __name__ == '__main__': main()
