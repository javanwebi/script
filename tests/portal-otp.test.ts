import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import handler from "../api/portal";
test("chosen credentials and persistent one-time SMS authentication", async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "sanat-otp-"));
  process.env.PORTAL_DATA_PATH = path.join(dir, "portal.json");
  process.env.PORTAL_SESSION_SECRET =
    "otp-test-session-secret-over-thirty-two-characters";
  delete process.env.KAVENEGAR_API_KEY;
  delete process.env.KAVENEGAR_VERIFY_TEMPLATE;
  const server = http.createServer(handler);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(server.address() as any).port}`,
    originalFetch = globalThis.fetch;
  let deliveredCode = "",
    deliveries = 0,
    rejected = false;
  globalThis.fetch = async (input, init) => {
    if (String(input).startsWith("https://api.kavenegar.com/")) {
      deliveries++;
      deliveredCode =
        new URLSearchParams(String(init?.body)).get("token") || "";
      return new Response(
        JSON.stringify({ return: { status: rejected ? 401 : 200 } }),
        { status: 200 },
      );
    }
    return originalFetch(input, init);
  };
  const request = async (body?: any) => {
    const r = await originalFetch(url, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      status: r.status,
      data: await r.json(),
      cookie: r.headers.get("set-cookie"),
    };
  };
  const payload = {
    firstName: "تست",
    lastName: "پیامک",
    companyName: "Test",
    mobile: "09123334444",
    provinceId: "yazd",
    cityId: "yazd-yazd",
    activityField: "صنعت",
    username: "chosen_company",
    password: "selected-test-password",
  };
  const changeEntry = async (change: (e: any) => void) => {
    const db = JSON.parse(
      await readFile(process.env.PORTAL_DATA_PATH!, "utf8"),
    );
    change(Object.values(db.otp)[0]);
    await writeFile(process.env.PORTAL_DATA_PATH!, JSON.stringify(db));
  };
  try {
    await t.test(
      "registration requires chosen username and safe password",
      async () => {
        assert.equal(
          (
            await request({
              action: "register",
              payload: { ...payload, username: undefined },
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await request({
              action: "register",
              payload: { ...payload, password: "short" },
            })
          ).status,
          400,
        );
        const r = await request({ action: "register", payload });
        assert.equal(r.status, 201);
        assert.equal(r.data.user.username, payload.username);
        assert.equal(r.data.credentials.initialPassword, undefined);
        assert.equal(
          (
            await request({
              action: "login",
              identifier: payload.mobile,
              password: payload.mobile,
            })
          ).status,
          401,
        );
        assert.equal(
          (
            await request({
              action: "login",
              identifier: payload.username,
              password: payload.password,
            })
          ).status,
          200,
        );
      },
    );
    await t.test("missing provider never fabricates delivery", async () => {
      assert.equal(
        (await request({ action: "otp_request", phone: payload.mobile }))
          .status,
        503,
      );
      assert.equal(deliveries, 0);
    });
    process.env.KAVENEGAR_API_KEY = "test-placeholder";
    process.env.KAVENEGAR_VERIFY_TEMPLATE = "test-template";
    await t.test(
      "transport contract, cooldown and no OTP leakage",
      async () => {
        const r = await request({
          action: "otp_request",
          phone: payload.mobile,
        });
        assert.equal(r.status, 200);
        assert.equal(deliveries, 1);
        assert.match(deliveredCode, /^\d{6}$/);
        assert.ok(!JSON.stringify(r.data).includes(deliveredCode));
        assert.ok(
          !(await readFile(process.env.PORTAL_DATA_PATH!, "utf8")).includes(
            deliveredCode,
          ),
        );
        assert.equal(
          (await request({ action: "otp_request", phone: payload.mobile }))
            .status,
          429,
        );
      },
    );
    await t.test(
      "wrong code fails, correct code creates signed session, replay fails",
      async () => {
        assert.equal(
          (
            await request({
              action: "otp_verify",
              phone: payload.mobile,
              code: "000000",
            })
          ).status,
          401,
        );
        const r = await request({
          action: "otp_verify",
          phone: payload.mobile,
          code: deliveredCode,
        });
        assert.equal(r.status, 200);
        assert.ok(r.cookie?.includes("HttpOnly"));
        assert.equal(r.data.user.username, payload.username);
        assert.equal(
          (
            await request({
              action: "otp_verify",
              phone: payload.mobile,
              code: deliveredCode,
            })
          ).status,
          401,
        );
      },
    );
    await t.test(
      "five wrong attempts and expiration lock the challenge",
      async () => {
        await changeEntry((e) => (e.sentAt = 0));
        await request({ action: "otp_request", phone: payload.mobile });
        for (let i = 0; i < 5; i++)
          assert.equal(
            (
              await request({
                action: "otp_verify",
                phone: payload.mobile,
                code: "000000",
              })
            ).status,
            401,
          );
        assert.equal(
          (
            await request({
              action: "otp_verify",
              phone: payload.mobile,
              code: deliveredCode,
            })
          ).status,
          401,
        );
        await changeEntry((e) => (e.sentAt = 0));
        await request({ action: "otp_request", phone: payload.mobile });
        await changeEntry((e) => (e.expires = Date.now() - 1));
        assert.equal(
          (
            await request({
              action: "otp_verify",
              phone: payload.mobile,
              code: deliveredCode,
            })
          ).status,
          401,
        );
      },
    );
    await t.test("provider failure is not reported as sent", async () => {
      await changeEntry((e) => (e.sentAt = 0));
      rejected = true;
      assert.equal(
        (await request({ action: "otp_request", phone: payload.mobile }))
          .status,
        503,
      );
    });
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.KAVENEGAR_API_KEY;
    delete process.env.KAVENEGAR_VERIFY_TEMPLATE;
    await new Promise<void>((r) => server.close(() => r()));
    await rm(dir, { recursive: true, force: true });
  }
});
