import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import handler from "../api/portal";

test("portal authentication, isolation, persistence and admin edits", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "sanat-portal-"));
  process.env.PORTAL_DATA_PATH = path.join(dir, "portal.json");
  process.env.PORTAL_SESSION_SECRET =
    "test-only-session-secret-at-least-thirty-two-characters";
  process.env.PORTAL_ADMIN_PASSWORD = "test-only-admin-password";
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(server.address() as any).port}`;
  const request = async (body?: any, cookie = "", origin?: string) => {
    const r = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: {
        "content-type": "application/json",
        cookie,
        ...(origin ? { origin } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: r.status,
      data: await r.json(),
      cookie: r.headers.get("set-cookie")?.split(";")[0] || "",
    };
  };
  try {
    await t.test(
      "guest and forged cookie cannot edit customer data",
      async () => {
        assert.equal((await request()).data.user, null);
        assert.equal(
          (
            await request(
              { action: "save", revision: 0, values: {} },
              "sanat_portal=forged",
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await request({
              action: "login",
              identifier: "admin",
              password: "123admin",
            })
          ).status,
          401,
        );
        assert.equal(
          (
            await request(
              {
                action: "admin_login",
                username: "admin",
                password: process.env.PORTAL_ADMIN_PASSWORD,
              },
              "",
              "https://evil.example",
            )
          ).status,
          403,
        );
      },
    );
    const registration = await request({
      action: "register",
      payload: {
        username: "test_factory",
        password: "test-selected-password",
        firstName: "کاربر",
        lastName: "آزمایش",
        companyName: "Test factory",
        mobile: "09121111111",
        provinceId: "yazd",
        cityId: "yazd-yazd",
        activityField: "صنعت",
        approvedB2B: true,
        role: "admin",
      },
    });
    const consumer = registration.cookie;
    await t.test(
      "self-registration cannot choose CRM access or receive fabricated SMS confirmation",
      () => {
        assert.equal(registration.status, 201);
        assert.equal(registration.data.user.role, "retail");
        assert.equal(registration.data.user.approvedB2B, false);
        assert.equal(registration.data.smsSent, false);
        assert.equal(registration.data.user.totalPurchases, 0);
      },
    );
    await t.test(
      "onboarding cannot be skipped and must persist valid answers",
      async () => {
        assert.equal(
          (
            await request(
              { action: "inquiry", code: "80301", quantity: 1 },
              consumer,
            )
          ).status,
          403,
        );
        assert.equal(
          (
            await request(
              { action: "profile", payload: { onboardingCompleted: true } },
              consumer,
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await request(
              { action: "profile", payload: { onboardingCompleted: "yes" } },
              consumer,
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await request(
              { action: "profile", payload: { favoriteBrands: ["invalid"] } },
              consumer,
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await request(
              { action: "profile", payload: { favoriteBrands: ["forza"] } },
              consumer,
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await request(
              {
                action: "profile",
                payload: { businessType: "factory", onboardingCompleted: true },
              },
              consumer,
            )
          ).status,
          200,
        );
      },
    );
    await t.test(
      "inquiries require a signed customer and persist with server-owned identity",
      async () => {
        assert.equal(
          (await request({ action: "inquiry", code: "80301", quantity: 1 }))
            .status,
          401,
        );
        assert.equal(
          (
            await request(
              { action: "inquiry", code: "80301", quantity: 0 },
              consumer,
            )
          ).status,
          400,
        );
        const result = await request(
          {
            action: "inquiry",
            code: "80301",
            quantity: 2,
            customerId: "forged",
            productName: "چرخ دنده",
            notes: "نیاز به بررسی",
          },
          consumer,
        );
        assert.equal(result.status, 201);
        assert.equal(result.data.inquiry.customerId, registration.data.user.id);
        const snapshot = await request(undefined, consumer);
        assert.equal(snapshot.data.values.atlas_admin_inquiries_v1.length, 1);
        assert.equal(
          (await request()).data.values.atlas_admin_inquiries_v1,
          undefined,
        );
        const stranger = await request({
          action: "register",
          payload: {
            username: "other_factory",
            password: "other-selected-password",
            firstName: "کاربر",
            lastName: "دیگر",
            companyName: "Other",
            mobile: "09121112222",
            provinceId: "yazd",
            cityId: "yazd-yazd",
            activityField: "صنعت",
          },
        });
        assert.deepEqual(
          (await request(undefined, stranger.cookie)).data.values
            .atlas_admin_inquiries_v1,
          [],
        );
      },
    );
    await t.test("missing password and guessed OTP are rejected", async () => {
      assert.equal(
        (await request({ action: "login", identifier: "09121111111" })).status,
        401,
      );
      assert.equal(
        (
          await request({
            action: "login",
            identifier: "09121111111",
            otp: "1234",
          })
        ).status,
        401,
      );
      assert.equal(
        (
          await request({
            action: "login",
            identifier: "09121111111",
            password: "1234",
          })
        ).status,
        401,
      );
      assert.equal(
        (
          await request({
            action: "login",
            identifier: "۰۹۱۲۱۱۱۱۱۱۱",
            password: "test-selected-password",
          })
        ).status,
        200,
      );
    });
    await t.test(
      "profile update cannot elevate privilege or change purchase volume",
      async () => {
        const update = await request(
          {
            action: "profile",
            payload: {
              approvedB2B: true,
              role: "admin",
              totalPurchases: 9999999999,
              favoriteBrands: ["forza"],
            },
          },
          consumer,
        );
        assert.equal(update.data.user.approvedB2B, false);
        assert.equal(update.data.user.role, "retail");
        assert.equal(update.data.user.totalPurchases, 0);
      },
    );
    const admin = (
      await request({
        action: "admin_login",
        username: "admin",
        password: process.env.PORTAL_ADMIN_PASSWORD,
      })
    ).cookie;
    let snapshot = (await request(undefined, admin)).data;
    const users = snapshot.values.atlas_admin_customers_v1;
    const b2b = {
      id: "crm-b2b",
      username: "factory_test",
      fullName: "مشتری خرید بالا",
      phone: "09122222222",
      approvedB2B: true,
      role: "wholesale",
      assignedPriceListCode: "B",
      totalPurchases: 270000000,
      creditLimit: 0,
      onboardingCompleted: true,
    };
    const bannerKey = "atlas_portal_content_banners_v1";
    const values = {
      atlas_admin_customers_v1: [...users, b2b],
      [bannerKey]: [
        {
          id: "consumer-all",
          portal: "consumer",
          scope: "collective",
          title: "عمومی مشتری",
          active: true,
        },
        {
          id: "consumer-single",
          portal: "consumer",
          scope: "individual",
          targetCustomerId: users[0].id,
          title: "پیام شخصی",
          active: true,
        },
        {
          id: "other-customer",
          portal: "consumer",
          scope: "individual",
          targetCustomerId: "someone-else",
          title: "محرمانه",
          active: true,
        },
        {
          id: "b2b-all",
          portal: "high_volume",
          scope: "collective",
          title: "عمومی باشگاه",
          active: true,
        },
        {
          id: "b2b-A",
          portal: "high_volume",
          scope: "collective",
          targetTierCode: "A",
          active: true,
        },
        { id: "off", portal: "consumer", scope: "collective", active: false },
      ],
      atlas_price_lists_v2: [
        { id: "retail", code: "RETAIL", isRetailCash: true },
        { id: "a", code: "A" },
        { id: "b", code: "B" },
      ],
      atlas_portal_club_milestones_v1: {
        consumer: [{ code: "C", publicTitle: "retail-path" }],
        high_volume: [{ code: "A", publicTitle: "factory-path" }],
      },
      atlas_customer_reward_assignments_v1: [
        { id: "r1", targetCustomerIds: ["crm-b2b"], notes: "admin-only-note" },
        { id: "r2", targetCustomerIds: ["another-b2b"] },
      ],
    };
    await t.test(
      "admin creates CRM identity and saves global and individual content",
      async () => {
        assert.equal(
          (
            await request(
              { action: "save", revision: snapshot.revision, values },
              admin,
            )
          ).status,
          200,
        );
        assert.equal(
          (
            await request(
              { action: "save", revision: snapshot.revision, values: {} },
              admin,
            )
          ).status,
          409,
        );
        assert.equal(
          (await request({ action: "save", revision: 2, values: {} }, consumer))
            .status,
          403,
        );
      },
    );
    const b2bLogin = await request({
      action: "login",
      identifier: "factory_test",
      password: "09122222222",
    });
    await t.test(
      "CRM username authenticates on separate client and receives only assigned data",
      async () => {
        assert.equal(b2bLogin.status, 200);
        assert.equal(b2bLogin.data.user.approvedB2B, true);
        assert.equal(b2bLogin.data.user.onboardingCompleted, false);
        assert.equal(
          (
            await request(
              {
                action: "profile",
                payload: {
                  favoriteBrands: ["forza"],
                  businessType: "factory",
                  onboardingCompleted: true,
                },
              },
              b2bLogin.cookie,
            )
          ).status,
          200,
        );
        assert.equal(b2bLogin.data.user.creditLimit, 0);
        const high = (await request(undefined, b2bLogin.cookie)).data;
        assert.deepEqual(
          high.values[bannerKey].map((r: any) => r.id),
          ["b2b-all"],
        );
        assert.deepEqual(
          high.values.atlas_price_lists_v2.map((r: any) => r.code),
          ["B"],
        );
        assert.equal(high.values.atlas_admin_customers_v1.length, 1);
        assert.equal(
          high.values.atlas_customer_reward_assignments_v1.length,
          1,
        );
        assert.equal(
          high.values.atlas_customer_reward_assignments_v1[0].notes,
          undefined,
        );
        assert.deepEqual(high.values.atlas_portal_club_milestones_v1, {
          high_volume: [{ code: "A", publicTitle: "factory-path" }],
        });
        const retail = (await request(undefined, consumer)).data;
        assert.deepEqual(retail.values.atlas_portal_club_milestones_v1, {
          consumer: [{ code: "C", publicTitle: "retail-path" }],
        });
        assert.deepEqual(
          retail.values.atlas_customer_reward_assignments_v1,
          [],
        );
        assert.deepEqual(
          retail.values[bannerKey].map((r: any) => r.id),
          ["consumer-all", "consumer-single"],
        );
        assert.deepEqual(
          retail.values.atlas_price_lists_v2.map((r: any) => r.code),
          ["RETAIL"],
        );
      },
    );
    await t.test(
      "removing all banners persists an empty list; credentials are hashed on disk",
      async () => {
        snapshot = (await request(undefined, admin)).data;
        assert.equal(
          (
            await request(
              {
                action: "save",
                revision: snapshot.revision,
                values: { [bannerKey]: [] },
              },
              admin,
            )
          ).status,
          200,
        );
        assert.deepEqual(
          (await request(undefined, consumer)).data.values[bannerKey],
          [],
        );
        const disk = JSON.parse(
          await readFile(process.env.PORTAL_DATA_PATH!, "utf8"),
        );
        assert.ok(
          disk.users.every(
            (u: any) => u.passwordHash && u.passwordSalt && !u.password,
          ),
        );
      },
    );
    await t.test(
      "CRM access can be revoked without a stale role bypass",
      async () => {
        snapshot = (await request(undefined, admin)).data;
        const updated = snapshot.values.atlas_admin_customers_v1.map(
          (u: any) => (u.id === b2b.id ? { ...u, approvedB2B: false } : u),
        );
        assert.equal(
          (
            await request(
              {
                action: "save",
                revision: snapshot.revision,
                values: { atlas_admin_customers_v1: updated },
              },
              admin,
            )
          ).status,
          200,
        );
        const state = (await request(undefined, b2bLogin.cookie)).data;
        assert.equal(state.user.approvedB2B, false);
        assert.equal(state.user.role, "retail");
        assert.deepEqual(state.values.atlas_customer_reward_assignments_v1, []);
      },
    );
    await t.test(
      "serverless runtime fails closed without durable storage",
      async () => {
        process.env.VERCEL = "1";
        assert.equal((await request()).status, 503);
        delete process.env.VERCEL;
      },
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(dir, { recursive: true, force: true });
  }
});
