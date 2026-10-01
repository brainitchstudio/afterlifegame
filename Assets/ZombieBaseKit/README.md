# Zombie Base Kit for Unity (v2.0)

16-bit pixel art for a top-down (3/4 view) zombie survival base-builder, with import automation, a map loader and a time-of-day grade. Everything is drawn at 1x on a 16 px grid.

## Install
1. Unzip and drop the `ZombieBaseKit` folder anywhere under `Assets/`.
2. Make sure the **2D Sprite** package is installed (Window > Package Manager). It comes with the 2D templates.
3. Unity imports the art on its own. `Editor/ZombieKitImporter.cs` reads `Data/unity_import.json` and sets, for every PNG under `Art/`:
   - Sprite (2D and UI), 16 pixels per unit, Point filter, no compression, no mipmaps
   - the pivot (see below) and 8 px 9-slice borders on `UI/frame_*`
   - sheet slicing into named frames: `<file>_<row>_<rowName>_<col>`, e.g. `walker_02_e_1`
   If you add the kit before the package, run **Tools > Zombie Base Kit > Reimport Art**.
4. Camera: orthographic. For crisp pixels add a Pixel Perfect Camera with Assets PPU = 16 and scale by whole numbers.

## Folders
- `Art/Terrain/<season>/`: ground tiles (grass, dirt, edges, roads, road edges and corners), trees, bush, stump, watch towers
- `Art/Buildings/<season>/`: 11 base buildings. `<name>_door.png` is a 4-frame door strip (closed to open) the same size as the building; lay it over the building sprite
- `Art/Decor/<season>/`: 42 props (vehicles, barrels, fences, graves, tents, foliage and more)
- `Art/World/<season>/`: 8 points of interest for the wider map (farmhouse, barn, gas station, chapel and more)
- `Art/Walls/`: 4 materials x 6 pieces (`h`, `v`, `tl`, `tr`, `bl`, `br`) plus `wall_planks_dmg`. A 16x28 wall covers one tile and overhangs the tile above by 12 px
- `Art/Gates/`: 4 kinds (wood, metal, log, scrap). Horizontal `closed`/`open`, vertical `v_closed`, `v_open_e`, `v_open_w`
- `Art/Characters/`: 5 zombies, 10 survivors, and `Zombies/Burning/` variants. 24x28 frames, 4 columns x 8 rows, rows `s, n, e, w, se, sw, ne, nw`
- `Art/FX/Gunfire/`: `flash`, `tracer`, `spark`, `blood` with 16 rows, one per firing direction (row i = i x 22.5 deg clockwise from east, screen Y down). `casing` is a 4-frame spin
- `Art/FX/Molotov/`: bottle spin, shadow, splash, looping ground fire, burnout and the `scorch` decal
- `Art/Lights/`: torch and flashlight light cookies (greyscale), plus small torch and flashlight props
- `Art/UI/`: HUD panels, buttons in every state, icons, bars, toasts, minimap, cursors, selection brackets, placement ghosts (`ghost_<building>_ok/_bad`), research tree nodes and connectors, survivor cards, bitmap fonts
- `Art/Title/`: title background, logo, main menu, new game / load / settings panels and controls, and a composed `title_screen`
- `Data/manifest.json`: every asset with size, footprint (in tiles), door region, frame layout, fps and file path. `{season}` in a path is `spring`, `summer`, `fall` or `winter`
- `Data/lighting.json`: time-of-day grades, hand-light strengths and season palettes
- `Source/`: the JavaScript generators that draw every sprite. Unity ignores them

## Placement and pivots
- Grid objects (terrain, trees, walls, gates, towers, buildings, world, decor) pivot at **bottom-left**. Put the sprite at the bottom-left corner of its footprint. Anything taller than the footprint is roof or overhang and doesn't block.
- Characters pivot at **bottom-centre** (their feet).
- Gunfire pivots at the centre. Splash, fire, burnout and scorch pivot at the point where the bottle lands.
- The flashlight cookie pivots at the lens and points east; rotate it to aim.
- UI and title art pivot at the centre.

## Seasons
Each season folder has the same file names, so swap seasons by loading the same key from a different folder. Walls, gates, characters, FX and UI don't change with the season.

## Depth sorting
Either set Project Settings > Graphics > Transparency Sort Mode to Custom Axis (0, 1, 0) and let the pivots handle it, or set `sortingOrder` from the ground Y. `SurvivalMapLoader` uses sortingOrder = footprint bottom in map pixels, and `KitSpriteAnimator` matches it when you assign its `map` field.

## Scripts
- `Scripts/SurvivalMapLoader.cs`: builds a map exported from the Map Editor (Tilemap ground, sorted objects, colliders, spawn markers). See `MAP_EXPORT.txt`.
- `Scripts/KitSpriteAnimator.cs`: plays a sliced sheet. Drag in all of a sheet's sprites, then call `Face(velocity)` for walk sheets or `Aim(direction)` for gunfire.
- `Scripts/SurvivalLighting.cs` + `Shaders/GradedSprite.shader`: the time-of-day grade from the editors (early morning through late night). Add SurvivalLighting to the scene, make a material with `ZombieBaseKit/GradedSprite` and use it on your sprite renderers. Set `hour` (0 to 24) or pick a preset. `Darkness` (0 to 1) tells you how strongly torches and flashlights should read; draw the light cookies additively, scaled by it.
  - Windows light up after dark, the same as in the editors: the three glass colours (`#1f2825`, `#34423c`, `#566a60`) blend to warm lamplight, partly at dusk and dawn and fully at night. `windowGlow` on SurvivalLighting scales it globally. To switch one building's lights off (unpowered, abandoned), give it a material instance with `Window Glow` = 0. This needs the art uncompressed with point filtering, which the importer sets.

## Rendering rules
- Point filtering only, whole-number scaling, snap positions to whole pixels.
- Every sprite has a 1 px dark outline (`#1a1e16`). Baked cast shadows are the only semi-transparent pixels.
- Don't edit the PNGs by hand. Change the generators in `Source/` and re-export.
