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
  assert.match(images, /auth-login-banner\\.svg/);
  assert.match(images, /auth-register-banner\\.svg/);
  assert.doesNotMatch(read('scripts/optimize-images.mjs'), /banner_auth_login_1791194148886\\.jpg|banner_auth_register_1791194168672\\.jpg/);
  assert.match(css, /\.account-dialog \.account-access\s*\{[^}]*overflow-y: auto/s);
  assert.match(css, /\.account-dialog \.account-access-form\s*\{[^}]*overflow: visible/s);
  assert.match(css, /-webkit-overflow-scrolling: touch/);
});


test('dedicated login and registration routes share the two replacement banners with the auth dialog', () => {
  const app = read('src/App.tsx');
  const modal = read('src/components/auth/AuthModal.tsx');
  const auth = read('src/components/auth/AccountAccess.tsx');
  const css = read('src/storefront.css');
  assert.ok(app.includes('path="/login"'));
  assert.ok(app.includes('path="/register"'));
  assert.ok(modal.includes('initial={authModalInitialView}'));
  assert.ok(auth.includes('data-mode={mode}'));
  assert.ok(auth.includes('A.bannerAuthLogin'));
  assert.ok(auth.includes('A.bannerAuthRegister'));
  assert.ok(auth.includes('عضو صنعت پیش شوید'));
  assert.ok(auth.includes('به میزکار خود در صنعت پیش وارد شوید'));
  assert.ok(css.includes('aspect-ratio: 3.6 / 1'));
  assert.ok(css.includes('Final banner replacement'));
});
