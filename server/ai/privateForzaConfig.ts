/**
 * Apply the private VPS FORZA config over environment values inherited from
 * the previous Docker container. Only FORZA_ and AVALAI_ settings are allowed;
 * database, auth, port, and unrelated provider credentials remain untouched.
 */
export function applyPrivateForzaConfig(
  env: Record<string, string | undefined>,
  config: Record<string, string>,
): void {
  const hasBundledDibaRuntime = Boolean(String(env.FORZA_STT_DIBA_MODEL_PATH || '').trim());
  const imageOwnedSttKeys = new Set([
    'FORZA_STT_PROVIDER',
    'FORZA_STT_DIBA_MODEL_PATH',
    'FORZA_STT_PYTHON',
    'FORZA_STT_WORKERS',
  ]);
  for (const [key, value] of Object.entries(config)) {
    // When the pinned VPS image includes Diba, its provider and runtime paths
    // are authoritative. A stale private-file value must not disable it or
    // point the worker at a Python/model path absent from the live container.
    if (hasBundledDibaRuntime && imageOwnedSttKeys.has(key)) continue;
    if ((key.startsWith('FORZA_') || key.startsWith('AVALAI_')) && typeof value === 'string') {
      env[key] = value;
    }
  }
}
