/**
 * The FORZA page owns live audio and microphone resources. A new root key after
 * async catalog hydration would remount the voice call and form particles twice.
 */
export function shouldRemountAfterCatalogHydration(pathname: string): boolean {
  return !/^\/ai-forza(?:\/|$)/i.test(pathname);
}
