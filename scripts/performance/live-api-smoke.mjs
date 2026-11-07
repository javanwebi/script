const base = process.env.PUBLIC_APP_URL || 'https://sanatpish.com';
const limitMs = Number(process.env.API_LATENCY_TARGET_MS || 2000);
const catalogLimitMs = Number(process.env.CATALOG_LATENCY_TARGET_MS || 6000);
const paths = ['/api/health', '/api/portal', '/api/runtime?includeProducts=0', '/api/runtime'];
const samples = [];
for (const path of paths) {
  for (const round of [1, 2]) {
    const started = performance.now();
    let status = 0, error = '';
    let audit = '';
    try {
      const response = await fetch(new URL(path, base), {
        redirect: 'error',
        signal: AbortSignal.timeout(35000),
        headers: { Accept: 'application/json', 'User-Agent': 'SanatPish-Latency-Smoke/1.0' },
      });
      status = response.status;
      if (path.startsWith('/api/runtime') && response.ok) {
        const payload = await response.json();
        const categories = payload?.values?.atlas_admin_categories_v1;
        if (path.includes('includeProducts=0')) {
          if (payload.success !== true || payload.database !== true || payload.productsIncluded !== false
            || !Array.isArray(payload.products) || payload.products.length !== 0) {
            error = 'lean runtime bootstrap unexpectedly included catalogue products';
          }
          audit = 'lean runtime: no product payload';
        } else {
          const products = payload?.products;
          const familyCount = Array.isArray(products) ? products.length : 0;
          const skuCount = Array.isArray(products)
            ? products.reduce((sum, product) => sum + (Array.isArray(product.variants) ? product.variants.length : 0), 0)
            : 0;
          audit = 'catalog=' + familyCount + ' families/' + skuCount + ' SKUs/' + (Array.isArray(categories) ? categories.length : 0) + ' categories';
          if (payload.success !== true || payload.database !== true) error = 'runtime is not database-backed';
          else if (familyCount !== 1383 || skuCount !== 10435 || !Array.isArray(categories) || categories.length === 0) {
            error = 'catalog payload mismatch: ' + audit;
          }
        }
      } else {
        await response.arrayBuffer();
      }
      if (!response.ok) error = 'HTTP ' + status;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
    const ms = Math.round(performance.now() - started);
    const requestLimitMs = path === '/api/runtime' ? catalogLimitMs : limitMs;
    samples.push({ path, round, status, ms, limitMs:requestLimitMs, error, audit });
    console.log(path + ' #' + round + ': ' + ms + 'ms, status=' + status + ', target=' + requestLimitMs + 'ms' + (audit ? ', ' + audit : '') + (error ? ', error=' + error : ''));
  }
}
const markdown = [
  '# Sanat Pish live API smoke',
  '',
  'Measured from a GitHub-hosted runner, including network and response download time. Results are not browser RUM or authenticated-user latency.',
  '',
  '| Endpoint | Round | HTTP | Total (ms) | Target (ms) | Result |',
  '| --- | ---: | ---: | ---: | ---: | --- |',
  ...samples.map(x => '| ' + x.path + ' | ' + x.round + ' | ' + x.status + ' | ' + x.ms + ' | ' + x.limitMs + ' | ' + (x.error || (x.ms > x.limitMs ? 'SLOW' : 'OK')) + ' |'),
  '',
  'Targets: ' + limitMs + 'ms for lean/auth endpoints and ' + catalogLimitMs + 'ms for the full catalogue response. Sample size: two requests per endpoint.',
  '',
].join('\n');
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import('node:fs');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
}
if (samples.some(x => x.error || x.ms > x.limitMs)) {
  console.error('API smoke failed: HTTP error, catalogue mismatch, or endpoint exceeded its latency target');
  process.exitCode = 1;
}
