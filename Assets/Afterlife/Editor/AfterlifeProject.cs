using System;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.UIElements;

namespace Afterlife.Editor
{
    public static class AfterlifeProject
    {
        const string Root = "Assets/Afterlife/";
        public const string Scene = "Assets/afterlifev1.unity";
        public const string FallbackScene = Root + "Scenes/Afterlife.unity";
        public static string ActiveScenePath => File.Exists(Scene) ? Scene : FallbackScene;

        [MenuItem("Afterlife/Open Game Scene")]
        public static void OpenGameScene()
        {
            if (EditorApplication.isPlaying) EditorApplication.isPlaying = false;
            EditorApplication.delayCall += () =>
            {
                string path = ActiveScenePath;
                if (File.Exists(path)) EditorSceneManager.OpenScene(path);
            };
        }
        [MenuItem("Afterlife/Dev Tools/Remove Saved Settlement Preview")]
        public static void RemoveSavedSettlementPreview()
        {
            if (EditorApplication.isPlaying) throw new InvalidOperationException("Stop Play mode before cleaning the build scene.");
            var scene = EditorSceneManager.OpenScene(ActiveScenePath);
            var game = UnityEngine.Object.FindAnyObjectByType<AfterlifeGame>();
            if (!game) throw new InvalidOperationException("The build scene has no AfterlifeGame root.");
            int removed = 0;
            for (int i = game.transform.childCount - 1; i >= 0; i--)
            {
                var child = game.transform.GetChild(i);
                if (child.name != "Environment [Preview]" && child.name != "Entities [Preview]") continue;
                UnityEngine.Object.DestroyImmediate(child.gameObject);
                removed++;
            }
            if (removed > 0) EditorSceneManager.SaveScene(scene);
            Debug.Log("AFTERLIFE_SAVED_PREVIEW_REMOVED count=" + removed);
        }
        [MenuItem("Afterlife/Prepare Project")]
        public static void Prepare()
        {
            Bundle();
            PlayerSettings.companyName = "Afterlife";
            PlayerSettings.productName = "Afterlife";
            PlayerSettings.bundleVersion = "1.0.0";
            PlayerSettings.SetApplicationIdentifier(NamedBuildTarget.Standalone, "games.afterlife.refuge");
            PlayerSettings.defaultScreenWidth = 1440; PlayerSettings.defaultScreenHeight = 900;
            PlayerSettings.fullScreenMode = FullScreenMode.Windowed;
            PlayerSettings.resizableWindow = true;
            PlayerSettings.runInBackground = true;
            PlayerSettings.colorSpace = ColorSpace.Gamma;
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Standalone, ScriptingImplementation.Mono2x);
            PlayerSettings.SetApiCompatibilityLevel(NamedBuildTarget.Standalone, ApiCompatibilityLevel.NET_Standard);
            EditorSettings.serializationMode = SerializationMode.ForceText;
            QualitySettings.vSyncCount = 1; QualitySettings.antiAliasing = 0;
            string atlas = Root + "Resources/AfterlifeAtlas.png";
            var importer = (TextureImporter)AssetImporter.GetAtPath(atlas);
            importer.textureType = TextureImporterType.Default; importer.filterMode = FilterMode.Point;
            importer.textureCompression = TextureImporterCompression.Uncompressed; importer.mipmapEnabled = false;
            importer.isReadable = true; importer.alphaIsTransparency = true; importer.maxTextureSize = 4096; importer.SaveAndReimport();
            ConfigureTextures();
            if (!File.Exists(Root + "Resources/AfterlifePanel.asset"))
            {
                var panel = ScriptableObject.CreateInstance<PanelSettings>(); panel.scaleMode = PanelScaleMode.ScaleWithScreenSize;
                panel.referenceResolution = new Vector2Int(1440, 900); panel.match = .5f;
                AssetDatabase.CreateAsset(panel, Root + "Resources/AfterlifePanel.asset");
            }
            Directory.CreateDirectory(Root + "Prefabs");
            string prefabPath = Root + "Prefabs/Afterlife.prefab";
            if (!File.Exists(prefabPath))
            {
                var go = new GameObject("Afterlife", typeof(AfterlifeGame));
                PrefabUtility.SaveAsPrefabAsset(go, prefabPath); UnityEngine.Object.DestroyImmediate(go);
            }
            if (!File.Exists(Scene))
            {
                var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
                PrefabUtility.InstantiatePrefab(AssetDatabase.LoadAssetAtPath<GameObject>(prefabPath));
                var camera = new GameObject("Main Camera", typeof(Camera), typeof(AudioListener)); camera.tag = "MainCamera";
                var c = camera.GetComponent<Camera>(); c.orthographic = true; c.orthographicSize = 128f; c.transform.position = new Vector3(0, 0, -10);
                c.backgroundColor = new Color(.2f,.27f,.17f); c.clearFlags = CameraClearFlags.SolidColor;
                // Add the outpost map loader as a separate scene root. It auto-loads outpost.json and
                // outpost_atlas.png from Resources at runtime (see SurvivalMapLoader.cs).
                var mapGo = new GameObject("OutpostMap");
                mapGo.AddComponent<SurvivalMapLoader>();
                EditorSceneManager.SaveScene(scene, Scene);
            }
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(Scene, true) };
            // Ensure the outpost map loader is present in the current scene.
            AddOutpostMapToScene();
            AssetDatabase.SaveAssets();
            Debug.Log("AFTERLIFE_PROJECT_READY");
        }
        [MenuItem("Afterlife/Add Outpost Map to Scene")]
        public static void AddOutpostMapToScene()
        {
            // Skip if already present.
            if (UnityEngine.Object.FindAnyObjectByType<SurvivalMapLoader>() != null)
            {
                Debug.Log("OutpostMap SurvivalMapLoader already in scene.");
                return;
            }
            var mapGo = new GameObject("OutpostMap");
            mapGo.AddComponent<SurvivalMapLoader>();
            Undo.RegisterCreatedObjectUndo(mapGo, "Add OutpostMap");
            var activeScene = EditorSceneManager.GetActiveScene();
            EditorSceneManager.SaveScene(activeScene);
            Debug.Log("AFTERLIFE_OUTPOST_MAP_ADDED");
        }
        static string BundleContent()
        {
            string source = Root + "Simulation";
            var modules = Directory.GetFiles(source, "*.mjs", SearchOption.AllDirectories).OrderBy(p=>p,StringComparer.Ordinal).Select(file=>
            {
                string name = file.Substring(source.Length+1).Replace('\\','/');
                string code = Regex.Replace(File.ReadAllText(file), "(\\bfrom\\s*|\\bimport\\s*)(['\"])(\\.[^'\"]+)\\2", m=>
                {
                    string resolved = Path.GetFullPath(Path.Combine(Path.GetDirectoryName(file),m.Groups[3].Value));
                    string relative = resolved.Substring(Path.GetFullPath(source).Length+1).Replace('\\','/');
                    return m.Groups[1].Value+m.Groups[2].Value+relative+m.Groups[2].Value;
                });
                return new ModuleSource {name=name,source=code};
            }).ToArray();
            return JsonUtility.ToJson(new ModuleBundle {modules=modules});
        }
        [MenuItem("Afterlife/Rebuild Simulation Bundle")]
        public static void Bundle()
        {
            string target = Root + "Resources/Simulation.json", content=BundleContent();
            if (!File.Exists(target)||File.ReadAllText(target)!=content) {File.WriteAllText(target,content);AssetDatabase.ImportAsset(target);}
        }
        public static void AssertBundleCurrent()
        {
            string target = Root + "Resources/Simulation.json";
            if (!File.Exists(target) || File.ReadAllText(target) != BundleContent())
                throw new InvalidOperationException("Simulation bundle is stale. Use Afterlife > Rebuild Simulation Bundle before validating.");
        }
        [MenuItem("Afterlife/Configure Textures")]
        public static void ConfigureTextures()
        {
            AssetDatabase.Refresh();
            string[] folders = new[] { Root + "Resources/UI", Root + "Resources/Buildings", Root + "Resources/Title" };
            int count = 0;
            foreach (var folder in folders)
            {
                if (!Directory.Exists(folder)) continue;
                var files = Directory.GetFiles(folder, "*.png", SearchOption.AllDirectories);
                foreach (var file in files)
                {
                    string assetPath = file.Replace('\\', '/');
                    var importer = AssetImporter.GetAtPath(assetPath) as TextureImporter;
                    if (importer == null) continue;
                    bool dirty = false;
                    if (importer.textureType != TextureImporterType.Sprite) { importer.textureType = TextureImporterType.Sprite; dirty = true; }
                    if (importer.spriteImportMode != SpriteImportMode.Single) { importer.spriteImportMode = SpriteImportMode.Single; dirty = true; }
                    if (importer.filterMode != FilterMode.Point) { importer.filterMode = FilterMode.Point; dirty = true; }
                    if (importer.mipmapEnabled) { importer.mipmapEnabled = false; dirty = true; }
                    if (importer.textureCompression != TextureImporterCompression.Uncompressed) { importer.textureCompression = TextureImporterCompression.Uncompressed; dirty = true; }
                    if (!importer.alphaIsTransparency) { importer.alphaIsTransparency = true; dirty = true; }
                    if (dirty)
                    {
                        importer.SaveAndReimport();
                        count++;
                    }
                }
            }
            // Also configure the outpost pixel-art atlas so it renders with nearest-neighbour filtering.
            string outpostAtlas = Root + "Resources/outpost_atlas.png";
            if (File.Exists(outpostAtlas))
            {
                var imp = AssetImporter.GetAtPath(outpostAtlas) as TextureImporter;
                if (imp != null)
                {
                    bool d2 = false;
                    if (imp.textureType != TextureImporterType.Default) { imp.textureType = TextureImporterType.Default; d2 = true; }
                    if (imp.filterMode != FilterMode.Point) { imp.filterMode = FilterMode.Point; d2 = true; }
                    if (imp.mipmapEnabled) { imp.mipmapEnabled = false; d2 = true; }
                    if (imp.textureCompression != TextureImporterCompression.Uncompressed) { imp.textureCompression = TextureImporterCompression.Uncompressed; d2 = true; }
                    if (!imp.alphaIsTransparency) { imp.alphaIsTransparency = true; d2 = true; }
                    if (imp.isReadable != true) { imp.isReadable = true; d2 = true; }
                    if (d2) { imp.SaveAndReimport(); count++; }
                }
            }
            AssetDatabase.SaveAssets();
            Debug.Log("AFTERLIFE_TEXTURES_CONFIGURED count=" + count);
        }
        public static void BuildVerifiedMac() { Validate(); SimulationRegression.Run(); BuildMac(); }
        [MenuItem("Afterlife/Build/macOS")]
        public static void BuildMac() => Build(BuildTarget.StandaloneOSX, "Builds/macOS/Afterlife.app");
        [MenuItem("Afterlife/Build/Windows (requires module)")]
        public static void BuildWindows() => Build(BuildTarget.StandaloneWindows64, "Builds/Windows/Afterlife.exe");
        [MenuItem("Afterlife/Build/Linux (requires module)")]
        public static void BuildLinux() => Build(BuildTarget.StandaloneLinux64, "Builds/Linux/Afterlife");
        static void Build(BuildTarget target,string output)
        {
            Prepare();
            if(!BuildPipeline.IsBuildTargetSupported(BuildTargetGroup.Standalone,target)) throw new BuildFailedException("Install this platform's Unity Hub build support first.");
            Directory.CreateDirectory(Path.GetDirectoryName(output));
            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions { scenes=new[]{Scene},locationPathName=output,target=target,options=BuildOptions.None });
            if(report.summary.result!=BuildResult.Succeeded) throw new BuildFailedException(report.summary.result.ToString());
            Debug.Log("AFTERLIFE_BUILD_SUCCEEDED " + output);
        }
        [MenuItem("Afterlife/Validate Embedded Simulation")]
        public static void Validate()
        {
            AssertBundleCurrent();
            Application.SetStackTraceLogType(LogType.Log, StackTraceLogType.None);
            using(var sim=new Simulation())
            {
                var initial=sim.ReadFrame(); Require(initial.day==1 && initial.entities.Count(e=>e.kind=="survivor")==4,"Four starting survivors");
                Require(sim.ReadTerrain()!=null,"Startup terrain without generated map");
                float initialWood=initial.wood;
                var clock=System.Diagnostics.Stopwatch.StartNew();
                for(int i=0;i<200;i++)sim.Step(.05f);
                var frame=sim.ReadFrame();Require(Mathf.Abs(frame.elapsed-10)<.01f,"Fixed simulation step");
                Require(frame.entities.Any(e=>e.kind=="zombie") || frame.kills > 0,"Zombie arrivals");
                Require(frame.wood>initialWood,"Production");
                string save=sim.Serialize();using(var restored=new Simulation()){Require(restored.Restore(save),"Save round trip");Require(Mathf.Abs(restored.ReadFrame().elapsed-frame.elapsed)<.001f,"Restored time");Require(!restored.Restore("{}"),"Reject invalid save");}
                Require(sim.Command("recruit"),"Radio broadcast");for(int i=0;i<430;i++)sim.Step(.05f);
                var hud=sim.ReadHud();Require(hud.candidates.Length>0,"Candidate produced");Require(sim.Command("acceptCandidate",hud.candidates[0].id),"Recruit accepted");
                Require(sim.Command("upgradeBuilding",1,"radio"),"Building upgrade");
                Require(sim.ReadCatalog().buildings.Length==13,"Complete construction catalog");
                Require(sim.Command("devGrantResource","wood",1000) && sim.Command("devGrantResource","metal",1000),"Developer resource controls");
                var towerSpot=sim.Preview("tower",-352,-256,0);
                Require(towerSpot.ok && sim.Command("build","tower",(double)towerSpot.x,(double)towerSpot.y,towerSpot.rotation),"Watchtower placement");
                var tower=sim.ReadFrame().entities.FirstOrDefault(e=>e.kind=="building"&&e.type=="tower");
                sim.Step(.05f);
                Require(tower!=null && sim.ReadFrame().entities.Any(e=>e.id==tower.id),"Watchtower persists in Unity frame");
                Debug.Log("AFTERLIFE_VALIDATION_PASSED elapsed_ms="+clock.ElapsedMilliseconds);
            }
        }
        static void Require(bool condition,string message){if(!condition)throw new Exception("Validation failed: "+message);Debug.Log("PASS "+message);}
    }
    public sealed class SimulationImporter : AssetPostprocessor
    {
        static void OnPostprocessAllAssets(string[] imported,string[] deleted,string[] moved,string[] movedFrom)
        {
            if(imported.Concat(deleted).Concat(moved).Concat(movedFrom).Any(p=>p.StartsWith("Assets/Afterlife/Simulation/")&&p.EndsWith(".mjs")))
                EditorApplication.delayCall += AfterlifeProject.Bundle;
        }
    }
    public sealed class SimulationBuildStep : IPreprocessBuildWithReport
    {
        public int callbackOrder => 0;
        public void OnPreprocessBuild(BuildReport report) => AfterlifeProject.Bundle();
    }
    [InitializeOnLoad]
    public static class AutoOpenScene
    {
        static AutoOpenScene()
        {
            EditorApplication.delayCall += () =>
            {
                if (EditorApplication.isPlaying) return;
                var active = EditorSceneManager.GetActiveScene();
                if (string.IsNullOrEmpty(active.path) || active.name == "Untitled" || active.name == "SampleScene")
                {
                    string target = AfterlifeProject.ActiveScenePath;
                    if (File.Exists(target))
                    {
                        EditorSceneManager.OpenScene(target);
                    }
                }
            };
        }
    }
}
