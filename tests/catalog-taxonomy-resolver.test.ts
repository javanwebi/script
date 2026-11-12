import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ensureCatalogFamiliesLoaded,
  resolveMenuCategoryPayload,
  resolveNavigationCategoriesAndGroups,
} from '../src/services/catalogTaxonomyResolver';
import { APPROVED_MENU_CATEGORIES, APPROVED_MENU_GROUPS } from '../src/data/approvedMenuFallback';

test('all grouped product families and 10,435 SKUs are mapped across the 14 groups and 34 categories', () => {
  const products = ensureCatalogFamiliesLoaded();
  assert.ok(products.length >= 1230, `Expected at least 1230 grouped families, got ${products.length}`);

  const { categories, groups } = resolveNavigationCategoriesAndGroups();
  assert.equal(groups.length, APPROVED_MENU_GROUPS.length);
  assert.equal(categories.length, APPROVED_MENU_CATEGORIES.length);

  const totalAssignedFamilies = categories.reduce((sum, cat) => sum + Number(cat.familyCount ?? 0), 0);
  const totalAssignedSkus = categories.reduce((sum, cat) => sum + Number(cat.skuCount ?? 0), 0);
  assert.equal(totalAssignedFamilies, products.length);
  assert.ok(totalAssignedSkus >= 10435, `Expected at least 10435 SKUs, got ${totalAssignedSkus}`);
});

test('every approved excel-v2 category slug resolves a valid non-empty menu-category payload', () => {
  for (const cat of APPROVED_MENU_CATEGORIES) {
    const payload = resolveMenuCategoryPayload(cat.slug);
    assert.ok(payload, `Missing payload for ${cat.slug}`);
    assert.equal(payload.success, true);
    assert.equal(payload.category.slug, cat.slug);
    assert.ok(Array.isArray(payload.families) && payload.families.length > 0, `Category ${cat.slug} should have assigned families`);
  }
});
