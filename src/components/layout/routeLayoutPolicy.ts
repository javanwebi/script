/** Routes that must render without the public storefront header, footer or dock. */
export function isAdminIsolatedRoute(pathname: string): boolean {
  const cleanPath = String(pathname || '/').split(/[?#]/, 1)[0] || '/';
  return cleanPath === '/admin' || cleanPath.startsWith('/admin/');
}
