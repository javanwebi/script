import test from 'node:test';
import assert from 'node:assert/strict';
import {ADMIN_MODULES,allowedPortalKeys,validPermissions} from '../../server/db/adminPermissions';

test('staff modules are unique and include all non-security work areas',()=>{
 assert.equal(new Set(ADMIN_MODULES).size,ADMIN_MODULES.length);
 assert.ok(ADMIN_MODULES.includes('orders'));
 assert.ok(ADMIN_MODULES.includes('announcements'));
});
test('employee permissions are validated against the hardcoded module registry',()=>{
 assert.deepEqual(validPermissions(['orders','orders','crm']),['orders','crm']);
 assert.throws(()=>validPermissions(['root']),/مجوز/);
 assert.throws(()=>validPermissions('orders'),/مجوز/);
 assert.throws(()=>validPermissions(Array(30).fill('orders')),/مجوز/);
});
test('portal scope cannot cross into unrelated customer or pricing documents',()=>{
 const keys=allowedPortalKeys(['announcements']);
 assert.deepEqual([...keys],['atlas_portal_content_announcements_v1']);
 assert.equal(keys.has('atlas_admin_customers_v1'),false);
 assert.equal(keys.has('atlas_price_lists_v2'),false);
 assert.equal(keys.has('atlas_portal_layout_configs_v1'),false);
 assert.deepEqual([...allowedPortalKeys(['dashboard','settings','orders'])],[]);
});
