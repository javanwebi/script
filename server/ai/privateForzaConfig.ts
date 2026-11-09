/**
 * Apply the private VPS FORZA config over environment values inherited from
 * the previous Docker container. Only FORZA_ and AVALAI_ settings are allowed;
 * database, auth, port, and unrelated provider credentials remain untouched.
 */
export function applyPrivateForzaConfig(
  env: Record<string, string | undefined>,
  config: Record<string, string>,
): void {
  for (const [key, value] of Object.entries(config)) {
    // The local STT runtime is provisioned by the pinned VPS image. A stale
    // value in the legacy private env file must not disable Diba or point the
    // worker at a Python/model path that does not exist in the live container.
    if (key === 'FORZA_STT_PROVIDER' ||
        key === 'FORZA_STT_DIBA_MODEL_PATH' ||
        key === 'FORZA_STT_PYTHON' ||
        key === 'FORZA_STT_WORKERS') continue;
    if ((key.startsWith('FORZA_') || key.startsWith('AVALAI_')) && typeof value === 'string') {
      env[key] = value;
    }
  }
}
