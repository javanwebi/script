/** Bound first-token, idle and total waits; provider heartbeat frames do not reset them. */
export function createForzaStreamDeadline(options: { firstMs?: number; idleMs?: number; totalMs?: number } = {}) {
  const controller = new AbortController();
  const expire = () => controller.abort(new Error('زمان دریافت پاسخ تمام شد؛ دوباره تلاش کنید.'));
  let idle = setTimeout(expire, options.firstMs ?? 30_000);
  const total = setTimeout(expire, options.totalMs ?? 120_000);
  return {
    signal: controller.signal,
    progress() {
      if (controller.signal.aborted) return;
      clearTimeout(idle);
      idle = setTimeout(expire, options.idleMs ?? 45_000);
    },
    dispose() { clearTimeout(idle); clearTimeout(total); },
  };
}
