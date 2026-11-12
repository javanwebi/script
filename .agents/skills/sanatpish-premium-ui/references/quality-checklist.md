# UI release checklist

## Review
- [ ] Actual route and matching header/footer links tested, no duplicate orphan page
- [ ] Existing design tokens and RTL conventions respected
- [ ] Main content and products backed by live authorized data (no invented identifiers)
- [ ] Images map to actual SKU and work with proper alt text/fallback
- [ ] Mobile, tablet and desktop visually reviewed; no overflow or unreadable text
- [ ] Keyboard/focus/form labels and reduced-motion behavior checked
- [ ] Loading/error/empty/retry/success states useful and truthful
- [ ] Search, filter, navigation, cart, RFQ and admin actions work where applicable
- [ ] No regression to auth, data access, routes and endpoints
- [ ] Image payload, unnecessary network requests and CLS evaluated
- [ ] npm run lint and npm run build plus relevant test suites run if environment permits
- [ ] Browser Console/Network and real user interactions checked when browser available
- [ ] Report distinguishes checks actually performed from pending verification

## Signoff
Provide filenames, routes, before/after summary, test commands/results, screenshots if actually captured, risks and outstanding follow-up; never assert production success without visiting production.
