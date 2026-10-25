import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { catalogV2GuestReady, hydratePublicCatalogRoute } from '../../services/catalogClient';

/** Experimental read-only loader, never active for ordinary customers. */
export function CatalogRouteHydrator() {
  const location = useLocation();
  useEffect(() => {
    if (!catalogV2GuestReady()) return;
    const controller = new AbortController();
    void hydratePublicCatalogRoute(location.pathname, location.search, controller.signal)
      .catch(error => {
        if (!controller.signal.aborted)
          console.error('[Catalog V2 preview] Page-scoped fetch failed', error);
      });
    return () => controller.abort();
  }, [location.pathname, location.search]);
  return null;
}
