/** Public, credential-free voice provider status consumed by the browser. */
export type ForzaVoiceTextStatus = {
  provider?: unknown;
  requestedProvider?: unknown;
  configured?: unknown;
  reason?: unknown;
  model?: unknown;
  voice?: unknown;
  voiceReady?: unknown;
};

/**
 * FORZA customer voice calls are intentionally pinned to the existing AvalAI
 * text path. Never silently permit Gemini/worker fallback or a stale server
 * that does not expose the provider readiness contract.
 */
export function forzaVoiceCallReadinessMessage(
  status: ForzaVoiceTextStatus | null | undefined,
): string | null {
  if (!status) {
    return 'وضعیت اتصال مدل متنی AvalAI از سرور دریافت نشد؛ اتصال سرور را بررسی و صفحه را تازه‌سازی کنید.';
  }
  if (status.requestedProvider !== 'avalai' || status.provider !== 'avalai') {
    return 'موتور مکالمه فورزا روی AvalAI تنظیم نشده است؛ ارائه‌دهنده تماس را در تنظیمات خصوصی سرور روی avalai قرار دهید.';
  }
  if (status.configured !== true) {
    return 'اتصال AvalAI آماده نیست؛ کلید خصوصی و مدل متنی را در تنظیمات سرور بررسی کنید.';
  }
  const supportedVoice = [
    'piper-nima-gyro-medium',
    'piper-amir-medium',
    'pocket-farsi-v2',
  ].includes(String(status.voice || ''));
  if (!supportedVoice || status.voiceReady !== true) {
    return 'موتور صدای انتخاب‌شده آماده نیست؛ وضعیت سرویس صوتی سرور را بررسی کنید.';
  }
  return null;
}
