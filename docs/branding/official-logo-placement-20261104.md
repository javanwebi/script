# Sanat Pish brand placement (2026-11-04)

This is a UI-only update. Do not replace the company's visual identity with text, emoji, generic gear or AT placeholders. All real product/currency/customer data remain in PostgreSQL/Supabase.

## Corporate identity

- Main header on desktop: `src/assets/logo.png`, surfaced as `STORE_ASSETS.sanatPishLogo`. The existing mobile lockup `public/images/mobile-header-logo.png` stays unchanged because it was previously supplied specifically for the tight mobile header.
- Consumer + B2B account shell: `src/components/common/BrandIdentity.tsx` `SanatPishLogo`, in the sidebar and mobile account header. The account header uses a light frame for contrast with the orange industrial background.
- Admin login/sidebar, consumer login/registration, and mobile category/support sheet: the same official corporate asset. Brand-text paragraphs, copyright text, company names and meaningful page headings remain real text (not decorative duplicate logos).
- Footer: `SanatPishFooterLogo` **attempts `/logo2.png` first** in both the main brand column and copyright bar. The requested `logo2.png` file **is not present in GitHub as of this change**, so this component falls back to the verified official `STORE_ASSETS.sanatPishLogo` image instead of showing a broken logo. The real second logo must be added at `public/logo2.png` (not replaced by a guessed or fabricated image) to enable the preferred footer artwork. No requirement to change JSX after the asset is added.

## FORZA identity

- `src/assets/forza-workspace-mark.svg` is a lightweight vector outline drawn from the user-supplied orange-and-white triangular FORZA mark. It is intentionally separate from the corporate identity.
- `CognivoGeometricLogo` keeps its exported component name for compatibility, but now renders this user-directed FORZA mark rather than the earlier placeholder icon. It is used in the workspace sidebar, workspace topbar, initial welcome and floating launcher.
- The source upload is available only in this conversation; the small vector is an approximation traced from the upload. For an exact pixel-for-pixel match, a future repository binary upload of the original PNG/optimized WebP may replace this derivative without touching its call sites.

## QA

Run `npm run lint && npm run build`, `node --import tsx --test tests/official-brand-logo-placement.test.ts`, and `node scripts/tests/consumer-portal-responsive-smoke.cjs` using the standard GitHub Actions preview. For live-site assurance confirm `logo2.png` exists in the deployed build before claiming its use.
