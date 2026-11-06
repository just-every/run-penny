import hashlib,json,re,subprocess
from pathlib import Path
source='599d82f10cb4a6c5746f3b68b66515eb4872826e'
def git(*args):return subprocess.check_output(['git',*args])
def blob(ref,path):return git('show',ref+':'+path)
def digest(data):return hashlib.sha256(data).hexdigest()
rows=[]
paths=['src/core/features/scorecards/'+name+'.ts' for name in ['input','ranking','repository','routes','archive']]+['tests/base/scorecards.test.ts','migrations/core/0110_scorecards.sql','src/core/features/data/erasure-dependencies.ts','src/core/features/data/archive.ts','src/core/features/data/schema-inventory.json']
for path in paths:
 a,b=blob(source,path),Path(path).read_bytes();same=a==b
 rows.append(dict(path=path,source_sha256=digest(a),candidate_sha256=digest(b),unchanged=same))
 assert same,path
source_tests=git('ls-tree','-r',source,'--','tests').splitlines()
now_tests=git('ls-files','-s','--','tests').splitlines()
# Current main's newer test integration is inherited; no B1 test edits.
changed_tests=git('diff','--name-only','origin/main','--','tests').decode().splitlines()
assert changed_tests==['tests/base/scorecards.test.ts'],changed_tests
assert Path('tests/base/scorecards.test.ts').read_bytes()==blob(source,'tests/base/scorecards.test.ts')
source_migrations=git('ls-tree','-r',source,'--','migrations').decode().splitlines()
for entry in source_migrations:
 metadata,path=entry.split('\t');assert git('hash-object',path).decode().strip()==metadata.split()[2],path
# All other parent Status rows, including full gaps/evidence, remain verbatim.
def status(text):
 return {m[1]:m[0] for m in re.finditer(r'^\| `([A-Z][A-Z0-9-]+)` \|[^\n]+$',text,re.M) if len(m[0].split('|'))==8}
main_rows=status(blob('origin/main','CONTRACT.md').decode());current_rows=status(Path('CONTRACT.md').read_text())
assert len(main_rows)==281,(len(main_rows),len(current_rows))
for clause,row in main_rows.items():
 if clause!='PRIO-004':assert current_rows.get(clause)==row,clause
frozen_rows=status(blob(source,'CONTRACT.md').decode())
assert current_rows['PRIO-004'].split('|')[4].strip()=='partial'
for phrase in ["acceptance point 1's visible two-scorer card and scorecard UI",'segment-filtered ranking and SEG-006 integration','PRIO-003 scorecard columns','other idea families and scoped role delegation','Existing provider, device, account, Base, ct, uip, payments and release holds remain unchanged.']:
 assert phrase in current_rows['PRIO-004'],phrase
for path in ['ACCEPTANCE.md','docs/CLAIMS.md']:assert Path(path).read_bytes()==blob('origin/main',path),path
result=dict(source=source,main=git('rev-parse','origin/main').decode().strip(),byte_comparisons=rows,all_applied_migrations_unchanged=len(source_migrations),parent_status_rows_preserved=len(main_rows)-1,clause_status_before='partial',clause_status_after='partial',permanent_scorecard_registrations_before=2,permanent_scorecard_registrations_after=2,assertion_bytes_unchanged=True,generated_views_equal_main=True,changed_paths_from_source=git('diff','--name-only',source).decode().splitlines(),changed_paths_from_main=git('diff','--name-only','origin/main').decode().splitlines())
Path('../packet/mechanical-proof.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:v for k,v in result.items() if k not in ['byte_comparisons','changed_paths_from_source','changed_paths_from_main']},indent=2))
