# Responsive RTL reference

- Audit at compact mobile (~360px), common mobile (~390px), tablet (~768px), laptop (~1280px) and wide desktop (~1440px); adjust for actual breakpoint system.
- Preserve coherent Persian RTL reading order, logical CSS properties and accessible DOM/tab order. Isolate mixed-direction SKUs, model codes, units, prices, email addresses and URLs.
- Build mobile-specific header/search/menu interactions where needed. Use accessible drawers and ensure modals/dialogs do not trap scroll unintentionally.
- Use fluid grids and measured image aspect ratios, no clipped product titles or horizontal document overflow. Touch areas should generally reach 44x44 CSS px when feasible.
- Keep hero focal points in view on small screens and avoid hiding critical specs or CTAs. Respect reduced motion and avoid excessive glass/blur.
