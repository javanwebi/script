/**
 * On a 1GB Railway container, a resident Pocket ONNX worker plus the catalog
 * process exceeds the memory limit. Never run local synthesis there by
 * default. Ubuntu/self-hosted installations can still use their own CPU.
 * A separate configured speech service always takes precedence.
 */
export function allowInProcessPocket(env: Record<string,string|undefined>): boolean {
  const railway = Boolean(env.RAILWAY_SERVICE_ID || env.RAILWAY_PROJECT_ID || env.RAILWAY_ENVIRONMENT_NAME);
  return !railway || env.FORZA_POCKET_ALLOW_IN_PROCESS === 'true';
}
