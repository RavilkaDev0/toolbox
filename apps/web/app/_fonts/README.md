# Local fonts

Geist Sans and Geist Mono Latin variable WOFF2 files were copied without modification from the installed Next.js 16.4.0 `dist/next-devtools/server/font` assets. They are committed local application assets, not runtime imports of Next.js internals. Both use SIL OFL 1.1; the upstream license is included as `OFL.txt` (vercel/geist-font). No Google Fonts request is made at build or runtime. Sans is preloaded by next/font/local; Mono is not preloaded. Latin-only matches the current English launch UI; add audited subsets before localization.
