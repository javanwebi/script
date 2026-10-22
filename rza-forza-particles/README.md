# RZA Forza Particles (fully offline)

React + Three.js (WebGL) particle recreation of the RZA Forza avatar.
No CDN anywhere: JS, CSS (Tailwind), fonts and the image data are all inside this folder.

## Just run it (no install, no internet)
Open dist/index.html in Chrome / Edge / Firefox (double-click works).

## Folders
- dist/          ready-to-run build: index.html + app.js + app.css + fonts/
- src/App.jsx    scene, shaders, particle layers, buttons
- src/pixels.js  source image as raw RGB (800x525, base64), one particle per pixel
- src/index.css  Tailwind input + local @font-face (Noto Sans / Noto Sans Arabic, SIL OFL)
- src/tailwind.out.css  compiled Tailwind CSS (already built)
- src/fonts/     woff2 font files
- node_modules/  react 18.3.1, react-dom 18.3.1, three 0.185.1 (runtime libs, already included)
- tailwind.config.js  theme colors + fonts

## Rebuild after editing (optional)
Runtime libs are already in node_modules. Rebuilding needs the build tools esbuild + tailwindcss
(install once: npm i -D esbuild@0.27.2 tailwindcss@3.4.18), then:
  npm run build
Output goes to dist/.
