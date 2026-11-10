/**
 * Keep an authenticated customer's intended cart/checkout/SKU route after login.
 * Never treat an unauthenticated, user-supplied path as an external navigation target.
 */
export function resolvePostLoginDestination(
  root: '/account' | '/consumer-dashboard',
  explicitReturnTo: string | undefined,
  savedDestination: string,
): string {
  const safeLocal = (value: string) =>
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('\\') &&
    !/[\r\n]/.test(value);

  const requested = explicitReturnTo && safeLocal(explicitReturnTo)
    ? explicitReturnTo
    : savedDestination;

  if (!safeLocal(requested)) return root;

  const productRoute = /^\/(?:account|consumer-dashboard)\/product\/([^/?#]+)(?:\?.*)?$/.exec(requested);
  if (productRoute) return root + '/product/' + productRoute[1];

  if (/^\/(?:cart|checkout)(?:[/?#]|$)/.test(requested)) return requested;

  // The standalone login/register route historically supports arbitrary
  // explicit local returnTo pages; do not alter those legitimate flows.
  if (explicitReturnTo && safeLocal(explicitReturnTo) && !/^\/admin(?:[/?#]|$)/.test(explicitReturnTo)) {
    return explicitReturnTo;
  }

  return root;
}
