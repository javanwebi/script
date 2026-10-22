from pathlib import Path
import os,sys,shutil
source=Path(sys.argv[1]).resolve()
target=Path(sys.argv[2]).resolve()
# Import the pinned source snapshot, never its Git history or customer databases.
shutil.copytree(source,target,dirs_exist_ok=True,ignore=shutil.ignore_patterns('.git','.github','node_modules','dist','usersDb.json','smsLogsDb.json'))
os.chdir(target)
import re,json
for file in ['src/data/mockData.ts','src/services/agencyService.ts','src/services/pricingCreditService.ts']:
 p=Path(file);s=p.read_text();edits=[]
 for m in re.finditer(r'(?:export )?const ((?:MOCK_|INITIAL_)\w+):[^=\n]+=\s*(\[)',s):
  start=m.start(2);depth=0;quote=None;comment=None;i=start
  while i<len(s):
   c=s[i];n=s[i:i+2]
   if comment=='line':
    if c=='\n':comment=None
   elif comment=='block':
    if n=='*/':comment=None;i+=1
   elif quote:
    if c=='\\':i+=1
    elif c==quote:quote=None
   elif n=='//':comment='line';i+=1
   elif n=='/*':comment='block';i+=1
   elif c in "'\"`":quote=c
   elif c=='[':depth+=1
   elif c==']':
    depth-=1
    if depth==0:break
   i+=1
  text='[]'
  if m.group(1)=='INITIAL_PRICE_LISTS':
   text=s[start:i+1];text=re.sub(r'customProductPrices:\s*\{[^}]*\}','customProductPrices: {}',text);text=re.sub(r'(minPurchaseVolume|discountPercent):\s*[0-9_.]+',r'\1: 0',text);text=re.sub(r'//[^\n]*','',text)
  edits.append((start,i+1,text))
 for a,b,text in reversed(edits):s=s[:a]+text+s[b:]
 p.write_text(s)
p=Path('src/data/catalogOverridesDb.json');db=json.loads(p.read_text());amounts={'price','retail','wholesale','dealer','base','stock','unitPrice','calculatedPrice','discountPercent','creditLimit'}
def clean(v):
 if isinstance(v,list):return [clean(x) for x in v]
 if isinstance(v,dict):return {k:0 if k in amounts else False if k=='stockKnown' else True if k=='inquiryOnly' else clean(x) for k,x in v.items()}
 return v
p.write_text(json.dumps(clean(db),ensure_ascii=False,indent=2)+'\n')
for file in ['src/data/usersDb.json','src/data/smsLogsDb.json']:Path(file).unlink(missing_ok=True)
p=Path('.gitignore');p.write_text(p.read_text()+'\n# Customer data belongs in the runtime database, never in source control.\nsrc/data/usersDb.json\nsrc/data/smsLogsDb.json\n')
p=Path('src/admin/modules/SettingsSystemModule.tsx');s=p.read_text();s=re.sub(r"(\[testPhone, setTestPhone\] = useState\()'[^']*'(\))",r"\1''\2",s);p.write_text(s)

# Summary prices are runtime data too; ship a catalog with no seeded commerce amounts.
p=Path('src/data/catalogSummary.json');p.write_text(json.dumps(clean(json.loads(p.read_text())),ensure_ascii=False,indent=2)+'\n')
p=Path('src/services/agencyService.ts');p.write_text(re.sub(r"recipientPhone: '09\d{9}'", "recipientPhone: ''",p.read_text()))
p=Path('src/services/pricingCreditService.ts');p.write_text('\n'.join(line.rstrip() for line in p.read_text().splitlines())+'\n')
# Do not continue if a private legacy file accidentally survived the copy.
assert not Path('src/data/usersDb.json').exists()
assert not Path('src/data/smsLogsDb.json').exists()
for file in ['src/data/catalogOverridesDb.json','src/data/catalogSummary.json']:
 def check(v):
  if isinstance(v,list):
   for x in v:check(x)
  elif isinstance(v,dict):
   for k,x in v.items():
    if k in amounts:assert x==0, 'Unexpected commerce seed in '+file
    check(x)
 check(json.loads(Path(file).read_text()))
print('Pinned source imported; legacy records omitted; commercial seeds cleared.')

