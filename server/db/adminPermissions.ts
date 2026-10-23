// One source of truth for administration capability names and document boundaries.
export const ADMIN_MODULES=['dashboard','orders','inquiries','crm','customer_grading','agencies','products','bulk_import','content_studio','announcements','clients','settings'] as const;
export type AdminModule=typeof ADMIN_MODULES[number];
export type StaffRole='sales_manager'|'warehouse_operator';
export const STAFF_ROLES:StaffRole[]=['sales_manager','warehouse_operator'];
export const isAdminModule=(value:unknown):value is AdminModule=>typeof value==='string'&&(ADMIN_MODULES as readonly string[]).includes(value);
export const validPermissions=(value:unknown):AdminModule[]=>{
 if(!Array.isArray(value)||value.length>ADMIN_MODULES.length||value.some(v=>!isAdminModule(v)))throw Object.assign(new Error('مجوزهای بخش‌ها معتبر نیست.'),{status:400});
 return [...new Set(value)] as AdminModule[];
};
export const PORTAL_MODULE_KEYS:Partial<Record<AdminModule,readonly string[]>>={
 inquiries:['atlas_admin_inquiries_v1'],crm:['atlas_admin_customers_v1'],
 customer_grading:['atlas_customers_approval_v2','atlas_price_lists_v2','atlas_customer_grades_v2','atlas_club_rewards_v2','atlas_customer_reward_assignments_v1','atlas_price_list_history_v2'],
 content_studio:['atlas_portal_content_banners_v1','atlas_portal_club_milestones_v1','atlas_portal_layout_configs_v1','atlas_portal_customer_overrides_v1'],
 announcements:['atlas_portal_content_announcements_v1']
};
export const allowedPortalKeys=(modules:readonly string[]):Set<string>=>new Set(modules.flatMap(module=>[...(PORTAL_MODULE_KEYS[module as AdminModule]||[])]));
