"""Read the supplied workbook without modifying it; preserve every family and SKU.
Usage: python scripts/import-product-workbook.py /path/to/catalogue.xlsx
Requires openpyxl for read-only extraction. No network access or inferred specifications.
"""
import hashlib
import json
import re
import sys
from pathlib import Path
import openpyxl

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1])
sheet = openpyxl.load_workbook(source, read_only=True, data_only=True).active
rows = list(sheet.values)
assert rows[0][:4] == ('دسته اصلی', 'زیرمنو', 'نوع فنی', 'نام خانواده (یک‌بار)')
families = []
codes = set()
for number, row in enumerate(rows[1:], 2):
    if not any(row):
        continue
    variants = []
    for line in (row[7] or '').splitlines():
        match = re.fullmatch(r'سایز (.*?) ← کد (\S+) \((.*)\)', line)
        assert match, (number, line)
        size, code, name = match.groups()
        assert code not in codes, (number, code)
        codes.add(code)
        variants.append({'code': code, 'size': size, 'name': name})
    assert len(variants) == row[9], number
    families.append(dict(zip(
        ['sourceRow', 'code', 'categoryName', 'submenu', 'technicalType', 'name', 'brand', 'profiles', 'sizes', 'variants', 'unit', 'itemCount', 'materials', 'filters', 'sourceStatus'],
        [number, 'FAM-' + variants[0]['code'], *row[:7], variants, *row[8:13]]
    )))
output = root / 'src/data/catalogueSource.json'
output.write_text(json.dumps(families, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
manifest = {'sourceFile': source.name, 'sourceSHA256': hashlib.sha256(source.read_bytes()).hexdigest(), 'sheet': sheet.title, 'families': len(families), 'skus': len(codes), 'categories': len({f['categoryName'] for f in families}), 'submenus': len({(f['categoryName'], f['submenu']) for f in families}), 'technicalTypes': len({(f['categoryName'], f['submenu'], f['technicalType']) for f in families})}
(root / 'src/data/catalogueImport.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(manifest, ensure_ascii=False))
