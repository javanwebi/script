# Storefront design

Restores the visual product catalogue and SKU detail layout from 921719a, including image/code/specification/price grouping and mobile purchase controls. Keeps the existing Header and Footer components and their colors. Palette overrides apply only inside main.

Homepage retains the cinematic hero, original brands, categories and industries, adds an illustrated service story explaining supply, manufacturing and technical selection, a purchase path, and image-based assistance. Shared self-hosted Vazirmatn matches customer portals. Portal access controls and content management remain intact.

## Industry, discovery and account access

The homepage now introduces the single FORZA workspace, six image-led industry paths, practical knowledge articles and the account journey. Dedicated industry routes share typography and components but use their own imagery, process stages, technical checklists and related catalog metadata. Brand search and the knowledge index/article routes replace dead header links. The About menu includes direct links and a map, retaining existing header/footer colors.

The shared account form is used in the native modal and standalone login/register pages. It preserves the selected SKU through login/onboarding. Guest prices/stock are removed from public API payloads and the initial JSON bundled by Vite. Authenticated commercial catalog hydration stays in memory, with only public metadata cached on disk; login/logout invalidates it. SKU purchase and inquiry controls live under the role-protected portal route. Requests persist server-side with the session's customer identity and can be reviewed by that customer and the admin.

FORZA retrieval searches the complete current family/SKU catalog and live management overrides. It supplies only relevant technical metadata to the model. When live generation is unavailable, the fallback explicitly identifies itself as catalog retrieval and does not invent prices or availability. The image recognition and voice integrations still depend on their configured external providers.

Map preview: OpenStreetMap tile https://tile.openstreetmap.org/8/166/104.png, © OpenStreetMap contributors, https://www.openstreetmap.org/copyright. The preview is regional, not a verified factory pin; interactive mode and external map links remain available.

Removed the retired `/api/auth` implementation, demo customer seeds, weak password bypasses and user/SMS inspection routes; signed-session `/api/portal` is the sole authentication path. Removed embedded personal demo records and fabricated fallback phone numbers from modified account/admin code. Existing persisted records are unaffected.
