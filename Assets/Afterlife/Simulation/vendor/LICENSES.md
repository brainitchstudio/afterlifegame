# Vendored third-party code

Each file here is an ES module copied from the npm package listed below. Pathfinding has its heap import localized. Valibot is tree-shaken to the exports used by saveSchema.mjs so unused Unicode emoji regexes do not prevent parsing on Unity/Mono. The retained validation functions are unchanged. Full Valibot source is preserved in Tools/VendorSource/valibot-full.mjs; regenerate with Tools/trim-valibot.mjs and esbuild 0.25.0.

| File | Package | License | Copyright | Source |
|---|---|---|---|---|
| `kdbush.mjs` | kdbush 4.1.0 | ISC | © Vladimir Agafonkin | https://cdn.jsdelivr.net/npm/kdbush@4.1.0/index.js |
| `pathfinding.mjs` | pathfinding 0.4.18 | MIT | © Xueqiao Xu | https://cdn.jsdelivr.net/npm/pathfinding@0.4.18/+esm (only change: its `heap` import points at `./heap.mjs`) |
| `heap.mjs` | heap 0.2.5 | MIT | © Xueqiao Xu | https://cdn.jsdelivr.net/npm/heap@0.2.5/+esm |
| `valibot.mjs` | valibot 1.5.0 | MIT | © Fabian Hiller | https://cdn.jsdelivr.net/npm/valibot@1.5.0/dist/index.mjs |

Full license texts: https://github.com/mourner/kdbush/blob/main/LICENSE · https://github.com/qiao/PathFinding.js/blob/master/LICENSE · https://github.com/qiao/heap.js/blob/master/LICENSE · https://github.com/fabian-hiller/valibot/blob/main/LICENSE.md
