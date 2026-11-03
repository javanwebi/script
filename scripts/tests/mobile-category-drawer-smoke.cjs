/* Browser smoke: mobile storefront category drawer, approved taxonomy. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { mkdirSync } = require("node:fs");
const dir = process.env.SCREENSHOT_DIR || "/tmp";
const base = process.env.PREVIEW_URL || "http://127.0.0.1:4173";
(async () => {
  mkdirSync(dir, {recursive:true});
  const browser = await chromium.launch({headless:true});
  try {
    for (const width of [360, 390, 430, 768]) {
      const page = await browser.newPage({
        viewport:{width,height:860}, locale:"fa-IR", reducedMotion:"reduce",
      });
      await page.goto(base + "/", {waitUntil:"domcontentloaded"});
      const dock=page.locator(".store-bottom-nav.store-industrial-bottom-nav");
      await dock.waitFor({timeout:30000});
      await dock.getByRole("button",{name:/دسته‌ها/}).click();
      const dialog=page.locator("dialog.store-mobile-sheet.is-category-explorer[open]");
      await dialog.waitFor({timeout:30000});
      const explorer=dialog.locator('[data-testid="mobile-category-explorer"]');
      await explorer.waitFor();
      const groups=explorer.locator(".sanat-mobile-category-group");
      assert.ok(await groups.count() > 5, "Approved main groups missing");
      assert.ok(await explorer.locator(".sanat-mobile-category-item-link").count() > 0,"Subcategories missing");
      const check=await page.evaluate(()=>{
        const el=document.querySelector(".sanat-mobile-category-columns");
        const rail=document.querySelector(".sanat-mobile-category-rail");
        const result=document.querySelector(".sanat-mobile-category-results");
        const d=document.querySelector("dialog.is-category-explorer");
        if(!el||!rail||!result||!d) return null;
        const c=el.getBoundingClientRect(),r=rail.getBoundingClientRect(),l=result.getBoundingClientRect();
        return {width:innerWidth,documentWidth:document.documentElement.scrollWidth,
          railRight:r.right,resultLeft:l.left,columnsHeight:c.height,
          resultsOverflow:getComputedStyle(result).overflowY,
          railOverflow:getComputedStyle(rail).overflowY,
          sheetHeight:d.getBoundingClientRect().height};
      });
      assert.ok(check,"Category menu panels missing");
      assert.ok(check.documentWidth <= width+3,"Horizontal overflow at "+width+": "+JSON.stringify(check));
      assert.ok(check.railRight > check.resultLeft, "RTL main group rail should be on right");
      assert.equal(check.railOverflow, "auto");
      assert.equal(check.resultsOverflow, "auto");
      assert.ok(check.columnsHeight > 100);
      await page.screenshot({path:dir+"/sanat-mobile-category-"+width+".png",fullPage:false});
      if (width===390) {
        await groups.nth(1).click();
        assert.equal(await groups.nth(1).getAttribute("aria-pressed"),"true");
        const links=explorer.locator(".sanat-mobile-category-item-link");
        assert.ok(await links.count() > 0,"Group selection yielded no subcategories");
        await explorer.locator("input[type=search]").fill("تسمه");
        assert.ok(await explorer.locator(".sanat-mobile-category-item-link").count() > 0,"Searching approved menu failed");
        await explorer.locator("input[type=search]").fill("ZZZNOEXCELCATEGORYZZZ");
        await explorer.getByText("دسته‌ای با این عبارت پیدا نشد.").waitFor();
        await explorer.getByRole("button",{name:"نمایش همه دسته‌ها"}).click();
        assert.ok(await groups.count()>5,"Reset search failed");
        await page.keyboard.press("Escape");
        assert.equal(await dialog.isVisible(),false,"Escape must close the sheet");
      } else {
        await dialog.getByRole("button",{name:"بستن منو"}).click();
        assert.equal(await dialog.isVisible(),false);
      }
      console.log("PASS mobile category sheet",width,check);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
