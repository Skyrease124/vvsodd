"""Official-data import tracker for Watch This Parcel, Parcel Timeline and Nearby Tax Sale Results.

Rules (see README.md):
 * A county list import is compared with the last VERIFIED snapshot. Only a successful and complete import changes anything.
 * Failed or incomplete imports are logged (imports.json) and change nothing: no events, no removal alerts.
 * Re-importing the same file (same sha256) is a no-op. Event ids are deterministic, so nothing is ever added twice.
 * A parcel missing from a good list is "No longer listed. Outcome unconfirmed." Sold / redeemed / withdrawn / canceled
   need an official record (record_outcome with a source URL) or a published results file.
 * Records are keyed by state|county|parcel|certificate. Parcel IDs are kept exactly as published (leading zeros etc.).
 * Ambiguous matches go to review.json and their events stay hidden from customers until an admin approves them.
"""
import hashlib, json, os, re, sys, datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
STATES = os.path.join(ROOT, 'kinvest-liens', 'liens', 'states')
TL = os.path.join(STATES, 'timeline')
SNAP = os.path.join(os.path.dirname(__file__), 'snapshots')
CFG = json.load(open(os.path.join(os.path.dirname(__file__), 'counties.json')))
TRACKED = ['amount', 'payoff', 'saleDate', 'status']
LABELS = {'amount': 'amount', 'payoff': 'payoff', 'saleDate': 'sale date', 'status': 'status'}

def sha(b): return hashlib.sha256(b).hexdigest()
def today(): return datetime.date.today().isoformat()
def key_of(state, county, parcel, cert=''): return '|'.join([state, county, str(parcel), str(cert or '')])
def eid(*parts): return hashlib.sha1('␟'.join(str(p) for p in parts).encode()).hexdigest()[:16]
def read_json(p, d):
    try:
        with open(p) as f: return json.load(f)
    except Exception: return d
def write_json(p, v):  # atomic
    os.makedirs(os.path.dirname(p), exist_ok=True)
    t = p + '.tmp'
    with open(t, 'w') as f: json.dump(v, f, separators=(',', ':'), ensure_ascii=False)
    os.replace(t, p)

def load_liens_js(fn):
    s = open(os.path.join(STATES, fn)).read(); i = s.index('LIENS.push(...')
    return s[:i], json.loads(s[i + 14:s.rindex(');')])
def save_liens_js(fn, head, rows):
    open(os.path.join(STATES, fn), 'w').write(head + 'LIENS.push(...' + json.dumps(rows, separators=(',', ':'), ensure_ascii=False) + ');\n')

def snap_of_rows(cfg, county, rows):
    out = {}
    for l in rows:
        out[key_of(cfg['state'], county, l['parcel'], l.get('cert', '') if cfg['kind'] == 'lien' and cfg.get('certInKey') else '')] = {k: l.get(k) for k in TRACKED if l.get(k) is not None}
    return out

def money(n): return '${:,.2f}'.format(n) if isinstance(n, (int, float)) else str(n)
def fmt(field, v): return money(v) if field in ('amount', 'payoff') else str(v)

def state_paths(county):
    slug = CFG[county]['slug']
    return os.path.join(SNAP, slug + '.json'), os.path.join(TL, slug + '.json')

def load_tl(county):
    c = CFG[county]
    return read_json(state_paths(county)[1], {'county': county, 'state': c['state'], 'events': [], 'gone': {}, 'lastVerified': None})

def log_import(rec):
    p = os.path.join(TL, 'imports.json'); d = read_json(p, {'imports': []})
    if any(x['id'] == rec['id'] for x in d['imports']): return False
    d['imports'].append(rec); write_json(p, d); return True

def add_review(item):
    p = os.path.join(TL, 'review.json'); d = read_json(p, {'items': []})
    if not any(x['id'] == item['id'] for x in d['items']): d['items'].append(item); write_json(p, d)

def run_import(county, records, *, raw_sha, source_name=None, source_url=None, published='', detected=None, ok=True,
               note='', complete=None, apply=None, kind='list'):
    """records: {key: {parcel, cert, amount, payoff, saleDate, status, row}} parsed from a county list.
    Returns the import log entry. Never raises for bad data: it logs and leaves the last verified state alone."""
    cfg = CFG[county]; detected = detected or today(); snap_p, _ = state_paths(county)
    snap = read_json(snap_p, None); tl = load_tl(county)
    imp_id = 'imp-' + cfg['slug'] + '-' + raw_sha[:12]
    entry = {'id': imp_id, 'county': county, 'state': cfg['state'], 'kind': kind, 'at': detected, 'published': published or '',
             'sourceName': source_name or cfg['sourceName'], 'sourceUrl': source_url or cfg['sourceUrl'], 'sha256': raw_sha,
             'records': len(records) if records else 0, 'status': 'ok', 'note': note}
    prev_logs = [x for x in read_json(os.path.join(TL, 'imports.json'), {'imports': []})['imports'] if x['county'] == county]
    if any(x['sha256'] == raw_sha and x['status'] == 'ok' for x in prev_logs):
        entry.update(status='duplicate', note='Same file as an earlier successful import; nothing changed.', id=imp_id + '-dup-' + detected)
        log_import(entry); return entry
    prev_n = len(snap['records']) if snap else 0
    if not ok or not records:
        entry.update(status='failed', note=note or 'The file could not be read. Last verified statuses were left in place.'); log_import(entry); return entry
    if complete is False or (prev_n and len(records) < cfg.get('minRatio', 0.8) * prev_n):
        entry.update(status='incomplete', note=(note + ' ' if note else '') + 'Only %d of the %d records we had last time. Treated as incomplete: last verified statuses were left in place and no removal alerts were sent.' % (len(records), prev_n))
        log_import(entry); return entry
    src = {'name': entry['sourceName'], 'url': entry['sourceUrl']}
    cur = {k: {f: r.get(f) for f in TRACKED if r.get(f) is not None} for k, r in records.items()}
    have = {e['id'] for e in tl['events']}; new_events = []; counts = {'added': 0, 'removed': 0, 'changed': 0}
    def emit(k, r, typ, field='', old=None, new=None, text='', official=True, review=False, rid=None):
        e = {'id': eid(k, typ, field, old, new, imp_id), 'key': k, 'state': cfg['state'], 'county': county, 'parcel': r['parcel'], 'cert': r.get('cert', ''),
             'type': typ, 'field': field, 'old': old, 'new': new, 'text': text, 'publishedAt': published or '', 'detectedAt': detected,
             'importId': imp_id, 'source': src, 'official': official}
        if review: e['review'] = True; e['reviewId'] = rid
        if e['id'] not in have: have.add(e['id']); new_events.append(e)
    if snap:
        old = snap['records']
        # possible re-keyed parcels: a removed and an added record sharing a schedule/account number are ambiguous
        added = [k for k in cur if k not in old]; removed = [k for k in old if k not in cur]
        sched = {}
        for k in added:
            s = records[k].get('alt')
            if s: sched.setdefault(s, []).append(k)
        amb_removed = set()
        for k in removed:
            s = (snap.get('alt') or {}).get(k)
            if s and s in sched:
                amb_removed.add(k)
                add_review({'id': eid('amb', k, imp_id), 'county': county, 'state': cfg['state'], 'status': 'open', 'at': detected, 'importId': imp_id,
                            'reason': 'A parcel left the list and a new one with the same schedule number (%s) appeared. Is it the same property under a new ID?' % s,
                            'oldKey': k, 'newKeys': sched[s]})
        for k in cur:
            if k in old:
                for f in TRACKED:
                    a, b = old[k].get(f), cur[k].get(f)
                    if a != b and (a is not None or b is not None):
                        counts['changed'] += 1
                        lab = {'amount': cfg['amountLabel'], 'payoff': cfg['payoffLabel'] or 'payoff', 'saleDate': 'Sale date', 'status': 'Status'}[f]
                        emit(k, records[k], f + '_changed', f, a, b, '%s changed from %s to %s on the county\'s latest list.' % (lab, fmt(f, a) if a is not None else 'not listed', fmt(f, b) if b is not None else 'not listed'))
            else:
                counts['added'] += 1
                if tl['gone'].get(k):
                    emit(k, records[k], 'relisted', '', None, None, 'Listed again on the county\'s latest list.'); tl['gone'].pop(k, None)
                else:
                    emit(k, records[k], 'added_to_list', '', None, None, 'Added to the county\'s list (not on the previous list).')
        for k in removed:
            counts['removed'] += 1
            last = dict(snap.get('rows', {}).get(k, {})); last['lastSeen'] = snap.get('asOf', ''); tl['gone'][k] = last
            emit(k, {'parcel': last.get('parcel', k.split('|')[2]), 'cert': last.get('cert', '')}, 'no_longer_listed', '', None, None,
                 'No longer listed. Outcome unconfirmed.', official=False, review=k in amb_removed, rid=eid('amb', k, imp_id))
    else:
        counts['added'] = len(records); entry['note'] = (entry['note'] + ' ' if entry['note'] else '') + 'First import: baseline recorded, no changes to compare yet.'
    for ev in new_events: tl['events'].append(ev)
    tl['events'].sort(key=lambda e: (e['detectedAt'], e['id']))
    tl['lastVerified'] = {'importId': imp_id, 'at': detected, 'published': published or '', 'records': len(records), 'sourceName': src['name'], 'sourceUrl': src['url']}
    tl['updated'] = detected
    rows = {k: r['row'] for k, r in records.items() if r.get('row')}
    write_json(snap_p, {'asOf': detected, 'importId': imp_id, 'records': cur, 'rows': {k: {x: rows[k][x] for x in ('parcel', 'cert', 'amount', 'payoff', 'saleDate', 'desc', 'owner', 'address') if x in rows[k]} for k in rows},
                        'alt': {k: r['alt'] for k, r in records.items() if r.get('alt')}})
    if apply: apply(records, snap)
    write_json(state_paths(county)[1], tl)
    entry.update(counts=counts, events=len(new_events)); log_import(entry); return entry

def record_outcome(county, parcel, outcome, date, source_url, source_name, price=None, cert='', detected=None, note=''):
    """An official record of what happened to a parcel (sold, redeemed, withdrawn, canceled). A source URL is required."""
    assert outcome in ('sold', 'redeemed', 'withdrawn', 'canceled', 'rescheduled'), outcome
    if not source_url: raise ValueError('An official source is required to label a parcel ' + outcome)
    cfg = CFG[county]; tl = load_tl(county); detected = detected or today(); k = key_of(cfg['state'], county, parcel, cert)
    txt = {'sold': 'Official record: sold%s.', 'redeemed': 'Official record: redeemed by the owner%s.', 'withdrawn': 'Official record: withdrawn from the sale%s.', 'canceled': 'Official record: sale canceled%s.', 'rescheduled': 'Official record: sale rescheduled%s.'}[outcome] % ((' for ' + money(price)) if price else '')
    typ = {'sold': 'result_posted', 'redeemed': 'redemption_confirmed', 'withdrawn': 'withdrawn_confirmed', 'canceled': 'auction_canceled', 'rescheduled': 'auction_rescheduled'}[outcome]
    e = {'id': eid(k, typ, date, price, source_url), 'key': k, 'state': cfg['state'], 'county': county, 'parcel': parcel, 'cert': cert, 'type': typ, 'field': 'salePrice' if price else '', 'old': None,
         'new': price, 'text': (note + ' ' if note else '') + txt, 'publishedAt': date or '', 'detectedAt': detected, 'importId': 'official-record', 'source': {'name': source_name, 'url': source_url}, 'official': True}
    if any(x['id'] == e['id'] for x in tl['events']): return False
    tl['events'].append(e); tl['events'].sort(key=lambda x: (x['detectedAt'], x['id'])); write_json(state_paths(county)[1], tl); return True

def import_results(county, results, *, raw_sha, source_name, source_url, published, detected=None, label='Sold at auction', ok=True, note=''):
    """Official auction RESULTS (actual sale prices). results: [{parcel, officialId, price, address, city, zip, buyerNote}].
    Writes one result_posted event per parcel and the verified-sales file used by Nearby Tax Sale Results.
    Matching is by exact parcel ID against the last verified list; anything else is queued for admin review and hidden until approved."""
    cfg = CFG[county]; detected = detected or today(); tl = load_tl(county); snap = read_json(state_paths(county)[0], None) or {'records': {}}
    imp_id = 'imp-' + cfg['slug'] + '-res-' + raw_sha[:12]
    entry = {'id': imp_id, 'county': county, 'state': cfg['state'], 'kind': 'results', 'at': detected, 'published': published, 'sourceName': source_name, 'sourceUrl': source_url, 'sha256': raw_sha, 'records': len(results), 'status': 'ok', 'note': note}
    prev = [x for x in read_json(os.path.join(TL, 'imports.json'), {'imports': []})['imports'] if x['county'] == county and x['sha256'] == raw_sha and x['status'] == 'ok']
    if prev: entry.update(status='duplicate', id=imp_id + '-dup-' + detected, note='Same results file as an earlier successful import; nothing changed.'); log_import(entry); return entry
    if not ok or not results:
        entry.update(status='failed', note=note or 'The results file could not be read. Nothing was changed.'); log_import(entry); return entry
    src = {'name': source_name, 'url': source_url}; have = {e['id'] for e in tl['events']}; n = 0; amb = 0
    for r in results:
        k = key_of(cfg['state'], county, r['parcel']); listed = k in snap['records']
        e = {'id': eid(k, 'result_posted', r['price'], published, source_url), 'key': k, 'state': cfg['state'], 'county': county, 'parcel': r['parcel'], 'cert': '', 'type': 'result_posted', 'field': 'salePrice',
             'old': None, 'new': r['price'], 'text': '%s for %s (actual sale price from the published results).' % (label, money(r['price'])), 'publishedAt': published, 'detectedAt': detected, 'importId': imp_id, 'source': src, 'official': True}
        if r.get('officialId') and r['officialId'] != r['parcel']: e['officialId'] = r['officialId']
        if not listed:
            e['review'] = True; e['reviewId'] = eid('res', k, imp_id); amb += 1
            add_review({'id': eid('res', k, imp_id), 'county': county, 'state': cfg['state'], 'status': 'open', 'at': detected, 'importId': imp_id, 'eventId': e['id'],
                        'reason': 'Result for parcel %s (%s) does not match a parcel on the last verified foreclosure list. Confirm it is the same property before customers see it.' % (r['parcel'], r.get('address', ''))})
        if e['id'] not in have: have.add(e['id']); tl['events'].append(e); n += 1
    tl['events'].sort(key=lambda x: (x['detectedAt'], x['id'])); write_json(state_paths(county)[1], tl)
    rp = os.path.join(TL, 'results-' + cfg['slug'] + '.json'); old = read_json(rp, {'results': []})['results']; have_r = {(x['parcel'], x['price'], x['date']) for x in old}
    for r in results:
        t = (r['parcel'], r['price'], published)
        if t not in have_r: old.append({'parcel': r['parcel'], 'address': r.get('address', ''), 'price': r['price'], 'date': published, 'acres': r.get('acres'), 'use': r.get('use', ''), 'matched': ('%s|%s|%s|' % (cfg['state'], county, r['parcel'])) in snap['records']})
    write_json(rp, {'county': county, 'state': cfg['state'], 'source': src, 'published': published, 'results': old})
    entry.update(events=n, counts={'added': n, 'removed': 0, 'changed': 0}, ambiguous=amb); log_import(entry); return entry
