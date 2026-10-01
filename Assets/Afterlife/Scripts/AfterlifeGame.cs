using System;
using System.Collections;
using System.Linq;
using UnityEngine;

namespace Afterlife
{
    [DisallowMultipleComponent]
    public sealed class AfterlifeGame : MonoBehaviour
    {
        public Simulation Simulation { get; private set; }
        public WorldView World { get; private set; }
        public GameHud Hud { get; private set; }
        public AudioManager Audio { get; private set; }
        public Frame Frame { get; private set; }
        public HudData Data { get; private set; }
        public Catalog Catalog { get; private set; }
        public bool Paused { get; set; }
        public bool Expanding { get; private set; }
        public string Building { get; private set; }
        public int Rotation { get; private set; }
        public int Speed { get; set; } = 1;
        public bool Ready { get; private set; }
        public static bool SmokeMode => Environment.GetCommandLineArgs().Contains("--afterlife-smoke");

        [Header("Camera & Controls")]
        [Range(200f, 1600f)] public float panSpeed = 650f;
        [Range(0.5f, 3f)] public float zoomSensitivity = 1.4f;

        [Header("Live Game Telemetry (Play Mode)")]
        [SerializeField] string currentDayPhase = "Loading...";
        [SerializeField] int woodCount;
        [SerializeField] int metalCount;
        [SerializeField] int foodCount;
        [SerializeField] int survivorCount;
        [SerializeField] int zombieCount;
        [SerializeField] int totalKills;

        float accumulator, hudTimer, saveTimer;
        bool focused = true;
        Placement preview;
        string fatal;
        bool outcomeShown;
        bool hadIncoming;
        bool generatingNewRun;
        public bool PauseOnIncursion { get; private set; }
        public bool DebugToolsEnabled => Application.isEditor || Debug.isDebugBuild;

        Vector2 lastMousePos;
        Vector2 leftDownPos;
        float leftDragDist;
        bool leftDragging;

        void Start()
        {
            try
            {
                // Clear any edit-mode preview children so runtime begins fresh
                for (int i = transform.childCount - 1; i >= 0; i--)
                {
                    Destroy(transform.GetChild(i).gameObject);
                }

                // Deactivate any SurvivalMapLoader / OutpostMap objects in the scene so they
                // don't spawn colliders and sprites that overlap with WorldView.
                foreach (var loader in FindObjectsByType<SurvivalMapLoader>())
                    loader.gameObject.SetActive(false);

                Application.targetFrameRate = 60;
                PauseOnIncursion = PlayerPrefs.GetInt("Afterlife.PauseOnIncursion", 0) != 0;
                Audio = gameObject.AddComponent<AudioManager>();
                Simulation = new Simulation(); Catalog = Simulation.ReadCatalog();
                string warning = SmokeMode ? "" : SaveStore.Load(Simulation);
                var camera = Camera.main;
                if (!camera) { var go = new GameObject("Main Camera", typeof(Camera)); go.tag = "MainCamera"; camera = go.GetComponent<Camera>(); }
                camera.orthographic = true; camera.transform.position = new Vector3(0, 0, -10); camera.backgroundColor = new Color(.2f,.27f,.17f);
                World = gameObject.AddComponent<WorldView>(); World.Initialize(camera);
                Frame = Simulation.ReadFrame(); RefreshTerrain(); World.Present(Frame);
                Data = Simulation.ReadHud();
                hadIncoming = !string.IsNullOrEmpty(Frame.incoming);
                Hud = gameObject.AddComponent<GameHud>(); Hud.Initialize(this);
                if (!string.IsNullOrEmpty(warning)) Hud.Notify("Save recovery", warning);
                Ready = true;
                if (SmokeMode) gameObject.AddComponent<PlayerSmokeCheck>();
                else Hud.ShowStartScreen();
                lastMousePos = Input.mousePosition;
            }
            catch (Exception ex) { Fail(ex); }
        }

        void Update()
        {
            if (!Ready) return;
            // The embedded interpreter cannot survive Unity's assembly reload.
            if (Simulation == null)
            {
                Ready = false;
                fatal = "Scripts were reloaded. Stop and restart Play mode to continue from your autosave.";
                return;
            }
            try
            {
                HandleInput();
                if (Hud.IsWorldLoading) return;
                if (World.Fit(Frame, Expanding)) { Simulation.SetBounds(World.Bounds.x, World.Bounds.y); World.RebuildTerrain(Simulation.ReadTerrain()); }
                if (!Paused && !Hud.ModalOpen && focused && Frame.status == "playing")
                {
                    accumulator += Mathf.Min(Time.unscaledDeltaTime, .15f) * Speed;
                    int steps = 0;
                    while (accumulator >= .05f && steps++ < 12) { Simulation.Step(.05f); accumulator -= .05f; }
                    // Bounded catch-up prevents a slow frame from creating an unbounded work queue.
                    accumulator = Mathf.Min(accumulator, .6f);
                    if (steps > 0) { Frame = Simulation.ReadFrame(); World.Present(Frame); CheckIncursion(); }
                }
                hudTimer += Time.unscaledDeltaTime; saveTimer += Time.unscaledDeltaTime;
                if (hudTimer >= .25f) { hudTimer = 0; Data = Simulation.ReadHud(); Hud.Refresh(); }
                if (saveTimer >= 5) { saveTimer = 0; Save(); }

                if (Frame != null)
                {
                    currentDayPhase = $"Day {Frame.day:00} · {((int)Frame.hour):00}:{(int)(Frame.hour % 1 * 60):00} ({Frame.phase})";
                    woodCount = Mathf.FloorToInt(Frame.wood);
                    metalCount = Mathf.FloorToInt(Frame.metal);
                    survivorCount = Frame.survivorCount;
                    zombieCount = Frame.zombieCount;
                    totalKills = Frame.kills;

                    if (Frame.status != "playing" && !outcomeShown && !Hud.ModalOpen)
                    {
                        outcomeShown = true;
                        Audio?.PlayOutcome(Frame.status == "won");
                        Hud.ShowOutcome();
                    }
                }
            }
            catch (Exception ex) { Fail(ex); }
        }

        void HandleInput()
        {
            if (Hud != null && Hud.IsWorldLoading) return;
            if (Hud != null && Hud.IsStartScreenOpen)
            {
                if (Input.GetKeyDown(KeyCode.W) || Input.GetKeyDown(KeyCode.UpArrow) || (Hud.IsNewGameSetupOpen && Input.GetKeyDown(KeyCode.LeftArrow)))
                {
                    Hud.SelectPreviousStartMenuItem();
                    return;
                }
                if (Input.GetKeyDown(KeyCode.S) || Input.GetKeyDown(KeyCode.DownArrow) || (Hud.IsNewGameSetupOpen && Input.GetKeyDown(KeyCode.RightArrow)))
                {
                    Hud.SelectNextStartMenuItem();
                    return;
                }
                if (Input.GetKeyDown(KeyCode.Return) || Input.GetKeyDown(KeyCode.KeypadEnter) || Input.GetKeyDown(KeyCode.Space))
                {
                    Hud.ActivateCurrentStartMenuItem();
                    return;
                }
                if (Input.GetKeyDown(KeyCode.Escape) && Hud.IsNewGameSetupOpen)
                {
                    Hud.BackFromNewGameSetup();
                    return;
                }
                if (Input.GetKeyDown(KeyCode.N) && !Hud.IsNewGameSetupOpen)
                {
                    Hud.StartNewGame();
                    return;
                }
                if (Input.GetKeyDown(KeyCode.C) && !Hud.IsNewGameSetupOpen)
                {
                    Hud.ContinueGame();
                    return;
                }
                if (Input.GetKeyDown(KeyCode.Escape))
                {
                    Save();
                    Application.Quit();
                    return;
                }
                return;
            }

            if (Input.GetKeyDown(KeyCode.Escape) || Input.GetMouseButtonDown(1)) { Cancel(); return; }

            if (Hud.ModalOpen) return;

            // Camera panning with WASD or Arrow Keys
            float panStep = panSpeed * Time.unscaledDeltaTime;
            Vector2 pan = Vector2.zero;
            if (Input.GetKey(KeyCode.W) || Input.GetKey(KeyCode.UpArrow)) pan.y += panStep;
            if (Input.GetKey(KeyCode.S) || Input.GetKey(KeyCode.DownArrow)) pan.y -= panStep;
            if (Input.GetKey(KeyCode.A) || Input.GetKey(KeyCode.LeftArrow)) pan.x -= panStep;
            if (Input.GetKey(KeyCode.D) || Input.GetKey(KeyCode.RightArrow)) pan.x += panStep;
            if (pan != Vector2.zero) World.PanCamera(pan);

            // Track mouse drag state
            if (Input.GetMouseButtonDown(0))
            {
                leftDownPos = Input.mousePosition;
                leftDragDist = 0f;
                leftDragging = false;
            }
            Vector2 mouseDelta = (Vector2)Input.mousePosition - lastMousePos;
            if (Input.GetMouseButton(0) && !Hud.OverUI())
            {
                leftDragDist += mouseDelta.magnitude;
                if (leftDragDist > 4f)
                {
                    leftDragging = true;
                }
            }

            // Mouse drag panning (primary left mouse drag or middle mouse drag)
            if (leftDragging && Building != "barricade" && !Hud.OverUI())
            {
                World.DragCamera(mouseDelta);
            }
            else if (Input.GetMouseButton(2) && !Hud.OverUI())
            {
                Vector2 drag = new Vector2(-Input.GetAxis("Mouse X") * 24f, -Input.GetAxis("Mouse Y") * 24f);
                World.PanCamera(drag);
            }

            // Mouse wheel zoom (smooth, directed towards mouse cursor)
            float scroll = Input.GetAxis("Mouse ScrollWheel");
            if (!Hud.OverUI() && Mathf.Abs(scroll) > 0.005f)
            {
                World.ZoomCamera(scroll * zoomSensitivity * 0.35f, Input.mousePosition, true);
            }

            // Keyboard zoom (+ / - / PageUp / PageDown / [ / ])
            if (Input.GetKeyDown(KeyCode.Equals) || Input.GetKeyDown(KeyCode.KeypadPlus) || Input.GetKeyDown(KeyCode.PageUp) || Input.GetKeyDown(KeyCode.RightBracket))
                World.ZoomCamera(0.06f);
            if (Input.GetKeyDown(KeyCode.Minus) || Input.GetKeyDown(KeyCode.KeypadMinus) || Input.GetKeyDown(KeyCode.PageDown) || Input.GetKeyDown(KeyCode.LeftBracket))
                World.ZoomCamera(-0.06f);

            // Focus on selection or reset camera (F or Home)
            if (Input.GetKeyDown(KeyCode.F))
            {
                if (World.Selected >= 0 && Frame != null)
                {
                    var sel = Frame.entities.FirstOrDefault(e => e.id == World.Selected);
                    if (sel != null) World.FocusOn(new Vector2(sel.x, sel.y));
                    else World.ResetCamera();
                }
                else World.ResetCamera();
            }
            if (Input.GetKeyDown(KeyCode.Home)) World.ResetCamera();

            if (Input.GetKeyDown(KeyCode.C))
            {
                if (Hud.IsCrewOpen) Hud.CloseModal();
                else Hud.ShowCrew();
                return;
            }

            if (Hud.ModalOpen) return;
            if (Input.GetKeyDown(KeyCode.Space)) TogglePause();
            if (Input.GetKeyDown(KeyCode.B)) Hud.ShowBuild();
            if (Input.GetKeyDown(KeyCode.E)) Hud.ShowExpeditions();
            if (Input.GetKeyDown(KeyCode.J)) Hud.ShowJournal();
            if (Input.GetKeyDown(KeyCode.L)) ToggleExpansion();
            if (Input.GetKeyDown(KeyCode.R) && !string.IsNullOrEmpty(Building)) Rotation = 1 - Rotation;
            if (Input.GetKeyDown(KeyCode.Alpha1)) SetSpeed(1);
            if (Input.GetKeyDown(KeyCode.Alpha2)) SetSpeed(2);
            if (Input.GetKeyDown(KeyCode.Alpha4)) SetSpeed(4);
            if (DebugToolsEnabled && Input.GetKeyDown(KeyCode.Z))
            {
                var p = World.PointerWorld();
                Command("spawnZombieAt", "walker", (double)p.x, (double)p.y);
                Hud.Notify("Zombie spawned", "Spawned a walker at cursor position.");
            }
            if (DebugToolsEnabled && Input.GetKeyDown(KeyCode.H))
            {
                Command("triggerIncursion");
                Hud.Notify("Incursion triggered", "Director announced an incoming swarm!");
            }
            if (Hud.ModalOpen) return;
            if (Hud.OverUI()) { World.ShowPlacement(null); return; }
            var point = World.PointerWorld();
            if (!string.IsNullOrEmpty(Building))
            {
                preview = Simulation.Preview(Building, point.x, point.y, Rotation);
                World.ShowPlacement(preview);
                if (preview != null)
                {
                    bool canRotate = Building == "barricade" || Building == "gate";
                    Hud.SetHint(preview.reason + (canRotate ? "   R rotate · Right click finish" : "   Right click finish"));
                }
            }
            bool leftClicked = Input.GetMouseButtonUp(0) && leftDragDist <= 4f && !Hud.OverUI();
            if (Input.GetMouseButtonUp(0))
            {
                leftDragging = false;
            }
            lastMousePos = Input.mousePosition;

            bool isBarricade = Building == "barricade";
            if (isBarricade)
            {
                if (!Input.GetMouseButtonDown(0)) return;
            }
            else
            {
                if (!leftClicked) return;
            }

            if (!string.IsNullOrEmpty(Building))
            {
                if (preview != null && preview.ok)
                {
                    string builtType = Building;
                    bool success = Command("build", Building, (double)preview.x, (double)preview.y, preview.rotation);
                    if (success)
                    {
                        if (builtType != "barricade")
                        {
                            Building = null;
                            World.ShowPlacement(null);
                            Hud.SetHint("");
                        }
                    }
                    else
                    {
                        Hud.Notify("Cannot build here", preview.reason);
                    }
                }
                else if (preview != null)
                {
                    Hud.Notify("Cannot build here", preview.reason);
                }
                return;
            }
            if (Expanding) { Command("buyLand", Mathf.FloorToInt((point.x + 128) / 256), Mathf.FloorToInt((point.y + 96) / 192)); return; }
            int poiHit = World.HitPoi(point);
            if (poiHit >= 0)
            {
                Hud.ShowPoiExpedition(poiHit);
                return;
            }
            Select(World.Hit(point));
        }

        public void Select(int id) { World.Selected = id; Hud.ShowInspector(id); }
        public void BeginBuilding(string type) { Hud.CloseModal(); Building = type; Rotation = 0; Expanding = false; Select(-1); RefreshTerrain(); }
        public void ToggleExpansion()
        {
            Hud.CloseModal(); Building = null; World.ShowPlacement(null); Expanding = !Expanding; Select(-1); RefreshTerrain();
            Hud.SetHint(Expanding ? "Click a highlighted parcel to claim it · " + Data.landCost + " · Escape to finish" : "");
        }
        public void Cancel()
        {
            if (World.FollowTargetId >= 0) World.ClearFollow();
            if (Hud.ModalOpen) { Hud.CloseModal(); return; }
            Building = null; World.ShowPlacement(null); Expanding = false; Select(-1); RefreshTerrain(); Hud.SetHint("");
        }
        public void TogglePause() { Paused = !Paused; Hud.Refresh(); }
        public void SetSpeed(int speed) { Speed = speed == 2 || speed == 4 ? speed : 1; Hud.Refresh(); }

        public void TogglePauseOnIncursion()
        {
            PauseOnIncursion = !PauseOnIncursion;
            PlayerPrefs.SetInt("Afterlife.PauseOnIncursion", PauseOnIncursion ? 1 : 0);
            PlayerPrefs.Save();
        }

        void CheckIncursion()
        {
            bool incoming = !string.IsNullOrEmpty(Frame.incoming);
            if (incoming && !hadIncoming && PauseOnIncursion)
            {
                Paused = true;
                Hud.Notify("Incursion — paused", "Prepare your defenses, then press Space to resume.");
                Hud.Refresh();
            }
            hadIncoming = incoming;
        }

        public bool Command(string command, params object[] args)
        {
            bool ok = Simulation.Command(command, args);
            Frame = Simulation.ReadFrame(); Data = Simulation.ReadHud(); World.Present(Frame); CheckIncursion(); RefreshTerrain(); Hud.Refresh(); Hud.RefreshInspector();
            if (ok)
            {
                if (command == "build") Audio?.PlayBuild();
                else if (command == "raiseAlarm") Audio?.PlayAlarm();
            }
            else
            {
                Hud.Notify("Action unavailable", "Check supplies, capacity, placement, and current assignments.");
            }
            return ok;
        }

        public void RefreshTerrain()
        {
            if (World.Fit(Frame, Expanding) || World.Terrain == null) { Simulation.SetBounds(World.Bounds.x, World.Bounds.y); World.RebuildTerrain(Simulation.ReadTerrain()); }
        }

        public bool Save()
        {
            if (Simulation == null || generatingNewRun) return false;
            try { if (!SmokeMode) SaveStore.Write(Simulation); return true; }
            catch (Exception ex) { Debug.LogWarning(ex); Hud?.Notify("Save failed", ex.Message); return false; }
        }

        public void NewRun() => NewRun(null, "normal");

        public void NewRun(string mapSize, string difficulty)
        {
            Save(); // Keep the previous save as the backup when the new run is written.
            ResetNewRun(difficulty);
            if (mapSize != null && !Simulation.GenerateWorld(mapSize, UnityEngine.Random.Range(1, int.MaxValue)))
                throw new InvalidOperationException("World generation failed for " + mapSize);
            CompleteNewRun();
            Save();
        }

        public void StartNewRunWithLoading(string mapSize, string difficulty)
        {
            if (generatingNewRun) return;
            StartCoroutine(GenerateNewRun(mapSize, difficulty));
        }

        IEnumerator GenerateNewRun(string mapSize, string difficulty)
        {
            generatingNewRun = true;
            string previousRun = null;
            Exception failure = null;
            yield return null; // Let the loading screen render before the first generation phase.
            try
            {
                previousRun = Simulation.Serialize();
                ResetNewRun(difficulty);
                Simulation.BeginWorldGeneration(mapSize, UnityEngine.Random.Range(1, int.MaxValue));
            }
            catch (Exception ex) { failure = ex; }

            while (failure == null)
            {
                WorldGenerationProgress step = null;
                try { step = Simulation.AdvanceWorldGeneration(); }
                catch (Exception ex) { failure = ex; }
                if (failure != null) break;
                Hud.UpdateWorldLoading(step.done ? .94f : step.progress,
                    step.done ? "Bringing the refuge into focus..." : step.activity);
                if (step.done) break;
                yield return null;
            }

            if (failure == null)
            {
                yield return null;
                try
                {
                    CompleteNewRun();
                    Hud.UpdateWorldLoading(1, "The refuge is ready. Good luck out there.");
                    generatingNewRun = false;
                    Save();
                }
                catch (Exception ex) { failure = ex; }
            }

            if (failure == null)
            {
                yield return null;
                Hud.FinishWorldLoading(mapSize, difficulty);
            }
            else
            {
                Debug.LogException(failure);
                generatingNewRun = false;
                try { if (previousRun != null && Simulation.Restore(previousRun)) CompleteNewRun(); }
                catch (Exception restoreError) { Debug.LogException(restoreError); }
                Hud.FailWorldLoading(failure.Message);
            }
        }

        void ResetNewRun(string difficulty)
        {
            Simulation.Command("reset");
            Simulation.SetDifficulty(difficulty);
        }

        void CompleteNewRun()
        {
            outcomeShown = false; hadIncoming = false; Hud.ClearJournal(); accumulator = 0; Paused = false; Speed = 1;
            Building = null; Expanding = false; World.ShowPlacement(null); World.Selected = -1;
            World.ResetCamera();
            Frame = Simulation.ReadFrame(); Data = Simulation.ReadHud(); RefreshTerrain(); World.RebuildTerrain(Simulation.ReadTerrain()); World.Present(Frame);
            Hud.CloseModal(); Hud.ShowInspector(-1); Hud.Refresh();
        }

        public string ImportSave(string json)
        {
            // Validate in an isolated simulation before replacing a live game.
            using (var probe = new Simulation()) if (!probe.Restore(json)) return probe.RestoreError(json);
            Save();
            if (!Simulation.Restore(json)) return "Save restoration failed.";
            outcomeShown = false; hadIncoming = !string.IsNullOrEmpty(Simulation.ReadFrame().incoming); Hud.ClearJournal();
            accumulator = 0; Building = null; Expanding = false; Paused = true; World.Selected = -1; World.ShowPlacement(null);
            World.ResetCamera();
            Frame = Simulation.ReadFrame(); Data = Simulation.ReadHud(); RefreshTerrain(); World.RebuildTerrain(Simulation.ReadTerrain()); World.Present(Frame);
            Hud.CloseModal(); Hud.ShowInspector(-1); Hud.Refresh(); Save(); return "";
        }

        void OnApplicationFocus(bool value) { focused = value; if (!value && Ready) Save(); }
        void OnApplicationPause(bool value) { if (value && Ready) Save(); }
        void OnApplicationQuit() { if (Ready) Save(); }
        void OnDestroy() { Simulation?.Dispose(); }
        void Fail(Exception ex) { Ready = false; fatal = ex.ToString(); Debug.LogException(ex); Hud?.Notify("Afterlife stopped", ex.Message); }

        void OnGUI()
        {
            if (fatal == null) return;
            GUI.Box(new Rect(20, 20, Screen.width - 40, Screen.height - 40), "Afterlife could not continue");
            GUI.TextArea(new Rect(40, 60, Screen.width - 80, Screen.height - 100), fatal);
        }

        [ContextMenu("Reset Camera View")]
        public void ContextResetCamera() => World?.ResetCamera();

        [ContextMenu("Toggle Alarm")]
        public void ContextToggleAlarm() { if (Frame != null) Command(Frame.alarm ? "clearAlarm" : "raiseAlarm"); }

        [ContextMenu("Toggle Fullscreen")]
        public void ContextToggleFullscreen() => Screen.fullScreen = !Screen.fullScreen;

        [ContextMenu("Debug: Spawn Walker at Pointer")]
        public void ContextSpawnWalker() { var p = World.PointerWorld(); Command("spawnZombieAt", "walker", (double)p.x, (double)p.y); }

        [ContextMenu("Debug: Spawn Runner at Pointer")]
        public void ContextSpawnRunner() { var p = World.PointerWorld(); Command("spawnZombieAt", "runner", (double)p.x, (double)p.y); }

        [ContextMenu("Debug: Spawn Brute at Pointer")]
        public void ContextSpawnBrute() { var p = World.PointerWorld(); Command("spawnZombieAt", "brute", (double)p.x, (double)p.y); }

        [ContextMenu("Debug: Trigger Incursion")]
        public void ContextTriggerIncursion() { Command("triggerIncursion"); }

        [ContextMenu("Debug: Kill All Zombies")]
        public void ContextKillAllZombies() { Command("killAllZombies"); }

        [ContextMenu("World: Generate Procedural World (Medium)")]
        public void ContextGenerateWorld()
        {
            if (Simulation != null)
            {
                Simulation.GenerateWorld("medium", UnityEngine.Random.Range(1, 99999));
                Frame = Simulation.ReadFrame();
                RefreshTerrain();
                World.RebuildTerrain(Simulation.ReadTerrain());
                World.Present(Frame);
            }
        }

        [ContextMenu("World: Load Outpost Map")]
        public void ContextLoadOutpostMap()
        {
            if (Simulation != null)
            {
                Simulation.LoadOutpostMap();
                Frame = Simulation.ReadFrame();
                RefreshTerrain();
                World.RebuildTerrain(Simulation.ReadTerrain());
                World.Present(Frame);
            }
        }

        [ContextMenu("Season: Set Spring")]
        public void ContextSetSeasonSpring()
        {
            if (Simulation != null)
            {
                Simulation.SetSeason("spring");
                Frame = Simulation.ReadFrame();
                World.RebuildTerrain(Simulation.ReadTerrain());
            }
        }

        [ContextMenu("Season: Set Summer")]
        public void ContextSetSeasonSummer()
        {
            if (Simulation != null)
            {
                Simulation.SetSeason("summer");
                Frame = Simulation.ReadFrame();
                World.RebuildTerrain(Simulation.ReadTerrain());
            }
        }

        [ContextMenu("Season: Set Fall")]
        public void ContextSetSeasonFall()
        {
            if (Simulation != null)
            {
                Simulation.SetSeason("fall");
                Frame = Simulation.ReadFrame();
                World.RebuildTerrain(Simulation.ReadTerrain());
            }
        }

        [ContextMenu("Season: Set Winter")]
        public void ContextSetSeasonWinter()
        {
            if (Simulation != null)
            {
                Simulation.SetSeason("winter");
                Frame = Simulation.ReadFrame();
                World.RebuildTerrain(Simulation.ReadTerrain());
            }
        }

        [ContextMenu("UI: Show Start Screen")]
        public void ContextShowStartScreen() => Hud?.ShowStartScreen();
    }
}
