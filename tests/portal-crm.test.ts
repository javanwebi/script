import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCrmPhone } from '../server/db/adminCustomersApi';

test('CRM accepts authentic Iranian mobile numbers and normalizes Persian/Arabic digits', () => {
  assert.equal(normalizeCrmPhone('۰۹۱۲۳۴۵۶۷۸۹'), '09123456789');
  assert.equal(normalizeCrmPhone('٠٩١٢٣٤٥٦٧٨٩'), '09123456789');
  assert.equal(normalizeCrmPhone('+98 912 345 6789'), '09123456789');
});

test('CRM rejects incomplete or non-mobile numbers rather than inventing identities', () => {
  for (const phone of ['', '1234', '02112345678', '+1 555 123 4567']) {
    assert.throws(() => normalizeCrmPhone(phone), /شماره موبایل/);
  }
});
