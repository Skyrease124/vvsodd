"""Florida adapter: parse legal descriptions and find official-roll leads (Florida statewide parcels).
To add another state, write an adapter with the same two functions (parse_legal, find_leads) and register it in hoa_backfill.ADAPTERS."""
import re
from core import norm_name, tokens

ASSOC = re.compile(r'\b(ASSOCIATION|ASSOC|ASSN|HOMEOWNERS?|HOME OWNERS?|HOA|POA|PROPERTY OWNERS?|MAINTENANCE|MASTER|COMMUNITY|RESIDENTS)\b')
STOP = re.compile(r'\s+(LOTS?|LTS?|LT|BLK|BLOCK|BK|PB|PLAT|UNIT|PHASE|PH|SEC|SECTION|TRACT|TR|PARCEL|PCL|OR|ORB|O/R|MB|DB|DEED|REPL|REPLAT|UNREC|UNRECORDED|CONDO.*|ADD|ADDN|ADDITION|PT|PART|NO|#)\b.*$|\s+\d.*$')

def parse_legal(desc, roll_legal):
    d = re.sub(r'\s+', ' ', (desc or '').upper()); rl = re.sub(r'\s+', ' ', (roll_legal or '').upper()).strip()
    out = {'sub': None, 'phase': None, 'block': None, 'lot': None, 'kind': 'plat', 'conf': 'low'}
    if re.search(r'MINERAL|SUBSURF|SUB SRFC|S/S RTS', d): out['kind'] = 'mineral'; return out
    if re.search(r'\bCONDO', d + ' ' + rl): out['kind'] = 'condo'
    m = re.search(r'\b(?:PHASE|PH)\s*([0-9]+[A-Z]?|[IVX]+)\b', d); out['phase'] = m.group(1) if m else None
    m = re.search(r'\b(?:BLK|BLOCK|BK)\s*([A-Z]|[0-9]+[A-Z]?)\b', d); out['block'] = m.group(1) if m else None
    m = re.search(r'\b(?:LOTS?|LTS?|LT)\s*([0-9]+[A-Z]?|[A-Z])\b', d); out['lot'] = m.group(1) if m else None
    # subdivision name: the roll's short legal usually starts with it; fall back to text before LOT/BLK in the listing description
    cand = None
    if rl and not re.match(r'^[\d\- ]+[A-Z]?\b.*(\d+[NSEW]|TWP|SEC)\b', rl) and not re.match(r'^\d', rl):
        cand = STOP.sub('', rl).strip()
    if (not cand or len(cand) < 4) and not re.match(r'^[\d.\- ]', d):
        m = re.match(r'^([A-Z][A-Z &\'.\-]{3,40}?)\s+(?:LOTS?|LTS?|LT|BLK|BLOCK|PB|PLAT|UNIT|PHASE|PH|REPL|SUB|S/D)\b', d)
        if m: cand = m.group(1).strip()
    if cand and re.match(r'^(THE\s+)?[NSEW]\b', cand): cand = None
    if cand and len(cand) >= 4 and not re.search(r'\b(TH|THENCE|BEG|BEGINNING|COM|COMMENCE|FROM|THAT PART|THE EAST|THE WEST|THE NORTH|THE SOUTH|N \d|S \d|E \d|W \d|POB)\b', cand):
        out['sub'] = cand; out['conf'] = 'medium' if (out['lot'] or out['block']) else 'low'
    return out

def find_leads(fetch, co_no, sub, wait=None):
    """Official-roll leads: parcels in the same county whose short legal starts with this subdivision and whose owner of record looks like an association,
    or that carry the DOR common-area code (09). Returned as evidence records. Weak name matches are dropped."""
    key = norm_name(sub)
    if len(key) < 4: return []
    like = key.replace("'", "''")
    where = "CO_NO=%d AND S_LEGAL LIKE '%s%%' AND (DOR_UC=9 OR OWN_NAME LIKE '%%ASSOC%%' OR OWN_NAME LIKE '%%ASSN%%' OR OWN_NAME LIKE '%%HOMEOWNER%%' OR OWN_NAME LIKE '%%HOA%%' OR OWN_NAME LIKE '%%PROPERTY OWNERS%%' OR OWN_NAME LIKE '%%MAINTENANCE%%')" % (co_no, like)
    d = fetch('https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query',
              {'where': where, 'outFields': 'PARCEL_ID,OWN_NAME,DOR_UC,S_LEGAL,ASMNT_YR', 'returnGeometry': 'false', 'resultRecordCount': 50, 'f': 'json'}, timeout=90)
    st = tokens(sub); leads = []
    for f in d.get('features', []):
        a = f['attributes']; own = (a.get('OWN_NAME') or '').upper()
        if not ASSOC.search(own): continue
        if st and not (st & tokens(own)): continue  # the association name must share a distinctive word with the subdivision
        leads.append({'type': 'roll-owner', 'assoc': (a.get('OWN_NAME') or '').strip(), 'parcel': a.get('PARCEL_ID'), 'roll': a.get('ASMNT_YR'), 'common': a.get('DOR_UC') == 9})
    return leads
