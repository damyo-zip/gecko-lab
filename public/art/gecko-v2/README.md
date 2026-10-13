# Gecko art v2

`normal-base.png` and the accompanying 96×96 PNG masks are the runtime source assets. `source-art.png` is a separately generated 1312×1199 working original, not a concept-image crop or a professional native 96px illustration. The reference images remain untouched.

`manifest.json` records the original hash, pixel sampling, palette and six anatomy annotations. All production masks intersect the PNG silhouette. `src/engine/art-data.ts` is compiled from these PNGs; the build/check tool verifies exact file hashes and indexed pixels.

From repository root:

```sh
node scripts/compile-gecko-art.mjs
node scripts/compile-gecko-art.mjs --check
node scripts/render-art-report.mjs
```

`prepare-gecko-art.mjs` rebuilds the asset from the generated working original. Do not run it automatically over an artist's edited PNGs. Compile reviewed assets directly instead. See `docs/phase6.md` for origin, architecture, actual renders and quality limitations.
