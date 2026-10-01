SURVIVAL MAP EDITOR - UNITY EXPORT

Files
  outpost.json          Map data (ground tiles, objects, markers, collision grid)
  outpost_atlas.png     Every sprite this map uses, packed into one texture
  outpost_preview.png   Flat render of the map at 1x
  outpost.survmap.json  Editor project. Open it in the editor to keep working
  SurvivalMapLoader.cs Runtime/editor loader

Setup
  1. Copy the folder into Assets/.
  2. Select outpost_atlas.png. In the Inspector set:
       Texture Type: Sprite (2D and UI)
       Filter Mode:  Point (no filter)
       Compression:  None
     then Apply.
  3. Create an empty GameObject and add SurvivalMapLoader.
  4. Drag outpost.json into Map Json and outpost_atlas.png into Atlas.
     The map builds right away in the editor and again when you press Play.
     Right-click the component header and pick Rebuild Map after re-exporting.
  5. Camera: orthographic. For crisp pixels add a Pixel Perfect Camera
     with Assets Pixels Per Unit = 16.

Coordinates
  1 tile = 1 world unit (16 px per unit).
  The editor uses tile (0,0) at the top-left with y going down.
  In Unity the map's bottom-left corner sits at the GameObject's position.
  loader.CellToWorld(tx, ty) converts editor tiles to world positions.

Depth sorting
  Every object's sortingOrder is the bottom edge of its footprint in map pixels
  (y down). Give moving characters sortingOrder = feet y in map pixels and they
  will walk behind and in front of trees, walls and buildings correctly.

JSON reference
  width, height, tileSize      map size in tiles, 16
  season, light                season and time of day baked into the atlas
  sprites[]                    name, x, y, w, h (rect in the atlas, y from the bottom)
  ground[]                     width*height sprite indices, row by row from the top
  objects[]                    type (wall, gate, tower, building, tree), kind, sprite,
                               tx, ty, fw, fh (footprint in tiles),
                               px, py (sprite top-left in map pixels, y down),
                               order (sortingOrder), blocking
  markers[]                    type (survivor_spawn, zombie_spawn), tx, ty
  collision[]                  width*height: 0 walkable, 1 blocked, 2 gate
  buildable[]                  width*height: 1 = starting base tile (player can build), 0 = outside
                               loader.IsBuildable(tx, ty) reads it
