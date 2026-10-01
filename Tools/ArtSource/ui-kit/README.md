# Design kit: tileset, characters, FX and HUD

Imported unchanged from the Claude Design project "Zombie Base Building Tileset"
(project 75d33415-4d5b-4e08-a6fa-c14f989fe491). Re-import these files rather than editing them here:

- `pixel-ui.js`: `buildUI()` returns every HUD sprite (frames, icons, bars, panels, tree nodes, and more)
- `pixel-assets-v2.js`: shared palette, the `Spr` sprite core, and `draw()`
- `pixel-buildings.js`: `buildBuildings()`, the eleven `bld_*` buildings
- `pixel-zombies.js`: `buildSurvivors()` / `buildZombies()`, 24×28 walk cycles in 8 directions
- `pixel-gunfire.js`: muzzle flash, tracer, flesh/hard impacts and casings in 16 directions
- `pixel-molotov.js`: bottle, splash, fire, burnout and burning-zombie sheets
- `*.dc.html`: the design's catalog pages, kept for reference only (they need the design tool's `support.js`)

`../art.mjs` builds the world art (1 world unit = 1 kit pixel, 16-unit grid) for `view.mjs` and the HUD portraits.

`../hudSkin.mjs` rasterizes the sprites at 2× and exposes them to `style.css` as
`--px-frame-*`, `--px-icon-*`, `--px-mini-*`, `--px-badge-*`, `--px-cursor-*` and `--px-bar-track`, scoped under `html.px-ui`.

## Where each asset is used

| Game | Kit asset |
| --- | --- |
| Ground | `grass_*` outside, `dirt_*` with `edge_*` borders on owned land, `road_*` for the two crossing roads |
| Scenery | `tree_oak` (kinds 0–1; 1 mirrored, about 12% of kind 0 dead: `tree_dead`), `tree_pine` (kind 2), `bush` / `stump` |
| Fence / barricade | `wall_palisade_*`; reinforced → `wall_planks_*`; plated → `wall_scrap_*` |
| Gate | `gate_wood_*` (plated: `gate_metal_*`) between two wall tiles, open while someone passes |
| Watchtower | `tower_open`, `tower_roofed` after two upgrades; sentries stand on the deck |
| HQ, farm, barracks | `bld_town_hall`, `bld_farm`, `bld_barracks` |
| Bunkhouse | `bld_bunkhouse` → `bld_bunkhouse` + `bld_shelter` (annex) |
| Workshop | `bld_workshop` + `bld_armory` → `bld_lumber_mill` + `bld_armory` |
| Clinic | `bld_clinic` + `bld_shelter` → `bld_lab` + `bld_shelter` |
| Survivors | outfit by job, two per job by look: guard/ranger, doctor/nurse, mechanic/engineer, elder/grower, hunter/scavenger (map and portraits) |
| Zombies | walker, runner, brute; every 7th walker wears the soldier outfit |
| Shots | gunfire flash + tracer, then flesh impact and a casing |
| Campfire | molotov fire loop |
| HUD | Survival HUD Kit (see below) |

Not used (no game mechanic yet): `bloater`, molotov bottle/splash/burning-zombie sheets, `gunfire_spark`,
`road_corner_*`, the sandbag wall set, the kit's own ghost sprites.

## HUD kit status

Done:
- **Frames:** HUD panels, floating panels, the modal, notifications, the edge alert, the objective banner,
  and every button type (toolbar, speed, modal, action rows, icon buttons, build cards, post options,
  destinations, recruit)
- **Icons:** toolbar, resource, pause/play and cost mini-icons; building emblems (`em-<type>` → kit icon);
  the demolish button
- **Bars and track:** the integrity/HP meter, and the day track (kit inset bar and phase ramps on the game's
  own phase schedule)
- **Upgrade trees:** node frames (off / btn / owned), lock and owned badges, kit connector colours
- **Portraits and cursors:** inset frames around portraits; arrow, build, deny and attack (over a zombie) cursors
- **Map selection:** kit corner brackets (lime for your own, red for zombies) replace the outlines and ellipses
- **Text:** body copy is in IBM Plex Mono and headings in Silkscreen; hover tips and order banners are framed
- **Pixi view (`view.mjs`):** overhead unit bars in the kit's ubar style; placement preview shows the building's
  own sprite tinted with the kit's ghost colours, plus corner brackets
- **Phones:** frames drop to 1× kit pixels at ≤700px, and resource icons are hidden there

Not adopted:
- HUD kit `portrait_*` faces: portraits instead crop each survivor's map outfit, so HUD and map match
- The kit's clock, toast, counter and objective sprites have baked-in sample text, so they only serve as layout references
- Prebaking `buildUI()` into a PNG atlas (`exportAtlas`): not needed yet, since generation takes about 55 ms at startup
