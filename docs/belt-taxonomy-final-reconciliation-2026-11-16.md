# Industrial belt taxonomy — final reconciliation (2026-11-16)

## Scope and safety rules

This reconciliation covers industrial belt families and their SKU/menu relationships only. APL polishing/injection machines are equipment, not belt products. They remain in the catalog but must not be assigned to an industrial-belt family/menu path. Do not create a new leaf or force a family into an unrelated approved Excel submenu.

No family, SKU, image, commercial specification, or stock record is deleted by the follow-up migration. Families without an approved, technically defensible menu path remain searchable in the all-products catalog and quarantined from unrelated category pages.

## Live database baseline (read-only audit)

The active database before the final follow-up reports:

| Approved belt menu | Active families | Active family SKUs |
|---|---:|---:|
| Timing | 131 | 1,922 |
| V-Belt | 177 | 4,924 |
| Welded belts | 20 | 108 |
| Conveyor/equipment belt products | 6 | 104 |
| **Current total** | **334** | **7,058** |

The current total includes the APL machinery family (2 SKUs) under the welding-equipment submenu. Removing that non-belt family produces the correct belt-only target of **333 families / 7,056 SKUs**. The conveyor/equipment category then contains 5 families / 102 SKUs.

## Quarantined families

There are 18 PU-welded V-profile families (45 SKUs) whose menu assignments were removed by the preceding correction, but whose legacy `catalog_families` fields still say V-Belt. The follow-up now clears those stale fields to `UNRESOLVED`, with no change to family membership or SKU records.

The separate 22-family quarantine list remains in the catalog and is excluded from belt menu assignments:

- 15 Poly-V PJ/PK/PL families (100 SKUs): no approved Excel submenu/leaf exists.
- 4 AA/K profile families (10 SKUs): no approved leaf exists in the current taxonomy.
- 1 automotive timing family (8 SKUs): outside the industrial-belt taxonomy.
- 1 generic industrial C family (6 SKUs): identity is not sufficiently established.
- 1 APL machinery family (2 SKUs): equipment, not a belt family.

After the follow-up, the expected total without an industrial-belt menu assignment is 40 families: the 18 stale PU-welded families plus these 22 quarantined families.

## Direct SKUs

The audit found 56 active direct SKUs already in the unresolved queue. The follow-up retains those records, places the reviewed XPC SKU under the V-Belt special parent, keeps double-sided timing SKUs at the timing parent level, keeps reviewed special V profiles at their approved parent level, and ensures the BRB direct SKUs remain unresolved. No direct SKU is deleted.

## PVC conveyor split

The production database already contains the PVC conveyor surface split: four distinct surface families, 146 active SKUs, and 146 commercial-spec rows. Those records are not rewritten by this follow-up.

## Implementation and rollback

- `src/data/catalogMenuSemanticGuard.ts` rejects APL polishing/injection equipment and other non-belt items from the belt equipment submenu; explicit belt-welding equipment remains eligible.
- `ops/sql/20261116_belt_family_taxonomy_followup.sql` contains the 31 reviewed family mappings, the 22-family quarantine, the 18 stale-metadata cleanup, and direct-SKU parent assignments.
- Before changing rows, it snapshots 71 family rows, 32 menu-assignment rows, and 35 direct-SKU rows into a private RLS-enabled backup table.
- `ops/sql/20261116_belt_family_taxonomy_followup_rollback.sql` restores those exact fields from that snapshot and retains the backup.
- PGlite integration coverage verifies forward migration, SKU/commercial-row preservation, backup protection, and exact rollback.

**Production status:** this final follow-up is prepared for review and is not yet applied. Merge the code/test PR first; apply the guarded SQL migration only after the PR is merged and the production preconditions are rechecked.
