using System;
using System.Collections;
using System.IO;
using System.Linq;
using UnityEngine;
using UnityEngine.UIElements;

namespace Afterlife
{
    // Opt-in standalone smoke harness. --afterlife-smoke never reads or writes the user's save.
    public sealed class PlayerSmokeCheck : MonoBehaviour
    {
        string output;
        bool failed;
        IEnumerator Start()
        {
            output = Path.Combine(Path.GetTempPath(), "afterlife-unity-smoke"); Directory.CreateDirectory(output);
            Application.logMessageReceived += OnLog;
            var game = GetComponent<AfterlifeGame>();
            yield return new WaitForSecondsRealtime(2);
            Check(game.Ready, "Game booted");
            Check(GetComponent<UIDocument>().rootVisualElement.worldBound.width > 100, "Native UI laid out");
            Check(FindObjectsByType<SpriteRenderer>().Count(r=>r.enabled&&r.sprite) > 80, "Native sprite world rendered");
            game.TogglePause();
            yield return new WaitForEndOfFrame();
            ScreenCapture.CaptureScreenshot(Path.Combine(output,"world.png"));
            game.Select(1);
            yield return new WaitForSecondsRealtime(.3f);
            Check(GetComponent<UIDocument>().rootVisualElement.Query<Button>().ToList().Any(b=>b.text.Contains("Upgrade")), "Building upgrade inspector");
            yield return new WaitForEndOfFrame();
            ScreenCapture.CaptureScreenshot(Path.Combine(output,"inspector.png"));
            game.SetSpeed(0); Check(game.Speed == 1, "Invalid speed falls back to 1x");
            game.Hud.Notify("Journal smoke check", "A retained event");
            game.Hud.ShowJournal(); yield return null;
            Check(GetComponent<UIDocument>().rootVisualElement.Query<Label>().ToList().Any(l => l.text.Contains("A retained event")), "Journal retains notifications");
            game.Hud.CloseModal();
            bool originalPauseOnIncursion = game.PauseOnIncursion;
            if (!originalPauseOnIncursion) game.TogglePauseOnIncursion();
            if (game.Paused) game.TogglePause();
            game.Command("triggerIncursion");
            Check(game.Paused, "Incursion pauses immediately when enabled");
            game.TogglePause();
            game.Command("clearAlarm");
            Check(!game.Paused, "An existing incursion does not repeatedly pause");
            game.TogglePause();
            if (!originalPauseOnIncursion) game.TogglePauseOnIncursion();
            string beforeInvalidImport = game.Simulation.Serialize();
            Check(game.ImportSave("{}").Length > 0 && game.Simulation.Serialize() == beforeInvalidImport, "Invalid import preserves live simulation");
            game.Hud.ShowBuild();yield return null;Check(game.Hud.ModalOpen, "Construction menu");
            yield return new WaitForEndOfFrame();ScreenCapture.CaptureScreenshot(Path.Combine(output,"build.png"));game.Hud.CloseModal();
            game.Hud.ShowRecruitment();yield return null;Check(game.Hud.ModalOpen, "Recruitment menu");
            yield return new WaitForEndOfFrame();ScreenCapture.CaptureScreenshot(Path.Combine(output,"recruitment.png"));game.Hud.CloseModal();
            game.Hud.ShowStockpile();yield return null;Check(game.Hud.ModalOpen, "Stockpile menu");
            yield return new WaitForEndOfFrame();ScreenCapture.CaptureScreenshot(Path.Combine(output,"stockpile.png"));game.Hud.CloseModal();
            game.Hud.ShowExpeditions();yield return null;Check(game.Hud.ModalOpen, "Expedition menu");
            yield return new WaitForEndOfFrame();ScreenCapture.CaptureScreenshot(Path.Combine(output,"expeditions.png"));game.Hud.CloseModal();
            game.ToggleExpansion();yield return null;Check(game.Expanding && game.World.Terrain.frontier.Length>0,"Land expansion");game.ToggleExpansion();
            game.BeginBuilding("barricade");yield return null;Check(game.Building=="barricade","Construction placement mode");game.Cancel();
            string json=game.Simulation.Serialize();Check(game.ImportSave(json)=="","Save import via native host");
            game.Hud.CloseModal();game.Select(-1);
            game.Hud.ShowStartScreen();
            yield return null;
            Check(game.Hud.IsStartScreenOpen, "Start screen displayed");
            game.Hud.StartNewGame();
            yield return null;
            Check(game.Hud.IsNewGameSetupOpen, "Difficulty selection displayed");
            game.Hud.ActivateCurrentStartMenuItem();
            yield return null;
            Check(game.Hud.IsNewGameSetupOpen, "Map size selection displayed");
            game.Hud.ActivateCurrentStartMenuItem();
            float loadingDeadline = Time.realtimeSinceStartup + 60f;
            while (game.Hud.IsWorldLoading && Time.realtimeSinceStartup < loadingDeadline) yield return null;
            Check(!game.Hud.IsWorldLoading, "New Game loading completed");
            Check(!game.Hud.IsStartScreenOpen, "Start screen dismissed on New Game");
            Check(game.World.Terrain.mapWidth == 160 && game.World.Terrain.mapHeight == 112, "Medium procedural world generated");
            yield return new WaitForSecondsRealtime(.5f);
            File.WriteAllText(Path.Combine(output,"result.txt"),failed?"FAILED":"PASSED");
            Debug.Log("AFTERLIFE_PLAYER_SMOKE_"+(failed?"FAILED":"PASSED")+" "+output);
            if (!Environment.GetCommandLineArgs().Contains("--afterlife-stay-open")) Application.Quit(failed?1:0);
        }
        void Check(bool condition,string name) { if(!condition){failed=true;Debug.LogError("SMOKE FAIL "+name);}else Debug.Log("SMOKE PASS "+name); }
        void OnLog(string message,string stack,LogType type) {if(type==LogType.Error||type==LogType.Exception)failed=true;}
        void OnDestroy(){Application.logMessageReceived-=OnLog;}
    }
}
