import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../src/pages/DiscoveryPages.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/storefront.css', import.meta.url), 'utf8');

test('non-ceramic industries have distinct editorial compositions', () => {
  for (const slug of ['textile', 'packaging', 'food', 'machinery', 'rubber']) {
    assert.ok(page.includes(`industry.slug === '${slug}'`), `missing ${slug} layout component`);
    assert.ok(css.includes(`.industry-visual-module--${slug}`), `missing ${slug} visual system`);
    assert.ok(css.includes(`.industry-${slug} .industry-hero`), `missing ${slug} hero treatment`);
  }
  assert.match(page, /industry-hero--\$\{industry\.slug\}/);
  assert.match(css, /@media \(max-width: 767px\)/);
});

test('ceramic retains its dedicated page instead of falling back to the generic industry template', () => {
  assert.match(page, /TileCeramicIndustryPage/);
  assert.match(page, /slug === "ceramic"/);
});
