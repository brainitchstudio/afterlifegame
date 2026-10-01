using System;
using System.Collections.Generic;
using System.Linq;
using UnityEditor;
using UnityEngine;

namespace Afterlife.Editor
{
    [CustomEditor(typeof(AfterlifeGame))]
    public sealed class AfterlifeGameEditor : UnityEditor.Editor
    {
        public override void OnInspectorGUI()
        {
            var game = (AfterlifeGame)target;

            EditorGUILayout.Space(6);
            if (!EditorApplication.isPlaying)
            {
                EditorGUILayout.HelpBox(
                    "EDIT MODE: In Edit Mode the simulation is idle. Click 'Spawn Settlement in Hierarchy' below to populate the Hierarchy and Scene View with editable preview GameObjects (Buildings, Survivors, Trees, Campfire, Terrain).",
                    MessageType.Info);

                EditorGUILayout.BeginHorizontal();
                GUI.backgroundColor = new Color(0.78f, 0.82f, 0.62f);
                if (GUILayout.Button("🎮 Spawn Settlement in Hierarchy", GUILayout.Height(32)))
                {
                    SpawnSettlementPreview(game);
                }
                GUI.backgroundColor = new Color(0.85f, 0.55f, 0.5f);
                if (GUILayout.Button("🧹 Clear Preview", GUILayout.Height(32), GUILayout.Width(120)))
                {
                    ClearSettlementPreview(game);
                }
                GUI.backgroundColor = Color.white;
                EditorGUILayout.EndHorizontal();

                EditorGUILayout.Space(4);
                if (GUILayout.Button("🎨 Open UI Toolkit Debugger (Inspect HUD)"))
                {
                    EditorApplication.ExecuteMenuItem("Window/UI Toolkit/Debugger");
                }
            }
            else
            {
                EditorGUILayout.HelpBox(
                    "PLAY MODE ACTIVE: The live simulation is running! GameObjects are live under 'Entities' (Survivors, Buildings, Zombies). Click any entity to inspect its stats in the Inspector.",
                    MessageType.None);

                EditorGUILayout.LabelField("Simulation Cheats & Dev Controls", EditorStyles.boldLabel);
                EditorGUILayout.BeginHorizontal();
                if (GUILayout.Button("+100 Wood")) game.Command("devGrantResource", "wood", 100);
                if (GUILayout.Button("+100 Metal")) game.Command("devGrantResource", "metal", 100);
                if (GUILayout.Button("+100 Food")) game.Command("devGrantResource", "food", 100);
                EditorGUILayout.EndHorizontal();

                EditorGUILayout.BeginHorizontal();
                if (GUILayout.Button("📻 Recruit Survivor")) game.Simulation?.Command("recruit");
                if (GUILayout.Button("🔨 Repair All")) game.Simulation?.Command("repairAll");
                if (GUILayout.Button(game.Paused ? "▶ Resume" : "⏸ Pause")) game.TogglePause();
                EditorGUILayout.EndHorizontal();

                EditorGUILayout.Space(4);
                if (GUILayout.Button("🎨 Open UI Toolkit Debugger"))
                {
                    EditorApplication.ExecuteMenuItem("Window/UI Toolkit/Debugger");
                }
            }

            EditorGUILayout.Space(8);
            DrawDefaultInspector();
        }

        [MenuItem("Afterlife/Dev Tools/Spawn Settlement Preview in Hierarchy", false, 50)]
        public static void MenuSpawnPreview()
        {
            var game = UnityEngine.Object.FindAnyObjectByType<AfterlifeGame>();
            if (game != null) SpawnSettlementPreview(game);
            else EditorUtility.DisplayDialog("Afterlife", "No AfterlifeGame GameObject found in active scene.", "OK");
        }

        [MenuItem("Afterlife/Dev Tools/Clear Preview Hierarchy", false, 51)]
        public static void MenuClearPreview()
        {
            var game = UnityEngine.Object.FindAnyObjectByType<AfterlifeGame>();
            if (game != null) ClearSettlementPreview(game);
        }

        [MenuItem("Afterlife/Dev Tools/Open UI Toolkit Debugger", false, 52)]
        public static void MenuOpenUiDebugger()
        {
            EditorApplication.ExecuteMenuItem("Window/UI Toolkit/Debugger");
        }

        public static void ClearSettlementPreview(AfterlifeGame game)
        {
            if (game == null) return;
            Undo.RegisterFullObjectHierarchyUndo(game.gameObject, "Clear Settlement Preview");
            for (int i = game.transform.childCount - 1; i >= 0; i--)
            {
                Undo.DestroyObjectImmediate(game.transform.GetChild(i).gameObject);
            }
            EditorUtility.SetDirty(game.gameObject);
        }

        public static void SpawnSettlementPreview(AfterlifeGame game)
        {
            if (Application.isPlaying || game == null) return;
            ClearSettlementPreview(game);

            var root = game.transform;
            Undo.RegisterFullObjectHierarchyUndo(game.gameObject, "Spawn Settlement Preview");

            var atlas = Resources.Load<Texture2D>("AfterlifeAtlas");
            var manifestAsset = Resources.Load<TextAsset>("AfterlifeAtlas");
            if (!atlas || !manifestAsset)
            {
                EditorUtility.DisplayDialog("Error", "Resources/AfterlifeAtlas not found.", "OK");
                return;
            }

            var manifest = JsonUtility.FromJson<AtlasManifest>(manifestAsset.text);
            var entries = manifest.entries.ToDictionary(e => e.key, e => e);
            float[] fireAnchor = manifest.fireAnchor ?? new[] { 16f, 16f };

            Sprite GetSprite(string key)
            {
                if (!entries.TryGetValue(key, out var e)) return null;
                var pivot = new Vector2(e.ax, 1 - e.ay);
                if (key.StartsWith("survivors/") || key.StartsWith("zombies/")) pivot = new Vector2(.5f, 2f / 28);
                if (key.StartsWith("molotov/fire/")) pivot = new Vector2(fireAnchor[0] / e.w, 1 - fireAnchor[1] / e.h);
                return Sprite.Create(atlas, new Rect(e.x, atlas.height - e.y - e.h, e.w, e.h), pivot, 1, 0, SpriteMeshType.FullRect);
            }

            using (var sim = new Simulation())
            {
                var frame = sim.ReadFrame();
                var terrain = sim.ReadTerrain();

                // 1. Environment
                var env = new GameObject("Environment [Preview]");
                env.hideFlags = HideFlags.DontSaveInEditor;
                Undo.RegisterCreatedObjectUndo(env, "Create Environment Preview");
                env.transform.SetParent(root, false);

                // Ground Terrain
                int bx = 512, by = 512;
                var pixels = new Color32[bx * 2 * by * 2];
                var keys = new HashSet<string>(terrain.land.Select(p => p.col + "," + p.row));
                Func<int, int, bool> owned = (x, y) => keys.Contains(Mathf.FloorToInt((x + 128f) / 256) + "," + Mathf.FloorToInt((y + 96f) / 192));
                var tilePixels = new Dictionary<string, Color32[]>();

                for (int y = -by; y < by; y += 16)
                {
                    for (int x = -bx; x < bx; x += 16)
                    {
                        bool inside = owned(x + 8, y + 8), v = x >= -32 && x < 32, h = y >= -32 && y < 32;
                        string k;
                        if (v && h) k = "road_x";
                        else if (v) k = inside || x != -32 && x != 16 ? "road_v" : x < 0 ? "road_edge_w" : "road_edge_e";
                        else if (h) k = inside || y != -32 && y != 16 ? "road_h" : y < 0 ? "road_edge_n" : "road_edge_s";
                        else if (inside) k = !owned(x + 8, y - 8) ? "edge_n" : !owned(x + 8, y + 24) ? "edge_s" : !owned(x - 8, y + 8) ? "edge_w" : !owned(x + 24, y + 8) ? "edge_e" : "dirt_a";
                        else k = "grass_a";

                        if (!tilePixels.TryGetValue(k, out var tile))
                        {
                            if (entries.TryGetValue("tiles/" + k, out var e))
                            {
                                tile = atlas.GetPixels(e.x, atlas.height - e.y - e.h, e.w, e.h).Select(c => (Color32)c).ToArray();
                                tilePixels[k] = tile;
                            }
                        }
                        if (tile != null)
                        {
                            for (int py = 0; py < 16; py++)
                            {
                                Array.Copy(tile, py * 16, pixels, (by - y - 16 + py) * bx * 2 + x + bx, 16);
                            }
                        }
                    }
                }

                var groundTexture = new Texture2D(bx * 2, by * 2, TextureFormat.RGBA32, false) { filterMode = FilterMode.Point };
                groundTexture.SetPixels32(pixels);
                groundTexture.Apply(false, true);

                var ground = new GameObject("Terrain");
                ground.transform.SetParent(env.transform, false);
                var groundR = ground.AddComponent<SpriteRenderer>();
                groundR.sprite = Sprite.Create(groundTexture, new Rect(0, 0, bx * 2, by * 2), new Vector2(.5f, .5f), 1);
                groundR.sortingOrder = -30000;

                // Campfire
                var campfire = new GameObject("Campfire");
                campfire.transform.SetParent(env.transform, false);
                campfire.transform.position = Vector3.zero;
                var fireR = campfire.AddComponent<SpriteRenderer>();
                fireR.sprite = GetSprite("campfire/0");
                fireR.sortingOrder = 92;

                // Trees
                var treesGo = new GameObject("Trees");
                treesGo.transform.SetParent(env.transform, false);
                foreach (var t in terrain.trees)
                {
                    string key = t.kind == 2 ? "tree_pine" : t.kind == 0 ? "tree_dead" : "tree_oak";
                    float anchor = key == "tree_pine" ? 41 : key == "tree_dead" ? 34 : 36;
                    var tree = new GameObject("Tree (" + key + ")");
                    tree.transform.SetParent(treesGo.transform, false);
                    var tr = tree.AddComponent<SpriteRenderer>();
                    tr.sprite = GetSprite("tiles/" + key);
                    if (tr.sprite != null)
                    {
                        tree.transform.position = new Vector3(t.x, -t.y - (tr.sprite.rect.height - anchor) * t.scale, 0);
                        tree.transform.localScale = new Vector3(t.kind == 1 ? -t.scale : t.scale, t.scale, 1);
                        tr.sortingOrder = Mathf.RoundToInt(t.y + 15);
                    }
                }

                // 2. Entities
                var entitiesGo = new GameObject("Entities [Preview]");
                entitiesGo.hideFlags = HideFlags.DontSaveInEditor;
                Undo.RegisterCreatedObjectUndo(entitiesGo, "Create Entities Preview");
                entitiesGo.transform.SetParent(root, false);

                var survivorsGo = new GameObject("Survivors");
                survivorsGo.transform.SetParent(entitiesGo.transform, false);

                var buildingsGo = new GameObject("Buildings");
                buildingsGo.transform.SetParent(entitiesGo.transform, false);

                foreach (var e in frame.entities)
                {
                    if (e.hidden) continue;
                    Transform parent = e.kind == "survivor" ? survivorsGo.transform : buildingsGo.transform;
                    var go = new GameObject(e.name);
                    go.transform.SetParent(parent, false);
                    go.transform.position = new Vector3(e.x, e.y, 0);

                    var r = go.AddComponent<SpriteRenderer>();
                    r.sprite = e.kind == "building" ? GetSprite(e.sprite) : GetSprite(e.sprite + "/s/0");
                    r.sortingOrder = Mathf.RoundToInt(e.groundY + (e.kind == "building" ? 5 : 15));

                    var auth = go.AddComponent<EntityAuthoring>();
                    auth.UpdateFrom(e);
                }

                // Camera framing
                var cam = Camera.main;
                if (cam != null)
                {
                    cam.orthographic = true;
                    cam.orthographicSize = 128f;
                    cam.transform.position = new Vector3(0, 0, -10);
                }
            }

            EditorUtility.SetDirty(game.gameObject);
            Debug.Log("Settlement preview successfully created in Hierarchy!");
        }
    }
}
