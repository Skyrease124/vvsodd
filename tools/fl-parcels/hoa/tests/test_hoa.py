import json, os, subprocess, sys, tempfile, shutil
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, '..'))
import core, fl
reg, bad = core.load_registry(HERE)
ids = [e['id'] for e in reg]
assert ids == ['test-sample-park'], ids                      # valid entry loaded
assert any('test-bad' in n for n, _ in bad), bad               # invalid entry rejected (no recording or link)
E = reg[0]
def P(**k): d = {'county': 'Leon', 'sub': 'SAMPLE PARK', 'phase': None, 'block': None, 'lot': None}; d.update(k); return d
# different phases of the same subdivision
assert core.decide(P(phase='1', block='A', lot='12'), [], reg)['st'] == 'confirmed'
assert core.decide(P(phase='2', block='A', lot='5'), [], reg)['st'] == 'confirmed'
assert core.decide(P(phase='3', lot='9'), [], reg)['st'] == 'confirmed'   # phase 3 is added by a recorded amendment
r4 = core.decide(P(phase='4', lot='9'), [], reg)
assert r4['st'] == 'unknown' and 'does not list' in r4['note'], r4       # phase 4 is in neither the declaration nor an amendment
assert core.decide(P(phase='2', block='Z', lot='1'), [], reg)['st'] == 'unknown'   # removed by amendment
rp = core.decide(P(phase=None, lot='7'), [], reg)
assert rp['st'] == 'possible' and 'does not say' in rp['why'], rp       # phase unparsed: coverage unverified
# no declaration reviewed, but an official-roll lead
lead = [{'type': 'roll-owner', 'assoc': 'OTHER OAKS HOA INC', 'parcel': '1', 'roll': 2026}]
assert core.decide(P(sub='OTHER OAKS'), lead, reg)['st'] == 'possible'
assert core.decide(P(sub='OTHER OAKS'), [], reg)['st'] == 'unknown'
assert core.decide(P(county='Duval'), [], reg)['st'] == 'unknown'       # different county never matches
# legal description parsing
assert fl.parse_legal('IDLEWILD LOT 15 BLOCK G OR 830/135', 'IDLEWILD')['lot'] == '15'
p = fl.parse_legal('SAMPLE PARK PHASE 2 LOT 9 BLK C', 'SAMPLE PARK'); assert (p['sub'], p['phase'], p['lot'], p['block']) == ('SAMPLE PARK', '2', '9', 'C'), p
assert fl.parse_legal('1/2 INTEREST IN MINERAL RIGHTS ON SE1/4', '')['kind'] == 'mineral'
assert fl.parse_legal('11 4S 14W-38-118C1 BEG 655 S', '11 4S 14W')['sub'] is None
# backfill: idempotent rerun, no duplicates, resumable
tmp = tempfile.mkdtemp(); lst = os.path.join(tmp, 'l.json'); out = os.path.join(tmp, 'out'); par = os.path.join(tmp, 'parcels'); os.makedirs(par)
L = [{'county': 'Leon', 'parcel': 'A1', 'desc': 'SAMPLE PARK PHASE 1 LOT 4 BLK A', 'use': ''}, {'county': 'Leon', 'parcel': 'A2', 'desc': 'SAMPLE PARK PHASE 3 LOT 9', 'use': ''}, {'county': 'Leon', 'parcel': 'A3', 'desc': '8 1N 3E IN W 1/2', 'use': ''}, {'county': 'Leon', 'parcel': 'A4', 'desc': 'SAMPLE PARK LOT 7', 'use': ''}]
json.dump(L, open(lst, 'w')); json.dump({'p': {'A1': {'legal': 'SAMPLE PARK'}, 'A2': {'legal': 'SAMPLE PARK'}, 'A3': {'legal': '8 1N 3E'}, 'A4': {'legal': 'SAMPLE PARK'}}}, open(os.path.join(par, 'leon.json'), 'w'))
def run(): return subprocess.run([sys.executable, os.path.join(HERE, '..', '..', 'hoa_backfill.py'), '--listings', lst, '--out', out, '--parcels', par, '--registry', HERE, '--no-leads', '--report-dir', tmp], capture_output=True, text=True)
r1 = run(); assert r1.returncode == 0, r1.stderr
a = open(os.path.join(out, 'leon.json')).read(); r2 = run(); b = open(os.path.join(out, 'leon.json')).read()
assert a == b, 'rerun changed the output'
D = json.loads(a)['p']; assert len(D) == 4
assert D['A1']['st'] == 'confirmed' and D['A2']['st'] == 'confirmed' and D['A3']['st'] == 'unknown' and D['A4']['st'] == 'possible', {k: v['st'] for k, v in D.items()}
assert json.load(open(os.path.join(out, 'declarations.json')))['decls']['test-sample-park']['dues']['amount'] == 350
shutil.rmtree(tmp); print('all HOA tests passed')
