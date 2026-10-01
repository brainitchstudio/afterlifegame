SURVIVAL MAP EDITOR - UNITY EXPORT

Files
  {name}.json          Map data (ground tiles, objects, markers, collision grid)
  {name}_atlas.png     Every sprite this map uses, packed into one texture
  {name}_preview.png   Flat render of the map at 1x
  {name}.survmap.json  Editor project. Open it in the editor to keep working
  SurvivalMapLoader.cs Runtime/editor loader

Setup
  1. Copy the folder into Assets/.
  2. Select {name}_atlas.png. In the Inspector set:
       Texture Type: Sprite (2D and UI)
       Filter Mode:  Point (no filter)
       Compression:  None
     then Apply.
  3. Create an empty GameObject and add SurvivalMapLoader.
  4. Drag {name}.json into Map Json and {name}_atlas.png into Atlas.
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
  rules[]                      width*height bit flags for runtime placement (see below)
  baseRect                     x0, y0, x1, y1 of the starting base, walls included

Placement rules
  Anything your game spawns at runtime (trees, props, loot, roads, zombies) should check the
  rules grid first, or it can land inside the base, on the wall or on the gate road.
    if (loader.CanPlace(tx, ty, fw, fh, SurvivalMapLoader.PlaceKind.Foliage)) { spawn; loader.MarkBlocked(tx, ty, fw, fh); }
  Bits
    1   Base       inside the starting base
    2   Wall       wall, gate or tower
    4   Buffer     clear ring outside the wall (3 tiles, 4 on the south side)
    8   Road
    16  Blocked    footprint of a blocking object
    32  Roof       a building or tower sprite covers this tile
    64  Facade     two rows in front of a building
    128 NoZombie   base, buffer and 8 tiles beyond
    256 GatePath   approach through the gate, inside and out
  PlaceKind denies
    Foliage      Base Wall Buffer Road Blocked Roof Facade GatePath
    Prop         Wall Buffer Blocked Roof GatePath
    TallProp     Wall Buffer Blocked Roof Facade GatePath
    BaseProp     Wall Blocked Roof GatePath Road   (crates, drums, campfires inside the base)
    Building     Wall Buffer Road Blocked Roof GatePath
    Road         Base Wall Blocked
    ZombieSpawn  NoZombie Blocked
