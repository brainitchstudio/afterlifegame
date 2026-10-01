// SurvivalMapLoader.cs - builds a map exported from the Survival Map Editor.
// Add this to an empty GameObject, assign the exported .json and _atlas.png, and the map builds
// in the editor and at runtime. 1 tile = 1 world unit (16 pixels per unit). The map's top-left
// corner sits at (0, height) in local space and its bottom-left at the GameObject's position.
using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Tilemaps;

[ExecuteAlways]
public class SurvivalMapLoader : MonoBehaviour
{
    public TextAsset mapJson;
    public Texture2D atlas;
    [Tooltip("Adds a BoxCollider2D for every blocked tile (walls, towers, buildings, trees).")]
    public bool colliders = true;
    public string sortingLayer = "Default";

    [Serializable] public class MapSprite { public string name; public int x, y, w, h; }
    [Serializable] public class MapObject { public string type, kind, sprite; public int tx, ty, fw, fh, px, py, order; public bool blocking; }
    [Serializable] public class MapMarker { public string type; public int tx, ty; }
    [Serializable] public class MapData
    {
        public int version, width, height, tileSize;
        public string name, season, light, atlas;
        public MapSprite[] sprites;
        public int[] ground;
        public MapObject[] objects;
        public MapMarker[] markers;
        public int[] collision;
        public int[] buildable;
        public int[] rules;
        public MapRect baseRect;
    }
    [Serializable] public class MapRect { public int x0, y0, x1, y1; }

    public MapData Data { get; private set; }

    void OnEnable() { Build(); }

    [ContextMenu("Rebuild Map")]
    public void Build()
    {
        for (int i = transform.childCount - 1; i >= 0; i--)
        {
            var c = transform.GetChild(i).gameObject;
            if (Application.isPlaying) Destroy(c); else DestroyImmediate(c);
        }
        if (!mapJson || !atlas) return;

        var d = Data = JsonUtility.FromJson<MapData>(mapJson.text);
        float ppu = d.tileSize;
        atlas.filterMode = FilterMode.Point;
        atlas.wrapMode = TextureWrapMode.Clamp;
        var flags = Application.isPlaying ? HideFlags.None : HideFlags.DontSaveInEditor;

        var spr = new Sprite[d.sprites.Length];
        var byName = new Dictionary<string, Sprite>();
        for (int i = 0; i < d.sprites.Length; i++)
        {
            var s = d.sprites[i];
            spr[i] = Sprite.Create(atlas, new Rect(s.x, s.y, s.w, s.h), new Vector2(0, 1), ppu, 0, SpriteMeshType.FullRect);
            spr[i].name = s.name;
            byName[s.name] = spr[i];
        }

        // Ground: one Tilemap, sprites anchored at the cell's top-left.
        var grid = Child("Grid", transform, flags);
        grid.AddComponent<Grid>();
        var g = Child("Ground", grid.transform, flags);
        var tm = g.AddComponent<Tilemap>();
        tm.tileAnchor = new Vector3(0, 1, 0);
        var tr = g.AddComponent<TilemapRenderer>();
        tr.sortingLayerName = sortingLayer;
        tr.sortingOrder = short.MinValue;
        var tiles = new Dictionary<int, Tile>();
        for (int y = 0; y < d.height; y++)
            for (int x = 0; x < d.width; x++)
            {
                int k = d.ground[y * d.width + x];
                if (k < 0) continue;
                if (!tiles.TryGetValue(k, out var t))
                {
                    t = ScriptableObject.CreateInstance<Tile>();
                    t.sprite = spr[k];
                    t.hideFlags = HideFlags.DontSave;
                    tiles[k] = t;
                }
                tm.SetTile(new Vector3Int(x, d.height - 1 - y, 0), t);
            }

        // Objects: one SpriteRenderer each. sortingOrder = footprint bottom in map pixels,
        // so lower objects draw in front. Sort characters the same way (feet y in map pixels).
        var objs = Child("Objects", transform, flags);
        foreach (var o in d.objects)
        {
            var go = Child(o.type + "_" + o.kind + "_" + o.tx + "_" + o.ty, objs.transform, flags);
            go.transform.localPosition = new Vector3(o.px / ppu, d.height - o.py / ppu, 0);
            var sr = go.AddComponent<SpriteRenderer>();
            sr.sprite = byName[o.sprite];
            sr.sortingLayerName = sortingLayer;
            sr.sortingOrder = o.order;
        }

        // Collision: 0 walkable, 1 blocked, 2 gate (walkable when open - handle in game code).
        if (colliders && d.collision != null)
        {
            var col = Child("Collision", transform, flags);
            for (int y = 0; y < d.height; y++)
                for (int x = 0; x < d.width; x++)
                    if (d.collision[y * d.width + x] == 1)
                    {
                        var b = col.AddComponent<BoxCollider2D>();
                        b.offset = new Vector2(x + 0.5f, d.height - y - 0.5f);
                        b.size = Vector2.one;
                    }
        }

        // Markers: empty GameObjects at cell centres (survivor_spawn, zombie_spawn).
        var mk = Child("Markers", transform, flags);
        if (d.markers != null)
            foreach (var m in d.markers)
            {
                var go = Child(m.type, mk.transform, flags);
                go.transform.localPosition = new Vector3(m.tx + 0.5f, d.height - m.ty - 0.5f, 0);
            }
    }

    static GameObject Child(string n, Transform p, HideFlags f)
    {
        var go = new GameObject(n);
        go.hideFlags = f;
        go.transform.SetParent(p, false);
        return go;
    }

    // Map tile (tx, ty) with y down, as in the editor, to a world-space cell centre.
    public Vector3 CellToWorld(int tx, int ty) => transform.TransformPoint(new Vector3(tx + 0.5f, Data.height - ty - 0.5f, 0));

    // 1 where the player may build at the start (the Base zone layer), 0 elsewhere.
    public bool IsBuildable(int tx, int ty) =>
        Data != null && Data.buildable != null && tx >= 0 && ty >= 0 && tx < Data.width && ty < Data.height && Data.buildable[ty * Data.width + tx] == 1;

    // Per-tile placement rules (bit flags). Check these before spawning anything at runtime.
    [Flags] public enum Rule
    {
        None = 0, Base = 1, Wall = 2, Buffer = 4, Road = 8, Blocked = 16,
        Roof = 32, Facade = 64, NoZombie = 128, GatePath = 256
    }
    public enum PlaceKind { Foliage, Prop, TallProp, BaseProp, Building, Road, ZombieSpawn }
    static readonly Rule[] Deny =
    {
        Rule.Base | Rule.Wall | Rule.Buffer | Rule.Road | Rule.Blocked | Rule.Roof | Rule.GatePath | Rule.Facade, // Foliage
        Rule.Wall | Rule.Buffer | Rule.Blocked | Rule.Roof | Rule.GatePath,                                      // Prop
        Rule.Wall | Rule.Buffer | Rule.Blocked | Rule.Roof | Rule.Facade | Rule.GatePath,                        // TallProp
        Rule.Wall | Rule.Blocked | Rule.Roof | Rule.GatePath | Rule.Road,                                        // BaseProp
        Rule.Wall | Rule.Buffer | Rule.Road | Rule.Blocked | Rule.Roof | Rule.GatePath,                          // Building
        Rule.Base | Rule.Wall | Rule.Blocked,                                                                    // Road
        Rule.NoZombie | Rule.Blocked                                                                             // ZombieSpawn
    };

    public Rule RulesAt(int tx, int ty) =>
        Data == null || Data.rules == null || tx < 0 || ty < 0 || tx >= Data.width || ty >= Data.height ? Rule.Wall : (Rule)Data.rules[ty * Data.width + tx];

    public bool HasRule(int tx, int ty, Rule r) => (RulesAt(tx, ty) & r) != 0;

    // True when every tile of a fw x fh footprint (top-left tx, ty) allows this kind of object.
    public bool CanPlace(int tx, int ty, int fw, int fh, PlaceKind kind)
    {
        var deny = Deny[(int)kind];
        for (int j = 0; j < fh; j++) for (int i = 0; i < fw; i++) if ((RulesAt(tx + i, ty + j) & deny) != 0) return false;
        return true;
    }

    // Call after placing something at runtime so later checks see it.
    public void MarkBlocked(int tx, int ty, int fw, int fh)
    {
        if (Data?.rules == null) return;
        for (int j = 0; j < fh; j++) for (int i = 0; i < fw; i++)
        {
            int x = tx + i, y = ty + j;
            if (x >= 0 && y >= 0 && x < Data.width && y < Data.height) Data.rules[y * Data.width + x] |= (int)Rule.Blocked;
        }
    }

    public bool InBase(int tx, int ty) => HasRule(tx, ty, Rule.Base);

    public int CollisionAt(int tx, int ty) =>
        Data == null || tx < 0 || ty < 0 || tx >= Data.width || ty >= Data.height ? 1 : Data.collision[ty * Data.width + tx];
}
