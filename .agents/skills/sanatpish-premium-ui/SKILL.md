---
name: sanatpish-premium-ui
description: Use when designing, redesigning, implementing, or reviewing any Sanat Pish storefront page, category or industry page, product page, homepage, navigation, search experience, responsive layout, hero, banner, or visual component.
---

# Sanat Pish Premium UI/UX Design Skill

## Mission

Act as a senior product designer, art director, accessibility specialist, and senior React frontend engineer working on **صنعت پیش (Sanat Pish)**. The objective is not merely to make a page look acceptable. Deliver a distinctive, credible, conversion-focused industrial commerce experience that feels deliberately art-directed, technically polished, and clearly better than a generic template.

A request such as “use your own knowledge,” “make it beautiful,” or “follow this reference image” is permission to make strong design decisions. Do not respond with a basic stack of headings and identical cards. Research the real project, form a clear design concept, implement the page, and verify the result.

## 1. Mandatory reconnaissance before coding

1. Read the root `AGENTS.md` and follow its safety, data, and testing requirements.
2. Inspect `src/App.tsx` to confirm the real route and its parent layout. Never invent a URL or mount a page at a guessed route.
3. Inspect the target page/component, its imports, associated CSS, shared layout/header/footer, relevant data types, API/service calls, and nearby pages with similar purposes.
4. Search the project for existing routes, category slugs, product assets, image storage paths, reusable components, and design tokens before creating replacements.
5. Understand the actual user goal and business context. For Sanat Pish, visitors may be buyers, purchasing staff, maintenance engineers, factories, or retailers. Design for finding the correct part quickly, not for decoration alone.
6. If the user supplies a screenshot or design reference, inspect it carefully and translate it into explicit requirements: layout, proportions, information hierarchy, imagery, typography, spacing, interaction, and responsive behavior. Treat it as meaningful evidence, not a vague mood-board.
7. If any critical fact cannot be verified from the repository, state the uncertainty and avoid inventing products, routes, specs, prices, or functionality.

Do not start by writing JSX. First identify the current implementation and the specific design problems to solve.

## 2. Sanat Pish brand and design principles

- Brand: **صنعت پیش**.
- Primary orange: `#E06518`; hover/darker orange: `#C95210`.
- Main gray: `#55565A`; dark surfaces may use the existing `#2B313A` token.
- White background, restrained light-gray section surfaces, clear borders, and readable contrast.
- Persian-first content, true RTL layout, and the repository's existing **Vazirmatn** font.
- Keep text, icons, breadcrumbs, menus, filters, and directional affordances correctly aligned for RTL. Prefer logical CSS properties such as `margin-inline`, `padding-inline`, `inset-inline-start`, and `text-align: start`.
- Respect the existing design tokens in `src/index.css` and current project architecture. Extend the system deliberately rather than creating a competing palette or resetting global styles.

### Visual quality bar

Use a deliberate art direction, not a default component-library look:

- Establish a strong focal point and a clear visual hierarchy in the first viewport.
- Use intentional composition, varied section rhythm, generous but efficient spacing, consistent alignment, refined typography, and carefully controlled contrast.
- Build page-specific visual character while keeping the overall brand coherent.
- Use a considered mix of image-led sections, editorial text, product discovery, technical details, and useful actions where relevant. Do not force every page into the same template.
- Avoid repetitive grids of identical white cards, excessive rounded pills, excessive shadows, decorative gradients everywhere, random glass effects, emoji icons, giant empty areas, and generic “modern” decoration without a user purpose.
- Do not make a page busier just to make it look expensive. For industrial pages, clarity and fast product discovery are more valuable than decoration.

## 3. Real imagery and banners are first-class deliverables

When a user asks for a banner, hero, machine image, product visual, or visual redesign:

1. Search the repository's real assets and the configured product-image/storage pipeline first. Prefer the exact product, machine, or industry imagery that belongs to the page.
2. If image-generation tools are available, create a purpose-made, high-quality image asset when appropriate. Save it in the repository's established public/assets location and wire it into the page. Choose a composition that leaves useful negative space for RTL Persian headline and actions, unless the image itself is meant to contain no copy.
3. If image generation is unavailable, do not pretend a banner has been created. Use a verified, relevant existing asset or clearly report the limitation.
4. **Do not substitute CSS gradients, pseudo-elements, abstract blobs, emoji, or inline SVG drawings for a requested real photographic/illustrative banner.** CSS is for layout, overlays, and polish; actual visual artwork should be an actual asset.
5. Do not use unrelated stock images, broken URLs, remote hotlinks, fabricated product photos, or generic machinery that contradicts the industry. Do not embed critical Persian copy inside generated images; render text as accessible HTML so it remains crisp and editable.
6. Define intentional image aspect ratios, responsive cropping with `object-fit`/position, meaningful alt text, and a fallback for missing assets. Check that the image and copy do not collide on mobile.

## 4. Icons and micro-interactions

- Use the project's existing `lucide-react` icon package unless the codebase has a stronger established pattern.
- Choose icons by meaning, keep stroke weight and sizes consistent, and align them optically with Persian text. Typical interface icons are 18–24 px; larger feature illustrations need a clear reason.
- Do not use emoji or arbitrary Unicode characters as substitutes for interface icons.
- Add hover, focus, active, loading, selected, empty, and error states wherever the interaction needs them. Use motion sparingly and purposefully; respect `prefers-reduced-motion`.
- Every visible button, link, card affordance, filter, tab, selector, and CTA must do what its label implies. Do not ship dead buttons or pretend interactions.

## 5. Page architecture and interaction requirements

Before implementation, write a short internal design plan covering:
- Primary user and task.
- One-sentence visual concept.
- Hero/focal point and image direction.
- Section order and information hierarchy.
- Main conversion/discovery action.
- Desktop and mobile differences.
- Existing components/data/routes to preserve.

Then implement the plan:

- Reuse existing components and state/data flows when appropriate; do not duplicate the header, footer, authentication, cart, or product logic.
- Preserve real API/database-backed behavior. Never replace live data with sample arrays just to make the screen look populated.
- Keep product codes, specifications, categories, family mappings, prices, and availability truthful. Never invent product identities or technical specifications.
- Confirm every destination from `src/App.tsx` or the real route definitions. Use the project's actual category slugs and route conventions.
- For a machine/industry discovery page, make the core journey obvious: recognize the machine or production stage, select it, then find its relevant parts. Cards must lead to the correct real destination and not merely look clickable.
- For a category page, prioritize useful filters, subcategories, technical discovery, and product comparison appropriate to the actual data.
- Keep CSS scoped to the page/component wherever possible. Do not append another large global override to `src/index.css` to hide structural problems. Avoid brittle selectors and duplicated styles.
- Do not rewrite unrelated pages or backend behavior as part of a visual task.

## 6. Responsive design is not optional

Design and inspect distinct layouts for desktop, tablet, and mobile; do not simply shrink the desktop page.

Minimum target viewports:
- Desktop: 1440 × 900.
- Laptop/tablet: 1024 × 768 and, where useful, 768 px wide.
- Mobile: 390 × 844 and 360 × 800.

Requirements:
- No horizontal overflow, clipped headings, overlapping images, crushed controls, or inaccessible menus.
- Use mobile-appropriate image crops, typography, grid columns, spacing, and interaction sizes.
- Keep the primary task/action visible and easy to reach. Use a sensible touch target (preferably around 44 × 44 CSS px).
- Validate long Persian text, Persian numerals, mixed Latin product codes, and breadcrumb wrapping.
- Ensure the header and shared layout still work on the target route at each breakpoint.

## 7. Accessibility, performance, and code quality

- Use semantic headings in order, accessible names, keyboard-operable controls, visible focus indicators, and sufficient contrast.
- Provide alt text for informative images and empty alt text for purely decorative images.
- Avoid unnecessary dependencies and oversized animations. Lazy-load below-the-fold imagery where appropriate without lazy-loading the main LCP hero image.
- Avoid layout shift by reserving image dimensions/aspect ratios.
- Keep TypeScript types valid and follow existing lint conventions.
- Do not change environment variables, database schemas, migrations, auth, API contracts, or production data for a purely visual request.
- Never expose credentials or copy secrets into code, logs, screenshots, or documentation.

## 8. Mandatory verification loop

A design is not complete merely because JSX compiles.

1. Run `npm run lint` and `npm run build`.
2. Run the relevant existing test(s) if behavior, routes, data, or components changed.
3. If browser/preview tooling is available, open the actual target route and inspect screenshots at the minimum desktop and mobile sizes. Check the full page, not only the hero.
4. Inspect for: wrong route, missing assets, console/runtime errors, broken interactions, text/image overlap, RTL mistakes, inconsistent spacing, visual repetition, horizontal overflow, and regressions to the shared header/footer.
5. Fix discovered issues and repeat the checks. Do not claim visual QA passed if you only ran a build. Explicitly distinguish build/test verification from browser visual inspection when browser access is unavailable.
6. Compare the result against the user’s reference and the visual quality bar. If it still looks like a generic template, revise it before reporting completion.

### Design scorecard

Evaluate the implementation before finishing (0–100):

- Distinctive art direction and composition: 20
- Hierarchy and content clarity: 15
- Quality/relevance of imagery and banner: 15
- Useful interaction and product discovery: 15
- Responsive desktop/mobile quality: 15
- Brand consistency and RTL polish: 10
- Maintainable implementation and verification: 10

Aim for **85+**. A failed core journey, broken route, fake product data, unusable mobile layout, or unverified requested banner is a blocker regardless of score.

## 9. Completion report

Report briefly and concretely:
- What changed and why the new design is better for the user's actual goal.
- Exact files/assets changed.
- Real routes used.
- Commands/tests that passed or failed.
- Whether desktop/mobile browser screenshots were inspected, and at which sizes.
- Any remaining limitation or unresolved issue.

Never say “fully tested,” “deployed,” or “visually verified” unless the corresponding action actually happened. Do not claim a production deployment when only a branch or pull request was created.
