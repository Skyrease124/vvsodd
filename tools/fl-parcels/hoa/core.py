"""HOA status engine (state-neutral core). A state adapter supplies legal-description parsing and lead search;
the registry of reviewed declarations (hoa/registry/*.json) is the ONLY way a parcel becomes 'confirmed'.

Statuses: confirmed | possible | unknown.
  confirmed: a reviewed, recorded declaration or amendment covers this exact parcel (phase/block/lot rule satisfied).
  possible:  an association is linked to the subdivision (reviewed declaration that does not cover this lot, or an official-roll lead), coverage unverified.
  unknown:   the records checked did not establish whether an HOA applies.
"""
import json, os, re

ISO = re.compile(r'^\d{4}-\d{2}-\d{2}$')
MEMBERSHIP = {'mandatory', 'voluntary', 'unknown'}

def norm_name(s):
    s = re.sub(r'[^A-Z0-9 ]+', ' ', (s or '').upper())
    s = re.sub(r'\b(SUBDIVISION|SUBD|SUBDIV|SUB|S/D|AT|OF|THE|UNREC|UNRECORDED|PLAT|REPLAT|REPL|ADDITION|ADDN|ADD|UNIT|PHASE|PH)\b', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()

def tokens(s):
    GENERIC = {'HOMEOWNERS', 'HOME', 'OWNERS', 'ASSOCIATION', 'ASSN', 'ASSOC', 'INC', 'HOA', 'POA', 'PROPERTY', 'COMMUNITY', 'CLUB', 'MASTER', 'THE', 'AND', 'OF', 'AT', 'FLORIDA', 'FL', 'CORP', 'LLC', 'COUNTY', 'PARK', 'ESTATES', 'HEIGHTS', 'VILLAGE', 'ACRES', 'MANOR', 'TERRACE', 'GARDENS', 'LAKES', 'LAKE', 'HILLS', 'PLACE', 'NORTH', 'SOUTH', 'EAST', 'WEST', 'CITY', 'RIVER', 'BEACH', 'PINES', 'OAKS', 'WOODS', 'GROVE', 'POINT', 'HARBOR', 'ISLAND', 'LANDING', 'PRESERVE', 'RESERVE', 'RIDGE', 'CREEK', 'SPRINGS', 'TRAIL', 'VISTA', 'VIEW'}
    return {t for t in norm_name(s).split() if len(t) > 2 and t not in GENERIC and not t.isdigit()}

def expand_rule(rule):
    """'all' | ['1-50', '55', 'A'] -> None (all) or a set of strings. Numeric ranges are expanded."""
    if rule in (None, 'all', ['all']): return None
    out = set()
    for r in rule:
        r = str(r).strip().upper()
        m = re.match(r'^(\d+)\s*-\s*(\d+)$', r)
        if m and int(m.group(2)) - int(m.group(1)) <= 5000: out.update(str(i) for i in range(int(m.group(1)), int(m.group(2)) + 1))
        else: out.add(r.lstrip('0') or '0' if r.isdigit() else r)
    return out

def validate_entry(e):
    """Returns a list of problems. An entry with any problem is rejected and can never produce 'confirmed'."""
    p = []
    for k in ['id', 'name', 'county', 'subdivisions', 'coverage', 'documents', 'verified']:
        if not e.get(k): p.append('missing ' + k)
    docs = e.get('documents') or []
    decl = [d for d in docs if d.get('type') == 'declaration']
    if not decl: p.append('needs a recorded declaration')
    for d in docs:
        if not (d.get('recording') or d.get('url')): p.append('document without a recording number or source link')
        if d.get('recorded') and not ISO.match(d['recorded']): p.append('bad recorded date')
        if d.get('type') == 'amendment' and d.get('effect') not in ('adds', 'removes', 'restates', 'other'): p.append('amendment needs an effect')
    v = e.get('verified') or {}
    if not v.get('by') or not ISO.match(v.get('date', '')): p.append('verified needs by and date')
    cov = e.get('coverage') or {}
    for k in ('phases', 'blocks', 'lots'):
        if k not in cov: p.append('coverage needs ' + k + ' ("all" or a list)')
    if e.get('membership') and e['membership'] not in MEMBERSHIP: p.append('bad membership')
    d = e.get('dues')
    if d and not (d.get('amount') and d.get('frequency') and ISO.match(d.get('asOf', '')) and (d.get('source') or {}).get('url')): p.append('dues need amount, frequency, asOf date and a source link')
    for a in e.get('assessments') or []:
        if not (a.get('amount') and ISO.match(a.get('asOf', '')) and (a.get('source') or {}).get('url')): p.append('assessment needs amount, asOf date and a source link')
    return p

def load_registry(dirpath):
    entries, bad = [], []
    if not os.path.isdir(dirpath): return entries, bad
    for f in sorted(os.listdir(dirpath)):
        if not f.endswith('.json'): continue
        try: e = json.load(open(os.path.join(dirpath, f)))
        except Exception as ex: bad.append((f, ['unreadable: ' + str(ex)])); continue
        for x in (e if isinstance(e, list) else [e]):
            pr = validate_entry(x)
            if pr: bad.append((f + ':' + str(x.get('id')), pr))
            else: entries.append(x)
    return entries, bad

def _in(rule, val):
    s = expand_rule(rule)
    if s is None: return True
    if val is None: return None  # unknown value against a restricted rule
    return str(val).upper().lstrip('0') in s or str(val).upper() in s

def covers(entry, parcel):
    """Returns ('yes'|'no'|'maybe', note). parcel: {county, sub, phase, block, lot}."""
    if entry['county'].upper() != parcel['county'].upper(): return 'no', ''
    psub = norm_name(parcel.get('sub'))
    keys = [norm_name(s) for s in entry['subdivisions']]
    if not psub or not any(psub == k or psub.startswith(k + ' ') or k.startswith(psub + ' ') for k in keys): return 'no', ''
    cov = entry['coverage']; res = []
    for field, rule in (('phase', cov['phases']), ('block', cov['blocks']), ('lot', cov['lots'])):
        r = _in(rule, parcel.get(field))
        res.append(r)
    ex = entry.get('exclusions') or (cov.get('exclusions') or [])
    for x in ex:
        if all(_in(x.get(f + 's', 'all'), parcel.get(f)) is True for f in ('phase', 'block', 'lot')) and any(x.get(f + 's', 'all') != 'all' for f in ('phase', 'block', 'lot')):
            return 'no', 'Excluded by ' + (x.get('recording') or 'an exclusion in the declaration')
    # amendments that remove this parcel
    for d in entry['documents']:
        if d.get('type') == 'amendment' and d.get('effect') == 'removes':
            sc = d.get('scope') or {}
            if all(_in(sc.get(f + 's', 'all'), parcel.get(f)) is True for f in ('phase', 'block', 'lot')) and any(sc.get(f + 's', 'all') != 'all' for f in ('phase', 'block', 'lot')):
                return 'no', 'Removed by amendment ' + (d.get('recording') or '')
    def scope_hit(sc):
        return all(_in(sc.get(f + 's', 'all'), parcel.get(f)) is True for f in ('phase', 'block', 'lot')) and any(sc.get(f + 's', 'all') != 'all' for f in ('phase', 'block', 'lot'))
    # a recorded amendment that ADDS this phase, block or lot extends the declaration's coverage
    for d in entry['documents']:
        if d.get('type') == 'amendment' and d.get('effect') == 'adds' and scope_hit(d.get('scope') or {}): return 'yes', ''
    if any(r is False for r in res): return 'no', 'The subdivision has a reviewed declaration, but it does not list this phase, block or lot.'
    if any(r is None for r in res): return 'maybe', 'The declaration covers only certain phases, blocks or lots, and this listing’s legal description does not say which one it is in.'
    return 'yes', ''

def public_entry(e):
    keep = ['id', 'name', 'county', 'subdivisions', 'coverage', 'documents', 'membership', 'dues', 'assessments', 'restrictions', 'verified', 'notes', 'contact']
    return {k: e[k] for k in keep if k in e}

def decide(parcel, leads, registry):
    """Returns the HOA record for one parcel."""
    maybe_notes = []
    for e in registry:
        r, note = covers(e, parcel)
        if r == 'yes': return {'st': 'confirmed', 'decl': e['id'], 'assoc': e['name']}
        if r == 'maybe': return {'st': 'possible', 'decl': e['id'], 'assoc': e['name'], 'why': note}
        if note: maybe_notes.append(note)
    if maybe_notes: return {'st': 'unknown', 'note': maybe_notes[0]}
    if leads: return {'st': 'possible', 'assoc': leads[0].get('assoc', ''), 'ev': leads[:3], 'why': 'The official county roll links an association to this subdivision, but no recorded declaration has been reviewed for this lot or phase.'}
    return {'st': 'unknown'}
