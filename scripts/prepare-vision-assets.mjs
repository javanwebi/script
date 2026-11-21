import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const MODEL_URL = 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx';
const MODEL_PATH = resolve('public/models/u2netp.onnx');
const TEMP_PATH = MODEL_PATH + '.download';
const EXPECTED_SHA256 = '309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8';
const EXPECTED_BYTES = 4574861;

async function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function verifyExisting() {
  try {
    const bytes = await readFile(MODEL_PATH);
    if (bytes.length === EXPECTED_BYTES && await sha256(bytes) === EXPECTED_SHA256) {
      process.stdout.write('[vision-assets] verified cached U2NETP model\n');
      return true;
    }
    await rm(MODEL_PATH, { force: true });
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  return false;
}

if (!(await verifyExisting())) {
  await mkdir(dirname(MODEL_PATH), { recursive: true });
  process.stdout.write('[vision-assets] downloading pinned U2NETP model\n');
  const response = await fetch(MODEL_URL, {
    redirect: 'follow',
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) throw new Error(`U2NETP download failed: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const digest = await sha256(bytes);
  if (bytes.length !== EXPECTED_BYTES || digest !== EXPECTED_SHA256) {
    throw new Error(`U2NETP integrity check failed: bytes=${bytes.length} sha256=${digest}`);
  }
  await writeFile(TEMP_PATH, bytes, { flag: 'w' });
  await rename(TEMP_PATH, MODEL_PATH);
  process.stdout.write(`[vision-assets] verified U2NETP model (${bytes.length} bytes)\n`);
}
