# Agent notes

- Load assets through `Data/manifest.json`. Don't hard-code sizes; read `w`/`h`, `footprint` and the frame fields from it. Replace `{season}` in paths with `spring`, `summer`, `fall` or `winter`.
- Import settings, pivots and slicing come from `Data/unity_import.json` via `Editor/ZombieKitImporter.cs`. Change that file, not the .meta files.
- 16 px = 1 world unit. Grid objects pivot bottom-left on their footprint; characters bottom-centre.
- Sort by ground Y (the bottom of the footprint).
- Walk sheets: rows `s, n, e, w, se, sw, ne, nw`. Gunfire: 16 rows clockwise from east in 22.5 deg steps. Sliced sprite names are `<file>_<row>_<rowName>_<col>`.
- While placing a building, draw `Art/UI/ghost_<building>_ok.png` over valid tiles and `_bad.png` over blocked ones.
- Door strips (`<building>_door.png`) are 4 frames, closed to open, each the size of the building sprite.
- Time of day: use `SurvivalLighting` + the `ZombieBaseKit/GradedSprite` material. Don't bake graded copies of the art.
- `README.md` has the full conventions.
