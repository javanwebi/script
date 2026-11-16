-- Restore only missing links from the semantic-audit backup.
-- Existing newer assignments are never overwritten.

begin;

insert into public.catalog_family_menu_assignments
  (family_code,category_slug,submenu_name,leaf_name,method,created_at,updated_at)
select
  b.family_code,b.category_slug,b.submenu_name,b.leaf_name,b.method,b.created_at,b.updated_at
from public.catalog_family_menu_assignment_semantic_backup_20261116 b
where not exists (
  select 1 from public.catalog_family_menu_assignments a
  where a.family_code=b.family_code
);

commit;
