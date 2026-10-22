import { test } from "node:test";
import assert from "node:assert/strict";
import {
  portalContentService as cms, DEFAULT_CLUB_MILESTONES, DEFAULT_CONSUMER_CLUB_MILESTONES,
  type PortalBannerItem,
} from "../src/services/portalContentService";
import type { Customer } from "../src/types";
import {durableStorage,refreshDurableStorage} from '../src/services/durableStorage';
globalThis.fetch=async()=>new Response(JSON.stringify({success:true,database:true,values:{atlas_portal_club_milestones_v1:{high_volume:DEFAULT_CLUB_MILESTONES,consumer:DEFAULT_CONSUMER_CLUB_MILESTONES}},versions:{},products:[]}));
Object.defineProperty(globalThis, "window", { value: new EventTarget() });
const user = {
  id: "one",
  fullName: "Test",
  phone: "09121111111",
  role: "retail",
  approvedB2B: false,
} as Customer;
const banner = (
  id: string,
  extra: Partial<PortalBannerItem> = {},
): PortalBannerItem => ({
  id,
  portal: "consumer",
  scope: "collective",
  title: "Test",
  subtitle: "",
  badgeText: "",
  ctaText: "",
  ctaLinkOrTab: "orders",
  theme: "industrial_orange",
  minCartVolume: 1000,
  cartDiscountPercent: 5,
  active: true,
  createdAt: "",
  ...extra,
});
test("portal content and campaign rules", async (t) => {
  await refreshDurableStorage();
  await t.test("role or price code alone cannot grant the CRM portal", () => {
    assert.equal(
      cms.isHighVolumeCustomer({
        ...user,
        role: "dealer",
        assignedPriceListCode: "A",
        isLegacyCustomer: true,
      }),
      false,
    );
    assert.equal(
      cms.isHighVolumeCustomer({ ...user, approvedB2B: true }),
      true,
    );
  });
  await t.test(
    "club milestones are independent and old wholesale data is preserved",
    () => {
      const key = "atlas_portal_club_milestones_v1";
      const legacy = cms.getClubMilestones("high_volume");
      durableStorage.setItem(key, JSON.stringify(legacy));
      assert.notDeepEqual(cms.getClubMilestones("consumer"), legacy);
      const consumer = cms
        .getClubMilestones("consumer")
        .map((m) => ({ ...m, minPurchaseVolume: m.minPurchaseVolume + 123 }));
      cms.saveClubMilestones(consumer, "consumer");
      assert.deepEqual(cms.getClubMilestones("high_volume"), legacy);
      assert.deepEqual(cms.getClubMilestones("consumer"), consumer);
      cms.saveClubMilestones([], "consumer");
      assert.deepEqual(cms.getClubMilestones("consumer"), []);
      assert.deepEqual(cms.getClubMilestones("high_volume"), legacy);
    },
  );
  await t.test(
    "appearance can be overridden without affecting another customer",
    () => {
      cms.saveCustomerOverride({
        customerId: "visual-test",
        customerName: "Test",
        portal: "consumer",
        appearanceOverride: { glass: "solid", density: "compact" },
        updatedAt: "",
      });
      assert.equal(
        cms.getResolvedConfigForCustomer("consumer", "visual-test").appearance
          .glass,
        "solid",
      );
      assert.equal(
        cms.getResolvedConfigForCustomer("consumer", "another").appearance
          .glass,
        "subtle",
      );
    },
  );
  await t.test("empty banners stay deleted", () => {
    durableStorage.setItem("atlas_portal_content_banners_v1", "[]");
    assert.deepEqual(cms.getBanners(), []);
  });
  await t.test(
    "individual config is scoped by both customer and portal",
    () => {
      cms.saveCustomerOverride({
        customerId: "one",
        customerName: "Test",
        portal: "consumer",
        uiTextsOverride: { heroSubtitle: "only consumer" },
        updatedAt: "",
      });
      cms.saveCustomerOverride({
        customerId: "one",
        customerName: "Test",
        portal: "high_volume",
        uiTextsOverride: { heroSubtitle: "only high volume" },
        updatedAt: "",
      });
      assert.equal(
        cms.getResolvedConfigForCustomer("consumer", "one").uiTexts
          .heroSubtitle,
        "only consumer",
      );
      assert.equal(
        cms.getResolvedConfigForCustomer("high_volume", "one").uiTexts
          .heroSubtitle,
        "only high volume",
      );
      cms.deleteCustomerOverride("one", "consumer");
      assert.equal(cms.getCustomerOverride("one", "consumer"), undefined);
      assert.ok(cms.getCustomerOverride("one", "high_volume"));
    },
  );
  await t.test(
    "thresholds, targeting, disabled campaigns, invalid percentages and strongest offer",
    () => {
      durableStorage.setItem(
        "atlas_portal_content_banners_v1",
        JSON.stringify([
          banner("all"),
          banner("specific", {
            scope: "individual",
            targetCustomerId: "one",
            cartDiscountPercent: 8,
          }),
          banner("someone-else", {
            scope: "individual",
            targetCustomerId: "other",
            cartDiscountPercent: 99,
          }),
          banner("disabled", { active: false, cartDiscountPercent: 90 }),
          banner("invalid", { cartDiscountPercent: 150 }),
          banner("high", {
            portal: "high_volume",
            cartDiscountPercent: 40,
            targetTierCode: "A",
          }),
        ]),
      );
      assert.equal(cms.getCartDiscountPercent(user, 999), 0);
      assert.equal(cms.getCartDiscountPercent(user, 1000), 8);
      assert.equal(cms.getCartDiscountPercent(null, 10000), 0);
      assert.equal(cms.getCartDiscountPercent(user, NaN), 0);
      assert.equal(
        cms.getCartDiscountPercent({ ...user, approvedB2B: true }, 10000),
        0,
      );
      assert.equal(
        cms.getCartDiscountPercent(
          { ...user, approvedB2B: true, assignedPriceListCode: "A" },
          10000,
        ),
        40,
      );
    },
  );
  await t.test(
    "announcements support 3 audiences, multi-customer selection, start/end scheduling, customer end-time visibility, and auto-archiving",
    () => {
      const now = Date.now();
      const pastIso = new Date(now - 60_000).toISOString();
      const futureIso = new Date(now + 3600_000).toISOString();

      cms.saveAnnouncement({
        id: "ann-web",
        portal: "storefront",
        scope: "collective",
        title: "وب‌سایت عمومی",
        body: "برای همه بازدیدکنندگان",
        tag: "اطلاعیه عمومی",
        createdAt: "۱۴۰۴/۰۸/۰۱",
        priority: "normal",
        active: true,
        endsAt: futureIso,
        showEndTimeToCustomer: true,
      });

      cms.saveAnnouncement({
        id: "ann-retail-sel",
        portal: "consumer",
        scope: "selected",
        targetCustomerIds: ["cust-1", "cust-2"],
        title: "ویژه دو مشتری خرده‌فروش",
        body: "فقط برای cust-1 و cust-2",
        tag: "اختصاصی",
        createdAt: "۱۴۰۴/۰۸/۰۱",
        priority: "important",
        active: true,
        showEndTimeToCustomer: false,
      });

      cms.saveAnnouncement({
        id: "ann-b2b-expired",
        portal: "high_volume",
        scope: "collective",
        title: "منقضی‌شده",
        body: "باید بایگانی شود",
        tag: "فوری",
        createdAt: "۱۴۰۴/۰۷/۰۱",
        priority: "urgent",
        active: true,
        endsAt: pastIso,
      });

      // Guest sees storefront announcement
      const guestVisible = cms.getStorefrontAndUserAnnouncements({
        userId: null,
        portal: null,
      });
      assert.ok(guestVisible.some((a) => a.id === "ann-web"));
      assert.ok(!guestVisible.some((a) => a.id === "ann-retail-sel"));

      // Selected retail customer sees both storefront and their targeted retail announcement
      const cust1Visible = cms.getStorefrontAndUserAnnouncements({
        userId: "cust-1",
        portal: "consumer",
      });
      assert.ok(cust1Visible.some((a) => a.id === "ann-web"));
      assert.ok(cust1Visible.some((a) => a.id === "ann-retail-sel"));

      // Unselected retail customer does not see ann-retail-sel
      const cust3Visible = cms.getStorefrontAndUserAnnouncements({
        userId: "cust-3",
        portal: "consumer",
      });
      assert.ok(!cust3Visible.some((a) => a.id === "ann-retail-sel"));

      // Expired announcement was automatically moved to archive
      const all = cms.getAnnouncements();
      const expired = all.find((a) => a.id === "ann-b2b-expired");
      assert.equal(expired?.archived, true);
      assert.equal(cms.getAnnouncementLifecycleStatus(expired!), "archived");
    },
  );
  await t.test(
    "scroll restoration store saves and retrieves sectionId, viewportTop, and scrollY for POP back navigation",
    async () => {
      const { saveScrollEntry, getSavedScrollEntry } = await import(
        "../src/components/layout/ScrollToTop"
      );
      saveScrollEntry(["key:hist-1", "route:/", "path:/"], {
        scrollY: 1840,
        sectionId: "home-why-sanat-pish",
        viewportTop: 120,
        updatedAt: Date.now(),
      });
      const byKey = getSavedScrollEntry(["key:hist-1"]);
      assert.equal(byKey?.scrollY, 1840);
      assert.equal(byKey?.sectionId, "home-why-sanat-pish");
      assert.equal(byKey?.viewportTop, 120);

      const byPathFallback = getSavedScrollEntry(["key:unknown", "path:/"]);
      assert.equal(byPathFallback?.scrollY, 1840);
      assert.equal(byPathFallback?.sectionId, "home-why-sanat-pish");
    },
  );
});

