"""Extract published H-profile facts from locally downloaded MISUMI e-catalog HTML.
Usage: python scripts/extract-misumi-reference.py /path/to/html-directory
No stock identifiers are generated. Reference sizes do not certify stocked brands.
"""
import json,re,hashlib,sys
from pathlib import Path
from html.parser import HTMLParser
class Text(HTMLParser):
 def __init__(self):super().__init__();self.parts=[]
 def handle_data(self,data):self.parts.append(data)
rows={};sources=[]
for page in [604,605]:
 f=Path(sys.argv[1])/f'page{page}.html';p=Text();p.feed(f.read_text());text='\n'.join(p.parts)
 url=f'https://th.c.misumi-ec.com/book/THA_EconomySeries_e-catalog2023_2nd/files/basic-html/page{page}.html'
 sources.append({'url':url,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})
 for line in text.splitlines():
  entries=list(re.finditer(r'\b(\d+)H\b',line))
  for i,m in enumerate(entries):
   tail=line[m.end():entries[i+1].start() if i+1<len(entries) else len(line)]
   numbers=[float(n) for n in re.findall(r'\d+(?:\.\d+)?',tail)]
   for teeth,mm in zip(numbers,numbers[1:]):
    if teeth.is_integer() and teeth>0 and abs(mm-teeth*12.7)<.011 and abs(mm-int(m[1])*2.54)<.011:
     rows[f'{m[1]}H']={'lengthMm':mm,'teeth':int(teeth),'sourceUrl':url,'sourcePage':page-5};break
assert rows['1200H']['lengthMm']==3048
assert rows['1550H']['lengthMm']==3937
assert len(rows)>=140,len(rows)
out={'checkedOn':'2026-10-19','scope':'Nominal H-profile length references, not stocked-item identity or availability.','sources':sources,'lengths':rows}
(Path(__file__).resolve().parents[1]/'src/data/misumiTimingReference.json').write_text(json.dumps(out,indent=2)+'\n')
print({'lengths':len(rows)})
