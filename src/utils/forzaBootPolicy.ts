/** A FORZA call owns active WebAudio, STT and its particle renderer.
 * Full catalogue bootstrap competes with the microphone/Three.js main thread,
 * and async hydration must never remount a running call.
 */
export function isForzaCallPath(pathname: string): boolean {
  return /^\/(?:ai-forza|face-to-face)(?:\/|$)/i.test(pathname);
}

export function shouldRemountAfterCatalogHydration(pathname: string): boolean {
  return !isForzaCallPath(pathname);
}

/** Keep the full 10k-SKU runtime on commerce routes; voice and admin use
 * the much smaller /api/runtime?includeProducts=0 bootstrap instead.
 * Visual identification still queries the dedicated server recognition API.
 */
export function shouldRequestFullCatalogOnBoot(pathname: string): boolean {
  return !/^\/admin(?:\/|$)/i.test(pathname) && !isForzaCallPath(pathname);
}
