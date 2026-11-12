import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const source=(file:string)=>readFileSync(file,'utf8');

test('homepage uses approved top-level groups rather than six sibling category names',()=>{
 const view=source('src/components/storefront/HomeSequence.tsx');
 assert.match(view,/APPROVED_MENU_CATEGORIES/);
 assert.match(view,/APPROVED_MENU_GROUPS/);
 assert.match(view,/displayedGroups/);
 assert.match(view,/group\.title/);
 assert.match(view,/fetch\("\/api\/catalog\/navigation-groups"/);
 assert.match(view,/homeCategories\(\)/);
 assert.match(view,/HOMEPAGE_CATEGORY_CARD_COUNT = 6/);
 assert.match(view,/to=\{`\/categories#menu-group-\$\{group\.id\}`\}/);
 assert.match(source('src/pages/AllCategoriesPage.tsx'),/id=\{`menu-group-\$\{section\.id\}`\}/);
 assert.doesNotMatch(view,/const groups = \[/);
 assert.doesNotMatch(view,/"پولی و انتقال نیرو"|"چرخ و رولر"|"بلبرینگ و یاتاقان"/);
});
test('small homepage endpoint returns active mega-menu category members in admin sort order',()=>{
 const code=source('server/catalogNavigationApi.ts');
 const handler=code.split("app.get('/api/catalog/home-categories'")[1].split("app.get('/api/catalog/categories'")[0];
 assert.match(handler,/public\.catalog_navigation_groups g/);
 assert.match(handler,/unnest\(g\.category_slugs\) with ordinality/);
 assert.match(handler,/join public\.catalog_categories c on c\.slug=member\.slug/);
 assert.match(handler,/g\.is_active=true/);
 assert.match(handler,/c\.is_active=true/);
 assert.match(handler,/c\.metadata->>'source'='industrial_megamenu_hierarchy_v2'/);
 assert.match(handler,/order by group_sort,member_sort,name/);
 assert.doesNotMatch(handler,/public\.catalog_families/);
});
