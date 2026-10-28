import { spawnSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const output = resolve('public/forza-greeting-bootstrap.wav');
const phrase = 'سَلام، بِه صَنعَتِ پیش خوش آمَدید. مَن فُورزا هَستَم وَ بَرایِ رَهنَماییِ شُما آمادِه‌اَم.';
const candidates = ['espeak-ng', 'espeak'];
let binary = '';
for (const candidate of candidates) {
  const probe = spawnSync(candidate, ['--version'], { encoding: 'utf8', stdio: 'ignore' });
  if (!probe.error && probe.status === 0) { binary = candidate; break; }
}
if (!binary) {
  console.warn('[FORZA greeting] espeak-ng/espeak is unavailable; Docker installs espeak-ng before build.');
  process.exit(0);
}
mkdirSync(resolve('public'), { recursive: true });
const result = spawnSync(binary, [
  '-v', 'fa', '-s', '195', '-p', '40', '-a', '190', '-w', output, phrase,
], { encoding: 'utf8', stdio: 'inherit', timeout: 12000 });
if (result.error || result.status !== 0) {
  throw result.error || new Error('Persian bootstrap greeting generation failed');
}
const size = statSync(output).size;
if (size < 44) throw new Error('Persian bootstrap greeting WAV is empty');
console.info('[FORZA greeting] Offline Persian bootstrap audio ready:', size, 'bytes');
