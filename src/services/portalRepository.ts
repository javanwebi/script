import {durableStorage,databaseStorageEnabled,refreshDurableStorage,hydrateMemory,flushDurableChanges} from "./durableStorage";
// Browser storage is a rendering cache. Authorization and durable data live in /api/portal.
export const PORTAL_CACHE_KEYS = [
  "atlas_admin_inquiries_v1",
  "atlas_admin_customers_v1",
  "atlas_legacy_customers_v1",
  "atlas_customers_approval_v2",
  "atlas_price_lists_v2",
  "atlas_customer_grades_v2",
  "atlas_club_rewards_v2",
  "atlas_customer_reward_assignments_v1",
  "atlas_price_list_history_v2",
  "atlas_portal_content_banners_v1",
  "atlas_portal_content_announcements_v1",
  "atlas_portal_club_milestones_v1",
  "atlas_portal_layout_configs_v1",
  "atlas_portal_customer_overrides_v1",
];
let revision = 0;
let isAdmin = false;
let dirty: Record<string, unknown> = {};
let saving: Promise<void> | null = null;
let saveError: Error | null = null;
function status(state: "saving" | "saved" | "error", message = "") {
  window.dispatchEvent(
    new CustomEvent("atlas-portal-save-status", { detail: { state, message } }),
  );
}
export async function portalRequest(body?: unknown) {
  let res: Response;
  try {
    res = await fetch("/api/portal", {
      method: body ? "POST" : "GET",
      credentials: "same-origin",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(body ? 15000 : 20000),
    });
  } catch (cause) {
    if (cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError")) {
      throw new Error("پاسخ سرور بیش از حد طول کشید. لطفاً دوباره تلاش کنید.");
    }
    throw new Error("ارتباط با سرور برقرار نشد. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.");
  }
  const data = await res
    .json()
    .catch(() => ({ message: "پاسخ سرور معتبر نیست." }));
  if (!res.ok || !data.success)
    throw new Error(data.message || "ارتباط با سرور برقرار نشد.");
  return data;
}
export function clearPortalCache() {
  isAdmin = false;
  dirty = {};
  saveError = null;
  for (const key of PORTAL_CACHE_KEYS) durableStorage.removeItem(key);
  durableStorage.removeItem("hyper_sanat_auth_state_v2");
  durableStorage.removeItem("atlas_admin_auth_v1");
  durableStorage.removeItem("hyper_sanat_registered_users_v2");
}
export async function hydratePortal() {
  if (saving) await saving;
  if (saveError) throw saveError;
  const data = await portalRequest();
  // Keep a recoverable copy of pre-migration browser data; never upload it automatically.
  if (!durableStorage.getItem("atlas_portal_cache_migrated_v1")) {
    const previous: Record<string, unknown> = {};
    for (const key of PORTAL_CACHE_KEYS) {
      const raw = durableStorage.getItem(key);
      if (raw) {
        try {
          previous[key] = JSON.parse(raw);
        } catch {
          /* invalid legacy cache */
        }
      }
    }
    if (Object.keys(previous).length)
      durableStorage.setItem(
        "atlas_portal_local_backup_v1",
        JSON.stringify(previous),
      );
    durableStorage.setItem("atlas_portal_cache_migrated_v1", "true");
  }
  if(databaseStorageEnabled())await refreshDurableStorage();
  hydrateMemory(()=>{
  revision = data.revision;
  isAdmin = data.admin;
  for (const key of PORTAL_CACHE_KEYS) {
    const value = data.values?.[key];
    if (value !== undefined) durableStorage.setItem(key, JSON.stringify(value));
    else if (key === "atlas_portal_layout_configs_v1")
      durableStorage.removeItem(key);
    else if (
      isAdmin &&
      [
        "atlas_price_lists_v2",
        "atlas_customer_grades_v2",
        "atlas_portal_club_milestones_v1",
      ].includes(key)
    )
      durableStorage.removeItem(key);
    else durableStorage.setItem(key, "[]");
  }
  durableStorage.removeItem("hyper_sanat_registered_users_v2");
  if (data.user)
    durableStorage.setItem(
      "hyper_sanat_auth_state_v2",
      JSON.stringify(data.user),
    );
  else durableStorage.removeItem("hyper_sanat_auth_state_v2");
  });
  for (const event of [
    "atlas-portal-content-updated",
    "atlas-pricing-updated",
    "atlas-session-updated",
  ])
    window.dispatchEvent(new CustomEvent(event, { detail: data }));
  return data;
}
export function persistPortalCache(key: string, value: string) {
  durableStorage.setItem(key, value);
  if (
    !isAdmin ||
    !PORTAL_CACHE_KEYS.includes(key) ||
    key === "atlas_legacy_customers_v1"
  )
    return;
  dirty[key] = JSON.parse(value);
  saveError = null;
  status("saving");
  if (!saving) {
    saving = new Promise<void>((resolve) => queueMicrotask(resolve))
      .then(async () => {
        while (Object.keys(dirty).length) {
          const values = dirty;
          dirty = {};
          try {
            const data = await portalRequest({
              action: "save",
              revision,
              values,
            });
            revision = data.revision;
          } catch (error: any) {
            dirty = { ...values, ...dirty };
            saveError = error;
            status("error", error.message);
            return;
          }
        }
        status("saved");
      })
      .finally(() => {
        saving = null;
      });
  }
}
export async function flushPortalChanges() {
  await flushDurableChanges();
  if (saving) await saving;
  if (saveError) throw saveError;
  if (Object.keys(dirty).length)
    throw new Error("تغییرات هنوز ذخیره نشده‌اند.");
}
