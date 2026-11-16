import test from 'node:test';
import assert from 'node:assert/strict';
import {isAdminIsolatedRoute} from '../src/components/layout/routeLayoutPolicy';

test('admin root and nested routes bypass public storefront chrome',()=>{
 assert.equal(isAdminIsolatedRoute('/admin'),true);
 assert.equal(isAdminIsolatedRoute('/admin/products'),true);
 assert.equal(isAdminIsolatedRoute('/admin/catalog/images'),true);
});

test('routes that only begin with the admin word are not treated as admin',()=>{
 assert.equal(isAdminIsolatedRoute('/administrator'),false);
 assert.equal(isAdminIsolatedRoute('/products'),false);
 assert.equal(isAdminIsolatedRoute('/'),false);
});
