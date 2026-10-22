"""Extract factual length tables from an independently downloaded Optibelt manual.

Usage: python scripts/extract-imperial-reference.py /path/to/optibelt.pdf [/path/to/mitsuboshi.pdf]
Requires pdftotext. Does not create inventory codes or infer stocked manufacturers.
"""
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

pdf = Path(sys.argv[1])
pages = subprocess.check_output(['pdftotext', '-layout', str(pdf), '-']).decode().split('\f')
pitches = {'MXL': 2.032, 'XL': 5.08, 'L': 9.525, 'H': 12.7, 'XH': 22.225, 'XXH': 31.75, 'DXL': 5.08, 'DL': 9.525, 'DH': 12.7}
records = {}
conflicts = {}
for page in range(43, 49):
    text = pages[page]
    assert '1.10 TIMING BELT STANDARD RANGE' in text
    if page < 48:
        matches = re.findall(r'\b(\d+)\s+(MXL|XXH|XL|XH|H|L)\s*[•]?\s+(\d+\.\d+)\s+(\d+)\b', text)
        for code, profile, length, teeth in matches:
            length, teeth = float(length), int(teeth)
            if abs(length - teeth * pitches[profile]) >= .011:
                conflicts[f'{code}{profile}'] = {'reportedLengthMm': length, 'reportedTeeth': teeth, 'pdfPage': page + 1, 'reason': 'Printed length and tooth count do not agree with profile pitch; do not publish a resolved length.'}
                continue
            records[f'{code}{profile}'] = {'lengthMm': length, 'teeth': teeth, 'pdfPage': page + 1}
    else:
        # This edition's double-sided table has misleading column headings:
        # numeric columns are inches and millimetres, NOT a tooth count.
        # Use the mm value only and independently validate it against the pitch.
        for profile, code, inches, mm in re.findall(r'\b(DXL|DL|DH)\s+(\d+)\s+(\d+\.\d+)\s+(\d+\.\d+)\b', text):
            mm = float(mm)
            teeth = round(mm / pitches[profile])
            assert abs(mm - float(inches) * 25.4) < .011
            assert abs(mm - teeth * pitches[profile]) < .011
            records[f'{code}{profile}'] = {'lengthMm': mm, 'teeth': teeth, 'pdfPage': page + 1}
assert len(records) == 355, f'Unexpected table layout: {len(records)} entries'
assert records['187L']['lengthMm'] == records['187DL']['lengthMm'] == 476.25
assert records['1000H']['teeth'] == 200
supplement = None
if len(sys.argv) > 2:
    other = Path(sys.argv[2])
    url = 'https://global.mitsuboshi.com/assetFiles/timing_belt_design_manual_en.pdf'
    other_pages = subprocess.check_output(['pdftotext', '-layout', str(other), '-']).decode().split('\f')
    added = 0
    for index in range(17, 22):
        text = other_pages[index]
        assert 'Standard Belt Sizes' in text
        # MXL is deliberately excluded: the two makers use different nominal
        # number conventions for MXL. Never cross-apply those numbers.
        for code, profile, teeth, mm, construction in re.findall(r'\b(\d+)\s+(XXH|XH|XL|H|L)\s+(\d+)\s+(\d+\.\d+)\s+(S(?:·D)?)\b', text):
            mm, teeth = float(mm), int(teeth)
            assert abs(mm - teeth * pitches[profile]) < .011
            for variant_profile in ([profile, 'D' + profile] if construction == 'S·D' and profile in ('XL', 'L', 'H') else [profile]):
                key = f'{code}{variant_profile}'
                if key in records:
                    assert abs(records[key]['lengthMm'] - mm) < .011, f'Conflicting manufacturers: {key}'
                elif key not in conflicts:
                    records[key] = {'lengthMm': mm, 'teeth': teeth, 'pdfPage': index + 1, 'sourceUrl': url}
                    added += 1
    assert added > 0
    supplement = {'url': url, 'sha256': hashlib.sha256(other.read_bytes()).hexdigest(), 'addedLengths': added, 'pdfPages': [18, 19, 20, 21, 22]}
data = {
    'sourceUrl': 'https://www.optibelt.com/fileadmin/pdf/produkte/zahnriemen-gummi/Optibelt-TM-Rubber-Timing-Belt-Drives.pdf',
    'sha256': hashlib.sha256(pdf.read_bytes()).hexdigest(),
    'checkedOn': '2026-10-19',
    'scope': 'Nominal reference lengths only; not manufacturer, availability or exact stocked-item verification.',
    'lengths': records,
    'conflicts': conflicts,
    'supplement': supplement,
}
out = Path(__file__).resolve().parents[1] / 'src/data/imperialTimingReference.json'
out.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
print({'referenceLengths': len(records), 'sourceSha256': data['sha256']})
