# Industrial storefront and account release

The public design uses one Vazirmatn font, the existing orange/gray/white palette, industrial photographs, subtle technical grids and restrained translucent surfaces. Header/footer colors remain unchanged.

Home leads with search and three concrete routes (known part, industry, custom manufacturing), then capabilities, FORZA, categories, industries, useful products, brands, ordering steps, knowledge and account entry. No fabricated catalog or stock counters are added.

Industry pages have distinct compositions: ceramic grid, textile weave and split hero, packaging station sequence, food inset hero, machinery technical bench, rubber modular cards. Station selection passes the industry/stage to FORZA. Brand pages support product-field filters. Catalog images retain their actual SKU binding.

## Account behavior

- Registration collects business information, then a chosen username and password. Passwords must have 10–128 characters and differ from the mobile number.
- New self-registered and new CRM users must save brand interests and business type before entering a panel. Onboarding, login and registration have no storefront header/footer.
- The server validates answers and rejects completion without required fields. Failed writes never advance onboarding. Existing completed accounts retain their answers.
- Passwords are hashed and never returned or stored as browser credentials. Existing account passwords remain valid.
- `/inquiry` sends signed-in customers to their permitted panel.

## SMS activation

The server-only Kavenegar transport uses verify/lookup. Configure `KAVENEGAR_API_KEY` and `KAVENEGAR_VERIFY_TEMPLATE` in the existing Railway service; the approved template must accept the verification token. Never use a VITE_ prefix or put provider credentials in source code.

Neither variable was present during this release. Until configured, password login works and SMS requests show an explicit unavailable state. A real handset delivery must be tested after activation.

Challenges use random six-digit tokens, keyed hashes, three-minute expiration, five verification attempts, one-minute resend delay and five requests per phone per hour. IP throttling, CSRF and durable storage apply. Successful tokens are consumed before the signed session is issued. Unknown phone numbers do not create accounts. Provider errors never expose keys or claim success.

## Validation

Type checking, production build, role/CRM persistence tests, chosen-credentials and OTP tests (mock provider; no real SMS sent), full browser registration/onboarding/failure retry/password login, and public route checks at 320/390/768/1440 pixels. External model generation, payments and handset delivery are not reported as successful production integrations.

## Homepage reference refinement

Restores the previous desktop/mobile cinematic hero. The immediate next section is a six-group image category strip, then factual trust links, useful products, the dark industrial supply carousel, existing FORZA/SWR brand banners, a unified FORZA introduction, compact company benefits, knowledge and membership. Header/footer and account logic remain unchanged. Industry imagery is limited to the actual six supported industries, and no unverified volume or customer statistics are added.
