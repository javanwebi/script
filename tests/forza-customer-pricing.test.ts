import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

test('FORZA customer price lookup is tied to the authenticated customer identity', () => {
  assert.match(server, /set_config\('request\.jwt\.claim\.sub'/);
  assert.match(server, /identity\.user\.canViewPrices\s*!==\s*true/);
  assert.match(server, /app_private\.current_variant_price\(v\.code\)/);
  assert.match(server, /variant_commercial_specs/);
});

test('only price-related turns load private prices and the model is told not to guess', () => {
  assert.match(server, /قیمت\|نرخ\|هزینه\|مبلغ\|تخفیف/);
  assert.match(server, /قیمت‌های واقعی و مجاز قیمت‌نامه حساب فعلی مشتری/);
  assert.match(server, /هیچ قیمت، تخفیف یا موجودی دیگری را حدس نزن/);
});
