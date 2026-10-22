/** Server persistence contracts. Regenerate public Database types against the migrated DEV stack before release. */
export type Json=string|number|boolean|null|Json[]|{[key:string]:Json|undefined};
export interface ProfileRow{id:string;auth_user_id:string|null;organization_id:string|null;phone:string|null;username:string|null;display_name:string;company_name:string;role:'retail'|'wholesale'|'dealer'|'admin';payload:Json;active:boolean;created_at:string;}
export interface FamilyRow{code:string;name:string;category_slug:string|null;active:boolean;payload:Json;updated_at:string;}
export interface VariantRow{code:string;family_code:string;name:string;active:boolean;payload:Json;updated_at:string;}
export interface DomainRow{namespace:string;scope_id:string;entry_key:string;position:number;owner_id:string|null;legacy_customer_id:string|null;status:string|null;payload:Json;active:boolean;updated_at:string;}
export interface InventoryRow{variant_code:string;quantity:number;reserved:number;known:boolean;version:number;payload:Json;}
export interface CheckoutInput{requestKey:string;items:{code:string;quantity:number}[];addressId:string;shippingId:'freight'|'tipax'|'post';paymentMethod:'online'|'transfer'|'credit';}
