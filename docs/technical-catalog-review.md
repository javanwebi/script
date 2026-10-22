# Technical catalog review

All 10,435 original SKUs are processed individually by productTechnicalData.ts. Original names, sizes, warehouse codes, financial fields and image bindings are preserved.

Current coverage after the owner-catalogue pass: 2,523 SKUs with reference enrichment; 5,512 with a readable model/designation or explicitly labelled catalog part code; 2,400 requiring model identification. None of these counts certifies the actual manufacturer's product.

Classification paths include category, subgroup, technical type and model where readable. Narrow V belts, classical V belts, ribbed belts, timing belts, bearing bore codes and B-series chain pitches use separate rules. Other parts retain explicit material/color/construction/dimension descriptions. Unitless dimensions remain unitless.

Each SKU contains sources and per-field evidence, displayed in the product page and admin editor. The admin products screen downloads the full technical review as JSON. CLI: node --import tsx scripts/audit-product-technical-data.ts --records

Do not turn warehouse SKUs into manufacturer part numbers. Do not infer load, speed, temperature, chemical resistance, bearing outer diameter/width, belt inside/outside lengths, exact compounds or certification from generic names. Timing tooth geometry cannot be identified by pitch alone. Manufacturer datasheets or readable markings/drawings are required to resolve these gaps.

Reference dimensions describe the referenced profile rather than a guarantee about the stocked product. Manual specifications override extracted values; changed admin values are identified as admin evidence.

## Second research pass, 2026-10-19

Of the original 5,100 unresolved SKUs, 2,642 now have a readable catalog part code or interpretable designation; 2,458 remain unidentified. No previously identified SKU was silently relabelled unidentified in this pass. All 10,435 SKUs remain intact.

New rules distinguish proprietary catalog markings from manufacturer standard designations, decode imperial timing profiles H/L/XL/XH and double-sided DH/DL/DXL, and classify the leading part noun rather than a secondary word (a pulley for a belt is not a belt). For 1000H100, the reference convention gives pitch length 2540 mm, width 25.4 mm and 200 teeth. If a rounded historical length would produce a fractional tooth count, a length is not published.

The current standard reference for imperial trapezoidal synchronous drives is ISO 19347:2015. ISO 5296:2012 is withdrawn and is not presented as a current conformity standard. ISO 3601-1, ISO 7089 and ISO 606 appear only as conditional comparison references for relevant part types. Their presence never claims that the stocked part conforms. KTR ROTEX references are only added when that name is explicitly present; spider material, hardness and authenticity are not inferred from color.

405 unresolved photos were reviewed as 25 visual morphology groups. Each file now has a shape description, required measurements, an unchanged-source checksum, and an explicit no-exact-SKU/no-standard-confirmation status. These groups do not merge the photographed items into one purchasable family or assign guessed SKUs.

Evidence is reproducible with scripts/audit-product-technical-data.ts and scripts/research-unassigned-images.py. Exact identity for unmarked proprietary shapes still requires the illustrated numbered manufacturer/owner catalog or a drawing-code crosswalk.

Primary references checked:
- https://www.iso.org/standard/64662.html
- https://www.optibelt.com/fileadmin/pdf/produkte/zahnriemen-gummi/Optibelt-TM-Rubber-Timing-Belt-Drives.pdf
- https://www.iso.org/cms/live/live/en/sites/isoorg/contents/data/standard/05/60/56001.html
- https://www.iso.org/standard/58043.html
- https://www.iso.org/standard/13666.html
- https://committee.iso.org/cms/live/live/en/sites/isoorg/contents/data/standard/06/12/61232.html
- https://www.ktr.com/us/en/products/rotex-torsionally-flexible-jaw-couplings/rotex-standard/
- https://iskbearing.com/product-details/62200


## کنترل مجدد کدهای اصلی

تمام ۲۶۴۲ ردیف تازه استخراج‌شده دوباره با دادهٔ اصلی مقایسه شد. تعداد کدهای انبار قبل و بعد ۱۰۴۳۵ است؛ هیچ کد انباری اضافه یا تغییر نکرده است. آزمون حفظ کامل مجموعهٔ کد، نام و اندازهٔ اصلی نیز اجرا می‌شود. همهٔ مقادیر catalogPartCode از خود نام اصلی خوانده شده‌اند؛ این فیلد کد جدید یا تأیید هویت سازنده نیست. عنوان مبهم «کد اختصاصی» به «کد موجود در نام اصلی کالا» اصلاح شد.

۴۰۵ تصویر همچنان فقط بررسی ظاهری دارند و به کد دقیق کالا متصل نشده‌اند؛ نام فایل‌های e(N).png شاهد تطبیق با SKU نیست.

## Primary-table audit, 2026-10-19

The fixed cohort in `src/data/technicalResearchCohort.json` contains exactly the same 2,642 existing warehouse identifiers discussed in the previous pass. `node --import tsx scripts/audit-research-cohort.ts --write` regenerates the row-by-row `docs/technical-research-2642.json` report.

Results: **913** rows have a nominal length/profile listed in the checked primary tables; **1,139** retain an original drawing/catalog marking only; **590** still lack sufficient manufacturer identity (including 419 imperial designations not listed in these particular tables). A missing table entry does not prove a product is invalid or unavailable. **Zero** exact stocked-item identities are certified by this audit. This was full-cohort comparison with primary-source data, not 2,642 independent web searches or physical inspections.

The 581-entry reference lookup is reproducibly extracted from the official Optibelt and Mitsuboshi manuals, retaining their download checksums and actual PDF page numbers. It is not a list of new inventory codes. Supplemental Mitsuboshi references apply only to the profiles explicitly listed, including double-sided construction only where the table states it.

Corrections:
- Historical rounded L/DL codes use the printed reference length: 187L / 187DL = 476.25 mm and 50 teeth. No direct multiplication of the rounded designation is used.
- Unlisted lengths are withheld rather than calculated as though existence of that manufacturer model had been proved.
- The checked Optibelt 817L row is internally inconsistent (printed length versus pitch × tooth count); it is retained as a conflict, not silently corrected.
- MXL numerical conventions differ between the two manufacturers. An unspecified-brand MXL name no longer yields a presumed length. The Optibelt-specific convention is used only when Optibelt is explicitly named in the original description.
- Wheels with O-ring coatings and cast housings holding diaphragms are classified by the actual leading part name. A mating part's polymer is no longer copied as the body's material.
- ROTEX numbers absent from the current KTR Standard table are flagged, retaining the original number. No nearest-size substitution, hardness, torque or authenticity is inferred.
- The Volta March 2026 profile brochure is provided as a conditional comparison for explicitly named Volta weldable belts; generic A/B/C/CRC labels do not establish a specific compound or rating.

Current whole-catalog extraction totals: 2,523 reference-enriched; 5,512 catalog-extracted; 2,400 requiring identification. These are extraction states, not verified manufacturer identities.

Additional primary sources inspected:
- https://global.mitsuboshi.com/assetFiles/timing_belt_design_manual_en.pdf
- https://www.voltabelting.com/wp-content/uploads/VRound-Profiles-CAT503EN00-Ver.Q.March-2026.pdf
- https://www.ktr.com/us/en/products/rotex-torsionally-flexible-jaw-couplings/rotex-standard/


## Owner catalogue reconciliation, 2026-10-19

The supplied 107-page illustrated Atlas catalogue (SHA-256 `2064bb6a4763c0e41f41bd4adc005bcf8f43591174a8e71850cab15741720a3a`) was inspected page by page. Eight existing family classifications were corrected; original warehouse identifiers, SKU names and sizes remain unchanged.

The pin drawing on PDF page 105 and dimension table on PDF page 106 (printed page 88) provide exact existing-code evidence for 31 rows in the fixed research cohort. Symbols 2R/W/h/2r and millimetre units are retained without inventing geometric interpretations. Duplicate code 90155 has conflicting 2r values (13/14 mm), so its dimensions are withheld. Catalogue code 90148 does not exist in the imported inventory and was not created.

143 of the 405 unresolved photographs match the same photograph and group heading in the supplied catalogue. These are searchable in the admin image audit. This verifies the catalogue group, not the warehouse SKU, model or size. No guessed photo-to-SKU bindings were added.

Additional official MISUMI H-profile tables support nominal reference lengths for 217 more cohort rows. The current 2,642-row report contains 1,130 nominal-length reference matches, 31 owner-table dimension matches, one owner-table conflict, 1,107 original-marking-only rows and 373 incomplete manufacturer identities. Exact manufacturer identities verified: zero. These remaining cases require a legible marking, manufacturer drawing or an inventory-to-catalogue crosswalk; they are not presented as completed identifications.

Source pages for the additional reference table:
- https://th.c.misumi-ec.com/book/THA_EconomySeries_e-catalog2023_2nd/files/basic-html/page604.html
- https://th.c.misumi-ec.com/book/THA_EconomySeries_e-catalog2023_2nd/files/basic-html/page605.html

Earlier counts above describe historical passes, not current completion claims.
