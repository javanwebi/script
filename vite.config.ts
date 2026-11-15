import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import fs from "node:fs";
import { publicCatalog } from "./src/utils/catalogPrivacy";

export default defineConfig(() => {
  return {
    plugins: [
      {
        name: "public-catalog-only",
        enforce: "pre",
        load(id) {
          if (
            /src\/data\/(catalogOverridesDb|catalogueSource|catalogSummary)\.json$/.test(
              id,
            )
          )
            return JSON.stringify(
              publicCatalog(JSON.parse(fs.readFileSync(id, "utf8"))),
            );
        },
      },
      {
        name: "copy-belt-catalog-assets",
        apply: "build",
        writeBundle(options) {
          const outRoot = options.dir
            ? path.resolve(options.dir)
            : path.resolve(__dirname, "dist");
          const srcBeltsRoot = path.resolve(__dirname, "src/assets/catalog/belts");
          const destBeltsRoot = path.join(outRoot, "src/assets/catalog/belts");
          for (const sub of ["families", "skus"]) {
            const srcSub = path.join(srcBeltsRoot, sub);
            const destSub = path.join(destBeltsRoot, sub);
            if (fs.existsSync(srcSub)) {
              fs.mkdirSync(path.dirname(destSub), { recursive: true });
              fs.cpSync(srcSub, destSub, { recursive: true, force: true });
            }
          }
        },
      },
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== "true",
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === "true" ? null : {},
      allowedHosts: true as const,
      host: true,
    },
  };
});
