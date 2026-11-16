import assert from 'node:assert/strict';
import test from 'node:test';
import { detectConveyorSurfaceProfile } from '../src/data/beltCatalogAudit';

test('PVC conveyor surface trade labels are preserved as distinct catalogue profiles', () => {
  assert.equal(detectConveyorSurfaceProfile('نوار نقاله PVC سنگی').profile, 'PVC_STONE_SURFACE');
  assert.equal(detectConveyorSurfaceProfile('نوار نقاله PVC پامرغی').profile, 'PVC_PAMARGHI_PATTERN');
  assert.equal(detectConveyorSurfaceProfile('نوار نقاله PVC کله قندی').profile, 'PVC_CONICAL_CLEAT');
  assert.equal(detectConveyorSurfaceProfile('نوار نقاله PVC چمنی').profile, 'PVC_GRASS_PATTERN');
  assert.equal(detectConveyorSurfaceProfile('نوار نقاله PVC لوزی').profile, 'PVC_DIAMOND_PATTERN');
  assert.equal(detectConveyorSurfaceProfile('نوار نقاله PVC آجدار').profile, 'PVC_ROUGH_TOP');
  assert.equal(detectConveyorSurfaceProfile('نوار نقاله PVC ساده').profile, 'PVC_SMOOTH');
  assert.equal(detectConveyorSurfaceProfile('نوار نقاله PVC شفاف').profile, 'PVC_TRANSPARENT');
});

test('unknown PVC surface is never silently classified as smooth', () => {
  const result = detectConveyorSurfaceProfile('نوار نقاله PVC سبز');
  assert.equal(result.profile, 'PVC_SURFACE_UNSPECIFIED');
  assert.equal(result.requiresReview, true);
});
