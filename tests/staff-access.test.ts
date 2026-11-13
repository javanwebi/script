import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitizeStaffPermissions,canStaff,namespacePermission,catalogMutationPermission,assertStaffDocumentChange,assertStaffCommercialFields,preserveStaffCommercialFields,assertStaffCatalogStructure} from '../server/db/staffPermissions';

test('unknown sections and actions are removed, view is required',()=>{
 const safe=sanitizeStaffPermissions({products:['edit','delete','view','view','super_admin'],settings:['view'],crm:['edit'],bulk_import:['view','import']});
 assert.deepEqual(safe.products,['edit','delete','view']);
 assert.equal(safe.settings,undefined);
 assert.equal(safe.crm,undefined);
 assert.deepEqual(safe.bulk_import,['view','import']);
});
test('catalog staff cannot escalate by owning the menu',()=>{
 const user={staff:true,admin:false,permissions:{products:['view','images']}};
 assert.equal(canStaff(user,'products'),true);
 assert.equal(canStaff(user,'products','images'),true);
 assert.equal(canStaff(user,'products','edit'),false);
 assert.equal(namespacePermission(user,'catalog_overrides',true,'atlas_admin_products_v1'),false);
 assert.equal(namespacePermission(user,'settings',false,'atlas_admin_settings_v1'),false);
 assert.equal(canStaff({admin:true},'products','delete'),true);
});
test('staff document permissions preserve create/edit/delete separation',()=>{
 const identity={staff:true,permissions:{announcements:['view','create']}};
 assert.doesNotThrow(()=>assertStaffDocumentChange(identity,'announcements','atlas_portal_content_announcements_v1',[],[{id:'a',title:'new'}]));
 assert.throws(()=>assertStaffDocumentChange(identity,'announcements','atlas_portal_content_announcements_v1',[{id:'a',title:'old'}],[{id:'a',title:'changed'}]));
 assert.throws(()=>assertStaffDocumentChange(identity,'announcements','atlas_portal_content_announcements_v1',[{id:'a',title:'old'}],[]));
 assert.throws(()=>assertStaffDocumentChange(identity,'announcements','atlas_portal_content_announcements_v1',[],[{title:'without stable id'}]));
});
test('catalog create/edit/delete endpoint actions are distinct',()=>{
 assert.deepEqual(catalogMutationPermission('/api/catalog/overrides/family/f1'),['products','delete']);
 assert.deepEqual(catalogMutationPermission('/overrides/bulk'),['bulk_import','import']);
 assert.deepEqual(catalogMutationPermission('/sku-transfer'),['products','sku_move']);
 assert.deepEqual(catalogMutationPermission('/product-images/sku-bindings'),['products','images']);
 assert.deepEqual(catalogMutationPermission('/product-images/bindings/abc'),['products','images']);
 assert.deepEqual(catalogMutationPermission('/direct-skus/bulk'),['products','edit']);
 assert.deepEqual(catalogMutationPermission('/direct-skus/ABC/image'),['products','images']);
 assert.deepEqual(catalogMutationPermission('/unrecognized-write'),['__forbidden__','__forbidden__']);
});
test('catalog editor cannot edit commercial data without price permission',()=>{
 const identity={staff:true,permissions:{products:['view','edit']}};
 const before={code:'fam',name:'old',prices:{retail:200},variants:[{code:'sku',price:200,stock:3,name:'old sku'}]};
 const valid={...before,name:'new',variants:[{...before.variants[0],name:'new sku'}]};
 assert.doesNotThrow(()=>assertStaffCommercialFields(identity,before,valid));
 assert.throws(()=>assertStaffCommercialFields(identity,before,{...valid,prices:{retail:1}}));
 assert.throws(()=>assertStaffCommercialFields(identity,before,{...valid,variants:[{code:'sku',price:1}]}));
 assert.throws(()=>assertStaffCommercialFields(identity,before,{...valid,variants:[{code:'sku',stock:500}]}));
 assert.doesNotThrow(()=>assertStaffCommercialFields({staff:true,permissions:{products:['view','edit','prices']}},before,{...before,prices:{retail:1}}));
});

test('redacted commercial placeholders preserve original server values on metadata update',()=>{
 const staff={staff:true,permissions:{products:['view','edit']}};
 const original={code:'A1',name:'old',prices:{base:100,retail:120},variants:[{code:'S1',price:120,stock:4,name:'old'}]};
 const redacted={code:'A1',name:'new',prices:{base:0,retail:0},variants:[{code:'S1',price:0,stock:0,name:'new'}]};
 assert.doesNotThrow(()=>assertStaffCommercialFields(staff,original,redacted));
 const result=preserveStaffCommercialFields(staff,original,redacted) as typeof original;
 assert.equal(result.name,'new');
 assert.equal(result.prices.retail,120);
 assert.equal(result.variants[0].name,'new');
 assert.equal(result.variants[0].price,120);
 assert.equal(result.variants[0].stock,4);
});

test('editing a family never implicitly grants SKU deletion or image/category rights',()=>{
 const editor={staff:true,permissions:{products:['view','edit']}};
 const before={code:'F1',categorySlug:'old',images:['/storage/products/a.webp'],variants:[{code:'S1',images:[]}]};
 assert.throws(()=>assertStaffCatalogStructure(editor,before,{...before,variants:[]}));
 assert.throws(()=>assertStaffCatalogStructure(editor,before,{...before,variants:[...before.variants,{code:'S2'}]}));
 assert.throws(()=>assertStaffCatalogStructure(editor,before,{...before,images:['/storage/products/b.webp']}));
 assert.throws(()=>assertStaffCatalogStructure(editor,before,{...before,categorySlug:'new'}));
 assert.doesNotThrow(()=>assertStaffCatalogStructure({staff:true,permissions:{products:['view','edit','images','categories','create','delete']}},before,{...before,images:['other'],variants:[]}));
});
