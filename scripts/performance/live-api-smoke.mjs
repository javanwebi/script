const base = process.env.PUBLIC_APP_URL || 'https://sanatpish-production.up.railway.app';
const limitMs = Number(process.env.API_LATENCY_TARGET_MS || 2000);
const paths = ['/api/health', '/api/portal', '/api/runtime'];
const samples = [];
for (const path of paths) {
  for (const round of [1, 2]) {
    const started = performance.now();
    let status = 0, error = '';
    try {
      const response = await fetch(new URL(path, base), {
        redirect: 'error',
        signal: AbortSignal.timeout(35000),
        headers: { Accept: 'application/json', 'User-Agent': 'SanatPish-Latency-Smoke/1.0' },
      });
      status = response.status;
      await response.arrayBuffer();
      if (!response.ok) error = 'HTTP ' + status;
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    }
    const ms = Math.round(performance.now() - started);
    samples.push({ path, round, status, ms, error });
    console.log(path + ' #' + round + ': ' + ms + 'ms, status=' + status + (error ? ', error=' + error : ''));
  }
}
const markdown = [
  '# Sanat Pish live API smoke',
  '',
  'Measured from a GitHub-hosted runner, including network and response download time. Results are not browser RUM or authenticated-user latency.',
  '',
  '| Endpoint | Round | HTTP | Total (ms) | Result |',
  '| --- | ---: | ---: | ---: | --- |',
  ...samples.map(x => '| ' + x.path + ' | ' + x.round + ' | ' + x.status + ' | ' + x.ms + ' | ' + (x.error || (x.ms > limitMs ? 'SLOW' : 'OK')) + ' |'),
  '',
  'Target: ' + limitMs + 'ms per request. Sample size: two requests per endpoint.',
  '',
].join('\n');
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import('node:fs');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
}
if (samples.some(x => x.error || x.ms > limitMs)) {
  console.error('API smoke failed: HTTP error or response exceeded ' + limitMs + 'ms');
  process.exitCode = 1;
}
