// Read-only HTTP comparison, intended for a staging host only.
const base = process.argv[2];
if (!base || !/^https:\/\//.test(base)) {
  console.error('Usage: node scripts/tests/catalog-runtime-benchmark.mjs https://STAGING-HOST');
  process.exit(2);
}
const routes = [
  '/api/runtime',
  '/api/runtime?catalog=omit',
  '/api/catalog/summary',
  '/api/catalog/products?page=1&limit=24',
  '/api/catalog/search?q=تسمه&page=1&limit=24',
];
for (const route of routes) {
  const samples = [];
  for (let i = 0; i < 3; i++) {
    const t0 = performance.now();
    const response = await fetch(new URL(route, base), { headers: { Accept: 'application/json' }, redirect: 'error' });
    const body = await response.arrayBuffer(); // Node auto-decompresses.
    const elapsedMs = Math.round((performance.now() - t0) * 10) / 10;
    const responseBytes = body.byteLength;
    const transmittedLength = response.headers.get('content-length');
    const parsed = JSON.parse(Buffer.from(body).toString());
    samples.push({
      status: response.status, elapsedMs, responseBytes,
      contentLength: transmittedLength ? Number(transmittedLength) : null,
      encoding: response.headers.get('content-encoding') || 'identity',
      productCount: Array.isArray(parsed.products) ? parsed.products.length : null,
      familyCount: parsed.familyCount ?? null, skuCount: parsed.skuCount ?? null,
    });
    if (!response.ok || !parsed.success) process.exitCode = 1;
  }
  console.log(JSON.stringify({ route, samples }, null, 2));
}
