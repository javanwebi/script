#!/usr/bin/env node
/**
 * optimize-images.mjs
 * -------------------
 * Builds lightweight, web-ready WebP derivatives inside `public/images/` so
 * every UI, editorial, brand, client-logo, industry, and mock image is served
 * cleanly from `public/` without Vite bundling multi-MB originals or calling CDNs.
 *
 * Usage:  node scripts/optimize-images.mjs [--force]
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FORCE = process.argv.includes('--force');

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Explicit mapping from raw source files in `src/assets` to clean web paths under `public/images/`.
 * Keeping an explicit map prevents stale/duplicate assets from bloating `public/images/`.
 */
const IMAGE_JOBS = [
  // Hero & storewide banners
  { src: 'src/assets/images/industrial_hero_banner_1789372743298.jpg', out: 'public/images/hero/hero-banner.webp', max: 1440, q: 80 },
  { src: 'src/assets/images/atlas_hero_pulley_1789379687558.jpg', out: 'public/images/hero/hero-pulley.webp', max: 1440, q: 80 },
  { src: 'src/assets/images/hero_steel_coils_1789642667373.jpg', out: 'public/images/hero/hero-steel-coils.webp', max: 1440, q: 80 },
  { src: 'src/assets/images/refinery_dusk_wide_1790695808002.jpg', out: 'public/images/hero/refinery-dusk-wide.webp', max: 1440, q: 78 },
  { src: 'src/assets/images/footer_conveyor_1789463035125.jpg', out: 'public/images/hero/footer-conveyor.webp', max: 1200, q: 76 },
  { src: 'src/assets/images/cta_consult_banner_1789637852056.jpg', out: 'public/images/hero/cta-consult-banner.webp', max: 1440, q: 78 },
  { src: 'src/assets/images/auth_industrial_hero_1791191790536.jpg', out: 'public/images/hero/auth-industrial-hero.webp', max: 1200, q: 78 },
  { src: 'src/assets/images/banner_auth_login_1791194148886.jpg', out: 'public/images/hero/banner-auth-login.webp', max: 1000, q: 78 },
  { src: 'src/assets/images/banner_auth_register_1791194168672.jpg', out: 'public/images/hero/banner-auth-register.webp', max: 1000, q: 78 },
  { src: 'src/assets/images/forza_swr_hero_banner_1791281882552.jpg', out: 'public/images/hero/forza-swr-dual-banner.webp', max: 1440, q: 80 },
  { src: 'src/assets/images/brands_fullbleed_bg_1791282424638.jpg', out: 'public/images/hero/brands-fullbleed-bg.webp', max: 1440, q: 78 },
  { src: 'src/assets/images/banner_forza_1789372945728.jpg', out: 'public/images/hero/banner-forza.webp', max: 1200, q: 80 },
  { src: 'src/assets/images/banner_swr_1789372963559.jpg', out: 'public/images/hero/banner-swr.webp', max: 1200, q: 80 },

  // Company pages, labs & visual showcase
  { src: 'src/assets/images/about_hero_gears_1794570603432.jpg', out: 'public/images/company/about-hero.webp', max: 1280, q: 80 },
  { src: 'src/assets/images/about_atlas_warehouse_1794570603737.jpg', out: 'public/images/company/about-warehouse.webp', max: 1200, q: 80 },
  { src: 'src/assets/images/services_cnc_inspection_1794570603805.jpg', out: 'public/images/company/services-hero.webp', max: 1280, q: 80 },
  { src: 'src/assets/images/services_engineering_consult_1794572176567.jpg', out: 'public/images/company/services-engineering-consult.webp', max: 1000, q: 80 },
  { src: 'src/assets/images/services_order_dispatch_1794572177214.jpg', out: 'public/images/company/services-order-dispatch.webp', max: 1000, q: 80 },
  { src: 'src/assets/images/industries_automated_line_1794570604866.jpg', out: 'public/images/company/industries-hero.webp', max: 1280, q: 80 },
  { src: 'src/assets/images/brands_parts_studio_1794570605118.jpg', out: 'public/images/company/brands-hero.webp', max: 1280, q: 80 },
  { src: 'src/assets/images/knowledge_caliper_guide_1794570605426.jpg', out: 'public/images/company/knowledge-hero.webp', max: 1280, q: 80 },
  { src: 'src/assets/images/contact_engineering_showroom_1794570606351.jpg', out: 'public/images/company/contact-showroom.webp', max: 1280, q: 80 },
  { src: 'src/assets/images/contact_visit_counter_1794572178138.jpg', out: 'public/images/company/contact-visit-counter.webp', max: 1000, q: 80 },
  { src: 'src/assets/images/parts_warehouse_vault_1791289671081.jpg', out: 'public/images/company/parts-warehouse-vault.webp', max: 1200, q: 78 },
  { src: 'src/assets/images/reverse_engineering_lab_1791289687614.jpg', out: 'public/images/company/reverse-engineering-lab.webp', max: 1000, q: 78 },
  { src: 'src/assets/images/predictive_maintenance_sensor_1791289700113.jpg', out: 'public/images/company/predictive-maintenance-sensor.webp', max: 1000, q: 78 },
  { src: 'src/assets/images/why_sanat_qc_inspection_1791287685522.jpg', out: 'public/images/company/why-sanat-qc.webp', max: 960, q: 78 },
  { src: 'src/assets/images/why_sanat_direct_factory_1791287695290.jpg', out: 'public/images/company/why-sanat-direct-factory.webp', max: 1200, q: 78 },
  { src: 'src/assets/images/why_sanat_cad_engineering_1791287704948.jpg', out: 'public/images/company/why-sanat-cad-engineering.webp', max: 1200, q: 78 },
  { src: 'src/assets/images/why_sanat_express_delivery_1791287714873.jpg', out: 'public/images/company/why-sanat-express-delivery.webp', max: 1200, q: 78 },
  { src: 'src/assets/images/ai_consult_robot_1789379706342.jpg', out: 'public/images/company/ai-consult-robot.webp', max: 960, q: 78 },
  { src: 'src/assets/images/ai_search_mobile_1789379723502.jpg', out: 'public/images/company/ai-search-mobile.webp', max: 960, q: 78 },
  { src: 'src/assets/images/engineer_why_atlas_1789379790899.jpg', out: 'public/images/company/engineer-why-atlas.webp', max: 960, q: 78 },
  { src: 'src/assets/IMAGESITE/Futuristic FORZA AI Robot Halo.png', out: 'public/images/company/forza-ai-robot-halo.webp', max: 900, q: 80 },
  { src: 'src/assets/IMAGESITE/Levitating Orbital Engine Assembly (1).png', out: 'public/images/company/levitating-orbital-engine.webp', max: 900, q: 80 },
  { src: 'src/assets/images/yazd-region-osm.png', out: 'public/images/company/yazd-region-osm.webp', max: 1000, q: 82 },

  // Knowledge articles (each position gets its own dedicated photograph)
  { src: 'src/assets/images/knowledge_caliper_guide_1794570605426.jpg', out: 'public/images/articles/identify-belt.webp', max: 960, q: 80 },
  { src: 'src/assets/images/ai_search_mobile_1789379723502.jpg', out: 'public/images/articles/part-photo.webp', max: 960, q: 80 },
  { src: 'src/assets/images/article_custom_part_blueprint_1794572176131.jpg', out: 'public/images/articles/custom-part.webp', max: 960, q: 80 },
  { src: 'src/assets/images/article_maintenance_inspection_1794572176617.jpg', out: 'public/images/articles/maintenance.webp', max: 960, q: 80 },

  // Covered Industries
  { src: 'src/assets/images/ind_ceramic_1789372889504.jpg', out: 'public/images/industries/ceramic.webp', max: 960, q: 78 },
  { src: 'src/assets/images/ind_textile_1789372911510.jpg', out: 'public/images/industries/textile.webp', max: 960, q: 78 },
  { src: 'src/assets/images/ind_factory_1789372929899.jpg', out: 'public/images/industries/manufacturing.webp', max: 960, q: 78 },
  { src: 'src/assets/images/ind_cement_plant_1789379772744.jpg', out: 'public/images/industries/cement.webp', max: 960, q: 78 },
  { src: 'src/assets/images/ind_food_belt_1789640443445.jpg', out: 'public/images/industries/food.webp', max: 960, q: 78 },
  { src: 'src/assets/images/ind_food_bottles_1789640622505.jpg', out: 'public/images/industries/food-bottles.webp', max: 960, q: 78 },
  { src: 'src/assets/images/ind_mining_truck_1789640639445.jpg', out: 'public/images/industries/mining-truck.webp', max: 960, q: 78 },
  { src: 'src/assets/images/ind_power_cooling_1789640659745.jpg', out: 'public/images/industries/power-cooling.webp', max: 960, q: 78 },
  { src: 'src/assets/images/ind_robot_arm_1789640675729.jpg', out: 'public/images/industries/robot-arm.webp', max: 960, q: 78 },
  { src: 'src/assets/images/ind_bg_plant_1789640602049.jpg', out: 'public/images/industries/bg-plant.webp', max: 1200, q: 74 },
  { src: 'src/assets/images/ind_rubber_plant_1794572180931.jpg', out: 'public/images/industries/rubber.webp', max: 960, q: 78 },

  // Subcategories & Brand Sub-parts
  { src: 'src/assets/images/hero_timing_belt_studio_1794523125679.jpg', out: 'public/images/subcategories/timing-belt-hero.webp', max: 1100, q: 80 },
  { src: 'src/assets/images/hero_vbelt_ribbed_studio_1794523125271.jpg', out: 'public/images/subcategories/vbelt-ribbed-hero.webp', max: 1100, q: 80 },
  { src: 'src/assets/images/hero_pu_welded_round_belt_1794523126034.jpg', out: 'public/images/subcategories/pu-welded-belt-hero.webp', max: 1100, q: 80 },
  { src: 'src/assets/images/hero_roller_conveyor_parts_1794523127595.jpg', out: 'public/images/subcategories/roller-conveyor-hero.webp', max: 1100, q: 80 },
  { src: 'src/assets/images/hero_polymer_seals_brushes_1794523128177.jpg', out: 'public/images/subcategories/polymer-seals-hero.webp', max: 1100, q: 80 },
  { src: 'src/assets/images/forza_sub_belt_1791282448324.jpg', out: 'public/images/subcategories/forza-sub-belt.webp', max: 760, q: 78 },
  { src: 'src/assets/images/forza_sub_bearing_1791282461295.jpg', out: 'public/images/subcategories/forza-sub-bearing.webp', max: 760, q: 78 },
  { src: 'src/assets/images/forza_sub_coupling_1791281900189.jpg', out: 'public/images/subcategories/forza-sub-coupling.webp', max: 760, q: 78 },
  { src: 'src/assets/images/forza_sub_fittings_1791281915503.jpg', out: 'public/images/subcategories/forza-sub-fittings.webp', max: 760, q: 78 },
  { src: 'src/assets/images/swr_sub_valve_1791282471297.jpg', out: 'public/images/subcategories/swr-sub-valve.webp', max: 760, q: 78 },
  { src: 'src/assets/images/swr_sub_elbow_1791281933503.jpg', out: 'public/images/subcategories/swr-sub-elbow.webp', max: 760, q: 78 },
  { src: 'src/assets/images/swr_sub_pipes_1791282482892.jpg', out: 'public/images/subcategories/swr-sub-pipes.webp', max: 760, q: 78 },
  { src: 'src/assets/images/swr_sub_flanges_1791282491635.jpg', out: 'public/images/subcategories/swr-sub-flanges.webp', max: 760, q: 78 },

  // Categories
  { src: 'src/assets/images/cat_belts_1789372769676.jpg', out: 'public/images/categories/belts.webp', max: 760, q: 78 },
  { src: 'src/assets/images/cat_pulleys_1789372787444.jpg', out: 'public/images/categories/pulleys.webp', max: 760, q: 78 },
  { src: 'src/assets/images/cat_bearings_1789372803159.jpg', out: 'public/images/categories/bearings.webp', max: 760, q: 78 },
  { src: 'src/assets/images/cat_chains_sprockets_1789379751306.jpg', out: 'public/images/categories/chains.webp', max: 760, q: 78 },
  { src: 'src/assets/images/cat_conveyor_1789372820961.jpg', out: 'public/images/categories/conveyor.webp', max: 760, q: 78 },
  { src: 'src/assets/images/cat_ceramic_1789372839717.jpg', out: 'public/images/categories/ceramic.webp', max: 760, q: 78 },
  { src: 'src/assets/images/cat_textile_1789372856221.jpg', out: 'public/images/categories/textile.webp', max: 760, q: 78 },
  { src: 'src/assets/images/cat_trans_1789372871923.jpg', out: 'public/images/categories/transmission.webp', max: 760, q: 78 },

  // Featured Storefront Products
  { src: 'src/assets/images/prod_cer_parts_1789373001819.jpg', out: 'public/images/products/ceramic-parts.webp', max: 680, q: 78 },
  { src: 'src/assets/images/prod_alu_pulley_1789373016576.jpg', out: 'public/images/products/alu-pulley.webp', max: 680, q: 78 },
  { src: 'src/assets/images/prod_pvc_belt_1789373040329.jpg', out: 'public/images/products/pvc-belt.webp', max: 680, q: 78 },
  { src: 'src/assets/images/prod_bearing_1789373059455.jpg', out: 'public/images/products/bearing.webp', max: 680, q: 78 },
  { src: 'src/assets/images/prod_forza_belt_1789373077648.jpg', out: 'public/images/products/forza-belt.webp', max: 680, q: 78 },
  { src: 'src/assets/images/prod_cer_roller_1789373093705.jpg', out: 'public/images/products/ceramic-roller.webp', max: 680, q: 78 },
  { src: 'src/assets/images/prod_flange_1789639958727.jpg', out: 'public/images/products/flange.webp', max: 680, q: 78 },
  { src: 'src/assets/images/prod_pipes_1789639975465.jpg', out: 'public/images/products/pipes.webp', max: 680, q: 78 },
  { src: 'src/assets/images/prod_valve_1789639989306.jpg', out: 'public/images/products/valve.webp', max: 680, q: 78 },
  { src: 'src/assets/images/prod_pump_1789640002577.jpg', out: 'public/images/products/pump.webp', max: 680, q: 78 },
  { src: 'src/assets/images/prod_motor_1789640017545.jpg', out: 'public/images/products/motor.webp', max: 680, q: 78 },
  { src: 'src/assets/images/prod_bearing_nsk_1789640036345.jpg', out: 'public/images/products/bearing-nsk.webp', max: 680, q: 78 },

  // Brand & Emblem Logos (lossless/near-lossless WebP with alpha transparency)
  { src: 'src/assets/logo.png', out: 'public/images/brand/sanatpish-logo.webp', max: 480, q: 88 },
  { src: 'src/assets/logo-forza.png', out: 'public/images/brand/logo-forza.webp', max: 400, q: 88 },
  { src: 'src/assets/SWR-LOGO.png', out: 'public/images/brand/swr-logo.webp', max: 400, q: 88 },
  { src: 'src/assets/atlas.png', out: 'public/images/brand/atlas-logo.webp', max: 320, q: 88 },
  { src: 'src/assets/Futuristic RZA FORZA Energy Emblem.png', out: 'public/images/brand/forza-emblem.webp', max: 520, q: 86 },

  // Client Logos (moshtari)
  { src: 'src/assets/moshtari/meybodtile-1897765651.jpg', out: 'public/images/clients/m1.webp', max: 240, q: 82 },
  { src: 'src/assets/moshtari/63bbd73ce5ff4fde8de2cde28151b8ec.w_250h_250r_k.jpg', out: 'public/images/clients/m2.webp', max: 240, q: 82 },
  { src: 'src/assets/moshtari/718a16d3b0ee4cbb9aef05cdcf42fdf2.w_250h_250r_k.jpg', out: 'public/images/clients/m3.webp', max: 240, q: 82 },
  { src: 'src/assets/moshtari/7401712e725842d9b7867c997e2c4524.w_225h_225r_k.png', out: 'public/images/clients/m4.webp', max: 240, q: 82 },
  { src: 'src/assets/moshtari/78109156913b4619b2eb68411388f503.w_228h_233r_k.jpg', out: 'public/images/clients/m5.webp', max: 240, q: 82 },
  { src: 'src/assets/moshtari/b848ca4510344a218c4b0c0a0d62b4b8.w_250h_250r_k.jpg', out: 'public/images/clients/m6.webp', max: 240, q: 82 },
  { src: 'src/assets/moshtari/download.png', out: 'public/images/clients/m7.webp', max: 240, q: 82 },
  { src: 'src/assets/moshtari/e7e6cf2d04dd45d084b51b67b877eab5.w_250h_250r_k.jpg', out: 'public/images/clients/m8.webp', max: 240, q: 82 },
  { src: 'src/assets/moshtari/e931fc644e00c472bb722af3258d63fa14145f74.jpeg', out: 'public/images/clients/m9.webp', max: 240, q: 82 },
  { src: 'src/assets/moshtari/images-1-1.jpg', out: 'public/images/clients/m10.webp', max: 240, q: 82 },
  { src: 'src/assets/moshtari/images-1.jpg', out: 'public/images/clients/m11.webp', max: 240, q: 82 },
  { src: 'src/assets/moshtari/images-1.png', out: 'public/images/clients/m12.webp', max: 240, q: 82 },
  { src: 'src/assets/moshtari/images-2.jpg', out: 'public/images/clients/m13.webp', max: 240, q: 82 },
  { src: 'src/assets/moshtari/images-2.png', out: 'public/images/clients/m14.webp', max: 240, q: 82 },
  { src: 'src/assets/moshtari/images-3.jpg', out: 'public/images/clients/m15.webp', max: 240, q: 82 },
  { src: 'src/assets/moshtari/images-3.png', out: 'public/images/clients/m16.webp', max: 240, q: 82 },
  { src: 'src/assets/moshtari/images-4.jpg', out: 'public/images/clients/m17.webp', max: 240, q: 82 },
  { src: 'src/assets/moshtari/images-4.png', out: 'public/images/clients/m18.webp', max: 240, q: 82 },
  { src: 'src/assets/moshtari/images-5.jpg', out: 'public/images/clients/m19.webp', max: 240, q: 82 },
  { src: 'src/assets/moshtari/images-5.png', out: 'public/images/clients/m20.webp', max: 240, q: 82 },
  { src: 'src/assets/moshtari/images-6.jpg', out: 'public/images/clients/m21.webp', max: 240, q: 82 },
  { src: 'src/assets/moshtari/images.jpg', out: 'public/images/clients/m22.webp', max: 240, q: 82 },
  { src: 'src/assets/moshtari/images.png', out: 'public/images/clients/m23.webp', max: 240, q: 82 },

  // Local Mock/Document Sample Photos (replaces all external Unsplash URLs)
  { src: 'src/assets/images/mock_commercial_document_1794572180167.jpg', out: 'public/images/mock/commercial-document.webp', max: 720, q: 80 },
];

async function run() {
  let converted = 0;
  let skipped = 0;
  let bytesBefore = 0;
  let bytesAfter = 0;

  for (const job of IMAGE_JOBS) {
    const srcPath = path.join(ROOT, job.src);
    const outPath = path.join(ROOT, job.out);

    if (!(await exists(srcPath))) {
      // Fallback: if mobile webp already exists in src/assets, check when original missing
      continue;
    }

    const srcStat = await fs.stat(srcPath);
    bytesBefore += srcStat.size;

    if (!FORCE && (await exists(outPath))) {
      const outStat = await fs.stat(outPath);
      if (outStat.mtimeMs >= srcStat.mtimeMs) {
        skipped += 1;
        bytesAfter += outStat.size;
        continue;
      }
    }

    await fs.mkdir(path.dirname(outPath), { recursive: true });
    const img = sharp(srcPath, { failOn: 'none' }).rotate();
    const meta = await img.metadata();
    const needsResize = (meta.width ?? 0) > job.max || (meta.height ?? 0) > job.max;
    const pipeline = needsResize
      ? img.resize({ width: job.max, height: job.max, fit: 'inside', withoutEnlargement: true })
      : img;

    const buffer = await pipeline.webp({ quality: job.q, effort: 4 }).toBuffer();
    await fs.writeFile(outPath, buffer);
    converted += 1;
    bytesAfter += buffer.length;
  }

  // Keep public/logo.png and public/favicon.ico crisp & lightweight (< 60 KB)
  const logoSrc = path.join(ROOT, 'src/assets/logo.png');
  const publicLogo = path.join(ROOT, 'public/logo.png');
  const publicFavicon = path.join(ROOT, 'public/favicon.ico');
  if (await exists(logoSrc)) {
    const logoStat = await fs.stat(publicLogo).catch(() => null);
    if (FORCE || !logoStat || logoStat.size > 80_000) {
      const pngBuf = await sharp(logoSrc)
        .resize({ width: 320, height: 320, fit: 'inside', withoutEnlargement: true })
        .png({ compressionLevel: 9, palette: true, quality: 85 })
        .toBuffer();
      await fs.writeFile(publicLogo, pngBuf);
      const favBuf = await sharp(logoSrc)
        .resize({ width: 64, height: 64, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png({ compressionLevel: 9, palette: true, quality: 85 })
        .toBuffer();
      await fs.writeFile(publicFavicon, favBuf);
    }
  }

  const mb = (n) => (n / 1048576).toFixed(2);
  console.log(
    `optimize-images: ${converted} converted to public/images/, ${skipped} up-to-date ` +
      `(${mb(bytesBefore)} MB -> ${mb(bytesAfter)} MB)`
  );
}

run().catch((err) => {
  console.error('optimize-images error:', err);
  process.exitCode = 1;
});
