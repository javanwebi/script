# Industrial Belt Manufacturer Evidence Audit — 2026-11-17

## Purpose and evidence policy

This document records the manufacturer-source corrections applied to the industrial belt catalog audit. The objective is not to make every inventory row appear manufacturer-verified. It is to assign the strongest evidence that actually exists and preserve uncertainty where the stock label, printed code, or official source is insufficient.

A manufacturer catalog can confirm a **brand + product series + profile** without proving the exact SKU's article number, length, width, compound, tensile cord, cover, rib count, tooth count, or construction. Such records are classified as `SERIES_VERIFIED`, not `DATASHEET_VERIFIED`.

No production database write or migration is part of this source-evidence change. The live FAM/PFAM generation boundary remains a separate deployment gate.

## Evidence levels

| Level | Meaning | What it does not mean |
|---|---|---|
| `DATASHEET_VERIFIED` | Exact inventory SKU/article code matched to the same manufacturer's official datasheet or catalog table | Not inferred from brand name or a generic product page |
| `SERIES_VERIFIED` | Official manufacturer source confirms the product family and profile used by the inventory record | Does not prove exact SKU dimensions or material construction |
| `NOMINAL_TABLE_VERIFIED` | A standard/nominal table or explicit cross-reference supports the designation or geometry | Does not prove the stock manufacturer's identity |
| `ALGORITHMIC_STANDARD_ONLY` | Classification follows parsed geometry/profile and an applicable standard | No manufacturer catalog match is claimed |
| `REQUIRES_REVIEW` | Printed belt marking, invoice, or physical inspection is required | Must not be force-assigned to a family |

## Official source matrix

### SWR

Primary sources:

- [SWR official product range](https://www.swr-europe.de/sortiment.php?lang=en)
- [SWR official product brochure](https://www.swr-europe.de/download/SWR_Imagebroschuere_en.pdf)

The brochure supports the following families and profile groups:

- Classical wrapped V-belts: Z, A, B, C, D, E.
- Classical raw-edge cogged: ZX, AX, BX, CX.
- Wedge: SPZ, SPA, SPB, SPC.
- RMA/US wedge: 3V, 5V, 8V.
- Raw-edge cogged narrow wedge: XPZ, XPA, XPB, XPC, 3VX, 5VX.
- Banded variants for the profiles shown in the brochure.
- Double-V/hexagonal: AA, BB, CC.
- Multi-rib: PJ, PK, PL, PM.

Do **not** extend this evidence to 8VX, AX-BANDED, CRC/TRC, or unrelated product labels. Those remain unverified unless another exact source is found.

### Optibelt

Primary source:

- [Optibelt Power Transmission Product Range](https://www.optibelt.com/fileadmin/pdf/produkte/keilriemen/Optibelt-product-range.pdf)
- [Optibelt Technical Manual — Rubber Timing Belts](https://www.optibelt.com/fileadmin/pdf/produkte/zahnriemen-gummi/Optibelt-TM-Rubber-Timing-Belt-Drives.pdf)

These official Optibelt catalogs document, among other lines:

- Classical V-belts and wedge belts.
- Raw-edge cogged V-belts and narrow wedge belts.
- KB/KBX banded belts.
- ZR imperial timing profiles MXL/XL/L/H/XH/XXH and double-sided DXL/DL/DH; OMEGA 2M/3M/5M/8M/14M, STD S5M/S8M/S14M and double-sided D5M/D8M/D14M/DS8M.
- ALPHA polyurethane timing families.
- RB ribbed belts and DK double-V belts.
- ZRK automotive timing-belt family.

The supported profile families may receive series-level evidence. The source does not convert every inventory size into an exact Optibelt article number.

ZRK handling:

- Four AUTO-RU candidates are treated as **ZRK series-level only**.
- Four additional candidate SKUs (31502, 31504, 31505, 31506) remain nominal/print-check records until the printed belt marking is read.
- SKU 35023 has an 8.0 mm pitch and remains separate from the 9.525 mm AUTO-RU candidates. It is not forced into ZRK.
- No exact ZRK SKU-specific datasheet claim is made.

### Megadyne

Primary sources:

- [Megadyne Corporate Product Guide](https://megadynegroup.com/files/resources/attachments/md_manu_en_product_guide_web_0.pdf) — includes MEGASYNC timing belts, V-belts, multi-rib belts, MEGAPOWER, MEGAFLEX and MEGALINEAR.
- [Megadyne MEGALINEAR product range](https://megadynegroup.com/en/products/timing-belts/polyurethane-open-end/megalinear/)
- [Megadyne PV Rubber Ribbed](https://megadynegroup.com/de-de/products/multi-rib-belts/pv-rubber-ribbed/)
- [Megadyne technical resources](https://megadynegroup.com/en/resources/?type=8)

These sources support series/profile-level classification for:

- Wrapped, wedge, raw-edge cogged and banded V-belt families.
- MEGASYNC imperial, HTB/STD/RPP, Silver3, Gold2 and double-sided families.
- MEGALINEAR T/AT and MTD polyurethane timing profiles.
- PV Rubber Ribbed PH/PJ/PK/PL/PM sections.

Important correction:

- The token **TNX** appears in inventory descriptions but was not found as an official Megadyne product series in the sources checked.
- TNX is therefore not manufacturer-verified.
- SKU 58129 is supported only as a Megadyne PJ-section multi-rib belt by the official PV Rubber Ribbed range. This is not an exact TNX datasheet match.
- Where a Megadyne record includes TNX, the evidence note explicitly preserves that uncertainty.

### BANDO

Primary source:

- [Bando Industrial Power Transmission Products — Catalog Vol. 2](https://www.bandousa.com/media/uploads/0/114_BUI-1009_Industrial-Power-Transmission-Products-catalog-Vol-2_9-17.pdf)

The official catalog covers Bando Power King, Power King Cog, Power Ace, Power Ace Cog, Power Scrum banded, Double-V, Rib Ace, Synchro-Link and related timing-belt product families.

Eleven H/DH inventory records have Bando profile-level support for the H/DH section, geometry and construction. The catalog does not establish an exact manufacturer article-number match for the internal inventory SKU codes; all eleven are therefore SERIES_VERIFIED, not DATASHEET_VERIFIED.

### DONGIL / DRB

Limited source:

- [DRB/DONGIL SUPER STAR REC product page](https://www.drbworld.com/industrial/index.php?CgCode=004&idx=52900&mode=fdn&num=1&pCode=MN0000028)

This source supports the explicitly marked SUPER STAR REC raw-edge cogged V-belt family (including the B-74 example). It must not be generalized to every DONGIL inventory code. Generic DONGIL records remain standard/algorithmic unless the REC marking is present.

## Cross-reference correction: SKU 42209

Source:

- [JIKIU 123RU24 catalog entry](https://www.jikiu.jp/catalogue/557384)

The page provides a nominal 123RU24 cross-reference and geometry, including 123 teeth, RU profile, 24 mm width and 9.525 mm pitch, with Mitsubishi MD154243 / Gates T204 references.

The stock record does not establish its manufacturer. Therefore:

- `matchedManufacturer = null`
- The source is recorded as a nominal cross-reference only.
- Neither JIKIU nor Mitsubishi is assigned as the inventory brand.
- This is not an exact manufacturer datasheet match.

## Explicitly unverified items

The following must not be promoted to manufacturer-series evidence merely because the text looks similar:

- SWR 8VX, AX-BANDED and CRC/TRC records not supported by the cited SWR profile tables.
- Optibelt AUTO-8MM records not matched to the ZRK AUTO-RU series.
- Megadyne TNX as a named manufacturer series.
- Generic DONGIL records without the explicit REC marking.
- FORZA, GNR, MARSHAL, M.T and HANCHANG records for which no authoritative official catalog entry was matched to the stock code in this research pass.
- Similar spellings across different brands (for example, MARSHAL vs. MARSHALL) must not be merged without exact identity evidence.

These records can still be classified by profile, pitch, geometry and applicable ISO/DIN/RMA/ARPM standards, but remain `ALGORITHMIC_STANDARD_ONLY` or `NOMINAL_TABLE_VERIFIED` as appropriate.

## Family construction rules

A family is based on technical identity, not on a convenient shared word or brand:

1. Keep different belt principles separate: V-belt, synchronous/timing, ribbed/poly-V, flat, conveyor, round, welded PU, and other types.
2. Keep different profile/pitch/tooth geometries separate.
3. Keep different construction and material systems separate when supported by data (wrapped vs. raw-edge, rubber vs. PU, cord type, backing/cover, fabric, special coating).
4. Keep single-sided and double-sided timing belts separate.
5. Keep different rib counts separate when rib count is a defining product specification.
6. Length and width variants may remain in one family only when the technical identity and all family invariants match.
7. Missing manufacturer data must remain unknown; do not infer a material or cord from a brand name alone.
8. A singleton is valid when the available evidence does not justify merging it with another family.

## Change and deployment boundary

This evidence registry changes source classification and audit provenance only. It does not authorize a production database migration.

Before any production write:

- Read-only inspect the actual live catalog generation.
- Reconcile FAM versus PFAM identifiers without assuming they are interchangeable.
- Verify the live SKU-to-family links and direct-product records.
- Generate an idempotent migration against the verified live generation.
- Back up, test, and preserve rollback before deploying.

The current work must pass repository tests and CI before any merge/deploy recommendation.
