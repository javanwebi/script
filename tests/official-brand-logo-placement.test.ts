import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read=(pathInRepo:string)=>fs.readFileSync(path.resolve(process.cwd(),pathInRepo),"utf8");

test("FORZA workspace has the owner's orange triangular emblem at all old icon callsites",()=>{
  const mark=read("src/assets/forza-workspace-mark.svg");
  const launcher=read("src/components/common/AiFloatingButton.tsx");
  const workspace=read("src/pages/AiConsultPage.tsx");
  assert.match(mark,/viewBox="0 0 256 256"/);
  assert.match(mark,/fill-rule="evenodd"/);
  assert.match(mark,/#fe5100/);
  assert.match(launcher,/import forzaWorkspaceMark from/);
  assert.match(launcher,/src={forzaWorkspaceMark}/);
  assert.match(launcher,/export const CognivoGeometricLogo/);
  assert.ok((workspace.match(/<CognivoGeometricLogo/g)||[]).length>=3,
    "Sidebar, main topbar, welcome view must use new FORZA emblem");
});

test("corporate logo is used in portal, login, admin and storefront mobile sheet",()=>{
  const identity=read("src/components/common/BrandIdentity.tsx");
  assert.match(identity,/STORE_ASSETS\.sanatPishLogo/);
  const portal=read("src/components/portal/PortalShell.tsx");
  assert.equal((portal.match(/<SanatPishLogo/g)||[]).length,2);
  assert.doesNotMatch(portal,/<Cog size={28}/);
  const admin=read("src/admin/AdminLayout.tsx");
  const auth=read("src/components/auth/AuthVisualSidePanel.tsx");
  const mobile=read("src/components/layout/MobileBottomBar.tsx");
  const adminLogin=read("src/admin/AdminLogin.tsx");
  assert.match(admin,/<SanatPishLogo/);
  assert.doesNotMatch(admin,/>\s*AT\s*</);
  assert.match(auth,/<SanatPishLogo/);
  assert.doesNotMatch(auth,/>\s*ص\s*</);
  assert.match(adminLogin,/<SanatPishLogo/);
  assert.match(mobile,/<SanatPishLogo/);
});

test("footer uses logo2.png first and always falls back to existing approved corporate logo",()=>{
  const identity=read("src/components/common/BrandIdentity.tsx");
  const footer=read("src/components/layout/Footer.tsx");
  assert.match(identity,/src={fallback \? STORE_ASSETS\.sanatPishLogo : "\/logo2\.png"}/);
  assert.match(identity,/onError={\(\) => setFallback\(true\)}/);
  assert.equal((footer.match(/<SanatPishFooterLogo/g)||[]).length,2);
  assert.doesNotMatch(footer,/<AtlasLogoMark/);
  const header=read("src/components/layout/Header.tsx");
  assert.match(header,/STORE_ASSETS\.sanatPishLogo/);
  assert.match(header,/mobile-header-logo\.png/);
});
