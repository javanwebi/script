/** The commerce dock is for browsing and shopping, not isolated workflows. */
const SHOPPING_SECTION_PREFIXES = [
  "/products",
  "/categories",
  "/category",
  "/product",
  "/direct-product",
  "/search",
  "/cart",
  "/wishlist",
  "/favorites",
  "/industries",
  "/industry",
  "/brands",
  "/knowledge",
  "/about",
  "/about-us",
  "/history",
  "/licenses",
  "/awards",
  "/contact",
  "/contact-us",
  "/factory-address",
  "/address",
] as const;

/** Segment boundaries prevent /productivity or /cartoon matching /product or /cart. */
export function isStorefrontBottomNavRoute(pathname: string): boolean {
  if (pathname === "/") return true;
  const pathnameWithoutTrailingSlash = pathname.replace(/\/+$/, "") || "/";
  return SHOPPING_SECTION_PREFIXES.some(prefix =>
    pathnameWithoutTrailingSlash === prefix || pathnameWithoutTrailingSlash.startsWith(prefix + "/")
  );
}
