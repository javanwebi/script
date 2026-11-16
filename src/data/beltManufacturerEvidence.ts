export interface ManufacturerSeriesEvidenceInput {
  sku: string;
  manufacturer: string | null | undefined;
  division: string;
  profile: string;
  originalName?: string;
}

export interface ManufacturerSeriesEvidence {
  manufacturer: string;
  sourceUrl: string;
  evidenceBasis: string;
}

const SWR_BROCHURE_URL =
  'https://www.swr-europe.de/download/SWR_Imagebroschuere_en.pdf';
const OPTIBELT_PRODUCT_RANGE_URL =
  'https://www.optibelt.com/fileadmin/pdf/produkte/keilriemen/Optibelt-product-range.pdf';
const OPTIBELT_TIMING_MANUAL_URL =
  'https://www.optibelt.com/fileadmin/pdf/produkte/zahnriemen-gummi/Optibelt-TM-Rubber-Timing-Belt-Drives.pdf';
const MEGADYNE_VBELT_MANUAL_URL =
  'https://megadynegroup.com/files/resources/attachments/md_manu_en_product_guide_web_0.pdf';
const MEGADYNE_MEGASYNC_MANUAL_URL =
  'https://megadynegroup.com/files/resources/attachments/md_manu_en_product_guide_web_0.pdf';
const MEGADYNE_MEGALINEAR_URL =
  'https://megadynegroup.com/en/products/timing-belts/polyurethane-open-end/megalinear/';
const MEGADYNE_PV_RIBBED_URL =
  'https://megadynegroup.com/de-de/products/multi-rib-belts/pv-rubber-ribbed/';
const BANDO_INDUSTRIAL_CATALOG_URL =
  'https://www.bandousa.com/media/uploads/0/114_BUI-1009_Industrial-Power-Transmission-Products-catalog-Vol-2_9-17.pdf';
const DONGIL_REC_URL =
  'https://www.drbworld.com/industrial/index.php?CgCode=004&idx=52900&mode=fdn&num=1&pCode=MN0000028';

const normalize = (value: string): string =>
  value.toUpperCase().replace(/[^A-Z0-9]/g, '');

const inSet = (value: string, values: string[]): boolean =>
  values.includes(value);

const bandedBase = (profile: string): string =>
  profile.replace(/BANDED$/, '');

const seriesEvidence = (
  manufacturer: string,
  sourceUrl: string,
  sourceDescription: string,
  originalName: string,
): ManufacturerSeriesEvidence => {
  const tnxNote = /TNX/i.test(originalName)
    ? ' The inventory token TNX was not found as a Megadyne series in the official sources and is not manufacturer-verified.'
    : '';
  return {
    manufacturer,
    sourceUrl,
    evidenceBasis:
      sourceDescription +
      ' Series/profile identity only: this source match does not independently verify this inventory SKU’s exact article number, length, width, compound, tensile cord, cover or construction details.' +
      tnxNote,
  };
};

/**
 * Returns evidence only when the detected manufacturer, classified belt
 * division and normalized profile are all explicitly covered by an official
 * manufacturer product range or technical handbook.
 *
 * This is series/profile-level evidence, never an exact-SKU datasheet claim.
 */
export function resolveManufacturerSeriesEvidence(
  input: ManufacturerSeriesEvidenceInput,
): ManufacturerSeriesEvidence | null {
  const manufacturer = (input.manufacturer ?? '').trim().toUpperCase();
  const division = input.division;
  const profile = normalize(input.profile);
  const base = bandedBase(profile);
  const originalName = input.originalName ?? '';

  if (manufacturer === 'SWR') {
    const classical = ['Z', 'A', 'B', 'C', 'D', 'E', 'ZX', 'AX', 'BX', 'CX'];
    const wedge = ['SPZ', 'SPA', 'SPB', 'SPC', '3V', '5V', '8V'];
    const coggedNarrow = ['XPZ', 'XPA', 'XPB', 'XPC', '3VX', '5VX'];
    const banded = [
      'SPZ', 'SPA', 'SPB', 'SPC', '3V', '5V', '8V',
      'A', 'B', 'C', 'D', 'XPZ', 'XPA', 'XPB', 'XPC', '3VX', '5VX',
    ];

    if (division === 'vbelt-classical' && inSet(profile, classical)) {
      return seriesEvidence(
        manufacturer,
        SWR_BROCHURE_URL,
        'The official SWR brochure lists classical Z/A/B/C/D/E and raw-edge cogged ZX/AX/BX/CX sections.',
        originalName,
      );
    }
    if (
      ['vbelt-wedge', 'vbelt-narrow-wedge'].includes(division) &&
      (inSet(profile, wedge) || inSet(profile, coggedNarrow))
    ) {
      return seriesEvidence(
        manufacturer,
        SWR_BROCHURE_URL,
        'The official SWR brochure lists SPZ/SPA/SPB/SPC, 3V/5V/8V, XPZ/XPA/XPB/XPC and 3VX/5VX product sections.',
        originalName,
      );
    }
    if (division === 'vbelt-banded' && inSet(base, banded)) {
      return seriesEvidence(
        manufacturer,
        SWR_BROCHURE_URL,
        'The official SWR brochure lists banded classical, wedge and raw-edge cogged profiles for the matched base section.',
        originalName,
      );
    }
    if (division === 'vbelt-hexagonal' && inSet(profile, ['AA', 'BB', 'CC'])) {
      return seriesEvidence(
        manufacturer,
        SWR_BROCHURE_URL,
        'The official SWR brochure lists double-V/hexagonal belt sections AA, BB and CC.',
        originalName,
      );
    }
    if (division === 'ribbed-poly-v' && inSet(profile, ['PJ', 'PK', 'PL', 'PM'])) {
      return seriesEvidence(
        manufacturer,
        SWR_BROCHURE_URL,
        'The official SWR brochure lists multi-rib profiles PJ, PK, PL and PM.',
        originalName,
      );
    }
  }

  if (manufacturer === 'OPTIBELT') {
    const classical = ['5', 'Y', '8', 'Z', 'A', 'B', 'C', 'D', 'E', '20', '25', 'ZX', 'AX', 'BX', 'CX'];
    const wedge = ['SPZ', 'SPA', 'SPB', 'SPC', '3V', '5V', '8V'];
    const coggedNarrow = ['XPZ', 'XPA', 'XPB', 'XPC', '3VX', '5VX'];
    const banded = [
      'SPZ', 'SPA', 'SPB', 'SPC', '3V', '5V', '8V',
      'XPZ', 'XPA', 'XPB', 'XPC', '3VX', '5VX', 'A', 'B', 'C', 'D',
    ];

    if (division === 'vbelt-classical' && inSet(profile, classical)) {
      return seriesEvidence(
        manufacturer,
        OPTIBELT_PRODUCT_RANGE_URL,
        'The official Optibelt product-range catalog lists VB classical and SUPER TX/SUPER X-POWER raw-edge cogged sections.',
        originalName,
      );
    }
    if (
      ['vbelt-wedge', 'vbelt-narrow-wedge'].includes(division) &&
      (inSet(profile, wedge) || inSet(profile, coggedNarrow))
    ) {
      return seriesEvidence(
        manufacturer,
        OPTIBELT_PRODUCT_RANGE_URL,
        'The official Optibelt catalog lists SK/RED POWER wedge profiles and SUPER X-POWER raw-edge cogged profiles.',
        originalName,
      );
    }
    if (division === 'vbelt-banded' && inSet(base, banded)) {
      return seriesEvidence(
        manufacturer,
        OPTIBELT_PRODUCT_RANGE_URL,
        'The official Optibelt catalog lists KB/KBX powerbands for the matched base profile.',
        originalName,
      );
    }
    if (division === 'vbelt-hexagonal' && inSet(profile, ['AA', 'BB', 'CC'])) {
      return seriesEvidence(
        manufacturer,
        OPTIBELT_PRODUCT_RANGE_URL,
        'The official Optibelt catalog lists DK double-V belt products.',
        originalName,
      );
    }
    if (division === 'ribbed-poly-v' && inSet(profile, ['PH', 'PJ', 'PK', 'PL', 'PM', 'DPK', 'EPK'])) {
      return seriesEvidence(
        manufacturer,
        OPTIBELT_PRODUCT_RANGE_URL,
        'The official Optibelt catalog lists RB ribbed-belt profiles PH/PJ/PK/PL/PM and automotive RBK PJ/PK/DPK/EPK sections.',
        originalName,
      );
    }
    if (
      division === 'timing-imperial-single' &&
      inSet(profile, ['MXL', 'XL', 'L', 'H', 'XH', 'XXH'])
    ) {
      return seriesEvidence(
        manufacturer,
        OPTIBELT_TIMING_MANUAL_URL,
        'The official Optibelt rubber-timing technical manual lists ZR imperial timing-belt profiles MXL/XL/L/H/XH/XXH.',
        originalName,
      );
    }
    if (
      division === 'timing-imperial-double' &&
      inSet(profile, ['DXL', 'DL', 'DH'])
    ) {
      return seriesEvidence(
        manufacturer,
        OPTIBELT_TIMING_MANUAL_URL,
        'The official Optibelt rubber-timing technical manual lists double-sided ZR profiles DXL/DL/DH.',
        originalName,
      );
    }
    if (
      division === 'timing-htd-rpp-double' &&
      inSet(profile, ['D5M', 'D8M', 'D14M', 'DS8M'])
    ) {
      return seriesEvidence(
        manufacturer,
        OPTIBELT_TIMING_MANUAL_URL,
        'The official Optibelt rubber-timing technical manual lists double-sided OMEGA D5M/D8M/D14M and STD DS8M profiles.',
        originalName,
      );
    }
    if (
      division === 'timing-htd-rpp-single' &&
      inSet(profile, ['2M', '3M', '5M', '8M', '14M', 'S5M', 'S8M', 'S14M'])
    ) {
      return seriesEvidence(
        manufacturer,
        OPTIBELT_TIMING_MANUAL_URL,
        'The official Optibelt rubber-timing technical manual lists its proprietary OMEGA profile 2M/3M/5M/8M/14M and STD S5M/S8M/S14M families. The manual notes pulley compatibility with HTD/RPP systems; this does not mean the tooth profiles are identical.',
        originalName,
      );
    }
    if (
      division === 'timing-metric-single' &&
      inSet(profile, ['T5', 'T10', 'T20', 'AT5', 'AT10', 'AT20'])
    ) {
      return seriesEvidence(
        manufacturer,
        OPTIBELT_PRODUCT_RANGE_URL,
        'The official Optibelt catalog lists ALPHA polyurethane timing-belt T and AT profiles.',
        originalName,
      );
    }
    if (division === 'timing-automotive-ru' && profile === 'AUTORU') {
      return seriesEvidence(
        manufacturer,
        OPTIBELT_PRODUCT_RANGE_URL,
        'The official Optibelt product range identifies the ZRK automotive timing-belt family; the inventory description does not carry a verified ZRK article number, so only the family/type is confirmed.',
        originalName,
      );
    }
  }

  if (manufacturer === 'MEGADYNE') {
    const classical = ['5', 'Y', '8', 'Z', 'A', 'B', 'C', 'D', 'E', '20', '25', 'ZX', 'AX', 'BX', 'CX'];
    const wedge = ['SPZ', 'SPA', 'SPB', 'SPC', '3V', '5V', '8V'];
    const coggedNarrow = ['XPZ', 'XPA', 'XPB', 'XPC', '3VX', '5VX'];
    const banded = [
      'SPZ', 'SPA', 'SPB', 'SPC', '3V', '5V', '8V',
      'XPZ', 'XPA', 'XPB', 'XPC', '3VX', '5VX', 'A', 'B', 'C', 'D',
    ];

    if (division === 'vbelt-classical' && inSet(profile, classical)) {
      return seriesEvidence(
        manufacturer,
        MEGADYNE_VBELT_MANUAL_URL,
        'The official Megadyne Corporate Product Guide documents the matched classical and raw-edge cogged V-belt sections.',
        originalName,
      );
    }
    if (
      ['vbelt-wedge', 'vbelt-narrow-wedge'].includes(division) &&
      (inSet(profile, wedge) || inSet(profile, coggedNarrow))
    ) {
      return seriesEvidence(
        manufacturer,
        MEGADYNE_VBELT_MANUAL_URL,
        'The official Megadyne Corporate Product Guide documents wrapped, wedge and raw-edge cogged V-belt sections.',
        originalName,
      );
    }
    if (division === 'vbelt-banded' && inSet(base, banded)) {
      return seriesEvidence(
        manufacturer,
        MEGADYNE_VBELT_MANUAL_URL,
        'The official Megadyne Corporate Product Guide documents banded V-belt profiles for the matched base section.',
        originalName,
      );
    }
    if (division === 'vbelt-hexagonal' && inSet(profile, ['AA', 'BB', 'CC'])) {
      return seriesEvidence(
        manufacturer,
        MEGADYNE_VBELT_MANUAL_URL,
        'The official Megadyne Corporate Product Guide documents double-V/hexagonal belt sections.',
        originalName,
      );
    }
    if (division === 'ribbed-poly-v' && inSet(profile, ['PH', 'PJ', 'PK', 'PL', 'PM'])) {
      return seriesEvidence(
        manufacturer,
        MEGADYNE_PV_RIBBED_URL,
        'The official Megadyne PV Rubber Ribbed page lists PH/PJ/PK/PL/PM and J/L/M multi-rib sections.',
        originalName,
      );
    }
    if (
      division === 'timing-imperial-single' &&
      inSet(profile, ['MXL', 'XL', 'L', 'H', 'XH', 'XXH'])
    ) {
      return seriesEvidence(
        manufacturer,
        MEGADYNE_MEGASYNC_MANUAL_URL,
        'The official Megadyne Corporate Product Guide documents MEGASYNC imperial MXL/XL/L/H/XH/XXH timing-belt families.',
        originalName,
      );
    }
    if (
      division === 'timing-imperial-double' &&
      inSet(profile, ['XL', 'L', 'H', 'DH', 'DXL', 'DL', 'DMXL'])
    ) {
      return seriesEvidence(
        manufacturer,
        MEGADYNE_MEGASYNC_MANUAL_URL,
        'The official Megadyne MEGASYNC technical handbook documents double-sided imperial timing-belt families.',
        originalName,
      );
    }
    if (
      division === 'timing-htd-rpp-single' &&
      inSet(profile, [
        '3M', '5M', '8M', '14M', 'HTD3M', 'HTD5M', 'HTD8M', 'HTD14M',
        'STD5M', 'STD8M', 'STD14M', 'HTB3M', 'HTB5M', 'HTB8M', 'HTB14M',
        'RPP3', 'RPP5', 'RPP8', 'RPP14', 'RPP8M', 'RPP14M',
        'MTD3', 'MTD5', 'MTD8', 'MTD14', 'SLV35M', 'SLV38M', 'SLV314M',
        'GLD25M', 'GLD28M', 'GLD214M', 'TTM8', 'TTM14',
      ])
    ) {
      return seriesEvidence(
        manufacturer,
        MEGADYNE_MEGASYNC_MANUAL_URL,
        'The official Megadyne Corporate Product Guide documents MEGASYNC HTB/STD/RPP and Silver3/Gold2 timing-belt families.',
        originalName,
      );
    }
    if (
      division === 'timing-htd-rpp-double' &&
      inSet(profile, [
        'D8M', 'D14M', 'RPP5DD', 'RPP8DD', 'RPP14DD', '8MDD', '14MDD',
        'SLV38MDD', 'SLV314MDD', 'GLD28MDD', 'GLD214MDD',
      ])
    ) {
      return seriesEvidence(
        manufacturer,
        MEGADYNE_MEGASYNC_MANUAL_URL,
        'The official Megadyne Corporate Product Guide documents double-sided RPP/Silver3/Gold2 timing-belt families.',
        originalName,
      );
    }
    if (
      division === 'timing-metric-single' &&
      inSet(profile, [
        'T2', 'T2.5', 'T5', 'T10', 'T20', 'AT3', 'AT5', 'AT10', 'AT15',
        'AT20', 'ATG5', 'ATG10', 'MTD3', 'MTD5', 'MTD8', 'MTD14',
      ])
    ) {
      return seriesEvidence(
        manufacturer,
        MEGADYNE_MEGALINEAR_URL,
        'The official Megadyne MEGALINEAR product range lists T/AT and MTD metric polyurethane timing-belt pitches.',
        originalName,
      );
    }
    if (
      division === 'timing-metric-double' &&
      inSet(profile, ['T5DD', 'T10DD', 'T20DD', 'AT5DD', 'AT10DD', 'AT15DD', 'AT20DD'])
    ) {
      return seriesEvidence(
        manufacturer,
        MEGADYNE_MEGALINEAR_URL,
        'The official Megadyne MEGALINEAR/MEGAFLEX literature documents double-sided metric polyurethane timing-belt families.',
        originalName,
      );
    }
  }

  if (manufacturer === 'BANDO') {
    const classical = ['A', 'B', 'C', 'D', 'E', 'AX', 'BX', 'CX'];
    const wedge = ['SPZ', 'SPA', 'SPB', 'SPC', '3V', '5V', '8V'];
    const coggedNarrow = ['XPZ', 'XPA', 'XPB', 'XPC', '3VX', '5VX'];
    const banded = ['B', 'C', 'D', '3V', '5V', '8V', '3VX', '5VX', '8VK'];

    if (division === 'vbelt-classical' && inSet(profile, classical)) {
      return seriesEvidence(
        manufacturer,
        BANDO_INDUSTRIAL_CATALOG_URL,
        'The official Bando Industrial Power Transmission catalog lists Power King M(Z)/A-E and Power King Cog AX/BX/CX sections.',
        originalName,
      );
    }
    if (
      ['vbelt-wedge', 'vbelt-narrow-wedge'].includes(division) &&
      (inSet(profile, wedge) || inSet(profile, coggedNarrow))
    ) {
      return seriesEvidence(
        manufacturer,
        BANDO_INDUSTRIAL_CATALOG_URL,
        'The official Bando catalog lists Power Ace/Power Ace Cog and narrow SP wedge-belt families.',
        originalName,
      );
    }
    if (division === 'vbelt-banded' && inSet(base, banded)) {
      return seriesEvidence(
        manufacturer,
        BANDO_INDUSTRIAL_CATALOG_URL,
        'The official Bando catalog lists Power Scrum and other banded V-belt product families for the matched base profile.',
        originalName,
      );
    }
    if (division === 'vbelt-hexagonal' && inSet(profile, ['AA', 'BB', 'CC'])) {
      return seriesEvidence(
        manufacturer,
        BANDO_INDUSTRIAL_CATALOG_URL,
        'The official Bando catalog lists double-V/hexagonal belt sections AA, BB and CC.',
        originalName,
      );
    }
    if (division === 'ribbed-poly-v' && inSet(profile, ['J', 'L', 'M'])) {
      return seriesEvidence(
        manufacturer,
        BANDO_INDUSTRIAL_CATALOG_URL,
        'The official Bando catalog lists Rib Ace J/L/M multi-rib belt sections.',
        originalName,
      );
    }
    if (
      ['timing-imperial-single', 'timing-imperial-double'].includes(division) &&
      inSet(profile, ['MXL', 'XL', 'L', 'H', 'XH', 'XXH', 'DXL', 'DL', 'DH', 'DMXL'])
    ) {
      return seriesEvidence(
        manufacturer,
        BANDO_INDUSTRIAL_CATALOG_URL,
        'The official Bando catalog documents Synchro-Link imperial single- and double-sided timing-belt profiles. Its part-number example includes a width/construction suffix (for example, 200G); the inventory labels omit that full suffix, so this is series/profile evidence, not an exact manufacturer-article match.',
        originalName,
      );
    }
    if (
      division === 'timing-htd-rpp-single' &&
      inSet(profile, [
        '3M', '5M', '8M', '14M', 'STS2M', 'STS3M', 'STS4.5M', 'STS5M',
        'STS8M', 'STS14M', 'HPS5M', 'HPS8M', 'HPS14M', 'KPS8M', 'KPS14M',
      ])
    ) {
      return seriesEvidence(
        manufacturer,
        BANDO_INDUSTRIAL_CATALOG_URL,
        'The official Bando catalog lists STS/HTD synchronous-belt product families and metric pitches.',
        originalName,
      );
    }
    if (division === 'timing-metric-double' && inSet(profile, ['DT5', 'DT10'])) {
      return seriesEvidence(
        manufacturer,
        BANDO_INDUSTRIAL_CATALOG_URL,
        'The official Bando catalog lists double-sided polyurethane metric timing-belt profiles DT5 and DT10.',
        originalName,
      );
    }
    if (division === 'timing-metric-single' && inSet(profile, ['T2.5', 'T5', 'T10'])) {
      return seriesEvidence(
        manufacturer,
        BANDO_INDUSTRIAL_CATALOG_URL,
        'The official Bando catalog lists metric T/DT timing-belt product families.',
        originalName,
      );
    }
  }

  if (
    manufacturer === 'DONGIL' &&
    /(?:^|[^A-Z0-9])REC(?:$|[^A-Z0-9])/i.test(originalName) &&
    ['vbelt-classical', 'vbelt-narrow-wedge'].includes(division)
  ) {
    return seriesEvidence(
      manufacturer,
      DONGIL_REC_URL,
      'The official DRB/DONGIL page verifies only the explicitly marked SUPER STAR REC raw-edge cogged belt family (example B-74); this evidence is not generalized to other DONGIL inventory codes.',
      originalName,
    );
  }

  return null;
}
