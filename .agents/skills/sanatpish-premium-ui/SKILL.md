---
name: sanatpish-premium-ui
description: Design, redesign and implement distinctive production-ready Persian RTL industrial commerce pages for Sanat Pish. Use for category pages, product discovery, storefront, admin dashboards and responsive UI changes in javanwebi/script.
---

# Sanat Pish Premium UI — design and implementation contract

## Mission
Act as a senior visual designer, UX researcher, frontend engineer, and commerce interface architect. Produce original, polished, usable, fast **implemented** experiences for صنعت پیش. Do not make a generic AI template, screenshot-only mockup or unconnected demo.

Before work, read repository `AGENTS.md`, inspect current page routes, existing components, CSS, assets, API/data flow, and comparable pages. Follow `AGENTS.md` if a conflict exists. Read the topic-specific documents in `references/` as needed.

## Inspiration: principles, not copied templates
Study optional sources:
- Anthropic Frontend Design: https://github.com/anthropics/skills/tree/main/skills/frontend-design
- UI/UX Pro Max: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill

Borrow only strong principles: original concepts, intentional typography, visual hierarchy, spacing, composition, accessible interactions, component states, responsive layout, and quality gates. **Never reproduce source website layouts, themes, stock visual patterns, or components verbatim.** Existing Sanat Pish identity and business behavior take precedence.

## Immutable project identity
- Brand: صنعت پیش (Sanat Pish). Primary orange `#E06518`, neutral gray `#55565A`, white surfaces; reconcile with existing tokens rather than randomly shifting brand colors.
- Persian language, full RTL layout, natural Persian microcopy; Persian numerals where the site convention uses them. Technical SKUs, codes, measurement units and mixed LTR identifiers must remain legible and intact.
- Industrial authenticity, not generic SaaS aesthetics. Use actual belts, pulleys, power transmission, sealing, hoses, textile, ceramic and packaging contexts where relevant.
- Both B2B factories and B2C retail customers need fast product discovery, accurate technical specifications and actionable consultation/RFQ.
- Honor existing headers, route links, breadcrumbs, category structures, login, cart and AI discovery entry points. Preserve working behavior unless specifically asked to change it.

## Required workflow — follow in sequence
1. **Audit:** identify actual route(s), component ownership, responsive behavior, related pages, data sources, existing assets, errors, and performance issues. Do not assume a requested visual is a new route.
2. **Design rationale:** define page audience, primary action, information priority, and one page-specific visual concept. Explain briefly why it suits industrial purchasing. Use reference guidance from `references/visual-design.md` and `references/ux-patterns.md`.
3. **Content truth:** map every product, family, SKU, price and image to actual APIs/database/storage. Never invent product codes, availability, prices, certifications or customer claims. Provide deliberate missing-data UI.
4. **Visual assets:** reuse authentic catalog assets when suitable; generate or source fitting hero imagery only when available and licensed/authorized. CSS is for layout and decoration, not for faking the main industrial product/hero photograph. Ensure reasonable crop, responsive formats, alt text and loading priority.
5. **Implementation:** edit the existing React 19 / Vite / TypeScript code and styles coherently; leverage installed lucide-react and motion only if justified. No cosmetic duplicate routes or orphan components. Avoid regressions in shared page elements.
6. **Responsive design:** design purposeful desktop and mobile arrangements rather than simply shrinking desktop. Test at representative widths and verify full RTL, touch targets, navigation, image cropping and overflow. See `references/responsive-design.md`.
7. **Quality:** check keyboard support, focus, forms, loading/empty/error/success states, contrast, layout shifts and asset sizes. Follow `references/quality-checklist.md`.
8. **Verify honestly:** when execution is available run `npm run lint`, `npm run build` and relevant tests. Inspect browser console, network and mobile/desktop visual behavior when browser access exists. Distinguish unit/build success from tested production.
9. **Deliver:** report precise route(s), edited files, assets, key UX changes, test commands/results, outstanding issues and deployment/commit status. Never claim to have deployed, tested hardware, or generated images without evidence.

## Backend/database boundaries
Follow `AGENTS.md`: real PostgreSQL/Supabase is source of truth, inspect adopted schema first, preserve data, do not use JSON as authoritative commerce data or fall back to it during outages. Never make production DDL, destructive updates, storage migration or permissions changes as a side effect of UI work. API authorization, RLS and server-side secrets stay intact. No invented catalogs.

## Practical page priorities
- Product/category pages: clear taxonomy, visual product cards backed by real images, SKU/spec comparison, filters, search, relevant families and direct-to-subcategory products without mandatory families.
- Industry pages: authentic equipment-context hero, application-led navigation, meaningful product links and technical value.
- AI visual identification / FORZA: understandable input and progress, accessibility, honest confidence labeling, failure/retry states; never imply a visually similar part is verified identical.
- Admin: readable information density, searchable selectors, image previews, safe CRUD, role-aware confirmation and helpful empty states.
- Homepage: unmistakable value proposition, technical search, clear customer pathways and functional responsive mega-menu.

## Operating rules
- Prefer substantial, relevant page-wide compositions but never add filler sections purely to make pages long.
- Respect user-provided screenshots as intent and inspect real UI before rewriting.
- No fake testimonials, data, stock numbers, brands or performance claims.
- Keep images out of GitHub if established storage workflow requires persistent storage; follow current asset pipeline.
- No unrelated refactor. Avoid needless dependencies. Preserve API endpoints, page route aliases and database contract.
- Prioritize real speed: trim JS, avoid unnecessary requests, render sensible loading states and optimize images.
- Do not silently modify global tokens or brand logo while working on a single page.

## Example invocation
"طبق `.agents/skills/sanatpish-premium-ui/SKILL.md` صفحه [مسیر واقعی] را بررسی، کانسپت اختصاصی طراحی، در سورس پیاده‌سازی و موبایل/دسکتاپ را تست کن. قوانین AGENTS.md و داده‌های واقعی را رعایت کن. در پایان تغییرات و محدودیت‌های تست را گزارش کن."
