import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolvePostLoginDestination } from '../src/utils/accountRedirect';

const read = (p: string) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('cart and checkout are preserved after login without unsafe external redirects', () => {
  assert.equal(resolvePostLoginDestination('/consumer-dashboard', undefined, '/cart'), '/cart');
  assert.equal(resolvePostLoginDestination('/consumer-dashboard', undefined, '/checkout'), '/checkout');
  assert.equal(resolvePostLoginDestination('/account', undefined, '/consumer-dashboard/product/6203ZZ'), '/account/product/6203ZZ');
  assert.equal(resolvePostLoginDestination('/consumer-dashboard', '/cart', '/checkout'), '/cart');
  assert.equal(resolvePostLoginDestination('/account', undefined, '//attacker.invalid'), '/account');
  assert.equal(resolvePostLoginDestination('/account', undefined, 'https://attacker.invalid/'), '/account');
  assert.equal(resolvePostLoginDestination('/account', undefined, '/admin'), '/account');
  assert.equal(resolvePostLoginDestination('/account', '/admin', ''), '/account');
});

test('desktop and mobile cart links skip protected cart only for confirmed guests', () => {
  for (const path of ['src/components/layout/Header.tsx','src/components/layout/MobileBottomBar.tsx']) {
    const source = read(path);
    assert.match(source, /currentUser \|\| authLoading \? "\/cart" : "\/login\?returnTo=%2Fcart"/);
  }
  assert.match(read('src/components/auth/ProtectedRoute.tsx'), /returnTo=/);
  assert.match(read('src/components/auth/AccountAccess.tsx'), /resolvePostLoginDestination\(root, returnTo, destination\)/);
});

test('mobile account dialog uses one scroll surface and keeps separate auth images', () => {
  const auth = read('src/components/auth/AccountAccess.tsx');
  const css = read('src/storefront.css');
  const images = read('src/assets/images/index.ts');
  assert.match(auth, /A\.bannerAuthRegister/);
  assert.match(auth, /A\.bannerAuthLogin/);
  assert.match(images, /bannerAuthLoginImg/);
  assert.match(images, /bannerAuthRegisterImg/);
  assert.match(css, /\.account-dialog \.account-access\s*\{[^}]*overflow-y: auto/s);
  assert.match(css, /\.account-dialog \.account-access-form\s*\{[^}]*overflow: visible/s);
  assert.match(css, /-webkit-overflow-scrolling: touch/);
});
