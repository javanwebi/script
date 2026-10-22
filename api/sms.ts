/** Server-only verification transport; never return provider keys or verification tokens. */
export const smsConfigured = () =>
  Boolean(
    process.env.KAVENEGAR_API_KEY && process.env.KAVENEGAR_VERIFY_TEMPLATE,
  );
export async function sendVerificationCode(phone: string, code: string) {
  if (!smsConfigured())
    throw Object.assign(
      new Error("ورود پیامکی هنوز فعال نشده است؛ با رمز عبور وارد شوید."),
      { status: 503 },
    );
  try {
    const response = await fetch(
      `https://api.kavenegar.com/v1/${encodeURIComponent(process.env.KAVENEGAR_API_KEY!)}/verify/lookup.json`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          receptor: phone,
          token: code,
          template: process.env.KAVENEGAR_VERIFY_TEMPLATE!,
          type: "sms",
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
    const data = await response.json();
    if (!response.ok || data.return?.status !== 200)
      throw new Error("provider rejected");
  } catch {
    throw Object.assign(
      new Error(
        "ارسال پیامک انجام نشد؛ کمی بعد تلاش کنید یا با رمز عبور وارد شوید.",
      ),
      { status: 503 },
    );
  }
}
