# Run: python3 tools/probate/tests/test_validate.py   (TEST FIXTURE records)
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import validate as V
ok = 0
def check(c, m):
    global ok; assert c, m; ok += 1; print('ok -', m)
good = {'kind': 'probate case', 'number': '2024-CP-0001', 'date': '2024-03-02', 'decedent': 'JOHN A SMITH', 'tie': 'parcel-id', 'confirmsDeath': True, 'sameDecedent': True, 'personId': 'p1', 'deathState': 'FL', 'source': 'Clerk (TEST FIXTURE)', 'url': 'https://example.gov/case', 'verifiedAt': '2026-11-17'}
check(V.check_record(good) == [], 'a complete, official, parcel-tied record is accepted')
for bad, why in (({'ssn': '000-00-0000'}, 'Social Security number'), ({'causeOfDeath': 'x'}, 'cause of death'), ({'applicantId': 'x'}, 'applicant identification'), ({'dob': '1950-01-01'}, 'date of birth')):
    check(any('not allowed' in e for e in V.check_record(dict(good, **bad))), 'a record carrying a %s is refused' % why)
check(V.check_record({k: v for k, v in good.items() if k != 'tie'}) != [], 'a record that does not tie to the parcel is refused')
check(V.check_record(dict(good, url='http://insecure.example')) != [], 'a non-https link is refused')
check(V.check_record(dict(good, personId='')) != [], 'a death-confirming record needs a person id')
check(V.check({'records': {'bad key': [good]}}, {'counties': {}}) != [], 'a record key must be STATE|County|PARCELID')
print('\n%d checks passed' % ok)
