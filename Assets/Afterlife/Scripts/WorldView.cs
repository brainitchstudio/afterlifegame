using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace Afterlife
{
    /// <summary>Unity SpriteRenderer world, using the original art at one world unit per pixel.</summary>
    public sealed class WorldView : MonoBehaviour
    {
        sealed class Actor
        {
            public SpriteRenderer sprite, healthBack, healthFill, lightCookie, towerOverlay;
            public Vector2 last, target;
            public float walk;
            public string direction = "s";
            public EntityView entity;
            public EntityAuthoring authoring;
        }
        public Camera Camera { get; private set; }
        public TerrainData Terrain { get; private set; }
        public const float DefaultTacticalZoom = 0.28f;
        public const float MinZoom = 0.18f;
        public const float MaxZoom = 4.0f;
        public float BaseOrthographicSize { get; private set; } = 458f;
        public float CurrentZoom { get; private set; } = DefaultTacticalZoom;
        public float TargetZoom { get; private set; } = DefaultTacticalZoom;
        public Vector2 Bounds => new Vector2(BaseOrthographicSize * Camera.aspect, BaseOrthographicSize);
        public int FollowTargetId { get; private set; } = -1;

        static readonly string[] Dirs = { "e", "se", "s", "sw", "w", "nw", "n", "ne" };
        Transform envParent, treesParent, entitiesParent, survivorsParent, buildingsParent, zombiesParent, effectsParent, overlaysParent, healthBarsParent, decorParent, worldBuildingsParent, poiBadgesParent;
        readonly Dictionary<string, Sprite> sprites = new Dictionary<string, Sprite>();
        readonly Dictionary<string, Sprite> walkSpriteCache = new Dictionary<string, Sprite>(512);
        readonly Dictionary<string, Sprite> ghostSpriteCache = new Dictionary<string, Sprite>();
        readonly Dictionary<string, AtlasEntry> entries = new Dictionary<string, AtlasEntry>();
        readonly Dictionary<string, Texture2D> entryTextures = new Dictionary<string, Texture2D>();
        Texture2D worldAtlas;
        readonly Dictionary<int, Actor> actors = new Dictionary<int, Actor>();
        readonly HashSet<int> aliveIds = new HashSet<int>(128);
        readonly List<int> deadIds = new List<int>(32);
        readonly List<Vector2> characterPositions = new List<Vector2>(64);
        readonly HashSet<EffectView> liveShots = new HashSet<EffectView>(32);
        readonly List<SpriteRenderer> trees = new List<SpriteRenderer>();
        readonly List<SpriteRenderer> effects = new List<SpriteRenderer>();
        readonly List<SpriteRenderer> claims = new List<SpriteRenderer>();
        readonly List<SpriteRenderer> brackets = new List<SpriteRenderer>();
        readonly List<SpriteRenderer> decorRenderers = new List<SpriteRenderer>();
        readonly List<SpriteRenderer> worldBuildingRenderers = new List<SpriteRenderer>();
        readonly List<SpriteRenderer> poiBadges = new List<SpriteRenderer>();
        string currentSeason = "summer";
        Texture2D atlas, groundTexture;
        Sprite groundSprite, pixel;
        SpriteRenderer ground, fire, ghost;
        Frame frame;
        Color grade = Color.white;
        float frameAt;
        int width, height, revision = -1;
        bool expanding;
        float[] fireAnchor;
        Vector3 targetCamPos = new Vector3(0, 0, -10);
        string lastPhase = "";
        float lastShotSfxTime, lastHitSfxTime, lastBashSfxTime;
        public int Selected { get; set; } = -1;
        SurvivalLighting lighting;
        Material gradedMaterial;
        // Terrain rebuild cache: skip the expensive ground texture + tree/decor rebuild when only
        // the claims overlay or camera size changed.
        int cachedMapW, cachedMapH;
        float cachedOriginX, cachedOriginY;
        string cachedSeason = "";
        float cachedBoundsX, cachedBoundsY;

        class ImpactFx
        {
            public string kind;
            public int dir;
            public Vector2 pos;
            public Vector2 vel;
            public float age;
            public float maxAge;
        }
        readonly List<ImpactFx> impacts = new List<ImpactFx>();
        readonly HashSet<EffectView> seenShots = new HashSet<EffectView>();
        readonly List<SpriteRenderer> targetLines = new List<SpriteRenderer>();

        public void Initialize(Camera camera)
        {
            Camera = camera;
            CurrentZoom = DefaultTacticalZoom;
            TargetZoom = DefaultTacticalZoom;
            Camera.orthographicSize = BaseOrthographicSize * CurrentZoom;
            targetCamPos = camera.transform.position;

            lighting = GetComponent<SurvivalLighting>();
            if (!lighting) lighting = gameObject.AddComponent<SurvivalLighting>();
            var gradedShader = Shader.Find("ZombieBaseKit/GradedSprite");
            if (gradedShader != null)
            {
                gradedMaterial = new Material(gradedShader);
            }

            envParent = new GameObject("Environment").transform; envParent.SetParent(transform, false);
            treesParent = new GameObject("Trees").transform; treesParent.SetParent(envParent, false);

            entitiesParent = new GameObject("Entities").transform; entitiesParent.SetParent(transform, false);
            survivorsParent = new GameObject("Survivors").transform; survivorsParent.SetParent(entitiesParent, false);
            buildingsParent = new GameObject("Buildings").transform; buildingsParent.SetParent(entitiesParent, false);
            zombiesParent = new GameObject("Zombies").transform; zombiesParent.SetParent(entitiesParent, false);

            effectsParent = new GameObject("Effects").transform; effectsParent.SetParent(transform, false);
            overlaysParent = new GameObject("Overlays").transform; overlaysParent.SetParent(transform, false);
            healthBarsParent = new GameObject("HealthBars").transform; healthBarsParent.SetParent(overlaysParent, false);

            decorParent = new GameObject("Decor").transform; decorParent.SetParent(envParent, false);
            worldBuildingsParent = new GameObject("WorldBuildings").transform; worldBuildingsParent.SetParent(entitiesParent, false);
            poiBadgesParent = new GameObject("POIs").transform; poiBadgesParent.SetParent(overlaysParent, false);

            atlas = Resources.Load<Texture2D>("AfterlifeAtlas");
            var manifestText = Resources.Load<TextAsset>("AfterlifeAtlas");
            if (manifestText != null)
            {
                var manifest = JsonUtility.FromJson<AtlasManifest>(manifestText.text);
                fireAnchor = manifest.fireAnchor;
                foreach (var e in manifest.entries) { entries[e.key] = e; entryTextures[e.key] = atlas; }
            }

            worldAtlas = Resources.Load<Texture2D>("WorldAtlas");
            var worldText = Resources.Load<TextAsset>("WorldAtlas");
            if (worldText != null)
            {
                var worldManifest = JsonUtility.FromJson<AtlasManifest>(worldText.text);
                if (worldManifest != null && worldManifest.entries != null)
                {
                    foreach (var e in worldManifest.entries) { entries[e.key] = e; entryTextures[e.key] = worldAtlas; }
                }
            }
            var white = new Texture2D(1, 1); white.SetPixel(0, 0, Color.white); white.Apply();
            pixel = Sprite.Create(white, new Rect(0, 0, 1, 1), new Vector2(.5f, .5f), 1);
            ground = Make("Terrain", -30000, envParent);
            fire = Make("Campfire", 92, envParent);
            ghost = Make("Construction preview", 29000, overlaysParent, true);
            ghost.enabled = false;
            for (int i = 0; i < 8; i++) brackets.Add(Make("Selection", 30000, overlaysParent, true));
        }

        SpriteRenderer Make(string name, int order, Transform parent = null, bool unlit = false)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent != null ? parent : transform, false);
            var r = go.AddComponent<SpriteRenderer>();
            r.sortingOrder = order;
            if (!unlit && gradedMaterial != null) r.material = gradedMaterial;
            return r;
        }

        public Sprite GetSprite(string key)
        {
            if (sprites.TryGetValue(key, out var sprite)) return sprite;
            if (!entries.TryGetValue(key, out var e)) return null;
            var tex = (entryTextures.TryGetValue(key, out var t) && t != null) ? t : atlas;
            var pivot = new Vector2(e.ax, 1 - e.ay);
            if (key.StartsWith("plots/tower")) pivot = new Vector2(0.5f, 16f / e.h);
            if (key.StartsWith("survivors/") || key.StartsWith("zombies/") || key.StartsWith("burning/")) pivot = new Vector2(.5f, 2f / 28);
            if (key.StartsWith("gunfire/")) pivot = new Vector2(.5f, .5f);
            if (key.StartsWith("molotov/fire/")) pivot = new Vector2(fireAnchor != null && fireAnchor.Length > 0 ? fireAnchor[0] / e.w : .5f, fireAnchor != null && fireAnchor.Length > 1 ? 1 - fireAnchor[1] / e.h : .5f);
            if (key.StartsWith("decor/")) pivot = new Vector2(.5f, 0f);
            if (key.StartsWith("world/")) pivot = new Vector2(0f, 0f);
            if (key.StartsWith("tiles/bridge_") || key.StartsWith("tiles/str_dock")) pivot = new Vector2(0f, 1f);
            if (key == "lights/light_flashlight_e") pivot = new Vector2(12f / e.w, 1f - 28.5f / e.h);
            if (key == "lights/light_torch") pivot = new Vector2(.5f, .5f);
            sprite = Sprite.Create(tex, new Rect(e.x, tex.height - e.y - e.h, e.w, e.h), pivot, 1, 0, SpriteMeshType.FullRect);
            sprites.Add(key, sprite); return sprite;
        }

        static string SeasonSuffix(string season)
        {
            if (string.IsNullOrEmpty(season) || season == "summer") return "";
            return "_" + season;
        }

        public Sprite GetSeasonalSprite(string key, string season)
        {
            string sf = SeasonSuffix(season);
            if (!string.IsNullOrEmpty(sf))
            {
                string seasonalKey = key + sf;
                if (entries.ContainsKey(seasonalKey)) return GetSprite(seasonalKey);
            }
            return GetSprite(key);
        }

        public Sprite GetWalkSprite(string baseSprite, string dir, int walkFrame)
        {
            string key = baseSprite + "/" + dir + "/" + walkFrame;
            if (walkSpriteCache.TryGetValue(key, out var s)) return s;
            s = GetSprite(key);
            if (!s) s = GetSprite(baseSprite + "/s/0");
            walkSpriteCache[key] = s;
            return s;
        }

        public bool Fit(Frame state, bool expand)
        {
            if (revision == state.landRevision && width == Screen.width && height == Screen.height && expanding == expand) return false;
            revision = state.landRevision; width = Screen.width; height = Screen.height; expanding = expand;
            float extra = expand ? 520 : 330;
            var t = state.territory;
            float w = 2 * Mathf.Max(Mathf.Abs(t.left), t.right) + extra;
            float h = 2 * Mathf.Max(Mathf.Abs(t.top), t.bottom) + (expand ? 500 : 340);
            BaseOrthographicSize = Mathf.Max(h / 2, w / Camera.aspect / 2);
            Camera.orthographicSize = BaseOrthographicSize * CurrentZoom;
            return true;
        }

        public void PanCamera(Vector2 deltaWorld)
        {
            FollowTargetId = -1;
            float panScale = Camera.orthographicSize / BaseOrthographicSize;
            targetCamPos.x += deltaWorld.x * panScale;
            targetCamPos.y += deltaWorld.y * panScale;
            ClampCamera();
        }

        public void DragCamera(Vector2 deltaScreenPixels)
        {
            if (Camera == null) return;
            FollowTargetId = -1;
            float worldPerPixel = (2f * Camera.orthographicSize) / Screen.height;
            targetCamPos.x -= deltaScreenPixels.x * worldPerPixel;
            targetCamPos.y -= deltaScreenPixels.y * worldPerPixel;
            Camera.transform.position = targetCamPos;
            ClampCamera();
        }

        public void ZoomCamera(float zoomDelta)
        {
            ZoomCamera(zoomDelta, Vector2.zero, false);
        }

        public void ZoomCamera(float zoomDelta, Vector2 screenPos, bool towardsCursor)
        {
            float prevTarget = TargetZoom;
            TargetZoom = Mathf.Clamp(TargetZoom - zoomDelta, MinZoom, MaxZoom);
            if (Mathf.Approximately(prevTarget, TargetZoom)) return;

            if (towardsCursor && Camera != null && screenPos != Vector2.zero && FollowTargetId < 0)
            {
                Vector3 vp = Camera.ScreenToViewportPoint(screenPos);
                float vx = (vp.x - 0.5f) * 2f * Camera.aspect;
                float vy = (vp.y - 0.5f) * 2f;
                float deltaSize = (prevTarget - TargetZoom) * BaseOrthographicSize;
                targetCamPos.x += vx * deltaSize;
                targetCamPos.y += vy * deltaSize;
            }
            ClampCamera();
        }

        public void FocusOn(Vector2 worldPos)
        {
            FollowTargetId = -1;
            targetCamPos = new Vector3(worldPos.x, -worldPos.y, -10);
            TargetZoom = DefaultTacticalZoom;
            ClampCamera();
        }

        public void Follow(int entityId)
        {
            FollowTargetId = entityId;
            Vector2 pos = Vector2.zero;
            bool found = false;
            if (actors.TryGetValue(entityId, out var a) && a != null)
            {
                pos = a.target;
                found = true;
            }
            else if (frame != null && frame.entities != null)
            {
                var ent = frame.entities.FirstOrDefault(e => e.id == entityId);
                if (ent != null)
                {
                    pos = new Vector2(ent.x, ent.y);
                    found = true;
                }
            }

            if (found)
            {
                targetCamPos = new Vector3(pos.x, -pos.y, -10);
                TargetZoom = DefaultTacticalZoom;
                ClampCamera();
            }
        }

        public void ClearFollow()
        {
            FollowTargetId = -1;
        }

        public void ResetCamera()
        {
            FollowTargetId = -1;
            TargetZoom = DefaultTacticalZoom;
            targetCamPos = new Vector3(0, 0, -10);
            ClampCamera();
        }

        void ClampCamera()
        {
            if (frame == null) return;
            float minX, maxX, minY, maxY;
            if (Terrain != null && Terrain.mapWidth > 0 && Terrain.mapHeight > 0)
            {
                float mapW = Terrain.mapWidth * 16f, mapH = Terrain.mapHeight * 16f;
                float left = -Terrain.originX, right = left + mapW;
                float margin = 120f;
                minX = left - margin;
                maxX = right + margin;
                float top = Terrain.originY;
                float bottom = -(mapH - Terrain.originY);
                minY = bottom - margin;
                maxY = top + margin;
            }
            else
            {
                var t = frame.territory;
                maxX = Mathf.Max(Mathf.Abs(t.left), t.right) + 350f;
                maxY = Mathf.Max(Mathf.Abs(t.top), t.bottom) + 350f;
                minX = -maxX;
                minY = -maxY;
            }
            targetCamPos.x = Mathf.Clamp(targetCamPos.x, minX, maxX);
            targetCamPos.y = Mathf.Clamp(targetCamPos.y, minY, maxY);
        }

        static uint Hash(int x, int y)
        {
            unchecked { uint n = (uint)(x * 374761393 + y * 668265263); n = (n ^ n >> 13) * 1274126177; return n ^ n >> 16; }
        }
        static float Noise(int x, int y) => Hash(x, y) / 4294967296f;

        public void RebuildTerrain(TerrainData data)
        {
            Terrain = data;
            string curSeason = !string.IsNullOrEmpty(data.season) ? data.season : (!string.IsNullOrEmpty(currentSeason) ? currentSeason : "summer");
            currentSeason = curSeason;
            string sf = SeasonSuffix(curSeason);

            // Detect whether only the claims overlay needs updating (expanding toggle, screen resize)
            // while the actual map content hasn't changed. If so, take the fast path.
            bool hasMapGround = data.mapWidth > 0 && data.mapHeight > 0 &&
                data.ground != null && data.ground.Length == data.mapWidth * data.mapHeight;
            bool mapChanged = data.mapWidth != cachedMapW || data.mapHeight != cachedMapH
                || data.originX != cachedOriginX || data.originY != cachedOriginY
                || curSeason != cachedSeason;
            if (!hasMapGround)
            {
                // Fallback terrain: also invalidate on bounds change
                float bx = Mathf.CeilToInt((Bounds.x + 60) / 16) * 16;
                float by = Mathf.CeilToInt((Bounds.y + 60) / 16) * 16;
                if (bx != cachedBoundsX || by != cachedBoundsY) mapChanged = true;
                cachedBoundsX = bx; cachedBoundsY = by;
            }
            bool claimsOnly = !mapChanged && groundTexture != null;

            if (claimsOnly)
            {
                // Fast path: only rebuild claims overlay
                foreach (var c in claims) if (c) Destroy(c.gameObject); claims.Clear();
                if (expanding) foreach (var p in data.frontier)
                {
                    var r = Make("Claim land " + p.col + "," + p.row, -29000, overlaysParent); r.sprite = pixel;
                    r.transform.position = new Vector3(p.col * 256, -p.row * 192, 0); r.transform.localScale = new Vector3(248, 184, 1);
                    r.color = new Color(.8f, .95f, .55f, .18f); claims.Add(r);
                }
                return;
            }

            // Full rebuild: update cache keys
            cachedMapW = data.mapWidth; cachedMapH = data.mapHeight;
            cachedOriginX = data.originX; cachedOriginY = data.originY;
            cachedSeason = curSeason;

            foreach (var t in trees) if (t) Destroy(t.gameObject); trees.Clear();
            foreach (var c in claims) if (c) Destroy(c.gameObject); claims.Clear();
            foreach (var d in decorRenderers) if (d) Destroy(d.gameObject); decorRenderers.Clear();
            foreach (var b in worldBuildingRenderers) if (b) Destroy(b.gameObject); worldBuildingRenderers.Clear();
            foreach (var p in poiBadges) if (p) Destroy(p.gameObject); poiBadges.Clear();
            if (poiBadgesParent != null)
            {
                for (int i = poiBadgesParent.childCount - 1; i >= 0; i--)
                {
                    var c = poiBadgesParent.GetChild(i).gameObject;
                    if (Application.isPlaying) Destroy(c); else DestroyImmediate(c);
                }
            }
            if (groundSprite) Destroy(groundSprite);
            if (groundTexture) Destroy(groundTexture);
            int textureWidth, textureHeight;
            Color32[] pixels;
            var tilePixels = new Dictionary<string, Color32[]>();
            if (hasMapGround)
            {
                textureWidth = data.mapWidth * 16;
                textureHeight = data.mapHeight * 16;
                pixels = new Color32[textureWidth * textureHeight];
                for (int ty = 0; ty < data.mapHeight; ty++) for (int tx = 0; tx < data.mapWidth; tx++)
                {
                    string baseKey = "tiles/" + data.ground[ty * data.mapWidth + tx];
                    string tileKey = baseKey;
                    if (!string.IsNullOrEmpty(sf) && entries.ContainsKey(tileKey + sf)) tileKey += sf;
                    if (!tilePixels.TryGetValue(tileKey, out var tile))
                    {
                        if (!entries.TryGetValue(tileKey, out var e) && !entries.TryGetValue(baseKey, out e))
                            e = entries["tiles/grass_a"];
                        var raw = atlas.GetPixels(e.x, atlas.height - e.y - e.h, e.w, e.h);
                        tile = new Color32[raw.Length]; for (int p = 0; p < raw.Length; p++) tile[p] = raw[p];
                        tilePixels.Add(tileKey, tile);
                    }
                    int destY = (data.mapHeight - ty - 1) * 16;
                    for (int py = 0; py < 16; py++) Array.Copy(tile, py * 16, pixels, (destY + py) * textureWidth + tx * 16, 16);
                }
                ground.transform.position = new Vector3(textureWidth * .5f - data.originX, data.originY - textureHeight * .5f, 0);
            }
            else
            {
                int bx = Mathf.CeilToInt((Bounds.x + 60) / 16) * 16, by = Mathf.CeilToInt((Bounds.y + 60) / 16) * 16;
                textureWidth = bx * 2; textureHeight = by * 2;
                pixels = new Color32[textureWidth * textureHeight];
                var keys = new HashSet<string>(data.land.Select(p => p.col + "," + p.row));
                Func<int, int, bool> owned = (x, y) => keys.Contains(Mathf.FloorToInt((x + 128f) / 256) + "," + Mathf.FloorToInt((y + 96f) / 192));
                for (int y = -by; y < by; y += 16) for (int x = -bx; x < bx; x += 16)
                {
                    bool inside = owned(x + 8, y + 8), v = x >= -32 && x < 32, h = y >= -32 && y < 32;
                    string k;
                    if (v && h) k = "road_x";
                    else if (v) k = Noise(x, y) < .06 ? "road_p" : inside || x != -32 && x != 16 ? "road_v" : x < 0 ? "road_edge_w" : "road_edge_e";
                    else if (h) k = Noise(x, y) < .06 ? "road_p" : inside || y != -32 && y != 16 ? "road_h" : y < 0 ? "road_edge_n" : "road_edge_s";
                    else if (inside) k = !owned(x + 8, y - 8) ? "edge_n" : !owned(x + 8, y + 24) ? "edge_s" : !owned(x - 8, y + 8) ? "edge_w" : !owned(x + 24, y + 8) ? "edge_e" : "dirt_" + (Noise(x, y) < .6 ? "a" : Noise(x, y) < .85 ? "b" : "c");
                    else k = "grass_" + (Noise(x, y) < .6 ? "a" : Noise(x, y) < .85 ? "b" : "c");
                    string tileKey = "tiles/" + k;
                    if (!string.IsNullOrEmpty(sf) && entries.ContainsKey(tileKey + sf)) tileKey += sf;
                    if (!tilePixels.TryGetValue(tileKey, out var tile))
                    {
                        var e = entries.TryGetValue(tileKey, out var entry) ? entry : entries["tiles/" + k];
                        var raw = atlas.GetPixels(e.x, atlas.height - e.y - e.h, e.w, e.h);
                        tile = new Color32[raw.Length]; for (int p = 0; p < raw.Length; p++) tile[p] = raw[p];
                        tilePixels.Add(tileKey, tile);
                    }
                    for (int py = 0; py < 16; py++) Array.Copy(tile, py * 16, pixels, (by - y - 16 + py) * textureWidth + x + bx, 16);
                }
                ground.transform.localPosition = Vector3.zero;
            }
            groundTexture = new Texture2D(textureWidth, textureHeight, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point };
            groundTexture.SetPixels32(pixels); groundTexture.Apply(false, true);
            groundSprite = Sprite.Create(groundTexture, new Rect(0, 0, textureWidth, textureHeight), new Vector2(.5f, .5f), 1);
            ground.sprite = groundSprite;

            if (data.trees != null)
            {
                foreach (var t in data.trees)
                {
                    string key = t.kind == 2 ? "tree_pine" : t.kind == 0 && Noise((int)t.x, (int)t.y) < .12 ? "tree_dead" : "tree_oak";
                    float anchor = key == "tree_pine" ? 41 : key == "tree_dead" ? 34 : 36;
                    string treeKey = "tiles/" + key;
                    if (!string.IsNullOrEmpty(sf) && entries.ContainsKey(treeKey + sf))
                        treeKey += sf;

                    var r = Make("Tree", Mathf.RoundToInt(t.y + 15), treesParent);
                    r.sprite = GetSprite(treeKey);
                    if (!r.sprite) r.sprite = GetSprite("tiles/" + key);
                    r.transform.position = new Vector3(t.x, -t.y - (r.sprite.rect.height - anchor) * t.scale, 0);
                    r.transform.localScale = new Vector3(t.kind == 1 ? -t.scale : t.scale, t.scale, 1);
                    trees.Add(r);
                }
            }

            if (data.worldBuildings != null)
            {
                foreach (var b in data.worldBuildings)
                {
                    string bKey = b.key;
                    if (!string.IsNullOrEmpty(sf) && entries.ContainsKey(bKey + sf))
                        bKey += sf;

                    var r = Make("WorldBuilding_" + b.k, Mathf.RoundToInt(b.order), worldBuildingsParent);
                    r.sprite = GetSprite(bKey);
                    if (!r.sprite) r.sprite = GetSprite(b.key);
                    r.transform.position = new Vector3(b.x, -(b.y + b.fh * 16), 0);
                    worldBuildingRenderers.Add(r);
                }
            }

            if (data.decor != null)
            {
                foreach (var d in data.decor)
                {
                    string dKey = d.key;
                    if (!string.IsNullOrEmpty(sf) && entries.ContainsKey(dKey + sf))
                        dKey += sf;

                    var r = Make("Decor_" + d.k, Mathf.RoundToInt(d.order), decorParent);
                    r.sprite = GetSprite(dKey);
                    if (!r.sprite) r.sprite = GetSprite(d.key);
                    r.transform.position = new Vector3(d.x, -d.y, 0);
                    decorRenderers.Add(r);
                }
            }

            if (data.pois != null)
            {
                var starSpr = LoadBadge("badge_star");
                var checkSpr = LoadBadge("badge_check");
                foreach (var p in data.pois)
                {
                    var badgeGo = new GameObject("POI_" + p.name);
                    badgeGo.transform.SetParent(poiBadgesParent, false);
                    badgeGo.transform.position = new Vector3(p.x, -p.y, 0);

                    // High-contrast backing plate so the badge is legible against any terrain
                    var bg = Make("POI_Bg_" + p.id, 28990, badgeGo.transform, true);
                    bg.sprite = pixel;
                    bg.transform.localScale = new Vector3(16, 16, 1);
                    bg.color = p.scavenged ? new Color(0.12f, 0.16f, 0.12f, 0.85f) : new Color(0.15f, 0.18f, 0.12f, 0.92f);

                    var icon = Make("POI_Badge_" + p.id, 29000, badgeGo.transform, true);
                    icon.sprite = p.scavenged ? checkSpr : starSpr;
                    if (icon.sprite != null)
                    {
                        float ppu = icon.sprite.pixelsPerUnit;
                        float scale = (12f / Mathf.Max(1f, icon.sprite.rect.width)) * ppu;
                        icon.transform.localPosition = Vector3.zero;
                        icon.transform.localScale = new Vector3(scale, scale, 1);
                        icon.color = p.scavenged ? new Color(0.65f, 0.85f, 0.65f, 0.95f) : new Color(1.0f, 0.88f, 0.32f, 1f);
                    }
                    poiBadges.Add(icon);
                }
            }

            if (expanding) foreach (var p in data.frontier)
            {
                var r = Make("Claim land " + p.col + "," + p.row, -29000, overlaysParent); r.sprite = pixel;
                r.transform.position = new Vector3(p.col * 256, -p.row * 192, 0); r.transform.localScale = new Vector3(248, 184, 1);
                r.color = new Color(.8f, .95f, .55f, .18f); claims.Add(r);
            }
        }

        public void Present(Frame state)
        {
            frame = state; frameAt = Time.unscaledTime;
            if (!string.IsNullOrEmpty(state.season) && state.season != currentSeason)
            {
                currentSeason = state.season;
                if (Terrain != null)
                {
                    Terrain.season = currentSeason;
                    RebuildTerrain(Terrain);
                }
            }
            if (state.scavengedPois != null && poiBadges.Count > 0)
            {
                var checkSpr = LoadBadge("badge_check");
                for (int i = 0; i < state.scavengedPois.Length; i++)
                {
                    int id = state.scavengedPois[i];
                    if (id >= 0 && id < poiBadges.Count && poiBadges[id] != null && poiBadges[id].sprite != checkSpr)
                    {
                        poiBadges[id].sprite = checkSpr;
                        if (checkSpr != null)
                        {
                            float scale = (12f / Mathf.Max(1f, checkSpr.rect.width)) * checkSpr.pixelsPerUnit;
                            poiBadges[id].transform.localScale = new Vector3(scale, scale, 1);
                        }
                        poiBadges[id].color = new Color(0.65f, 0.85f, 0.65f, 0.95f);
                    }
                }
            }
            aliveIds.Clear();
            bool anyZombieFighting = false;
            for (int i = 0; i < state.entities.Length; i++)
            {
                var e = state.entities[i];
                if (e.hidden) continue;
                aliveIds.Add(e.id);
                if (!actors.TryGetValue(e.id, out var a))
                {
                    Transform targetParent = e.kind == "survivor" ? survivorsParent : (e.kind == "building" ? buildingsParent : zombiesParent);
                    var spriteR = Make(e.name, 0, targetParent);
                    spriteR.transform.position = new Vector3(e.x, -e.y, 0);
                    var auth = spriteR.gameObject.AddComponent<EntityAuthoring>();
                    auth.UpdateFrom(e);
                    a = new Actor {
                        sprite = spriteR,
                        healthBack = Make(e.name + " Health", 0, healthBarsParent),
                        healthFill = Make(e.name + " Fill", 0, healthBarsParent),
                        last = new Vector2(e.x, e.y),
                        target = new Vector2(e.x, e.y),
                        authoring = auth
                    };
                    a.healthBack.sprite = a.healthFill.sprite = pixel;
                    actors.Add(e.id, a);
                }
                a.entity = e;
                if (a.authoring != null) a.authoring.UpdateFrom(e);
                var delta = new Vector2(e.x, e.y) - a.target;
                if (delta.magnitude > .05f && delta.magnitude < 40)
                {
                    a.direction = Dirs[(Mathf.RoundToInt(Mathf.Atan2(delta.y, delta.x) / (Mathf.PI / 4)) + 8) % 8];
                    a.walk += delta.magnitude / 5;
                }
                else if (e.fighting)
                {
                    a.direction = e.facing < 0 ? "w" : "e";
                    a.walk += Time.unscaledDeltaTime * 6f;
                }
                if (string.IsNullOrEmpty(a.direction)) a.direction = e.facing < 0 ? "w" : "e";
                a.last = a.target; a.target = new Vector2(e.x, e.y);
                string baseSprite = e.sprite;
                if (e.burning)
                {
                    baseSprite = "burning/" + (string.IsNullOrEmpty(e.type) ? "walker" : e.type);
                }
                var sprite = e.kind == "building" ? GetSeasonalSprite(e.sprite, currentSeason) : GetWalkSprite(baseSprite, a.direction, (int)a.walk % 4);
                a.sprite.sprite = sprite;
                float gy = e.kind == "building" ? e.groundY : e.y;
                a.sprite.sortingOrder = Mathf.RoundToInt(e.stationed ? e.y + 45 : gy + (e.kind == "building" ? 5 : 15));
                a.sprite.transform.rotation = Quaternion.Euler(0, 0, e.downed ? 90 : 0);
                a.healthBack.sortingOrder = a.healthFill.sortingOrder = a.sprite.sortingOrder + 1;

                // Watchtower front railing and roof overlay when manned by a sentry
                if (e.kind == "building" && e.type == "tower")
                {
                    if (a.towerOverlay == null)
                    {
                        a.towerOverlay = Make(e.name + " Overlay", a.sprite.sortingOrder + 20, a.sprite.transform, false);
                        a.towerOverlay.transform.localPosition = Vector3.zero;
                        a.towerOverlay.transform.localScale = Vector3.one;
                    }
                    int lvl = (e.sprite != null && (e.sprite.EndsWith("/1") || e.sprite.Contains("/1/"))) ? 1 : 0;
                    a.towerOverlay.sprite = GetSeasonalSprite($"plots/tower/overlay/{lvl}", currentSeason);
                    bool hasSentry = state.entities != null && state.entities.Any(s => s.kind == "survivor" && s.stationed && Mathf.Abs(s.x - e.x) < 24 && (Mathf.Abs(s.y - (e.y - 34)) < 16 || Mathf.Abs(s.y - e.y) < 48));
                    a.towerOverlay.enabled = hasSentry;
                    a.towerOverlay.sortingOrder = Mathf.RoundToInt(e.groundY + 60);
                    a.towerOverlay.color = gradedMaterial != null ? Color.white : grade;
                }
                else if (a.towerOverlay != null)
                {
                    a.towerOverlay.enabled = false;
                }

                if (e.kind == "zombie" && e.fighting) anyZombieFighting = true;
            }

            deadIds.Clear();
            foreach (var pair in actors)
            {
                if (!aliveIds.Contains(pair.Key)) deadIds.Add(pair.Key);
            }
            for (int i = 0; i < deadIds.Count; i++)
            {
                int id = deadIds[i];
                var a = actors[id];
                if (a.sprite != null) Destroy(a.sprite.gameObject);
                if (a.healthBack != null) Destroy(a.healthBack.gameObject);
                if (a.healthFill != null) Destroy(a.healthFill.gameObject);
                if (a.lightCookie != null) Destroy(a.lightCookie.gameObject);
                if (a.towerOverlay != null) Destroy(a.towerOverlay.gameObject);
                actors.Remove(id);
            }
            DrawEffects();

            // Zombie combat bash audio feedback
            if (anyZombieFighting && Time.unscaledTime - lastBashSfxTime > 0.35f)
            {
                lastBashSfxTime = Time.unscaledTime;
                AudioManager.Instance?.PlayZombieBash();
            }

            // Phase transition audio chimes
            if (state.phase != lastPhase)
            {
                if (!string.IsNullOrEmpty(lastPhase))
                {
                    if (state.phase == "dawn") AudioManager.Instance?.PlayDawn();
                    else if (state.phase == "night" || state.phase == "dusk") AudioManager.Instance?.PlayDusk();
                }
                lastPhase = state.phase;
            }
        }

        void Update()
        {
            if (frame == null) return;

            // Track followed entity position if active
            if (FollowTargetId >= 0)
            {
                if (actors.TryGetValue(FollowTargetId, out var followActor) && followActor != null && followActor.entity != null && followActor.entity.hp > 0)
                {
                    float interp = Mathf.Clamp01((Time.unscaledTime - frameAt) / .05f);
                    var p = Vector2.Lerp(followActor.last, followActor.target, interp);
                    targetCamPos.x = p.x;
                    targetCamPos.y = -p.y;
                    ClampCamera();
                }
                else if (frame.entities != null)
                {
                    var ent = frame.entities.FirstOrDefault(e => e.id == FollowTargetId);
                    if (ent != null && ent.hp > 0)
                    {
                        targetCamPos.x = ent.x;
                        targetCamPos.y = -ent.y;
                        ClampCamera();
                    }
                    else
                    {
                        FollowTargetId = -1;
                    }
                }
                else
                {
                    FollowTargetId = -1;
                }
            }

            // Smooth camera panning and zooming towards target
            if (Camera != null)
            {
                if (Mathf.Abs(CurrentZoom - TargetZoom) > 0.0005f)
                {
                    CurrentZoom = Mathf.Lerp(CurrentZoom, TargetZoom, Time.unscaledDeltaTime * 12f);
                    Camera.orthographicSize = BaseOrthographicSize * CurrentZoom;
                }
                else if (CurrentZoom != TargetZoom)
                {
                    CurrentZoom = TargetZoom;
                    Camera.orthographicSize = BaseOrthographicSize * CurrentZoom;
                }
                Camera.transform.position = Vector3.Lerp(Camera.transform.position, targetCamPos, Time.unscaledDeltaTime * 14f);
            }

            if (lighting != null)
            {
                lighting.hour = frame.hour;
            }
            // Match the simulation's night window (18:00-06:00). The visual grade
            // starts darkening before dusk, but survivors should not light the day.
            bool isNight = frame.hour >= 18f || frame.hour < 6f;
            float dark = isNight ? (lighting != null ? lighting.Darkness : 1f) : 0f;
            float light = frame.hour >= 8 && frame.hour < 17 ? 1 : frame.hour >= 20 || frame.hour < 5 ? .52f : .78f;
            grade = Color.Lerp(grade, new Color(light, light * .98f, Mathf.Min(1, light * 1.08f)), .08f);
            ground.color = gradedMaterial != null ? Color.white : grade;
            float t = Mathf.Clamp01((Time.unscaledTime - frameAt) / .05f);
            foreach (var a in actors.Values)
            {
                var p = Vector2.Lerp(a.last, a.target, t); a.sprite.transform.position = new Vector3(p.x, -p.y, 0); a.sprite.color = gradedMaterial != null ? Color.white : grade;
                if (a.towerOverlay != null && a.towerOverlay.enabled) a.towerOverlay.color = gradedMaterial != null ? Color.white : grade;

                // Flashlight beam for active survivors when dark
                if (a.entity != null && a.entity.kind == "survivor" && !a.entity.downed && dark > 0.15f)
                {
                    if (a.lightCookie == null)
                    {
                        a.lightCookie = Make("Flashlight", 29000, a.sprite.transform, true);
                        a.lightCookie.sprite = GetSprite("lights/light_flashlight_e");
                    }
                    a.lightCookie.enabled = true;
                    float angle = a.direction == "e" ? 0 : a.direction == "se" ? -45 : a.direction == "s" ? -90 : a.direction == "sw" ? -135 : a.direction == "w" ? 180 : a.direction == "nw" ? 135 : a.direction == "n" ? 90 : 45;
                    a.lightCookie.transform.rotation = Quaternion.Euler(0, 0, angle);
                    a.lightCookie.color = new Color(1f, 0.95f, 0.75f, dark * 0.7f);
                }
                else if (a.lightCookie != null)
                {
                    a.lightCookie.enabled = false;
                }
                bool show = a.entity.hp < a.entity.maxHP - .1f || a.entity.id == Selected;
                a.healthBack.enabled = a.healthFill.enabled = show;
                if (show)
                {
                    bool isZombie = a.entity.kind == "zombie";
                    float w = a.entity.kind == "building" ? 38 : isZombie ? 22 : 20;
                    float pct = Mathf.Clamp01(a.entity.hp / Mathf.Max(1, a.entity.maxHP));
                    float y = -p.y + (a.sprite.sprite ? a.sprite.sprite.bounds.max.y + 5 : 30);
                    a.healthBack.transform.position = new Vector3(p.x, y, 0); a.healthBack.transform.localScale = new Vector3(w + 2, 4, 1); a.healthBack.color = new Color(.08f, .1f, .08f);
                    a.healthFill.transform.position = new Vector3(p.x - w * (1 - pct) / 2, y, 0); a.healthFill.transform.localScale = new Vector3(w * pct, 2, 1);
                    if (isZombie)
                    {
                        a.healthFill.color = new Color(.88f, .22f, .18f); // Always crimson for the undead
                    }
                    else
                    {
                        a.healthFill.color = pct < .35f ? new Color(.8f, .3f, .25f) : new Color(.75f, .85f, .5f);
                    }
                }
            }
            characterPositions.Clear();
            if (frame != null && frame.entities != null)
            {
                for (int j = 0; j < frame.entities.Length; j++)
                {
                    var ent = frame.entities[j];
                    if (ent.kind != "building" && !ent.hidden)
                        characterPositions.Add(new Vector2(ent.x, ent.y));
                }
            }
            for (int i = 0; i < trees.Count; i++)
            {
                if (Terrain == null || Terrain.trees == null || i >= Terrain.trees.Length) break;
                var tree = Terrain.trees[i];
                bool hidden = false;
                float ty = tree.y;
                float tx = tree.x;
                for (int j = 0; j < characterPositions.Count; j++)
                {
                    var cp = characterPositions[j];
                    if (cp.y < ty && cp.y > ty - 40f && Mathf.Abs(cp.x - tx) < 16f)
                    {
                        hidden = true;
                        break;
                    }
                }
                trees[i].color = new Color(grade.r, grade.g, grade.b, hidden ? .45f : tree.alpha);
            }
            if (gradedMaterial == null)
            {
                for (int i = 0; i < decorRenderers.Count; i++)
                    if (decorRenderers[i] != null) decorRenderers[i].color = grade;
                for (int i = 0; i < worldBuildingRenderers.Count; i++)
                    if (worldBuildingRenderers[i] != null) worldBuildingRenderers[i].color = grade;
            }
            fire.sprite = GetSprite("molotov/fire/" + ((int)(frame.elapsed * 10) % 8));
            if (!fire.sprite) fire.sprite = GetSprite("molotov/fire/0");
            fire.transform.position = new Vector3(34, -77, 0); fire.transform.localScale = Vector3.one * .5f;

            var selectedEntity = actors.TryGetValue(Selected, out var selected) ? selected.entity : null;
            if (!ghost.enabled)
            {
                Color bracketColor = (selectedEntity != null && selectedEntity.kind == "zombie")
                    ? new Color(0.92f, 0.32f, 0.22f)
                    : new Color(.8f, .95f, .6f);
                DrawBrackets(selectedEntity, bracketColor);
            }
            DrawTargetLines(selectedEntity);
        }

        void DrawTargetLines(EntityView target)
        {
            int lineIdx = 0;
            if (target != null && target.kind == "zombie" && frame != null && frame.entities != null)
            {
                for (int i = 0; i < frame.entities.Length; i++)
                {
                    var s = frame.entities[i];
                    if (s.kind != "survivor" || s.targetId != target.id || s.hidden) continue;

                    Vector2 p1 = new Vector2(s.x, -s.y);
                    Vector2 p2 = new Vector2(target.x, -target.y);
                    Vector2 diff = p2 - p1;
                    float dist = diff.magnitude;
                    if (dist > 1f)
                    {
                        if (lineIdx >= targetLines.Count) targetLines.Add(Make("TargetLine", 29500, overlaysParent));
                        var r = targetLines[lineIdx++];
                        r.enabled = true;
                        r.sprite = pixel;
                        r.color = new Color(0.95f, 0.42f, 0.28f, 0.55f);
                        r.transform.position = new Vector3((p1.x + p2.x) * 0.5f, (p1.y + p2.y) * 0.5f, 0);
                        r.transform.rotation = Quaternion.Euler(0, 0, Mathf.Atan2(diff.y, diff.x) * Mathf.Rad2Deg);
                        r.transform.localScale = new Vector3(dist, 1.5f, 1);
                    }
                }
            }
            for (; lineIdx < targetLines.Count; lineIdx++) targetLines[lineIdx].enabled = false;
        }

        void DrawEffects()
        {
            int used = 0;
            SpriteRenderer r;
            bool shotSfxTriggered = false;
            bool hitSfxTriggered = false;

            liveShots.Clear();
            if (frame != null && frame.effects != null)
            {
                for (int i = 0; i < frame.effects.Length; i++)
                {
                    var eff = frame.effects[i];
                    if (eff.type == "shot") liveShots.Add(eff);
                }
            }
            seenShots.IntersectWith(liveShots);

            foreach (var e in frame.effects)
            {
                if (used >= effects.Count) effects.Add(Make("Effect", 28000, effectsParent));
                r = effects[used++]; r.enabled = true;
                float t = Mathf.Clamp01(1 - e.life / Mathf.Max(.001f, e.maxLife));
                if (e.type == "shot")
                {
                    int dir = (Mathf.RoundToInt(Mathf.Atan2(e.ty - e.y, e.tx - e.x) / (Mathf.PI * 2 / 16)) + 16) % 16;
                    r.sprite = GetSprite("gunfire/flash/" + dir + "/" + Mathf.Min(2, (int)(t * 3)));
                    r.transform.position = new Vector3(e.x, -e.y, 0); r.transform.localScale = Vector3.one; r.color = Color.white;
                    r.sortingOrder = 28000;
                    if (used >= effects.Count) effects.Add(Make("Tracer", 28001, effectsParent));
                    r = effects[used++]; r.enabled = true; r.sprite = GetSprite("gunfire/tracer/" + dir + "/" + ((int)(t * 4) % 2));
                    r.transform.position = new Vector3(Mathf.Lerp(e.x, e.tx, t), -Mathf.Lerp(e.y, e.ty, t), 0); r.transform.localScale = Vector3.one; r.color = Color.white;
                    r.sortingOrder = 28001;

                    if (!seenShots.Contains(e))
                    {
                        seenShots.Add(e);
                        // Flesh impact blood splatter at target
                        impacts.Add(new ImpactFx { kind = "blood", dir = dir, pos = new Vector2(e.tx, -e.ty), maxAge = 0.32f });
                        // Brass casing ejected from firearm
                        float cdx = e.tx - e.x, cdy = e.ty - e.y, clen = Mathf.Max(1f, Mathf.Sqrt(cdx * cdx + cdy * cdy));
                        Vector2 cvel = new Vector2((-cdy / clen * 18f - cdx / clen * 5f), -(cdx / clen * 18f - cdy / clen * 5f) * 0.4f);
                        impacts.Add(new ImpactFx { kind = "casing", dir = 0, pos = new Vector2(e.x, -e.y), vel = cvel, maxAge = 0.45f });

                        if (!hitSfxTriggered && Time.unscaledTime - lastHitSfxTime > 0.08f)
                        {
                            hitSfxTriggered = true;
                            lastHitSfxTime = Time.unscaledTime;
                            AudioManager.Instance?.PlayHit();
                        }
                    }

                    if (!shotSfxTriggered && Time.unscaledTime - lastShotSfxTime > 0.08f)
                    {
                        shotSfxTriggered = true;
                        lastShotSfxTime = Time.unscaledTime;
                        AudioManager.Instance?.PlayShoot();
                    }
                }
                else if (e.type == "death")
                {
                    r.sprite = pixel;
                    r.sortingOrder = -28000; // Blood pool rests on ground level
                    r.transform.position = new Vector3(e.x, -e.y, 0);
                    r.transform.localScale = new Vector3(18, 7, 1);
                    r.color = new Color(.38f, .07f, .05f, Mathf.Min(.65f, e.life));
                }
                else
                {
                    r.sprite = pixel;
                    r.sortingOrder = 28000;
                    r.transform.position = new Vector3(e.x, -e.y + t * 8, 0);
                    r.transform.localScale = new Vector3(3, 3, 1);
                    r.color = e.type == "heal" ? new Color(.5f, 1, .5f, 1 - t) : e.type == "repair" ? new Color(1, .8f, .4f, 1 - t) : new Color(.35f, .08f, .05f, Mathf.Min(.7f, e.life));

                    if (e.type == "heal" && t < 0.1f) AudioManager.Instance?.PlayHeal();
                    else if (e.type == "repair" && t < 0.1f) AudioManager.Instance?.PlayRepair();
                }
            }

            // Draw dynamic secondary impacts (blood splatter & ejected casings)
            float dt = Time.unscaledDeltaTime;
            for (int i = impacts.Count - 1; i >= 0; i--)
            {
                var fx = impacts[i];
                fx.age += dt;
                if (fx.age >= fx.maxAge) { impacts.RemoveAt(i); continue; }
                if (used >= effects.Count) effects.Add(Make("Impact", 28002, effectsParent));
                r = effects[used++]; r.enabled = true;
                if (fx.kind == "blood")
                {
                    int bframe = Mathf.Min(3, (int)(fx.age / 0.08f));
                    r.sprite = GetSprite("gunfire/blood/" + fx.dir + "/" + bframe);
                    r.sortingOrder = 28002;
                    r.transform.position = new Vector3(fx.pos.x, fx.pos.y, 0);
                    r.transform.localScale = Vector3.one;
                    r.color = Color.white;
                }
                else if (fx.kind == "casing")
                {
                    int cframe = ((int)(fx.age * 16f)) % 4;
                    r.sprite = GetSprite("gunfire/casing/" + cframe);
                    r.sortingOrder = 28001;
                    float py = fx.pos.y + fx.vel.y * fx.age - 50f * fx.age * fx.age;
                    r.transform.position = new Vector3(fx.pos.x + fx.vel.x * fx.age, py, 0);
                    r.transform.localScale = Vector3.one;
                    r.color = new Color(1, 1, 1, Mathf.Clamp01(1f - fx.age * 1.8f));
                }
            }

            for (; used < effects.Count; used++) effects[used].enabled = false;
        }

        void DrawBrackets(EntityView e, Color color)
        {
            for (int i = 0; i < brackets.Count; i++) brackets[i].enabled = e != null;
            if (e == null) return;
            float w = e.kind == "building" ? e.width + 6 : 28, h = e.kind == "building" ? e.height + 6 : 18;
            for (int i = 0; i < 4; i++)
            {
                float dx = i % 2 == 0 ? -1 : 1, dy = i < 2 ? -1 : 1, x = e.x + dx * w / 2, y = -e.y + dy * h / 2;
                var a = brackets[i * 2]; var b = brackets[i * 2 + 1]; a.sprite = b.sprite = pixel; a.color = b.color = color;
                a.transform.position = new Vector3(x - dx * 4, y, 0); a.transform.localScale = new Vector3(8, 1.5f, 1);
                b.transform.position = new Vector3(x, y - dy * 4, 0); b.transform.localScale = new Vector3(1.5f, 8, 1);
            }
        }

        public static (float w, float h) GetBuildingFootprint(string type, int rotation)
        {
            float w = 32, h = 32;
            switch (type)
            {
                case "core":
                case "town_hall":
                case "farm":
                case "dorm":
                case "bunkhouse":
                case "workshop":
                case "clinic":
                case "barracks":
                    w = 80; h = 64; break;
                case "tower":
                case "shelter":
                case "armory":
                    w = 32; h = 32; break;
                case "lumber_mill":
                    w = 48; h = 32; break;
                case "storage":
                case "lab":
                    w = 48; h = 48; break;
                case "barricade":
                    w = rotation != 0 ? 16 : 32;
                    h = rotation != 0 ? 32 : 16;
                    break;
                case "gate":
                    w = rotation != 0 ? 16 : 64;
                    h = rotation != 0 ? 64 : 16;
                    break;
            }
            return (w, h);
        }

        public Sprite GetGhostSprite(string bKey, bool ok)
        {
            string state = ok ? "ok" : "bad";
            string res = "UI/ghost_" + bKey + "_" + state;
            if (ghostSpriteCache.TryGetValue(res, out var cached) && cached != null) return cached;
            var s = Resources.Load<Sprite>(res);
            if (s == null)
            {
                var tex = Resources.Load<Texture2D>(res);
                if (tex != null)
                {
                    s = Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), new Vector2(0.5f, 0.5f), 1f);
                }
            }
            if (s != null) ghostSpriteCache[res] = s;
            return s;
        }

        public void ShowPlacement(Placement p)
        {
            ghost.enabled = p != null;
            if (p == null)
            {
                DrawBrackets(null, Color.white);
                return;
            }

            string bKey = !string.IsNullOrEmpty(p.type) ? p.type : (!string.IsNullOrEmpty(p.sprite) && p.sprite.Contains('/') ? p.sprite.Split('/')[1] : "");
            if (bKey == "core") bKey = "town_hall";
            else if (bKey == "dorm") bKey = "bunkhouse";
            else if (bKey == "barricade") bKey = "wall";

            var (fpW, fpH) = GetBuildingFootprint(p.type, p.rotation);
            var ghostSpr = GetGhostSprite(bKey, p.ok);

            if (ghostSpr != null)
            {
                ghost.sprite = ghostSpr;
                ghost.color = Color.white;
                // Scale according to pixelsPerUnit so 1 texture pixel = 1 world unit
                ghost.transform.localScale = new Vector3(ghostSpr.pixelsPerUnit, ghostSpr.pixelsPerUnit, 1f);

                if (p.type == "barricade" && p.rotation != 0)
                {
                    ghost.transform.rotation = Quaternion.Euler(0, 0, 90f);
                    ghost.transform.position = new Vector3(p.x, -p.y, 0);
                }
                else
                {
                    ghost.transform.rotation = Quaternion.identity;
                    float yOffset = (ghostSpr.rect.height - fpH) / 2f;
                    ghost.transform.position = new Vector3(p.x, -p.y + yOffset, 0);
                }
            }
            else
            {
                // Fallback for buildings without dedicated ghost texture (e.g. gate)
                ghost.sprite = GetSprite(p.sprite);
                ghost.color = p.ok ? new Color(0.4f, 1f, 0.4f, 0.75f) : new Color(1f, 0.3f, 0.3f, 0.75f);
                ghost.transform.localScale = Vector3.one;
                ghost.transform.rotation = Quaternion.identity;
                ghost.transform.position = new Vector3(p.x, -p.y, 0);
            }

            DrawBrackets(new EntityView { x = p.x, y = p.y, kind = "building", width = fpW, height = fpH }, p.ok ? new Color(.7f, 1, .5f, .75f) : new Color(1, .35f, .3f, .75f));
        }

        public Vector2 PointerWorld()
        {
            var p = Camera.ScreenToWorldPoint(Input.mousePosition); return new Vector2(p.x, -p.y);
        }

        public int Hit(Vector2 p)
        {
            if (frame == null || frame.entities == null) return -1;
            for (int i = frame.entities.Length - 1; i >= 0; i--)
            {
                var e = frame.entities[i];
                if (e.kind != "building" && !e.hidden && Vector2.Distance(p, new Vector2(e.x, e.y - 11)) < 15) return e.id;
            }
            for (int i = frame.entities.Length - 1; i >= 0; i--)
            {
                var e = frame.entities[i];
                if (e.kind == "building" && Mathf.Abs(p.x - e.x) < e.width / 2 + 6 && p.y > e.y - (e.type == "tower" ? 44 : e.height / 2 + 18) && p.y < e.y + e.height / 2 + 4) return e.id;
            }
            return -1;
        }

        Sprite LoadBadge(string name)
        {
            var s = Resources.Load<Sprite>("UI/" + name);
            if (s != null) return s;
            var tex = Resources.Load<Texture2D>("UI/" + name);
            if (tex != null) return Sprite.Create(tex, new Rect(0, 0, tex.width, tex.height), new Vector2(0.5f, 0.5f), 1);
            return null;
        }

        public int HitPoi(Vector2 p)
        {
            if (Terrain == null || Terrain.pois == null) return -1;
            for (int i = 0; i < Terrain.pois.Length; i++)
            {
                var poi = Terrain.pois[i];
                if (Vector2.Distance(p, new Vector2(poi.x, poi.y)) < 24f)
                    return poi.id;
            }
            return -1;
        }

        public void UpdatePoiBadges(MapPoiView[] pois)
        {
            if (pois == null || poiBadges.Count != pois.Length) return;
            var checkSpr = LoadBadge("badge_check");
            for (int i = 0; i < pois.Length; i++)
            {
                if (pois[i].scavenged && poiBadges[i] != null && poiBadges[i].sprite != checkSpr)
                {
                    poiBadges[i].sprite = checkSpr;
                    if (checkSpr != null)
                    {
                        float scale = (12f / Mathf.Max(1f, checkSpr.rect.width)) * checkSpr.pixelsPerUnit;
                        poiBadges[i].transform.localScale = new Vector3(scale, scale, 1);
                    }
                    poiBadges[i].color = new Color(0.65f, 0.85f, 0.65f, 0.95f);
                }
            }
        }

        void OnDestroy()
        {
            foreach (var s in sprites.Values) Destroy(s);
            foreach (var l in targetLines) if (l) Destroy(l.gameObject);
            foreach (var d in decorRenderers) if (d) Destroy(d.gameObject);
            foreach (var b in worldBuildingRenderers) if (b) Destroy(b.gameObject);
            foreach (var p in poiBadges) if (p) Destroy(p.gameObject);
            if (groundTexture) Destroy(groundTexture); if (groundSprite) Destroy(groundSprite);
            if (pixel) { Destroy(pixel.texture); Destroy(pixel); }
        }
    }
}
