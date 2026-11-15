export interface ModuleImportRetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void;
}

const TRANSIENT_IMPORT_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /Unable to preload CSS/i,
  /Loading chunk [\w-]+ failed/i,
  /Failed to fetch/i,
  /NetworkError when attempting to fetch resource/i,
  /Load failed/i,
];

export function isTransientModuleImportError(error: unknown): boolean {
  if (!error) return false;
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === 'string'
        ? error
        : '';
  return TRANSIENT_IMPORT_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function importWithRetry<T>(
  loader: () => Promise<T>,
  options: ModuleImportRetryOptions = {},
): Promise<T> {
  const maxRetries = Math.max(0, options.maxRetries ?? 3);
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 450);
  const sleep = options.sleep ?? defaultSleep;

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await loader();
    } catch (error) {
      lastError = error;
      if (attempt >= maxRetries || !isTransientModuleImportError(error)) {
        throw error;
      }
      const delayMs = baseDelayMs * 2 ** attempt;
      options.onRetry?.(attempt + 1, error, delayMs);
      await sleep(delayMs);
    }
  }
  throw lastError;
}
