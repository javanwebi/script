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
    if ((key.startsWith('FORZA_') || key.startsWith('AVALAI_')) && typeof value === 'string') {
      env[key] = value;
    }
  }
}
