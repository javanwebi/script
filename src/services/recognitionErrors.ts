/** Only these controlled messages may cross the job API; provider bodies can contain secrets. */
export const recognitionErrorMessages = {
 worker_auth: 'اتصال شناسایی تنظیم نیست: مدیر باید APP_WORKER_TOKEN را در ورکر و همان مقدار را در PART_RECOGNITION_WORKER_TOKEN سرور ثبت کند.',
 provider_key: 'کلید هوش مصنوعی ورکر تنظیم نیست؛ مدیر باید GEMINI_API_KEY را در Secrets ورکر ثبت و نسخه را Deploy کند.',
 image_unreachable: 'ورکر به لینک تصویر دسترسی ندارد؛ آدرس عمومی HTTPS سرور تصاویر باید از اینترنت قابل بازشدن باشد.',
 rate_limit: 'سرویس هوش مصنوعی به محدودیت درخواست رسیده است؛ کمی بعد دوباره تلاش کنید.',
 unavailable: 'ارتباط با سرویس شناسایی برقرار نشد؛ لطفاً کمی بعد دوباره تلاش کنید.',
} as const;
export class RecognitionServiceError extends Error {
 constructor(public code:keyof typeof recognitionErrorMessages){super(recognitionErrorMessages[code]);this.name='RecognitionServiceError';}
}
