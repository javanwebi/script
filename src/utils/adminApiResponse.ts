/**
 * Admin mutation response contract.
 * Do not mistake an HTML proxy page / SPA fallback for a failed SQL mutation.
 * Never display response bodies: they can include private customer information.
 */
export type AdminApiFailureKind = 'http' | 'not-json' | 'bad-contract';

export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly kind: AdminApiFailureKind,
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}

type ApiEnvelope = { success?: boolean; message?: unknown; error?: unknown };

function serverMessage(payload: ApiEnvelope): string {
  const direct = typeof payload.message === 'string' ? payload.message.trim() : '';
  const nested = payload.error && typeof payload.error === 'object'
    ? (payload.error as {message?: unknown}).message : payload.error;
  const message = direct || (typeof nested === 'string' ? nested.trim() : '');
  return message.slice(0, 280);
}

function httpExplanation(status: number): string {
  if (status === 401) return 'نشست ورود منقضی شده است؛ دوباره وارد حساب شوید.';
  if (status === 403) return 'اجازه این عملیات وجود ندارد یا مبدأ درخواست پذیرفته نشده است.';
  if (status === 404 || status === 405)
    return 'این مسیر API در نسخه فعال سرور موجود نیست یا روش درخواست پشتیبانی نمی‌شود؛ نسخه فرانت‌اند و بک‌اند را بررسی کنید.';
  if (status === 408 || status === 504) return 'درخواست در زمان مقرر از سرور پاسخ نگرفت.';
  if (status === 413) return 'حجم داده یا تصویر از حد مجاز سرور بیشتر است.';
  if (status === 429) return 'تعداد درخواست‌ها بیش از حد مجاز است.';
  if (status === 502 || status === 503) return 'سرور یا پراکسی موقتاً در دسترس نیست.';
  if (status >= 500) return 'خطای داخلی در سرور رخ داده است.';
  return 'پاسخ معتبر برای این عملیات دریافت نشد.';
}

function isRecord(value: unknown): value is ApiEnvelope {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Expects the app's JSON {success:true} contract, even for HTTP 2xx. */
export async function requireAdminApiJson<T>(response: Response, operation: string): Promise<T> {
  const status = response.status;
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  let raw: string;
  try {
    raw = await response.text();
  } catch {
    throw new AdminApiError(`${operation}: خواندن پاسخ سرور ناموفق بود (HTTP ${status}).`, status, 'not-json');
  }

  let decoded: unknown;
  try {
    decoded = raw ? JSON.parse(raw) : null;
  } catch {
    decoded = null;
  }

  if (!isRecord(decoded)) {
    const html = contentType.includes('text/html') ||
      /^\s*(?:<!doctype\s+html|<html\b)/i.test(raw.slice(0, 120));
    const explanation = html
      ? status === 404 || status === 405
        ? httpExplanation(status)
        : status >= 500
          ? httpExplanation(status)
          : 'سرور به‌جای JSON صفحه HTML برگردانده است؛ مسیر API یا پیکربندی پراکسی را بررسی کنید.'
      : httpExplanation(status);
    throw new AdminApiError(`${operation}: ${explanation} (HTTP ${status})`, status, 'not-json');
  }

  if (!response.ok || decoded.success !== true) {
    throw new AdminApiError(
      `${operation}: ${serverMessage(decoded) || httpExplanation(status)} (HTTP ${status})`,
      status,
      response.ok ? 'bad-contract' : 'http',
    );
  }
  return decoded as T;
}

export function adminApiNetworkMessage(error: unknown, operation: string): string {
  if (error instanceof AdminApiError) return error.message;
  if (error && typeof error === 'object' && 'name' in error && error.name === 'TimeoutError')
    return `${operation}: زمان انتظار ارتباط با سرور تمام شد. پیش از ارسال دوباره، نتیجه عملیات را بررسی کنید.`;
  if (error && typeof error === 'object' && 'name' in error && error.name === 'AbortError')
    return `${operation}: درخواست قطع شد. قبل از تلاش دوباره، نتیجه عملیات را بررسی کنید.`;
  return error instanceof Error ? error.message : `${operation}: ارتباط با سرور برقرار نشد.`;
}
