# Industrial belt family engineering review — 2026-11-17

## Scope

This change corrects the engineering taxonomy and source handling for the belt catalogue. It does not claim that every internal inventory code has been matched to an exact manufacturer part number. Manufacturer catalogue evidence is recorded at series/profile level; exact SKU, length basis, compound and cord remain unverified unless the specific manufacturer's datasheet or belt marking is available.

## Manufacturer evidence

- SWR Europe official V-belt brochure: https://www.swr-europe.de/download/SWR_Imagebroschuere_en.pdf
  - Wrapped wedge profiles: SPZ, SPA, SPB, SPC (DIN 7753/1).
  - RMA/MPTA wedge profiles: 3V, 5V, 8V.
  - Banded V-belts: 3V, 5V, 8V and SPZ, SPA, SPB, SPC.
  - Double-V belts: AA, BB, CC.
  - Raw-edge cogged wedge profiles: XPZ, XPA, XPB, XPC.
  - Raw-edge cogged American wedge / banded profiles include 3VX and 5VX. The brochure does not list 8VX; 8VX must not be marked as SWR-catalogue-verified.
- Esbelt ceramics application page: https://www.esbelt.com/en/sectors/industrial/ceramics/
  - Confirms that ridge-top belts are used to carry tiles through liquid glaze in ceramic production.
  - This is application evidence only. It does not prove that a particular SWR/CRC inventory code is an Esbelt product, nor establish its compound, cord, dimensions or formal standard.
- Esbelt thermoweldable belt page: https://www.esbelt.com/en/products/thermoweldable-belts/
  - Distinguishes round, trapezoidal, pentagonal and ridge-top thermoweldable belt forms. This supports keeping round PU welded belts separate from crowned/ridge-top CRC/TRC profiles, but is not an exact SKU match.

- Mitsuboshi official V-belt design manual: https://global.mitsuboshi.com/assetFiles/v-belt_design_manual_din_en.pdf
  - Identifies Double-V sections AA, BB and CC under DIN 7722 / ISO 5289 / RMA IP-21 and provides the AA section dimensions. This supports the AA profile standard, not the compound or reinforcement of an individual inventory SKU.

## Correct engineering divisions

| Engineering family | Profiles / identity | Classification |
|---|---|---|
| Classical wrapped V | Z, A, B, C, D, E | Classical V-belt |
| Classical raw-edge cogged V | ZX, AX, BX, CX | Cogged classical V-belt |
| Metric narrow wrapped wedge | SPZ, SPA, SPB, SPC | Metric narrow wedge |
| Metric narrow raw-edge cogged wedge | XPZ, XPA, XPB, XPC | Raw-edge cogged narrow wedge |
| American wrapped wedge | 3V, 5V, 8V | American / high-capacity wedge |
| American raw-edge cogged wedge | 3VX, 5VX, 8VX | Cogged American wedge |
| Banded / Powerband | Base profile plus common tie-band | Separate joined V-belt family; no single-belt leaf |
| Double-V / hexagonal | AA, BB, CC | Double-V belt |
| Crowned / ridge-top transport | CRC / TRC | Crowned transport profile; not welded PU round |
| Welded PU round | Round PU/TPU | Heat-welded round belt |

## Database corrections in the migration

- Reclassify 103 crowned CRC/TRC variants to `FT-BELT-CROWNED-CRC`; retain 121 welded PU round variants as `FT-BELT-ROUND-CRC`.
- Reclassify 15 banded variants to `FT-VBELT-BANDED`; remove the inappropriate single-belt leaf from the five active banded families.
- Reclassify 29 American wrapped wedge variants to `FT-VBELT-WEDGE` and two cogged American wedge variants to `FT-VBELT-COGGED`.
- Correct 139 SWR XPZ/XPA/XPB/XPC variants to raw-edge cogged rubber rather than wrapped V-belt.
- Clarify two SWR AA items as Double-V / hexagonal AA. Keep them unresolved in the menu until an approved Excel leaf exists.
- Correct the 12 direct American wedge SKU paths and two direct AX-banded SKU paths.
- Remove unsupported claims that CRC/TRC, banded and other V-belt compounds/cords are definitely neoprene/polyester. Use manufacturer-neutral descriptions until the exact datasheet is available.
- Keep technical-review states and missing-evidence requirements; series-level evidence must not be mistaken for exact internal SKU verification.

- All four AA-profile variants (two SWR and two generic) are classified as Double-V / hexagonal AA using the published section definition. The two generic items do not inherit SWR-specific manufacturer evidence.
- The SWR XPZ family is assigned to the approved “SPA, SPB, SPC and cogged” leaf after the manufacturer catalogue confirms XPZ as a raw-edge cogged wedge series. The remaining exact local SKU/length matches stay series-level, not model-level.

## Evidence limitations and remaining work

1. The SWR brochure verifies profile families and available product series, not the local inventory codes or every length designation.
2. 8VX is not listed in the cited SWR brochure; its classification is standards/profile based only and needs the exact SWR datasheet or belt marking.
3. CRC/TRC has application-level ridge-top evidence, but no formal standard, exact compound, reinforcement or exact SKU has been established from the sources currently attached.
4. The AA double-V series is supported by the SWR brochure, but exact code and size matching still needs the product datasheet.
5. Any remaining profile, brand or construction conflict stays unresolved rather than being forced into a family.

## Safety and rollback

The forward migration creates a private snapshot in `internal.catalog_belt_family_engineering_backup_20261117`. The paired rollback script restores the changed columns from that exact snapshot. No SKU or family is deleted by this correction.
