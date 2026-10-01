using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UIElements;

namespace Afterlife
{
    /// <summary>
    /// Tactical UI Toolkit interface reflecting the canonical Afterlife HUD design.
    /// Features floating tactical cards, resource rate telemetry, day/night progress tracking,
    /// dynamic survivor roster with patrol badges, and an integrated action dock.
    /// </summary>
    public sealed class GameHud : MonoBehaviour
    {
        AfterlifeGame game;
        UIDocument document;
        PanelSettings settings;
        VisualElement root, backdrop, modal, toast, inspector;
        VisualElement missionCard, suppliesCard, rosterCard, actionDock;
        VisualElement timelineFill, integrityFill;
        VisualElement rosterList;
        ScrollView rosterScroll, inspectorScroll, modalScroll;

        // Mission & Time elements
        Label timeDay, timePhase, timeCountdown;
        Button pauseBtn, speed1Btn, speed2Btn, speed4Btn;

        // Supplies elements
        Label woodVal, woodRate, metalVal, metalRate, foodVal, foodRate;
        Label integrityVal;

        // Roster elements
        Label rosterCount, quickRecruitCost;
        Button quickRecruitBtn, rosterToggleBtn;
        Label patrolN, patrolE, patrolS, patrolW;

        // Action dock elements
        Label hostilesBadge, killsBadge;
        Button journalBtn;
        Button zoomInBtn, zoomOutBtn, zoomResetBtn, zoomLevelBtn;
        Button buildBtn, crewBtn, expedBtn, landBtn, alarmBtn, baseBtn, menuBtn;
        public bool IsCrewOpen { get; private set; }
        int selectedCrewSurvivorId = -1;
        string currentCrewTab = "roster";
        string rosterFilter = "all";
        readonly HashSet<int> expandedCrewSurvivors = new HashSet<int>();
        readonly Dictionary<int, string> expandedSurvivorSubTabs = new Dictionary<int, string>();

        // Helper & Alert elements
        Label hudHelper, incursionBanner;
        Label toastTitle, toastBody, inspectorHealth;
        VisualElement inspectorHealthBar;
        Label inspectorOutputMetric;
        Button inspectorRepairBtn;

        readonly Dictionary<int, VisualElement> survivorRows = new Dictionary<int, VisualElement>();
        readonly Dictionary<int, Label> survivorSubLabels = new Dictionary<int, Label>();
        readonly Dictionary<int, Button> survivorBadges = new Dictionary<int, Button>();
        readonly Dictionary<int, Button> survivorFocusButtons = new Dictionary<int, Button>();
        readonly Dictionary<string, Button> upgrades = new Dictionary<string, Button>();
        readonly List<GameEvent> journal = new List<GameEvent>();
        readonly HashSet<int> party = new HashSet<int>();

        int selected = -1;
        string trip = "woodland", rosterKey = "", lastIncoming = "";
        float toastUntil;
        bool rosterCollapsed = false;
        string inspectorBuildingTab = "staff";
        bool candidatePickerOpen = false;

        VisualElement startScreen;
        VisualElement startCanvas;
        VisualElement startCaret;
        VisualElement startCaretBlank;
        Button startNewGameBtn, startContinueBtn, startSettingsBtn, startQuitBtn;
        VisualElement newGameSetup;
        VisualElement worldLoading, worldLoadingFill;
        Label worldLoadingActivity, worldLoadingPercent;
        Label setupHeading, setupDescription;
        Button[] setupChoices;
        Button setupBackButton, setupNextButton;
        int setupStep = -1, setupIndex = 1;
        int selectedMapIndex = 1;
        bool worldLoadingActive;
        string selectedDifficulty = "normal";
        int startMenuIndex = 0;
        public bool IsStartScreenOpen { get; private set; }
        public bool IsNewGameSetupOpen => setupStep >= 0;
        public bool IsWorldLoading => worldLoadingActive;

        public bool ModalOpen => (backdrop != null && backdrop.style.display != DisplayStyle.None) || IsStartScreenOpen;

        public void Initialize(AfterlifeGame owner)
        {
            game = owner;
            settings = Resources.Load<PanelSettings>("AfterlifePanel");
            if (!settings)
            {
                settings = ScriptableObject.CreateInstance<PanelSettings>();
                settings.scaleMode = PanelScaleMode.ScaleWithScreenSize;
                settings.referenceResolution = new Vector2Int(1440, 900);
                settings.match = .5f;
            }

            document = gameObject.AddComponent<UIDocument>();
            document.panelSettings = settings;
            root = document.rootVisualElement;
            root.AddToClassList("root");
            root.pickingMode = PickingMode.Ignore;
            root.styleSheets.Add(Resources.Load<StyleSheet>("Afterlife"));

            BuildMissionCard();
            BuildSuppliesCard();
            BuildRosterCard();
            BuildActionDock();
            BuildHelperPrompt();
            BuildIncursionBanner();
            BuildToast();
            BuildInspector();

            backdrop = Element(root, "backdrop");
            backdrop.style.display = DisplayStyle.None;

            BuildStartScreen();

            Refresh();
        }

        void BuildMissionCard()
        {
            missionCard = Element(root, "tactical-card mission-card");

            var brandRow = Element(missionCard, "brand-row");
            var brandLeft = Element(brandRow, "brand-left");
            Icon(brandLeft, "icon_base", "brand-sprite-icon");
            var titlesCol = Element(brandLeft, "brand-titles-col");
            Label(titlesCol, "AFTERLIFE.", "brand-title");
            Label(titlesCol, "HOLD UNTIL DAWN", "brand-sub");

            Button(brandRow, "?", ShowMenu, true, "btn-help");

            var timeRow = Element(missionCard, "time-row");
            var timeDayRow = Element(timeRow, "row-center");
            Icon(timeDayRow, "icon_day", "time-sprite-icon");
            timeDay = Label(timeDayRow, "DAY 01 / 24", "time-day");
            timePhase = Label(timeRow, "DAYLIGHT 06:00", "time-phase");

            var timelineBar = Element(missionCard, "timeline-bar");
            timelineFill = Element(timelineBar, "timeline-fill");

            var clockBottom = Element(missionCard, "clock-bottom-row");
            timeCountdown = Label(clockBottom, "12h until nightfall", "time-countdown");

            var speedGroup = Element(clockBottom, "speed-group");
            pauseBtn = Button(speedGroup, "⏸", game.TogglePause, true, "btn-speed");
            speed1Btn = Button(speedGroup, "1×", () => game.SetSpeed(1), true, "btn-speed");
            speed2Btn = Button(speedGroup, "2×", () => game.SetSpeed(2), true, "btn-speed");
            speed4Btn = Button(speedGroup, "4×", () => game.SetSpeed(4), true, "btn-speed");
        }

        void BuildSuppliesCard()
        {
            suppliesCard = Element(root, "tactical-card supplies-card");

            var headerRow = Element(suppliesCard, "card-header-row");
            Label(headerRow, "SETTLEMENT SUPPLIES", "card-caption");
            Label(headerRow, "AUTOSAVE ON", "card-status-badge");

            var resGrid = Element(suppliesCard, "resource-grid");

            // Wood
            var woodCol = Element(resGrid, "resource-col");
            var woodRow = Element(woodCol, "resource-val-row");
            Icon(woodRow, "icon_wood", "resource-sprite");
            woodVal = Label(woodRow, "145", "resource-val");
            Label(woodCol, "WOOD", "resource-sub");
            woodRate = Label(woodCol, "+0.0/min", "resource-rate");

            // Metal
            var metalCol = Element(resGrid, "resource-col");
            var metalRow = Element(metalCol, "resource-val-row");
            Icon(metalRow, "icon_metal", "resource-sprite");
            metalVal = Label(metalRow, "75", "resource-val");
            Label(metalCol, "METAL", "resource-sub");
            metalRate = Label(metalCol, "+0.0/min", "resource-rate");

            // Food
            var foodCol = Element(resGrid, "resource-col");
            var foodRow = Element(foodCol, "resource-val-row");
            Icon(foodRow, "icon_food", "resource-sprite");
            foodVal = Label(foodRow, "90", "resource-val");
            Label(foodCol, "FOOD", "resource-sub");
            foodRate = Label(foodCol, "+0.0/min", "resource-rate");

            Element(suppliesCard, "supplies-divider");

            var integRow = Element(suppliesCard, "integrity-row");
            var integLeft = Element(integRow, "row-center");
            Icon(integLeft, "icon_integrity", "integrity-icon-sprite");
            Label(integLeft, "REFUGE INTEGRITY", "card-caption");
            integrityVal = Label(integRow, "100%", "integrity-val");

            var integTrack = Element(suppliesCard, "integrity-track");
            integrityFill = Element(integTrack, "integrity-fill");
        }

        void BuildRosterCard()
        {
            rosterCard = Element(root, "tactical-card roster-card");

            var header = Element(rosterCard, "roster-header-row");
            var headerLeft = Element(header, "roster-header-left");
            Label(headerLeft, "+ YOUR SURVIVORS", "roster-caption");
            rosterCount = Label(headerLeft, "4 / 6", "roster-count");

            rosterToggleBtn = Button(header, "−", ToggleRoster, true, "btn-help");

            rosterScroll = new ScrollView();
            rosterScroll.AddToClassList("roster-scroll");
            rosterCard.Add(rosterScroll);
            rosterList = rosterScroll.contentContainer;

            quickRecruitBtn = Button(rosterCard, "", ShowRecruitment, true, "btn-quick-recruit");
            var recruitRow = Element(quickRecruitBtn, "row");
            recruitRow.style.justifyContent = Justify.SpaceBetween;
            recruitRow.style.width = Length.Percent(100);
            Label(recruitRow, "+ Recruit survivor", "survivor-name");
            quickRecruitCost = Label(recruitRow, "18 food · 12 wood", "recruit-cost-label");

            var summaryRow = Element(rosterCard, "patrol-summary-row");
            patrolN = Label(summaryRow, "N 1", "patrol-summary-col");
            patrolE = Label(summaryRow, "E 1", "patrol-summary-col");
            patrolS = Label(summaryRow, "S 1", "patrol-summary-col");
            patrolW = Label(summaryRow, "W 1", "patrol-summary-col");
        }

        void ToggleRoster()
        {
            rosterCollapsed = !rosterCollapsed;
            rosterScroll.style.display = rosterCollapsed ? DisplayStyle.None : DisplayStyle.Flex;
            quickRecruitBtn.style.display = rosterCollapsed ? DisplayStyle.None : DisplayStyle.Flex;
            rosterToggleBtn.text = rosterCollapsed ? "+" : "−";
        }

        void BuildActionDock()
        {
            actionDock = Element(root, "action-dock-container");

            var telemRow = Element(actionDock, "telemetry-row");
            hostilesBadge = Label(telemRow, "PERIMETER QUIET", "telemetry-badge");
            killsBadge = Label(telemRow, "✝ 0 NEUTRALIZED", "telemetry-badge");
            journalBtn = Button(telemRow, "JOURNAL [ J ]", ShowJournal, true, "telemetry-badge");

            // Tactical Camera & Zoom Toolbar
            var zoomGroup = Element(telemRow, "zoom-group");
            zoomOutBtn = Button(zoomGroup, "−", () => game.World.ZoomCamera(-0.06f), true, "btn-zoom");
            zoomOutBtn.tooltip = "Zoom Out [ - / Scroll Down ]";
            zoomLevelBtn = Button(zoomGroup, "100%", FocusOrResetCamera, true, "btn-zoom-level");
            zoomLevelBtn.tooltip = "Reset Tactical Zoom [ Home ]";
            zoomInBtn = Button(zoomGroup, "+", () => game.World.ZoomCamera(0.06f), true, "btn-zoom");
            zoomInBtn.tooltip = "Zoom In [ + / Scroll Up ]";
            zoomResetBtn = Button(zoomGroup, "⌂", FocusOrResetCamera, true, "btn-zoom-reset");
            zoomResetBtn.tooltip = "Center Camera / Focus Selected [ F ]";

            var dockButtons = Element(actionDock, "dock-buttons-row");

            // Prominent BUILD action
            buildBtn = Button(dockButtons, "", ShowBuild, true, "btn-primary-action");
            Icon(buildBtn, "icon_build", "primary-action-sprite");
            Label(buildBtn, "BUILD  [ B ]", "primary-action-text");
            Icon(buildBtn, "badge_new", "primary-action-badge");

            crewBtn = CreateDockSquare(dockButtons, "icon_survivor", "👥", "CREW", () => ShowCrew());
            crewBtn.tooltip = "Survivor & Crew Management [ C ]";

            expedBtn = CreateDockSquare(dockButtons, "icon_expedition", "⛺", "EXPED", ShowExpeditions);
            landBtn = CreateDockSquare(dockButtons, "icon_map", "⛶", "LAND", game.ToggleExpansion);
            alarmBtn = CreateDockSquare(dockButtons, "icon_alarm", "🔔", "ALARM", () => game.Command(game.Frame.alarm ? "clearAlarm" : "raiseAlarm"));
            baseBtn = CreateDockSquare(dockButtons, "icon_base", "▦", "BASE", ShowStockpile);
            menuBtn = CreateDockSquare(dockButtons, "icon_menu", "⚙", "MENU", ShowMenu);
        }

        Button CreateDockSquare(VisualElement parent, string spriteName, string fallbackIcon, string label, Action action)
        {
            var btn = Button(parent, "", action, true, "btn-dock-square");
            var iconEl = Icon(btn, spriteName, "dock-icon-sprite");
            if (iconEl.style.backgroundImage.value.sprite == null)
            {
                Label(btn, fallbackIcon, "dock-icon");
            }
            Label(btn, label, "dock-label");
            return btn;
        }

        void FocusOrResetCamera()
        {
            if (game.World.Selected >= 0 && game.Frame != null)
            {
                var sel = game.Frame.entities.FirstOrDefault(e => e.id == game.World.Selected);
                if (sel != null) game.World.FocusOn(new Vector2(sel.x, sel.y));
                else game.World.ResetCamera();
            }
            else
            {
                game.World.ResetCamera();
            }
        }

        void BuildHelperPrompt()
        {
            hudHelper = Label(root, "[ CLICK TO INSPECT ]      [ SPACE TO PAUSE ]      [ WASD TO PAN ]      [ SCROLL / +/- TO ZOOM ]", "hud-helper-bar");
            hudHelper.pickingMode = PickingMode.Ignore;
        }

        void BuildIncursionBanner()
        {
            incursionBanner = Label(root, "", "incursion-alert-card");
            incursionBanner.pickingMode = PickingMode.Ignore;
            incursionBanner.style.display = DisplayStyle.None;
        }

        void BuildToast()
        {
            toast = Element(root, "toast");
            toast.pickingMode = PickingMode.Ignore;
            toast.style.display = DisplayStyle.None;
            toastTitle = Label(toast, "", "card-title");
            toastBody = Label(toast, "", "body");
        }

        void BuildInspector()
        {
            inspector = Element(root, "inspector");
            inspector.style.display = DisplayStyle.None;
        }

        static VisualElement Element(VisualElement parent, string classes)
        {
            var e = new VisualElement();
            foreach (string c in classes.Split(' ')) if (c.Length > 0) e.AddToClassList(c);
            parent.Add(e);
            return e;
        }

        static Label Label(VisualElement parent, string text, string classes = "body")
        {
            var e = new Label(text);
            foreach (string c in classes.Split(' ')) if (c.Length > 0) e.AddToClassList(c);
            parent.Add(e);
            return e;
        }

        static Button Button(VisualElement parent, string text, Action action, bool enabled = true, string classes = "")
        {
            Action wrapped = () => {
                try { AudioManager.Instance?.PlayClick(); } catch {}
                try { action?.Invoke(); } catch (Exception ex) { Debug.LogException(ex); }
            };
            var e = new Button(wrapped) { text = text };
            foreach (string c in classes.Split(' ')) if (c.Length > 0) e.AddToClassList(c);
            e.SetEnabled(enabled);
            parent.Add(e);
            return e;
        }

        static VisualElement Card(VisualElement parent, string title, string body)
        {
            var card = Element(parent, "card");
            Label(card, title, "card-title");
            if (!string.IsNullOrEmpty(body)) Label(card, body, "body");
            return card;
        }

        static readonly Dictionary<string, Sprite> uiSprites = new Dictionary<string, Sprite>();

        public static Sprite GetSprite(string name)
        {
            if (string.IsNullOrEmpty(name)) return null;
            if (uiSprites.TryGetValue(name, out var s) && s != null) return s;
            s = Resources.Load<Sprite>("UI/" + name);
            if (!s) s = Resources.Load<Sprite>("Buildings/" + name);
            if (s != null) uiSprites[name] = s;
            return s;
        }

        public static Sprite GetBuildingSprite(string type)
        {
            if (string.IsNullOrEmpty(type)) return null;
            string mapped = type;
            switch (type)
            {
                case "core": mapped = "town_hall"; break;
                case "farm": mapped = "farm"; break;
                case "dorm": mapped = "bunkhouse"; break;
                case "workshop": mapped = "workshop"; break;
                case "clinic": mapped = "clinic"; break;
                case "barracks": mapped = "barracks"; break;
                case "tower": mapped = "icon_tower"; break;
                case "barricade": mapped = "icon_barricade"; break;
                case "gate": mapped = "icon_gate"; break;
            }
            var spr = GetSprite(mapped);
            if (spr == null) spr = GetSprite("ghost_" + mapped + "_ok");
            if (spr == null) spr = GetSprite("ghost_" + type + "_ok");
            if (spr == null) spr = GetSprite("icon_" + mapped);
            if (spr == null) spr = GetSprite("icon_" + type);
            return spr;
        }

        static VisualElement Icon(VisualElement parent, string spriteName, string classes = "pixel-icon")
        {
            var e = Element(parent, classes);
            var spr = GetSprite(spriteName);
            if (spr != null) e.style.backgroundImage = new StyleBackground(spr);
            return e;
        }

        public bool OverUI()
        {
            if (ModalOpen) return true;
            if (root == null || root.panel == null) return false;
            Vector2 point = RuntimePanelUtils.ScreenToPanel(root.panel, new Vector2(Input.mousePosition.x, Screen.height - Input.mousePosition.y));
            var picked = root.panel.Pick(point);
            return picked != null && picked != root;
        }

        public void Refresh()
        {
            var f = game.Frame;
            var d = game.Data;
            if (f == null || d == null) return;

            // Mission & Time
            timeDay.text = "DAY " + f.day.ToString("00") + " / 24";
            int hourInt = (int)f.hour;
            int minuteInt = (int)(f.hour % 1f * 60f);
            timePhase.text = f.phase.ToUpperInvariant() + " " + hourInt.ToString("00") + ":" + minuteInt.ToString("00");

            float dayProgress = Mathf.Clamp01(f.hour / 24f);
            timelineFill.style.width = Length.Percent(dayProgress * 100f);

            string countdownText;
            if (f.hour >= 6f && f.hour < 18f) countdownText = Mathf.CeilToInt(18f - f.hour) + "h until nightfall";
            else if (f.hour >= 18f) countdownText = Mathf.CeilToInt(24f - f.hour + 6f) + "h until dawn";
            else countdownText = Mathf.CeilToInt(6f - f.hour) + "h until dawn";
            timeCountdown.text = countdownText;

            pauseBtn.text = game.Paused ? "▶" : "⏸";
            speed1Btn.EnableInClassList("speed-active", !game.Paused && game.Speed == 1);
            speed2Btn.EnableInClassList("speed-active", !game.Paused && game.Speed == 2);
            speed4Btn.EnableInClassList("speed-active", !game.Paused && game.Speed == 4);

            // Tactical Camera Zoom
            if (zoomLevelBtn != null && game.World != null)
            {
                int pct = Mathf.RoundToInt((WorldView.DefaultTacticalZoom / Mathf.Max(0.01f, game.World.CurrentZoom)) * 100f);
                zoomLevelBtn.text = pct + "%";
                if (zoomInBtn != null) zoomInBtn.SetEnabled(game.World.TargetZoom > WorldView.MinZoom + 0.005f);
                if (zoomOutBtn != null) zoomOutBtn.SetEnabled(game.World.TargetZoom < WorldView.MaxZoom - 0.005f);
            }

            // Supplies
            woodVal.text = Mathf.FloorToInt(f.wood).ToString();
            float wRate = d.rates != null ? d.rates.wood * 60f : 0f;
            woodRate.text = (wRate >= 0 ? "+" : "") + wRate.ToString("0.0") + "/min";
            woodRate.EnableInClassList("negative", wRate < 0);

            metalVal.text = Mathf.FloorToInt(f.metal).ToString();
            float mRate = d.rates != null ? d.rates.metal * 60f : 0f;
            metalRate.text = (mRate >= 0 ? "+" : "") + mRate.ToString("0.0") + "/min";
            metalRate.EnableInClassList("negative", mRate < 0);

            foodVal.text = Mathf.FloorToInt(f.food).ToString();
            float fdRate = d.rates != null ? d.rates.food * 60f : 0f;
            foodRate.text = (fdRate >= 0 ? "+" : "") + fdRate.ToString("0.0") + "/min";
            foodRate.EnableInClassList("negative", fdRate < 0);

            // Core Integrity & Roster
            EntityView core = null;
            int survivorTotal = 0;
            int n = 0, eCount = 0, s = 0, w = 0;
            if (f.entities != null)
            {
                for (int i = 0; i < f.entities.Length; i++)
                {
                    var ent = f.entities[i];
                    if (ent.kind == "building" && ent.type == "core")
                    {
                        core = ent;
                    }
                    else if (ent.kind == "survivor")
                    {
                        survivorTotal++;
                        string side = ent.side ?? "";
                        if (side == "north" || (side == "" && ent.id % 4 == 0)) n++;
                        else if (side == "east" || (side == "" && ent.id % 4 == 1)) eCount++;
                        else if (side == "south" || (side == "" && ent.id % 4 == 2)) s++;
                        else if (side == "west" || (side == "" && ent.id % 4 == 3)) w++;
                        else n++;
                    }
                }
            }

            float integrity = core != null && core.maxHP > 0 ? Mathf.Clamp01(core.hp / core.maxHP) : 1f;
            integrityVal.text = Mathf.RoundToInt(integrity * 100f) + "%";
            integrityFill.style.width = Length.Percent(integrity * 100f);
            integrityFill.style.backgroundColor = integrity < 0.35f
                ? new StyleColor(new Color(0.80f, 0.32f, 0.25f))
                : new StyleColor(new Color(0.78f, 0.82f, 0.62f));

            rosterCount.text = survivorTotal + " / " + f.capacity;
            quickRecruitCost.text = d.recruitCost;
            quickRecruitBtn.SetEnabled(d.freeBeds > 0 && !d.broadcasting);

            patrolN.text = "N " + n;
            patrolE.text = "E " + eCount;
            patrolS.text = "S " + s;
            patrolW.text = "W " + w;

            // Dynamic Survivor List
            var survivors = f.entities != null ? f.entities.Where(e => e.kind == "survivor").ToArray() : System.Array.Empty<EntityView>();
            string key = string.Join(",", survivors.Select(s2 => s2.id));
            if (key != rosterKey)
            {
                rosterKey = key;
                rosterList.Clear();
                survivorRows.Clear();
                survivorSubLabels.Clear();
                survivorBadges.Clear();
                survivorFocusButtons.Clear();

                foreach (var surv in survivors)
                {
                    int sid = surv.id;
                    var row = Element(rosterList, "survivor-item");
                    row.RegisterCallback<ClickEvent>(evt => {
                        if (evt.target is Button || (evt.target as VisualElement)?.GetFirstAncestorOfType<Button>() != null) return;
                        AudioManager.Instance?.PlayClick();
                        game.Select(sid);
                    });

                    // Mini avatar box
                    var av = Element(row, "avatar-box");
                    Color[] tints = { new Color(0.83f, 0.70f, 0.33f), new Color(0.83f, 0.48f, 0.33f), new Color(0.33f, 0.58f, 0.83f), new Color(0.60f, 0.41f, 0.76f) };
                    Color tint = tints[sid % 4];
                    av.style.borderTopColor = av.style.borderBottomColor = av.style.borderLeftColor = av.style.borderRightColor = new StyleColor(tint);
                    string pName = "portrait_" + (1 + (sid % 4));
                    var pSpr = GetSprite(pName);
                    if (pSpr != null)
                    {
                        var pImg = Element(av, "avatar-portrait");
                        pImg.style.backgroundImage = new StyleBackground(pSpr);
                    }
                    else
                    {
                        Label(av, surv.name.Length > 0 ? surv.name.Substring(0, 1) : "S", "avatar-text");
                    }

                    // Info
                    var info = Element(row, "survivor-info");
                    Label(info, surv.name, "survivor-name");
                    var sub = Label(info, "", "survivor-sub");
                    survivorSubLabels[sid] = sub;

                    // Focus Button (Crosshair ⌖)
                    var focusBtn = Button(row, "⌖", () => {
                        AudioManager.Instance?.PlayClick();
                        if (game.World.FollowTargetId == sid)
                        {
                            game.World.ClearFollow();
                        }
                        else
                        {
                            game.Select(sid);
                            game.World.Follow(sid);
                        }
                    }, true, "btn-survivor-focus");
                    focusBtn.tooltip = "Focus camera & follow survivor";
                    survivorFocusButtons[sid] = focusBtn;

                    // Assignment Badge button
                    var badge = Button(row, "", () => {
                        var cur = game.Frame?.entities.FirstOrDefault(x => x.id == sid);
                        string currentSide = cur?.side ?? "any";
                        string nextSide = currentSide == "north" ? "east" : currentSide == "east" ? "south" : currentSide == "south" ? "west" : currentSide == "west" ? "any" : "north";
                        game.Command("assign", sid, nextSide);
                    }, true, "survivor-badge");
                    survivorBadges[sid] = badge;

                    survivorRows[sid] = row;
                }
            }

            foreach (var surv in survivors)
            {
                if (survivorRows.TryGetValue(surv.id, out var row))
                {
                    row.EnableInClassList("selected", selected == surv.id);
                }

                if (survivorFocusButtons.TryGetValue(surv.id, out var fBtn))
                {
                    bool isFollowed = game.World.FollowTargetId == surv.id;
                    fBtn.EnableInClassList("focused", isFollowed);
                    fBtn.tooltip = isFollowed ? "Click to stop following survivor" : "Focus camera & follow survivor";
                }

                if (survivorSubLabels.TryGetValue(surv.id, out var sub))
                {
                    string status = surv.downed ? "DOWNED" : surv.task.Length > 0 ? surv.task : (surv.role.Length > 0 ? surv.role : surv.condition);
                    sub.text = "LVL " + surv.level + " · " + status;
                    if (surv.downed) sub.style.color = new StyleColor(new Color(0.88f, 0.35f, 0.28f));
                    else sub.style.color = new StyleColor(new Color(0.48f, 0.55f, 0.42f));
                }

                if (survivorBadges.TryGetValue(surv.id, out var badge))
                {
                    string badgeText = !string.IsNullOrEmpty(surv.side) && surv.side != "any" ? surv.side.ToUpperInvariant() : (!string.IsNullOrEmpty(surv.role) ? surv.role.ToUpperInvariant() : "PATROL");
                    badge.text = badgeText;
                }
            }

            // Action Dock Telemetry & Alarm
            alarmBtn.EnableInClassList("alarm-active", f.alarm);

            int hostileCount = f.entities != null ? f.entities.Count(e => e.kind == "zombie") : 0;
            if (f.incoming.Length > 0)
            {
                hostilesBadge.text = "⚠ " + f.incoming;
                hostilesBadge.EnableInClassList("alert", true);
                incursionBanner.text = "⚠ " + f.incoming;
                incursionBanner.style.display = DisplayStyle.Flex;

                if (string.IsNullOrEmpty(lastIncoming))
                {
                    AudioManager.Instance?.PlayAlarm();
                    AudioManager.Instance?.PlayZombieGroan();
                }
            }
            else
            {
                hostilesBadge.text = hostileCount > 0 ? "⚠ HOSTILES APPROACHING: " + hostileCount : "PERIMETER QUIET";
                hostilesBadge.EnableInClassList("alert", hostileCount > 0);
                incursionBanner.style.display = DisplayStyle.None;
            }
            lastIncoming = f.incoming;

            killsBadge.text = "✝ " + f.kills + " NEUTRALIZED";

            int warningCount = d.warnings?.Length ?? 0;
            journalBtn.text = warningCount > 0 ? "⚠ " + warningCount + " WARNINGS [ J ]" : "JOURNAL [ J ]";
            journalBtn.tooltip = warningCount > 0 ? string.Join("\n", d.warnings) : "Review recent settlement events";
            journalBtn.EnableInClassList("alert", warningCount > 0);

            // Drain Events
            foreach (var ev in d.events) Notify(ev.title, ev.message);
            d.events = Array.Empty<GameEvent>();

            // Live Inspector Updates
            if (inspectorHealth != null && selected >= 0)
            {
                var ent = f.entities != null ? f.entities.FirstOrDefault(e => e.id == selected) : null;
                if (ent == null) { ShowInspector(-1); return; }
                inspectorHealth.text = (ent.kind == "zombie" ? "THREAT INTEGRITY  " : "INTEGRITY  ") + Mathf.CeilToInt(ent.hp) + " / " + Mathf.CeilToInt(ent.maxHP);
                if (inspectorHealthBar != null)
                {
                    float hpRatio = Mathf.Clamp01(ent.hp / Mathf.Max(1f, ent.maxHP));
                    inspectorHealthBar.style.width = new StyleLength(new Length(hpRatio * 100f, LengthUnit.Percent));
                    inspectorHealthBar.EnableInClassList("low", hpRatio < 0.35f);
                }
                var details = game.Simulation.ReadDetails(selected);
                if (inspectorRepairBtn != null && details != null)
                {
                    inspectorRepairBtn.SetEnabled(details.repairEnabled);
                    inspectorRepairBtn.text = "Repair · " + details.repairCost;
                    inspectorRepairBtn.style.display = (!string.IsNullOrEmpty(details.repairCost) && ent.hp < ent.maxHP) ? DisplayStyle.Flex : DisplayStyle.None;
                }
                if (inspectorOutputMetric != null && details != null)
                {
                    inspectorOutputMetric.text = details.output ?? "";
                }
                if (details?.upgrades != null)
                {
                    foreach (var u in details.upgrades)
                    {
                        if (upgrades.TryGetValue(u.id, out var btn)) btn.SetEnabled(u.enabled);
                    }
                }
            }
        }

        void Update()
        {
            if (toast != null && Time.unscaledTime > toastUntil)
            {
                toast.style.display = DisplayStyle.None;
            }
        }

        public void Notify(string title, string message)
        {
            journal.Add(new GameEvent { title = "Day " + game.Frame.day + " · " + ((int)game.Frame.hour).ToString("00") + ":" + ((int)(game.Frame.hour % 1 * 60)).ToString("00") + " · " + title, message = message });
            if (journal.Count > 100) journal.RemoveAt(0);
            if (toast == null || toastTitle == null || toastBody == null) return;
            toastTitle.text = title;
            toastBody.text = message;
            toastUntil = Time.unscaledTime + 8f;
            toast.style.display = DisplayStyle.Flex;
        }

        public void SetHint(string text)
        {
            if (hudHelper == null) return;
            hudHelper.text = string.IsNullOrEmpty(text)
                ? "[ CLICK TO INSPECT ]      [ SPACE TO PAUSE ]      [ WASD TO PAN ]"
                : text;
        }

        ScrollView Open(string title)
        {
            IsCrewOpen = false;
            if (inspector != null) inspector.style.display = DisplayStyle.None;
            backdrop.Clear();
            backdrop.style.display = DisplayStyle.Flex;
            modal = Element(backdrop, "panel modal");
            var row = Element(modal, "row");
            Label(row, title, "heading");
            Element(row, "spacer");
            Button(row, "×", CloseModal, true, "close");
            modalScroll = new ScrollView();
            modalScroll.AddToClassList("modal-scroll");
            modal.Add(modalScroll);
            return modalScroll;
        }

        public void CloseModal()
        {
            IsCrewOpen = false;
            if (backdrop != null) backdrop.style.display = DisplayStyle.None;
            if (selected >= 0)
                ShowInspector(selected);
        }

        public void Confirm(string title, string message, Action action)
        {
            var panel = Open(title);
            Label(panel, message, "body");
            var row = Element(panel, "row");
            Button(row, "Confirm", () => { CloseModal(); action(); }, true, "primary");
            Button(row, "Cancel", CloseModal);
        }

        bool CanAffordBuilding(string costStr)
        {
            if (string.IsNullOrEmpty(costStr)) return true;
            if (game == null || game.Frame == null) return true;
            var parts = costStr.ToLowerInvariant().Split(new[] { '·', ',' }, StringSplitOptions.RemoveEmptyEntries);
            foreach (var part in parts)
            {
                var tokens = part.Trim().Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
                if (tokens.Length >= 2 && int.TryParse(tokens[0], out int amt))
                {
                    string res = tokens[1];
                    if (res.StartsWith("wood") && game.Frame.wood < amt) return false;
                    if (res.StartsWith("metal") && game.Frame.metal < amt) return false;
                    if (res.StartsWith("food") && game.Frame.food < amt) return false;
                }
            }
            return true;
        }

        static string GetBuildingCategory(string type)
        {
            switch (type)
            {
                case "barricade":
                case "gate":
                case "tower":
                case "shelter":
                    return "DEFENSE";
                case "dorm":
                case "barracks":
                    return "HOUSING";
                case "farm":
                case "workshop":
                case "lumber_mill":
                case "storage":
                case "lab":
                case "armory":
                case "clinic":
                    return "PRODUCTION";
                default:
                    return "OTHER";
            }
        }

        public void ShowBuild()
        {
            var panel = Open("CONSTRUCTION");

            var hintRow = Element(panel, "build-hint-bar");
            Label(hintRow, "Click to place  ·  [R] Rotate barricade & gate  ·  [Right-Click / Esc] Finish", "build-hint-text");

            var tabsRow = Element(panel, "build-tabs");
            string currentFilter = "ALL";

            var grid = Element(panel, "build-grid");

            var allCards = new List<(VisualElement card, string cat)>();

            Action updateFilter = () =>
            {
                foreach (var (card, cat) in allCards)
                {
                    card.style.display = (currentFilter == "ALL" || cat == currentFilter) ? DisplayStyle.Flex : DisplayStyle.None;
                }
            };

            var categories = new[] { "ALL", "DEFENSE", "HOUSING", "PRODUCTION" };
            var tabButtons = new List<Button>();

            if (game?.Catalog?.buildings != null)
            {
                foreach (var cat in categories)
                {
                    int count = cat == "ALL" ? game.Catalog.buildings.Length : game.Catalog.buildings.Count(b => GetBuildingCategory(b.id) == cat);
                    var btn = Button(tabsRow, $"{cat} ({count})", null, true, "build-tab-btn");
                    if (cat == currentFilter) btn.AddToClassList("active-tab");
                    string capturedCat = cat;
                    btn.clicked += () =>
                    {
                        currentFilter = capturedCat;
                        foreach (var b in tabButtons) b.RemoveFromClassList("active-tab");
                        btn.AddToClassList("active-tab");
                        updateFilter();
                    };
                    tabButtons.Add(btn);
                }

                foreach (var item in game.Catalog.buildings)
                {
                    string cat = GetBuildingCategory(item.id);
                    bool affordable = CanAffordBuilding(item.cost);

                    var card = Element(grid, "build-card-compact" + (affordable ? "" : " unaffordable"));
                    allCards.Add((card, cat));

                    var thumb = Element(card, "build-card-thumb");
                    var bldSpr = GetBuildingSprite(item.id);
                    if (bldSpr != null)
                    {
                        thumb.style.backgroundImage = new StyleBackground(bldSpr);
                    }

                    var info = Element(card, "build-card-info");
                    var titleRow = Element(info, "build-card-title-row");
                    Label(titleRow, item.name, "build-card-title");
                    Label(titleRow, cat, "build-card-badge");

                    Label(info, item.description, "build-card-desc");
                    Label(info, item.cost, "build-card-cost" + (affordable ? "" : " cannot-afford"));

                    string choice = item.id;
                    var buildBtn = Button(card, "Build", () => game.BeginBuilding(choice), true, "btn-build-action");
                    if (!affordable)
                    {
                        buildBtn.SetEnabled(false);
                    }
                }
            }
        }

        public void ShowInspector(int id)
        {
            selected = id;
            inspector.Clear();
            upgrades.Clear();
            inspectorRepairBtn = null;
            inspectorHealth = null;
            inspectorHealthBar = null;
            inspectorOutputMetric = null;

            var details = id >= 0 ? game.Simulation.ReadDetails(id) : null;
            if (details == null || string.IsNullOrEmpty(details.kind))
            {
                inspector.style.display = DisplayStyle.None;
                return;
            }

            inspector.style.display = DisplayStyle.Flex;

            if (details.kind == "building")
            {
                var headerRow = Element(inspector, "floating-header");
                var emblem = Element(headerRow, "building-emblem");
                Sprite bldSprite = GetBuildingSprite(details.type);
                if (bldSprite != null)
                {
                    var bldImg = Element(emblem, "building-sprite-preview");
                    bldImg.style.backgroundImage = new StyleBackground(bldSprite);
                }
                else
                {
                    var emblemLbl = Label(emblem, string.IsNullOrEmpty(details.icon) ? "⌂" : details.icon, "emblem-icon");
                    if (!string.IsNullOrEmpty(details.color) && ColorUtility.TryParseHtmlString(details.color, out var col))
                    {
                        emblemLbl.style.color = new StyleColor(col);
                        emblem.style.borderTopColor = new StyleColor(col);
                        emblem.style.borderRightColor = new StyleColor(col);
                        emblem.style.borderBottomColor = new StyleColor(col);
                        emblem.style.borderLeftColor = new StyleColor(col);
                    }
                }

                var titleBlock = Element(headerRow, "title-block");
                string tierText = !string.IsNullOrEmpty(details.tier) ? details.tier : "STRUCTURE";
                Label(titleBlock, tierText, "eyebrow");
                Label(titleBlock, details.name, "heading");

                if (details.demolish)
                {
                    var trashBtn = Button(headerRow, "", () => Confirm("Dismantle " + details.name, "Recover half the base materials (" + details.demolishRefund + "). Residents and staff will need new assignments.", () => { game.Command("demolish", id); game.Select(-1); }), true, "btn-trash");
                    Icon(trashBtn, "icon_demolish", "trash-icon-sprite");
                }
                Button(headerRow, "×", () => game.Select(-1), true, "close");

                var vitalsBox = Element(inspector, "vitals-box");
                var vitalRow = Element(vitalsBox, "vital-row");
                Icon(vitalRow, "icon_integrity", "vital-icon-sprite");
                Label(vitalRow, "HP", "vital-lbl");
                var vitalTrack = Element(vitalRow, "vital-track");
                inspectorHealthBar = Element(vitalTrack, "vital-fill");
                float hpRatio = Mathf.Clamp01(details.hp / Mathf.Max(1f, details.maxHP));
                inspectorHealthBar.style.width = new StyleLength(new Length(hpRatio * 100f, LengthUnit.Percent));
                inspectorHealthBar.EnableInClassList("low", hpRatio < 0.35f);

                inspectorHealth = Label(vitalRow, Mathf.CeilToInt(details.hp) + " / " + Mathf.CeilToInt(details.maxHP), "vital-val");

                inspectorRepairBtn = Button(vitalRow, "Repair · " + details.repairCost, () => { game.Command("repair", id); RefreshInspector(); }, details.repairEnabled, "btn-repair-inline");
                if (details.hp >= details.maxHP || string.IsNullOrEmpty(details.repairCost))
                {
                    inspectorRepairBtn.style.display = DisplayStyle.None;
                }

                var outputLine = Element(vitalsBox, "output-line");
                Label(outputLine, details.description, "output-sub");
                if (!string.IsNullOrEmpty(details.output))
                {
                    inspectorOutputMetric = Label(outputLine, details.output, "output-metric");
                }

                inspectorScroll = new ScrollView();
                inspectorScroll.AddToClassList("inspector-scroll");
                inspector.Add(inspectorScroll);
                var panel = inspectorScroll.contentContainer;

                bool hasStaffSlots = details.slots > 0;
                int ownedUpgrades = details.upgrades != null ? details.upgrades.Count(u => u.owned) : 0;
                int totalUpgrades = details.upgrades != null ? details.upgrades.Length : 0;

                if (hasStaffSlots)
                {
                    if (inspectorBuildingTab != "staff" && inspectorBuildingTab != "upgrades")
                        inspectorBuildingTab = "staff";

                    var tabs = Element(panel, "panel-tabs");
                    int staffCount = details.staff != null ? details.staff.Length : 0;
                    string roleTitle = !string.IsNullOrEmpty(details.roleName) ? details.roleName.ToUpperInvariant() : "STAFF";
                    Button(tabs, roleTitle + " (" + staffCount + "/" + details.slots + ")", () => { inspectorBuildingTab = "staff"; ShowInspector(id); }, true, "tab-btn" + (inspectorBuildingTab == "staff" ? " active" : ""));
                    Button(tabs, "Upgrades (" + ownedUpgrades + "/" + totalUpgrades + ")", () => { inspectorBuildingTab = "upgrades"; ShowInspector(id); }, true, "tab-btn" + (inspectorBuildingTab == "upgrades" ? " active" : ""));
                }
                else
                {
                    inspectorBuildingTab = "upgrades";
                    if (totalUpgrades > 0)
                    {
                        Label(panel, "Upgrades (" + ownedUpgrades + " / " + totalUpgrades + " Built)", "section");
                    }
                }

                if (inspectorBuildingTab == "staff" && hasStaffSlots)
                {
                    if (!string.IsNullOrEmpty(details.roleDescription))
                    {
                        Label(panel, details.roleDescription, "panel-note");
                    }
                    var staffList = Element(panel, "staff-list");
                    if (details.staff != null && details.staff.Length > 0)
                    {
                        foreach (var s in details.staff)
                        {
                            var row = Element(staffList, "staff-row");
                            string initial = !string.IsNullOrEmpty(s.name) ? s.name.Substring(0, 1).ToUpperInvariant() : "웃";
                            Label(row, initial, "staff-avatar");
                            var info = Element(row, "staff-info");
                            Label(info, s.name, "staff-name");
                            Label(info, s.description, "staff-desc");
                            int sid = s.id;
                            Button(row, "Release", () => { game.Command("post", sid, null); ShowInspector(id); }, true, "btn-release");
                        }
                    }

                    int openSlots = details.slots - (details.staff != null ? details.staff.Length : 0);
                    if (openSlots > 0)
                    {
                        string assignText = "+ Assign " + (!string.IsNullOrEmpty(details.roleName) ? details.roleName : "worker") + " (" + openSlots + " open)";
                        Button(panel, assignText, () => { candidatePickerOpen = !candidatePickerOpen; ShowInspector(id); }, true, "btn-slot-open" + (candidatePickerOpen ? " active" : ""));

                        if (candidatePickerOpen)
                        {
                            var drawer = Element(panel, "candidate-drawer");
                            if (details.assignable != null && details.assignable.Length > 0)
                            {
                                foreach (var cand in details.assignable)
                                {
                                    var row = Element(drawer, "staff-row");
                                    string cInit = !string.IsNullOrEmpty(cand.name) ? cand.name.Substring(0, 1).ToUpperInvariant() : "웃";
                                    Label(row, cInit, "staff-avatar");
                                    var cInfo = Element(row, "staff-info");
                                    Label(cInfo, cand.name, "staff-name");
                                    Label(cInfo, cand.description + " · LVL " + cand.level, "staff-desc");
                                    int cid = cand.id;
                                    Button(row, "Assign", () => {
                                        game.Command("post", cid, id);
                                        if (openSlots <= 1) candidatePickerOpen = false;
                                        ShowInspector(id);
                                    }, cand.enabled, "primary");
                                }
                            }
                            else
                            {
                                Label(drawer, "No unassigned survivors available.", "small");
                            }
                        }
                    }
                }
                else // "upgrades" tab or structures without staff
                {
                    if (details.upgrades != null && details.upgrades.Length > 0)
                    {
                        foreach (var u in details.upgrades)
                        {
                            string node = u.id;
                            bool isLocked = !u.owned && !string.IsNullOrEmpty(u.requires) && !details.upgrades.Any(p => p.id == u.requires && p.owned);
                            string cardClasses = "upgrade-node-card" + (u.owned ? " owned" : "") + (isLocked ? " locked" : "");
                            var card = Element(panel, cardClasses);

                            var titleRow = Element(card, "node-title-row");
                            var titleLeft = Element(titleRow, "row-center");
                            if (u.owned)
                            {
                                Icon(titleLeft, "badge_check", "badge-icon");
                            }
                            else if (isLocked)
                            {
                                Icon(titleLeft, "badge_lock", "badge-icon");
                            }
                            else
                            {
                                Icon(titleLeft, "badge_up", "badge-icon");
                            }
                            Label(titleLeft, u.name, "node-title");

                            if (u.owned)
                            {
                                Label(titleRow, "INSTALLED", "node-owned-tag");
                            }

                            Label(card, u.description, "node-desc");

                            if (!u.owned && !string.IsNullOrEmpty(u.parentName))
                            {
                                var reqRow = Element(card, "row-center");
                                Icon(reqRow, "badge_lock", "badge-icon-sm");
                                Label(reqRow, "Requires: " + u.parentName, "node-req");
                            }

                            if (!u.owned)
                            {
                                upgrades[u.id] = Button(card, "Upgrade · " + u.cost, () => {
                                    game.Command("upgradeBuilding", id, node);
                                    ShowInspector(id);
                                }, u.enabled, u.enabled ? "primary" : "");
                            }
                        }
                    }
                    else
                    {
                        Label(panel, "No upgrades available for this structure.", "small");
                    }
                }

                // Extras: Beds & Residents
                if (details.beds > 0)
                {
                    int resCount = details.residents != null ? details.residents.Length : 0;
                    var bedHeader = Element(panel, "section-header-row");
                    Icon(bedHeader, "icon_bed", "section-header-icon");
                    Label(bedHeader, "RESIDENTS (" + resCount + " / " + details.beds + " BEDS)", "section-header-text");
                    if (details.residents != null && details.residents.Length > 0)
                    {
                        Label(panel, string.Join(", ", details.residents), "panel-note");
                    }
                    else
                    {
                        Label(panel, "No residents assigned yet.", "small");
                    }
                }

                // Extras: Emergency Shelter
                if (details.shelter > 0)
                {
                    var shelterHeader = Element(panel, "section-header-row");
                    Icon(shelterHeader, "icon_warning", "section-header-icon");
                    Label(shelterHeader, "EMERGENCY SHELTER (ROOM FOR " + details.shelter + ")", "section-header-text");
                    if (details.isShelteringHere || (game.Data.sheltered && details.shelteredCount > 0))
                    {
                        var banner = Element(panel, "shelter-banner");
                        Label(banner, "⚠ " + details.shelteredCount + " survivors sheltering inside. Guards remain on duty.", "small");
                        Button(panel, "Sound All Clear · Release workers", () => {
                            game.Command("clearShelter");
                            ShowInspector(id);
                        }, true, "primary");
                    }
                    else
                    {
                        Button(panel, "Shelter workers here · " + details.shelter + " spaces", () => {
                            game.Command("orderShelter", id);
                            ShowInspector(id);
                        });
                    }
                }

                // Extras: Workshop Armory & Weapon Fabrication
                if (details.armory != null && details.armory.Length > 0)
                {
                    var armoryHeader = Element(panel, "section-header-row");
                    Icon(armoryHeader, "icon_damage", "section-header-icon");
                    Label(armoryHeader, "ARMORY FABRICATION", "section-header-text");
                    foreach (var w in details.armory)
                    {
                        var armRow = Element(panel, "armory-row");
                        var armInfo = Element(armRow, "armory-info");
                        Label(armInfo, w.name, "armory-name");
                        Label(armInfo, "Stock: " + w.count + " · Cost: " + w.cost, "armory-count");
                        string wid = w.id;
                        Button(armRow, "Fabricate", () => {
                            game.Command("fabricate", wid);
                            ShowInspector(id);
                        }, w.enabled, w.enabled ? "primary" : "");
                    }
                }
            }
            else if (details.kind == "survivor")
            {
                var headerRow = Element(inspector, "floating-header");
                var emblem = Element(headerRow, "building-emblem");
                string portraitName = "portrait_" + (1 + (details.id % 4));
                var pSpr = GetSprite(portraitName) ?? GetSprite("icon_survivor");
                if (pSpr != null)
                {
                    var pImg = Element(emblem, "avatar-portrait-lg");
                    pImg.style.backgroundImage = new StyleBackground(pSpr);
                }
                else
                {
                    Label(emblem, "웃", "emblem-icon");
                }
                var titleBlock = Element(headerRow, "title-block");
                Label(titleBlock, details.away ? "SURVIVOR · ON EXPEDITION" : "SURVIVOR · ACTIVE", "eyebrow");
                Label(titleBlock, details.name, "heading");
                var focusBtn = Button(headerRow, "⌖", () => {
                    AudioManager.Instance?.PlayClick();
                    if (game.World.FollowTargetId == details.id) game.World.ClearFollow();
                    else game.World.Follow(details.id);
                    ShowInspector(id);
                }, true, "btn-survivor-focus" + (game.World.FollowTargetId == details.id ? " focused" : ""));
                focusBtn.tooltip = game.World.FollowTargetId == details.id ? "Click to stop following survivor" : "Focus camera & follow survivor";
                Button(headerRow, "×", () => game.Select(-1), true, "close");

                var vitalsBox = Element(inspector, "vitals-box");
                var vitalRow = Element(vitalsBox, "vital-row");
                Icon(vitalRow, "icon_health", "vital-icon-sprite");
                Label(vitalRow, "HP", "vital-lbl");
                var vitalTrack = Element(vitalRow, "vital-track");
                inspectorHealthBar = Element(vitalTrack, "vital-fill");
                float hpRatio = Mathf.Clamp01(details.hp / Mathf.Max(1f, details.maxHP));
                inspectorHealthBar.style.width = new StyleLength(new Length(hpRatio * 100f, LengthUnit.Percent));
                inspectorHealthBar.EnableInClassList("low", hpRatio < 0.35f);

                inspectorHealth = Label(vitalRow, Mathf.CeilToInt(details.hp) + " / " + Mathf.CeilToInt(details.maxHP), "vital-val");

                var outputLine = Element(vitalsBox, "output-line");
                Label(outputLine, details.description, "output-sub");

                inspectorScroll = new ScrollView();
                inspectorScroll.AddToClassList("inspector-scroll");
                inspector.Add(inspectorScroll);
                var panel = inspectorScroll.contentContainer;

                Label(panel, "PATROL ASSIGNMENT", "section");
                var sides = Element(panel, "row");
                foreach (var side in new[] { "any", "north", "east", "south", "west" })
                {
                    string choice = side;
                    Button(sides, side.ToUpperInvariant(), () => game.Command("assign", id, choice), !details.away);
                }

                Label(panel, "JOBS & POSTS", "section");
                Button(panel, "Scavenger · prepare at HQ", () => game.Command("post", id, "scavenger"), !details.away);
                if (details.posts != null)
                {
                    foreach (var post in details.posts)
                    {
                        int bid = post.id;
                        Button(panel, post.name + "\n" + post.description, () => game.Command("post", id, bid), post.enabled && !details.away);
                    }
                }
                Button(panel, "Choose an expedition", ShowExpeditions, !details.away);
                Button(panel, "Open Full Crew Dossier [ C ]", () => ShowCrew(details.id, "roster"), true, "primary");
            }
            else // zombie
            {
                var headerRow = Element(inspector, "floating-header");
                var emblem = Element(headerRow, "building-emblem");
                var zSpr = GetSprite("icon_zombie");
                if (zSpr != null)
                {
                    var zImg = Element(emblem, "avatar-portrait-lg");
                    zImg.style.backgroundImage = new StyleBackground(zSpr);
                }
                else
                {
                    Label(emblem, "☠", "emblem-icon");
                }
                var titleBlock = Element(headerRow, "title-block");
                Label(titleBlock, "THE DEAD · HOSTILE", "eyebrow");
                Label(titleBlock, details.name, "heading");
                Button(headerRow, "×", () => game.Select(-1), true, "close");

                var vitalsBox = Element(inspector, "vitals-box");
                var vitalRow = Element(vitalsBox, "vital-row");
                Icon(vitalRow, "icon_health", "vital-icon-sprite");
                Label(vitalRow, "HP", "vital-lbl");
                var vitalTrack = Element(vitalRow, "vital-track");
                inspectorHealthBar = Element(vitalTrack, "vital-fill");
                float hpRatio = Mathf.Clamp01(details.hp / Mathf.Max(1f, details.maxHP));
                inspectorHealthBar.style.width = new StyleLength(new Length(hpRatio * 100f, LengthUnit.Percent));
                inspectorHealthBar.EnableInClassList("low", hpRatio < 0.35f);

                inspectorHealth = Label(vitalRow, Mathf.CeilToInt(details.hp) + " / " + Mathf.CeilToInt(details.maxHP), "vital-val");

                var outputLine = Element(vitalsBox, "output-line");
                Label(outputLine, details.description, "output-sub");

                inspectorScroll = new ScrollView();
                inspectorScroll.AddToClassList("inspector-scroll");
                inspector.Add(inspectorScroll);
                var panel = inspectorScroll.contentContainer;

                if (details.staff != null && details.staff.Length > 0)
                {
                    Label(panel, "ENGAGED SURVIVORS (" + details.staff.Length + ")", "section");
                    foreach (var person in details.staff)
                    {
                        Label(panel, "⚔ " + person.name + " · " + person.description, "body");
                    }
                    Button(panel, "Cancel attack order", () => game.Command("cancelAttack", id));
                }
                else
                {
                    Button(panel, "Attack with nearby survivors", () => game.Command("orderAttack", id), details.attackEnabled, "danger");
                }
            }

            Refresh();
        }

        public void RefreshInspector()
        {
            if (selected < 0) return;
            float scroll = inspectorScroll?.scrollOffset.y ?? 0;
            ShowInspector(selected);
            if (inspectorScroll != null) inspectorScroll.scrollOffset = new Vector2(0, scroll);
        }

        public void ShowCrew(int initialSurvivorId = -1, string targetTab = null)
        {
            IsCrewOpen = true;
            if (inspector != null) inspector.style.display = DisplayStyle.None;
            backdrop.Clear();
            backdrop.style.display = DisplayStyle.Flex;

            modal = Element(backdrop, "panel modal crew-modal");

            var survivors = game.Frame?.entities?.Where(e => e.kind == "survivor").ToArray() ?? Array.Empty<EntityView>();
            if (initialSurvivorId >= 0 && survivors.Any(s => s.id == initialSurvivorId))
            {
                selectedCrewSurvivorId = initialSurvivorId;
                expandedCrewSurvivors.Add(initialSurvivorId);
                currentCrewTab = targetTab == "dossier" || targetTab == null ? "roster" : targetTab;
            }
            else if (targetTab != null)
            {
                currentCrewTab = targetTab == "dossier" ? "roster" : targetTab;
            }

            if (selectedCrewSurvivorId < 0 && survivors.Length > 0)
            {
                selectedCrewSurvivorId = survivors[0].id;
            }

            // Window Header
            var headerRow = Element(modal, "crew-header-row");
            var headerLeft = Element(headerRow, "row-center");
            Icon(headerLeft, "icon_survivor", "crew-title-sprite");
            var titleBox = Element(headerLeft, "crew-title-box");
            Label(titleBox, "SURVIVOR & CREW MANAGEMENT", "heading");
            int downedCount = survivors.Count(s => s.downed);
            int injuredCount = survivors.Count(s => s.condition == "injured" && !s.downed);
            int awayCount = survivors.Count(s => s.away);
            string popText = $"{survivors.Length} / {game.Frame?.capacity ?? 0} SURVIVORS";
            if (downedCount > 0) popText += $"  ·  ⚠ {downedCount} DOWNED";
            if (injuredCount > 0) popText += $"  ·  ✚ {injuredCount} INJURED";
            if (awayCount > 0) popText += $"  ·  ⛺ {awayCount} ON EXPEDITION";
            Label(titleBox, popText, "eyebrow");

            Element(headerRow, "spacer");
            Button(headerRow, "×", CloseModal, true, "close");

            // Tab Bar: 2 Tabs: Roster & Shifts
            var tabBar = Element(modal, "crew-tab-bar");
            Button(tabBar, $"👥 ROSTER ({survivors.Length})", () => {
                currentCrewTab = "roster";
                ShowCrew(selectedCrewSurvivorId, "roster");
            }, true, currentCrewTab == "roster" ? "crew-tab-btn active" : "crew-tab-btn");

            Button(tabBar, "⏱ SHIFTS & DUTIES", () => {
                currentCrewTab = "shifts";
                ShowCrew(selectedCrewSurvivorId, "shifts");
            }, true, currentCrewTab == "shifts" ? "crew-tab-btn active" : "crew-tab-btn");

            // Content container
            modalScroll = new ScrollView();
            modalScroll.AddToClassList("modal-scroll crew-scroll");
            modal.Add(modalScroll);

            if (currentCrewTab == "shifts")
            {
                RenderCrewShiftsTab(modalScroll, survivors);
            }
            else
            {
                RenderCrewRosterTab(modalScroll, survivors);
            }
        }

        void RenderCrewRosterTab(ScrollView container, EntityView[] survivors)
        {
            var content = container.contentContainer;

            // Summary banner
            var summary = Element(content, "crew-summary-banner");
            var sumLeft = Element(summary, "row-center");
            Icon(sumLeft, "icon_base", "vital-icon-sprite");
            int armedCount = survivors.Count(s => !string.IsNullOrEmpty(s.gear) && s.gear != "fists");
            int restingCount = survivors.Count(s => s.task == "resting" || s.task == "to-bed");
            Label(sumLeft, $"COLONY ROSTER  ·  {game.Data.freeBeds} Free Beds  ·  {armedCount}/{survivors.Length} Armed  ·  {restingCount} Resting", "crew-summary-text");
            Button(summary, "+ RECRUIT SURVIVOR", ShowRecruitment, true, "primary");

            // Filter bar
            var filterBar = Element(content, "crew-filter-bar");
            Label(filterBar, "FILTER:", "eyebrow");
            var filters = new[]
            {
                ("all", $"ALL ({survivors.Length})"),
                ("guard", $"GUARDS & PATROL ({survivors.Count(s => s.role == "guard" || s.role == "sentry" || s.role == "patrol" || string.IsNullOrEmpty(s.role))})"),
                ("specialist", $"SPECIALISTS ({survivors.Count(s => s.role == "medic" || s.role == "engineer" || s.role == "farmer")})"),
                ("scavenger", $"SCAVENGERS ({survivors.Count(s => s.role == "scavenger")})"),
                ("casualty", $"CASUALTIES ({survivors.Count(s => s.condition == "injured" || s.downed)})")
            };

            foreach (var (key, label) in filters)
            {
                string fKey = key;
                var fBtn = Button(filterBar, label, () => {
                    rosterFilter = fKey;
                    ShowCrew(selectedCrewSurvivorId, "roster");
                }, true, rosterFilter == fKey ? "crew-filter-btn active" : "crew-filter-btn");
            }

            // Filtered list
            var filtered = survivors.Where(s => {
                if (rosterFilter == "guard") return s.role == "guard" || s.role == "sentry" || s.role == "patrol" || string.IsNullOrEmpty(s.role);
                if (rosterFilter == "specialist") return s.role == "medic" || s.role == "engineer" || s.role == "farmer";
                if (rosterFilter == "scavenger") return s.role == "scavenger";
                if (rosterFilter == "casualty") return s.condition == "injured" || s.downed;
                return true;
            }).ToArray();

            if (filtered.Length == 0)
            {
                Label(content, "No survivors match this filter.", "panel-note");
                return;
            }

            foreach (var surv in filtered)
            {
                int sid = surv.id;
                bool isExpanded = expandedCrewSurvivors.Contains(sid);

                var card = Element(content, "crew-card");
                string condClass = surv.downed ? "downed" : surv.condition == "injured" ? "injured" : surv.away ? "away" : "healthy";
                card.AddToClassList(condClass);
                if (isExpanded)
                {
                    card.AddToClassList("expanded");
                }

                // Card Header: clicking toggles expansion in-place
                var headerBox = Element(card, "crew-card-header");
                headerBox.RegisterCallback<ClickEvent>(evt => {
                    if (evt.target is Button) return;
                    AudioManager.Instance?.PlayClick();
                    selectedCrewSurvivorId = sid;
                    if (expandedCrewSurvivors.Contains(sid))
                        expandedCrewSurvivors.Remove(sid);
                    else
                        expandedCrewSurvivors.Add(sid);
                    ShowCrew(selectedCrewSurvivorId, "roster");
                });

                // Top row: Avatar, Name, Level, Role, Condition, Expand indicator
                var row1 = Element(headerBox, "crew-card-row");
                var left1 = Element(row1, "row-center");

                var av = Element(left1, "staff-avatar");
                string pName = "portrait_" + (1 + (sid % 4));
                var pSpr = GetSprite(pName);
                if (pSpr != null)
                {
                    var pImg = Element(av, "avatar-portrait");
                    pImg.style.backgroundImage = new StyleBackground(pSpr);
                }
                else
                {
                    Label(av, surv.name.Length > 0 ? surv.name.Substring(0, 1) : "S", "avatar-text");
                }

                Label(left1, surv.name, "staff-name");
                Label(left1, $"LVL {surv.level}", "eyebrow");

                string roleName = string.IsNullOrEmpty(surv.role) ? "PATROL" : surv.role.ToUpperInvariant();
                string roleIcon = surv.role == "medic" ? "✚ " : surv.role == "engineer" ? "⚒ " : surv.role == "farmer" ? "♧ " : surv.role == "guard" ? "⚔ " : surv.role == "sentry" ? "♜ " : surv.role == "scavenger" ? "➚ " : "◇ ";
                Label(left1, roleIcon + roleName, "crew-role-badge");

                var right1 = Element(row1, "row-center");
                var crewFocusBtn = Button(right1, "⌖", () => {
                    AudioManager.Instance?.PlayClick();
                    if (game.World.FollowTargetId == sid)
                    {
                        game.World.ClearFollow();
                    }
                    else
                    {
                        game.Select(sid);
                        game.World.Follow(sid);
                        CloseModal();
                    }
                }, true, "btn-survivor-focus" + (game.World.FollowTargetId == sid ? " focused" : ""));
                crewFocusBtn.tooltip = game.World.FollowTargetId == sid ? "Click to stop following survivor" : "Focus camera & follow survivor";

                string condText = surv.downed ? "DOWNED" : surv.condition == "injured" ? "INJURED" : surv.away ? "EXPEDITION" : "HEALTHY";
                Label(right1, condText, "crew-status-badge " + condClass);
                Label(right1, isExpanded ? "▲" : "▼", "crew-expand-indicator");

                // Middle row: Health Bar & Task
                var row2 = Element(headerBox, "crew-card-row");
                row2.style.marginTop = 4;
                row2.style.marginBottom = 4;

                var hpBox = Element(row2, "row-center");
                Icon(hpBox, "icon_health", "vital-icon-sprite");
                var hpTrack = Element(hpBox, "vital-track");
                hpTrack.style.width = 110;
                var hpFill = Element(hpTrack, "vital-fill");
                float hpRatio = Mathf.Clamp01(surv.hp / Mathf.Max(1f, surv.maxHP));
                hpFill.style.width = Length.Percent(hpRatio * 100f);
                hpFill.EnableInClassList("low", hpRatio < 0.35f);
                Label(hpBox, $"{Mathf.CeilToInt(surv.hp)}/{Mathf.CeilToInt(surv.maxHP)}", "vital-val");

                string taskDesc = surv.downed ? "Critically wounded! Needs rescue." : !string.IsNullOrEmpty(surv.task) ? surv.task : (surv.role == "sentry" ? "Watchtower sentry duty" : surv.role == "guard" ? "Perimeter defense" : "Active on duty");
                Label(row2, taskDesc, "output-sub");

                // Bottom row: Weapon, Sector, Expand / Collapse Toggle Button
                var row3 = Element(headerBox, "crew-card-row");
                row3.style.marginTop = 2;

                var loadoutBox = Element(row3, "row-center");
                Icon(loadoutBox, "icon_damage", "vital-icon-sprite");
                string weaponStr = !string.IsNullOrEmpty(surv.gear) ? surv.gear.ToUpperInvariant() : "FISTS";
                Label(loadoutBox, weaponStr, "eyebrow");

                string sectorStr = !string.IsNullOrEmpty(surv.side) && surv.side != "any" ? $"SECTOR: {surv.side.ToUpperInvariant()}" : "SECTOR: ALL SIDES";
                Label(loadoutBox, "  ·  " + sectorStr, "eyebrow");

                var toggleBtn = Button(row3, isExpanded ? "▲ COLLAPSE DOSSIER" : "▼ EXPAND DOSSIER", () => {
                    AudioManager.Instance?.PlayClick();
                    selectedCrewSurvivorId = sid;
                    if (expandedCrewSurvivors.Contains(sid))
                        expandedCrewSurvivors.Remove(sid);
                    else
                        expandedCrewSurvivors.Add(sid);
                    ShowCrew(selectedCrewSurvivorId, "roster");
                }, true, isExpanded ? "primary" : "crew-filter-btn");
                toggleBtn.style.marginLeft = toggleBtn.style.marginRight = toggleBtn.style.marginTop = toggleBtn.style.marginBottom = 0;

                // IF EXPANDED: Render full survivor dossier inside this card!
                if (isExpanded)
                {
                    var body = Element(card, "crew-card-expanded-body");
                    RenderExpandedSurvivorDossier(body, sid);
                }
            }
        }

        void RenderCrewShiftsTab(ScrollView container, EntityView[] survivors)
        {
            var content = container.contentContainer;
            float hour = game.Frame?.hour ?? 12f;
            int curShift = hour >= 6 && hour < 14 ? 0 : hour >= 14 && hour < 22 ? 1 : 2;
            string[] shiftNames = { "Day Shift (06:00 – 14:00)", "Evening Shift (14:00 – 22:00)", "Night Shift (22:00 – 06:00)" };

            // Current Shift Banner
            var clockBanner = Element(content, "crew-summary-banner");
            var clkLeft = Element(clockBanner, "row-center");
            Icon(clkLeft, "icon_time", "vital-icon-sprite");
            Label(clkLeft, $"COLONY CLOCK: Day {game.Frame?.day ?? 1} · {Mathf.FloorToInt(hour):D2}:00  ·  ACTIVE SHIFT: {shiftNames[curShift].ToUpperInvariant()}", "crew-summary-text");
            if (curShift == 2) Label(clockBanner, "⚠ NIGHT IN EFFECT: Deadliest swarm hours", "eyebrow");

            // SECTION 1: WATCHTOWER SENTRY SHIFTS
            Label(content, "WATCHTOWER SENTRY SHIFTS", "section");
            Label(content, "Watchtowers are kept across three 8-hour shifts. Sentries spot incursions early, alert guards, and gain +60% damage, +50 range, and 30% faster fire on the platform.", "panel-note");

            var towers = game.Frame?.entities?.Where(e => e.kind == "building" && e.type == "tower").ToArray() ?? Array.Empty<EntityView>();
            if (towers.Length == 0)
            {
                var noTowerCard = Card(content, "NO WATCHTOWERS CONSTRUCTED", "Construct a Watchtower [ B ] to assign sentries to 8-hour rotating shifts and watch over the perimeter.");
                Button(noTowerCard, "Open Construction [ B ]", ShowBuild, true, "primary");
            }
            else
            {
                foreach (var tower in towers)
                {
                    int tid = tower.id;
                    var box = Element(content, "shift-schedule-box");
                    var tHeader = Element(box, "row-center");
                    Icon(tHeader, "icon_alarm", "vital-icon-sprite");
                    Label(tHeader, $"♜ WATCHTOWER #{tid}  ·  LOCATION: ({tower.x:0}, {tower.y:0})", "card-title");

                    for (int sIdx = 0; sIdx < 3; sIdx++)
                    {
                        int shiftIndex = sIdx;
                        bool isCurrentShift = curShift == shiftIndex;
                        var sRow = Element(box, "shift-row");
                        if (isCurrentShift) sRow.AddToClassList("active-shift");

                        var sLeft = Element(sRow, "row-center");
                        Label(sLeft, shiftNames[shiftIndex], "shift-time-badge");
                        if (isCurrentShift)
                        {
                            Label(sLeft, "ON DUTY", "shift-duty-pill");
                        }

                        // Find sentry posted to this tower and shift
                        var sentry = survivors.FirstOrDefault(s => s.post == tid && s.shift == shiftIndex);
                        if (sentry != null)
                        {
                            int sid = sentry.id;
                            var sInfo = Element(sRow, "row-center");
                            sInfo.style.flexGrow = 1;
                            Label(sInfo, $"{sentry.name} (Lv.{sentry.level}) · {sentry.gear.ToUpperInvariant()} · {Mathf.CeilToInt(sentry.hp)}/{Mathf.CeilToInt(sentry.maxHP)} HP", "staff-name");

                            string dutyState = sentry.stationed ? "On Platform" : sentry.task == "to-tower" ? "En Route to Tower" : sentry.task == "resting" ? "Resting in Bunk" : sentry.task;
                            Label(sInfo, $" [{dutyState}]", "output-sub");

                            var sActions = Element(sRow, "row-center");
                            Button(sActions, "Dossier", () => {
                                selectedCrewSurvivorId = sid;
                                expandedCrewSurvivors.Add(sid);
                                expandedSurvivorSubTabs[sid] = "duties";
                                currentCrewTab = "roster";
                                ShowCrew(sid, "roster");
                            }, true, "crew-filter-btn");

                            Button(sActions, "Relieve", () => {
                                game.Command("post", sid, null);
                                ShowCrew(selectedCrewSurvivorId, "shifts");
                            }, true, "btn-release");
                        }
                        else
                        {
                            var vacantRow = Element(sRow, "row-center");
                            vacantRow.style.flexGrow = 1;
                            Label(vacantRow, "— VACANT SHIFT —", "eyebrow");

                            // Show eligible candidates to assign
                            var eligible = survivors.Where(s => !s.away && !s.downed && s.post != tid).Take(3).ToArray();
                            if (eligible.Length > 0)
                            {
                                foreach (var cand in eligible)
                                {
                                    int cid = cand.id;
                                    Button(vacantRow, $"+ Assign {cand.name}", () => {
                                        game.Command("assignShift", cid, tid, shiftIndex);
                                        ShowCrew(selectedCrewSurvivorId, "shifts");
                                    }, true, "crew-filter-btn");
                                }
                            }
                        }
                    }
                }
            }

            // SECTION 2: PERIMETER PATROL & GUARD SECTORS
            Label(content, "PERIMETER DEFENSE SECTORS", "section");
            Label(content, "Guards and Patrol survivors walk outside the wall and engage incoming hostiles. Assign coverage to vulnerable approaches.", "panel-note");

            var sides = new[] { "north", "east", "south", "west", "any" };
            foreach (var side in sides)
            {
                string sName = side.ToUpperInvariant();
                var sectorBox = Element(content, "sector-box");
                var assigned = survivors.Where(s => (s.role == "guard" || s.role == "patrol" || string.IsNullOrEmpty(s.role)) && (s.side == side || (side == "any" && s.side == "any"))).ToArray();

                var secLeft = Element(sectorBox, "row-center");
                secLeft.style.width = 160;
                Label(secLeft, $"{sName} SECTOR", "card-title");
                Label(secLeft, $"  ({assigned.Length} guards)", "eyebrow");

                var secStaff = Element(sectorBox, "row-center");
                secStaff.style.flexGrow = 1;
                if (assigned.Length == 0)
                {
                    Label(secStaff, "Unmanned · Higher risk of surprise incursion", "output-sub");
                }
                else
                {
                    foreach (var s in assigned)
                    {
                        int sid = s.id;
                        Button(secStaff, $"{s.name} (Lv.{s.level})", () => {
                            selectedCrewSurvivorId = sid;
                            expandedCrewSurvivors.Add(sid);
                            expandedSurvivorSubTabs[sid] = "duties";
                            currentCrewTab = "roster";
                            ShowCrew(sid, "roster");
                        }, true, "crew-filter-btn");
                    }
                }

                // Quick add to this sector
                var unassigned = survivors.FirstOrDefault(s => (s.role == "guard" || s.role == "patrol" || string.IsNullOrEmpty(s.role)) && s.side != side && !s.away);
                if (unassigned != null)
                {
                    int uid = unassigned.id;
                    Button(sectorBox, $"+ Move {unassigned.name}", () => {
                        game.Command("assign", uid, side);
                        ShowCrew(selectedCrewSurvivorId, "shifts");
                    }, true, "crew-filter-btn");
                }
            }

            // SECTION 3: WORKPLACE & FACILITY STAFFING
            Label(content, "FACILITY & WORKPLACE STAFFING", "section");
            Label(content, "Specialists posted to facilities heal the wounded, repair damage, and cultivate food supplies.", "panel-note");

            var facilities = new[]
            {
                ("clinic", "✚ CLINIC (MEDICS)", "Treats wounded survivors and rescues the downed. Intelligence speeds treatment."),
                ("workshop", "⚒ WORKSHOP (ENGINEERS)", "Rebuilds fence breaches and repairs buildings. Intelligence speeds work."),
                ("farm", "♧ FARM (FARMERS)", "Tends crops to feed the colony. Each farmer boosts food production rate."),
                ("barracks", "⚔ BARRACKS (GUARDS)", "Roves all sides of the wall and runs down incoming zombies. +30 HP, +25% DMG.")
            };

            foreach (var (bType, fTitle, fDesc) in facilities)
            {
                var buildingsOfType = game.Frame?.entities?.Where(e => e.kind == "building" && e.type == bType).ToArray() ?? Array.Empty<EntityView>();
                var fBox = Element(content, "shift-schedule-box");
                Label(fBox, fTitle, "card-title");
                Label(fBox, fDesc, "panel-note");

                if (buildingsOfType.Length == 0)
                {
                    Label(fBox, $"No {bType} constructed yet. Build one via Construction [ B ].", "output-sub");
                }
                else
                {
                    foreach (var b in buildingsOfType)
                    {
                        int bid = b.id;
                        var staff = survivors.Where(s => s.post == bid).ToArray();
                        var fRow = Element(fBox, "shift-row");
                        var fLeft = Element(fRow, "row-center");
                        Label(fLeft, $"#{bid} (Staff {staff.Length})", "shift-time-badge");

                        var fStaffList = Element(fRow, "row-center");
                        fStaffList.style.flexGrow = 1;
                        if (staff.Length == 0)
                        {
                            Label(fStaffList, "No workers posted.", "output-sub");
                        }
                        else
                        {
                            foreach (var worker in staff)
                            {
                                int wid = worker.id;
                                Button(fStaffList, $"{worker.name} (Lv.{worker.level})", () => {
                                    selectedCrewSurvivorId = wid;
                                    expandedCrewSurvivors.Add(wid);
                                    expandedSurvivorSubTabs[wid] = "duties";
                                    currentCrewTab = "roster";
                                    ShowCrew(wid, "roster");
                                }, true, "crew-filter-btn");

                                Button(fStaffList, "×", () => {
                                    game.Command("post", wid, null);
                                    ShowCrew(selectedCrewSurvivorId, "shifts");
                                }, true, "btn-trash");
                            }
                        }

                        int maxSlots = bType == "clinic" || bType == "workshop" || bType == "farm" ? 2 : 4;
                        if (staff.Length < maxSlots)
                        {
                            var cand = survivors.FirstOrDefault(s => s.post != bid && !s.away && !s.downed);
                            if (cand != null)
                            {
                                int cid = cand.id;
                                Button(fRow, $"+ Post {cand.name}", () => {
                                    game.Command("post", cid, bid);
                                    ShowCrew(selectedCrewSurvivorId, "shifts");
                                }, true, "primary");
                            }
                        }
                    }
                }
            }

            // Scavenger post
            var scavBox = Element(content, "shift-schedule-box");
            Label(scavBox, "➚ REFUGE HQ SCAVENGERS", "card-title");
            Label(scavBox, "Prepares supply runs at the core and first in line for expeditions.", "panel-note");
            var scavs = survivors.Where(s => s.role == "scavenger").ToArray();
            var scavRow = Element(scavBox, "row-center");
            if (scavs.Length == 0)
            {
                Label(scavRow, "No dedicated scavengers.", "output-sub");
            }
            else
            {
                foreach (var s in scavs)
                {
                    int sid = s.id;
                    Button(scavRow, $"{s.name} (Lv.{s.level})", () => {
                        selectedCrewSurvivorId = sid;
                        expandedCrewSurvivors.Add(sid);
                        expandedSurvivorSubTabs[sid] = "duties";
                        currentCrewTab = "roster";
                        ShowCrew(sid, "roster");
                    }, true, "crew-filter-btn");

                    Button(scavRow, "×", () => {
                        game.Command("post", sid, null);
                        ShowCrew(selectedCrewSurvivorId, "shifts");
                    }, true, "btn-trash");
                }
            }
            var nonScav = survivors.FirstOrDefault(s => s.role != "scavenger" && s.post < 0 && !s.away);
            if (nonScav != null)
            {
                int nid = nonScav.id;
                Button(scavBox, $"+ Make {nonScav.name} Scavenger", () => {
                    game.Command("post", nid, "scavenger");
                    ShowCrew(selectedCrewSurvivorId, "shifts");
                }, true, "crew-filter-btn");
            }
        }

        void RenderExpandedSurvivorDossier(VisualElement body, int sid)
        {
            var details = game.Simulation.ReadDetails(sid);
            if (details == null || details.kind != "survivor")
            {
                Label(body, "Could not load detailed survivor dossier telemetry.", "panel-note");
                return;
            }

            if (!expandedSurvivorSubTabs.TryGetValue(sid, out string activeTab))
            {
                activeTab = "stats";
                expandedSurvivorSubTabs[sid] = activeTab;
            }

            // SUB-TAB BAR: Tabs inside the expanded card to eliminate scrolling
            var subTabBar = Element(body, "crew-card-subtab-bar");

            Button(subTabBar, "📊 ATTRIBUTES & STATS", () => {
                AudioManager.Instance?.PlayClick();
                expandedSurvivorSubTabs[sid] = "stats";
                ShowCrew(selectedCrewSurvivorId, "roster");
            }, true, activeTab == "stats" ? "crew-card-subtab-btn active" : "crew-card-subtab-btn");

            Button(subTabBar, "⚔ DUTIES & LOADOUT", () => {
                AudioManager.Instance?.PlayClick();
                expandedSurvivorSubTabs[sid] = "duties";
                ShowCrew(selectedCrewSurvivorId, "roster");
            }, true, activeTab == "duties" ? "crew-card-subtab-btn active" : "crew-card-subtab-btn");

            string upgTabLabel = !string.IsNullOrEmpty(details.jobName) ? $"⚡ {details.jobName.ToUpperInvariant()} UPGRADES" : "⚡ JOB UPGRADES";
            Button(subTabBar, upgTabLabel, () => {
                AudioManager.Instance?.PlayClick();
                expandedSurvivorSubTabs[sid] = "upgrades";
                ShowCrew(selectedCrewSurvivorId, "roster");
            }, true, activeTab == "upgrades" ? "crew-card-subtab-btn active" : "crew-card-subtab-btn");

            var pane = Element(body, "crew-subtab-pane");

            if (activeTab == "stats")
            {
                // Vitals sub-row: Role description + XP progress
                var vitalsRow = Element(pane, "crew-card-row");
                vitalsRow.style.marginBottom = 6;
                vitalsRow.style.alignItems = Align.Center;

                var descBox = Element(vitalsRow, "row-center");
                descBox.style.flexGrow = 1;
                string jobDesc = !string.IsNullOrEmpty(details.roleDescription) ? details.roleDescription : $"{details.jobName} duty specialist";
                Label(descBox, jobDesc, "panel-note");

                var xpBox = Element(vitalsRow, "row-center");
                Icon(xpBox, "icon_expedition", "vital-icon-sprite");
                Label(xpBox, "XP", "vital-lbl");
                var xpTrack = Element(xpBox, "vital-track");
                xpTrack.style.width = 110;
                var xpFill = Element(xpTrack, "vital-fill");
                xpFill.style.backgroundColor = new StyleColor(new Color(0.38f, 0.65f, 0.85f));
                float xpRatio = Mathf.Clamp01(details.xp / Mathf.Max(1f, details.xpNeeded));
                xpFill.style.width = Length.Percent(xpRatio * 100f);
                Label(xpBox, $"{Mathf.FloorToInt(details.xp)}/{Mathf.FloorToInt(details.xpNeeded)}", "vital-val");

                if (details.condition == "downed")
                {
                    var bleedAlert = Element(pane, "crew-summary-banner bleedout-alert");
                    Label(bleedAlert, $"⚠ CRITICAL BLEEDOUT: {(details.bleed / 42f):0.1}h remaining until death! Requires immediate medical triage.", "danger");
                }

                Label(pane, "PERMANENT RPG ATTRIBUTES & APTITUDES", "card-title");
                Label(pane, "Aptitudes (★PRI, ▲SEC, ▼WEAK) bias seeded growth on level-up. Stats scale combat potency and facility output.", "panel-note");

                RenderStatRow(pane, "STR", "Strength", details.str, details.primaryStat == "str", details.secondaryStat == "str", details.weakStat == "str",
                    $"Melee Damage: +{((details.str - 4) * 7.5f):+0;-0;0}%, Carrying Loot");

                RenderStatRow(pane, "AGI", "Agility", details.agi, details.primaryStat == "agi", details.secondaryStat == "agi", details.weakStat == "agi",
                    $"Speed: +{((details.agi - 4) * 3.75f):+0;-0;0}%, Attack Cooldown: -{((details.agi - 4) * 3.75f):+0;-0;0}%");

                RenderStatRow(pane, "END", "Endurance", details.end, details.primaryStat == "end", details.secondaryStat == "end", details.weakStat == "end",
                    $"Health Bonus: +{((details.end - 4) * 9f):+0;-0;0} HP, Bleed-out: +{((details.end - 4) * 7.5f):+0;-0;0}%");

                RenderStatRow(pane, "INT", "Intelligence", details.intel, details.primaryStat == "int", details.secondaryStat == "int", details.weakStat == "int",
                    $"Medicine & Repairs: +{((details.intel - 4) * 10f):+0;-0;0}%, Farming Yield");

                RenderStatRow(pane, "CHA", "Charisma", details.cha, details.primaryStat == "cha", details.secondaryStat == "cha", details.weakStat == "cha",
                    $"Trading: +{((details.cha - 4) * 3f):+0;-0;0}%, Recruitment: +{((details.cha - 4) * 3f):+0;-0;0}%");
            }
            else if (activeTab == "duties")
            {
                Label(pane, "COMBAT LOADOUT & ASSIGNMENT", "card-title");

                // Weapon
                var wpnBox = Element(pane, "shift-row");
                var wpnLeft = Element(wpnBox, "row-center");
                Icon(wpnLeft, "icon_damage", "vital-icon-sprite");
                Label(wpnLeft, details.weaponName.ToUpperInvariant(), "staff-name");
                string wpnClass = details.weaponIsMelee ? "MELEE" : "FIREARM";
                Label(wpnLeft, $"  ·  {wpnClass}", "eyebrow");
                Label(wpnBox, $"DMG {details.weaponDamage:0.0}  ·  RNG {details.weaponRange:0}m  ·  CD {details.weaponCooldown:0.0}s", "output-sub");

                // Current Assignment
                var dutyBox = Element(pane, "shift-row");
                var dutyLeft = Element(dutyBox, "row-center");
                Icon(dutyLeft, "icon_base", "vital-icon-sprite");
                string postText = !string.IsNullOrEmpty(details.postName) ? details.postName : "Perimeter Patrol";
                string shiftText = !string.IsNullOrEmpty(details.shiftName) ? $" · {details.shiftName}" : "";
                Label(dutyLeft, $"{postText}{shiftText}", "staff-name");
                string sectorInfo = !string.IsNullOrEmpty(details.side) && details.side != "any" ? details.side.ToUpperInvariant() : "ALL SIDES";
                Label(dutyBox, $"Task: {(!string.IsNullOrEmpty(details.task) ? details.task : "On Duty")}  ·  Sector: {sectorInfo}", "output-sub");

                // Reassign Post / Role Actions
                Label(pane, "REASSIGN DUTIES & FACILITY POSTS", "section");
                var reassignRow = Element(pane, "row");
                reassignRow.style.flexWrap = Wrap.Wrap;

                if (details.posts != null)
                {
                    foreach (var p in details.posts)
                    {
                        int pid = p.id;
                        Button(reassignRow, p.name, () => {
                            game.Command("post", details.id, pid);
                            ShowCrew(details.id, "roster");
                        }, p.enabled && !details.away, "crew-filter-btn");
                    }
                }

                Button(reassignRow, "Scavenger at HQ", () => {
                    game.Command("post", details.id, "scavenger");
                    ShowCrew(details.id, "roster");
                }, details.role != "scavenger" && !details.away, "crew-filter-btn");

                Button(reassignRow, "Return to Patrol", () => {
                    game.Command("post", details.id, null);
                    ShowCrew(details.id, "roster");
                }, details.post >= 0 || details.role == "scavenger", "crew-filter-btn");

                // Patrol Sector Picker
                Label(pane, "PATROL SECTOR DEFENSE", "section");
                var sideRow = Element(pane, "row");
                foreach (var side in new[] { "north", "east", "south", "west", "any" })
                {
                    string sChoice = side;
                    bool isCur = details.side == side;
                    Button(sideRow, (isCur ? "• " : "") + side.ToUpperInvariant(), () => {
                        game.Command("assign", details.id, sChoice);
                        ShowCrew(details.id, "roster");
                    }, !details.away, isCur ? "primary" : "crew-filter-btn");
                }

                // Shelter Toggle
                var shelterRow = Element(pane, "row");
                shelterRow.style.marginTop = 6;
                Button(shelterRow, details.sheltered ? "Step Outside (Clear Shelter)" : "Order Shelter in Bunkhouse", () => {
                    game.Command("orderShelter", details.id);
                    ShowCrew(details.id, "roster");
                }, !details.away, "crew-filter-btn");
            }
            else // "upgrades"
            {
                Label(pane, $"{details.jobName.ToUpperInvariant()} UPGRADE TREE & FACILITY SYNERGY", "card-title");
                Label(pane, $"Upgrades researched at {details.jobName} facilities directly enhance this survivor's operational efficiency.", "panel-note");

                var upgradeGrid = Element(pane, "tree-node-grid");
                if (details.upgrades != null && details.upgrades.Length > 0)
                {
                    foreach (var up in details.upgrades)
                    {
                        var u = up;
                        var uCard = Element(upgradeGrid, "tree-node-card");
                        if (u.owned) uCard.AddToClassList("unlocked");
                        else if (u.enabled) uCard.AddToClassList("researchable");
                        else uCard.AddToClassList("locked");

                        var uTop = Element(uCard, "crew-card-row");
                        Label(uTop, u.name, "card-title");
                        if (u.owned)
                        {
                            Label(uTop, "✓ UNLOCKED", "crew-status-badge healthy");
                        }
                        else if (u.enabled)
                        {
                            Label(uTop, u.cost, "eyebrow");
                        }
                        else if (!string.IsNullOrEmpty(u.requires))
                        {
                            Label(uTop, $"REQ: {u.parentName}", "eyebrow");
                        }

                        Label(uCard, u.description, "output-sub");

                        if (!u.owned)
                        {
                            if (u.enabled && u.buildingId >= 0)
                            {
                                Button(uCard, $"Research Upgrade ({u.cost})", () => {
                                    game.Command("upgradeBuilding", u.buildingId, u.id);
                                    ShowCrew(details.id, "roster");
                                }, true, "primary");
                            }
                            else if (u.buildingId < 0)
                            {
                                Label(uCard, "Requires building to be constructed first.", "output-sub");
                            }
                        }
                    }
                }
                else
                {
                    Label(pane, "No job tech tree available for this role.", "output-sub");
                }
            }

            // Bottom collapse bar
            var bottomBar = Element(body, "row-center");
            bottomBar.style.justifyContent = Justify.Center;
            bottomBar.style.marginTop = 6;
            var collapseBottomBtn = Button(bottomBar, "▲ COLLAPSE DOSSIER", () => {
                AudioManager.Instance?.PlayClick();
                expandedCrewSurvivors.Remove(sid);
                ShowCrew(sid, "roster");
            }, true, "crew-filter-btn");
            collapseBottomBtn.style.paddingLeft = 16;
            collapseBottomBtn.style.paddingRight = 16;
        }

        void RenderStatRow(VisualElement parent, string code, string name, int val, bool isPrimary, bool isSecondary, bool isWeak, string benefit)
        {
            var row = Element(parent, "stat-row");
            var colName = Element(row, "row-center");
            colName.AddToClassList("stat-name-col");
            Label(colName, code, "stat-name-col");
            if (isPrimary) Label(colName, "★PRI", "stat-aptitude-badge primary");
            else if (isSecondary) Label(colName, "▲SEC", "stat-aptitude-badge secondary");
            else if (isWeak) Label(colName, "▼WEAK", "stat-aptitude-badge weak");

            var track = Element(row, "stat-bar-track");
            var fill = Element(track, "stat-bar-fill");
            float pct = Mathf.Clamp01(val / 10f);
            fill.style.width = Length.Percent(pct * 100f);
            if (isPrimary) fill.style.backgroundColor = new StyleColor(new Color(0.78f, 0.88f, 0.58f));
            else if (isWeak) fill.style.backgroundColor = new StyleColor(new Color(0.75f, 0.45f, 0.38f));

            Label(row, $"{val}/10", "stat-val-col");

            Label(parent, benefit, "stat-desc-sub");
        }

        public void ShowRecruitment()
        {
            var panel = Open("RADIO & RECRUITMENT");
            var d = game.Data;
            Label(panel, d.freeBeds + " free beds. Every new survivor needs a bed. Candidates retain their stats.", "body");
            Button(panel, d.broadcasting ? "Broadcasting · " + (d.recruitTimer / 42).ToString("0.0") + "h" : "Broadcast · " + d.recruitCost, () => { game.Command("recruit"); ShowRecruitment(); }, !d.broadcasting && d.freeBeds > 0, "primary");
            if (d.broadcasting) Label(panel, "Close this menu to let the broadcast progress.", "small");
            foreach (var c in d.candidates)
            {
                int id = c.id;
                var card = Element(panel, "card");
                var topRow = Element(card, "row");
                string pName = "portrait_" + (1 + (id % 4));
                var pSpr = GetSprite(pName);
                if (pSpr != null)
                {
                    var pImg = Element(topRow, "candidate-card-portrait");
                    pImg.style.backgroundImage = new StyleBackground(pSpr);
                }
                var info = Element(topRow, "staff-info");
                Label(info, c.name + " · " + c.label, "card-title");
                Label(info, c.stats + "\nWaiting for " + c.expires.ToString("0.0") + " game hours.", "body");
                var row = Element(card, "row");
                Button(row, "Welcome to the refuge", () => { game.Command("acceptCandidate", id); ShowRecruitment(); }, d.freeBeds > 0, "primary");
                Button(row, "Decline", () => { game.Command("declineCandidate", id); ShowRecruitment(); });
            }
            if (d.candidates.Length == 0) Label(panel, "Nobody is waiting at the gate. Broadcast or meet survivors on expeditions.", "body");
        }

        public void ShowStockpile()
        {
            var panel = Open("STOCKPILE & WORKSHOP");
            var d = game.Data;
            Label(panel, "Production per game day: " + (d.rates.wood * 1008).ToString("0") + " wood · " + (d.rates.metal * 1008).ToString("0") + " metal · " + (d.rates.food * 1008).ToString("+0;-0;0") + " food net.", "body");
            Label(panel, "Weapons are assigned automatically by job. Guards and sentries get first pick.", "small");
            foreach (var w in d.weapons)
            {
                string id = w.id;
                var card = Element(panel, "card");
                var topRow = Element(card, "row");
                Icon(topRow, "icon_damage", "vital-icon-sprite");
                var info = Element(topRow, "staff-info");
                Label(info, w.name + " · " + w.count + " owned", "card-title");
                Label(info, w.cost, "cost");
                Button(card, "Fabricate", () => { game.Command("fabricate", id); ShowStockpile(); }, w.enabled);
            }
            if (!string.IsNullOrEmpty(d.trader))
            {
                var card = Card(panel, "TRADER", d.trader);
                Button(card, "Accept trade", () => { game.Command("trade"); ShowStockpile(); }, d.tradeEnabled);
                Button(card, "Dismiss trader", () => { game.Command("dismissTrader"); ShowStockpile(); });
            }
            else Label(panel, "No trader in the refuge. Watch for arrivals while time advances.", "body");
        }

        public void ShowPoiExpedition(int poiId)
        {
            trip = "poi:" + poiId;
            party.Clear();
            ShowExpeditions();
        }

        public void ShowExpeditions()
        {
            var panel = Open("EXPEDITIONS");
            Label(panel, "Choose a destination and up to " + game.Data.partyCap + " survivors. Someone must stay behind. The refuge is paused while you plan.", "body");
            foreach (var e in game.Frame.entities.Where(e => e.kind == "survivor" && e.away))
            {
                Label(panel, e.name + " · " + e.task, "small");
            }
            var destinations = Element(panel, "row");
            foreach (var t in game.Catalog.expeditions)
            {
                string id = t.id;
                bool active = trip == id;
                Button(destinations, (active ? "• " : "") + t.name, () => { trip = id; party.Clear(); ShowExpeditions(); }, true, active ? "primary" : "");
            }
            if (game.Catalog.pois != null && game.Catalog.pois.Length > 0)
            {
                var poiDestinations = Element(panel, "row");
                foreach (var p in game.Catalog.pois)
                {
                    string id = p.id.ToString();
                    bool active = trip == id;
                    Button(poiDestinations, (active ? "• " : "") + p.name, () => { trip = id; party.Clear(); ShowExpeditions(); }, true, active ? "primary" : "");
                }
            }

            string tripName = "", tripDesc = "";
            var chosen = game.Catalog.expeditions.FirstOrDefault(e => e.id == trip);
            if (chosen != null)
            {
                tripName = chosen.name;
                tripDesc = chosen.description + "\n" + chosen.hours + " game hours · " + chosen.cost + " per member\nBase reward: " + chosen.reward;
            }
            else if (game.Catalog.pois != null)
            {
                var chosenPoi = game.Catalog.pois.FirstOrDefault(p => p.id.ToString() == trip);
                if (chosenPoi != null)
                {
                    tripName = chosenPoi.name;
                    tripDesc = (string.IsNullOrEmpty(chosenPoi.label) ? "Physical site expedition on the world map." : chosenPoi.label) + "\nPhysical site expedition on the world map.";
                }
            }
            if (string.IsNullOrEmpty(tripName) && game.Catalog.expeditions.Length > 0)
            {
                trip = game.Catalog.expeditions[0].id;
                var fb = game.Catalog.expeditions[0];
                tripName = fb.name;
                tripDesc = fb.description + "\n" + fb.hours + " game hours · " + fb.cost + " per member\nBase reward: " + fb.reward;
            }
            Card(panel, tripName, tripDesc);
            var info = game.Simulation.Party(party.ToArray(), trip);
            foreach (var s in info.members)
            {
                int id = s.id;
                bool selected = party.Contains(id);
                var btn = Button(panel, "", () => { if (!party.Remove(id)) party.Add(id); ShowExpeditions(); }, s.enabled || selected, selected ? "primary" : "");
                var btnRow = Element(btn, "row-center");
                if (selected)
                {
                    Icon(btnRow, "badge_check", "badge-icon");
                }
                else
                {
                    Icon(btnRow, "icon_survivor", "badge-icon");
                }
                Label(btnRow, s.name + " · " + s.description, "btn-text");
            }
            Label(panel, "Cost: " + info.cost + " · Risk per member: " + (info.risk * 100).ToString("0") + "%", "cost");
            Label(panel, info.reason ?? "", "body");
            Button(panel, "Send party", () => { if (game.Command("sendExpedition", party.ToArray(), trip)) { party.Clear(); CloseModal(); } }, string.IsNullOrEmpty(info.reason), "primary");
        }

        public void ClearJournal()
        {
            journal.Clear(); party.Clear(); lastIncoming = "";
            toast.style.display = DisplayStyle.None;
            SetHint("");
        }

        public void ShowJournal()
        {
            var panel = Open("SETTLEMENT JOURNAL");
            Label(panel, "CURRENT WARNINGS", "section");
            var warnings = game.Data.warnings ?? Array.Empty<string>();
            if (warnings.Length == 0) Label(panel, "No active warnings.", "body");
            foreach (string warning in warnings) Label(panel, "• " + warning, "body");
            Label(panel, "RECENT EVENTS", "section");
            Label(panel, "The latest 100 notifications from this session, newest first.", "small");
            if (journal.Count == 0) Label(panel, "No events recorded yet.", "body");
            for (int i = journal.Count - 1; i >= 0; i--) Card(panel, journal[i].title, journal[i].message);
        }

        public void ShowMenu()
        {
            var panel = Open("AFTERLIFE");
            Label(panel, "Survive 24 complete days. Each game hour lasts 42 seconds at 1×. Protect the HQ, grow food, recruit survivors and build a refuge that can withstand the night.", "body");
            Card(panel, "CONTROLS", "Click survivors or buildings to inspect.\nWASD / Arrows · pan camera    Scroll / +/- / HUD · zoom\nF · focus on selected / center    Home · reset view\nB · construction    E · expeditions    L · land    J · journal\nR · rotate wall/gate    Space · pause\n1 / 2 / 4 · speed    Escape / right click · cancel\nMenus and an unfocused window pause the simulation.");

            Button(panel, "Settlement journal · " + (game.Data.warnings?.Length ?? 0) + " warnings", ShowJournal);
            Button(panel, "Custom territory & seasons", ShowCustomGameSetup);
            Button(panel, "Pause on incursion: " + (game.PauseOnIncursion ? "ON" : "OFF"), () => { game.TogglePauseOnIncursion(); ShowMenu(); });
            bool soundOn = AudioManager.Instance == null || AudioManager.Instance.sfxEnabled;
            Button(panel, soundOn ? "Sound Effects: ENABLED" : "Sound Effects: MUTED", () => { AudioManager.Instance?.ToggleSound(); ShowMenu(); });
            Button(panel, "Save now", () => { if (game.Save()) Notify("Saved", "Progress is stored on this computer."); });
            Button(panel, "Copy save to clipboard", () => { GUIUtility.systemCopyBuffer = game.Simulation.Serialize(); Notify("Save copied", "Keep the JSON somewhere safe, or import it in the browser version."); });
            Button(panel, "Import save from clipboard", () => Confirm("Import save", "Replace this run with the Afterlife save JSON on your clipboard? The previous run is backed up.", () => { string error = game.ImportSave(GUIUtility.systemCopyBuffer); Notify(error.Length == 0 ? "Save imported" : "Import failed", error.Length == 0 ? "The game is paused. Resume when ready." : error); }));
            Button(panel, "Open save folder", () => Application.OpenURL("file://" + Application.persistentDataPath));
            Button(panel, "New refuge", () => Confirm("Start a new refuge", "Start over from Day 1? Your current run will be kept as the backup save.", game.NewRun), true, "danger");
            Button(panel, "Return to Title Screen", () => { CloseModal(); ShowStartScreen(); }, true, "primary");

            if (game.DebugToolsEnabled)
            {
            Label(panel, "ZOMBIE TESTING & COMBAT", "section");
            var dbgRow = Element(panel, "row");
            Button(dbgRow, "Spawn Zombie", () => { game.Command("spawnZombie", "walker", 0); CloseModal(); Notify("Spawned", "Walker spawned beyond the north gate."); });
            Button(dbgRow, "Trigger Swarm", () => { game.Command("triggerIncursion"); CloseModal(); Notify("Swarm Inbound", "Director triggered an incursion!"); });
            Button(dbgRow, "Kill All Dead", () => { game.Command("killAllZombies"); Notify("Cleared", "All active zombies eliminated."); });

            }

            Button(panel, "Third-party licenses", () => { var licenses = Open("THIRD-PARTY LICENSES"); Label(licenses, Resources.Load<TextAsset>("ThirdPartyNotices").text, "small"); });
            Button(panel, "Quit", () => { game.Save(); Application.Quit(); });
            Label(panel, "Native Unity presentation · original Afterlife simulation\nSaves: " + SaveStore.Pathname, "small");
        }

        public void ShowOutcome()
        {
            var panel = Open(game.Frame.status == "won" ? "TWENTY-FOUR DAYS. STILL HERE." : "THE REFUGE HAS FALLEN");
            Label(panel, game.Frame.status == "won" ? "Your people survived. The refuge held through all 24 days." : "The dead destroyed the HQ. Build, staff, and reinforce a new refuge to try again.", "body");
            Label(panel, "Day " + game.Frame.day + " · " + game.Frame.kills + " zombies defeated.", "heading");
            Button(panel, "Start a new refuge", () => Confirm("New refuge", "Begin a fresh run?", game.NewRun), true, "primary");
            Button(panel, "Return to Title Screen", () => { CloseModal(); ShowStartScreen(); });
            Button(panel, "Save & menu", ShowMenu);
        }

        void BuildStartScreen()
        {
            startScreen = Element(root, "start-screen");
            startScreen.style.display = DisplayStyle.None;
            startCanvas = Element(startScreen, "start-canvas");
            startCanvas.pickingMode = PickingMode.Position;

            var titleTex = Resources.Load<Texture2D>("Title/title_screen") ?? Resources.Load<Texture2D>("Title/title_bg");
            if (titleTex != null)
            {
                startCanvas.style.backgroundImage = new StyleBackground(titleTex);
            }

            startCaretBlank = Element(startCanvas, "start-caret-blank");
            startCaretBlank.pickingMode = PickingMode.Ignore;
            startCaretBlank.style.display = DisplayStyle.None;

            startCaret = Element(startCanvas, "start-caret");
            startCaret.pickingMode = PickingMode.Ignore;
            var caretTex = Resources.Load<Texture2D>("Title/caret");
            if (caretTex != null)
            {
                startCaret.style.backgroundImage = new StyleBackground(caretTex);
            }

            // Transparent hotspot buttons covering the 4 pre-created buttons in Title/title_screen.png
            startNewGameBtn = Button(startCanvas, "", StartNewGame, true, "start-title-btn start-btn-new-game");
            startNewGameBtn.RegisterCallback<MouseEnterEvent>(_ => SetStartMenuSelection(0));

            startContinueBtn = Button(startCanvas, "", ContinueGame, true, "start-title-btn start-btn-load-game");
            startContinueBtn.RegisterCallback<MouseEnterEvent>(_ => SetStartMenuSelection(1));

            startSettingsBtn = Button(startCanvas, "", ShowMenu, true, "start-title-btn start-btn-settings");
            startSettingsBtn.RegisterCallback<MouseEnterEvent>(_ => SetStartMenuSelection(2));

            startQuitBtn = Button(startCanvas, "", () => {
                game.Save();
                Application.Quit();
            }, true, "start-title-btn start-btn-quit");
            startQuitBtn.RegisterCallback<MouseEnterEvent>(_ => SetStartMenuSelection(3));

            startScreen.RegisterCallback<GeometryChangedEvent>(OnStartScreenGeometryChanged);
            BuildNewGameSetup();
            BuildWorldLoading();
            SetStartMenuSelection(0);
        }

        void BuildWorldLoading()
        {
            worldLoading = Element(startCanvas, "world-loading-overlay");
            worldLoading.style.display = DisplayStyle.None;
            var panel = Element(worldLoading, "world-loading-panel");
            Label(panel, "A NEW REFUGE", "world-loading-eyebrow");
            Label(panel, "THE WORLD IS WAKING", "world-loading-heading");
            Label(panel, "A fresh map is taking shape beyond the walls.", "world-loading-description");
            worldLoadingActivity = Label(panel, "Surveying the wilderness...", "world-loading-activity");
            var track = Element(panel, "world-loading-track");
            worldLoadingFill = Element(track, "world-loading-fill");
            worldLoadingPercent = Label(panel, "0%", "world-loading-percent");
        }

        public void BeginWorldLoading()
        {
            worldLoadingActive = true;
            setupStep = -1;
            newGameSetup.style.display = DisplayStyle.None;
            worldLoading.style.display = DisplayStyle.Flex;
            UpdateWorldLoading(0, "Surveying the wilderness...");
        }

        public void UpdateWorldLoading(float progress, string activity)
        {
            float amount = Mathf.Clamp01(progress);
            worldLoadingFill.style.width = Length.Percent(amount * 100f);
            worldLoadingPercent.text = Mathf.RoundToInt(amount * 100f) + "%";
            worldLoadingActivity.text = activity;
        }

        public void FinishWorldLoading(string size, string difficulty)
        {
            worldLoadingActive = false;
            worldLoading.style.display = DisplayStyle.None;
            HideStartScreen();
            Notify("New Refuge Established", size.ToUpperInvariant() + " world · " + difficulty.ToUpperInvariant() + " difficulty. Survive 24 days.");
        }

        public void FailWorldLoading(string message)
        {
            worldLoadingActive = false;
            worldLoading.style.display = DisplayStyle.None;
            ShowSetupStep(1);
            setupDescription.text = "World generation failed. " + message;
        }

        void BuildNewGameSetup()
        {
            newGameSetup = Element(startCanvas, "new-game-overlay");
            newGameSetup.style.display = DisplayStyle.None;
            var panel = Element(newGameSetup, "new-game-panel");
            Label(panel, "NEW GAME", "new-game-eyebrow");
            setupHeading = Label(panel, "SELECT DIFFICULTY", "new-game-heading");
            setupDescription = Label(panel, "Choose how fiercely the dead attack your refuge.", "new-game-description");
            var choices = Element(panel, "new-game-choices");
            setupChoices = new Button[4];
            for (int i = 0; i < 4; i++)
            {
                int choice = i;
                setupChoices[i] = Button(choices, "", () => ChooseSetupOption(choice), true, "new-game-choice");
                setupChoices[i].RegisterCallback<MouseEnterEvent>(_ => SetSetupSelection(choice));
            }
            var footer = Element(panel, "new-game-footer");
            setupBackButton = Button(footer, "BACK", BackFromNewGameSetup, true, "new-game-secondary");
            setupNextButton = Button(footer, "NEXT", AdvanceNewGameSetup, true, "new-game-primary");
        }

        void ShowSetupStep(int step)
        {
            setupStep = step;
            newGameSetup.style.display = DisplayStyle.Flex;
            setupHeading.text = step == 0 ? "SELECT DIFFICULTY" : "SELECT MAP SIZE";
            setupDescription.text = step == 0
                ? "Difficulty changes how often the dead arrive and the size of incursions."
                : "Each new world uses a random seed. Larger maps have more places to explore.";
            string[] names = step == 0 ? new[] { "EASY", "NORMAL", "HARD" } : new[] { "SMALL", "MEDIUM", "LARGE", "XL" };
            string[] details = step == 0 ? new[] { "Fewer raids", "Standard", "Big hordes" }
                : new[] { "96 × 72  ·  7 POIs", "160 × 112  ·  13 POIs", "240 × 176  ·  22 POIs", "320 × 224  ·  32+ POIs" };
            for (int i = 0; i < setupChoices.Length; i++)
            {
                var button = setupChoices[i];
                if (i >= names.Length)
                {
                    button.style.display = DisplayStyle.None;
                    continue;
                }
                button.style.display = DisplayStyle.Flex;
                button.Clear();
                button.RemoveFromClassList("difficulty-art");
                if (step == 0)
                {
                    button.AddToClassList("difficulty-art");
                    string[] textures = { "card_easy", "card_normal", "card_hard" };
                    var tex = Resources.Load<Texture2D>("Title/" + textures[i]);
                    if (tex != null) button.style.backgroundImage = new StyleBackground(tex);
                }
                else button.style.backgroundImage = StyleKeyword.None;
                Label(button, names[i], step == 0 ? "new-game-card-sr" : "new-game-map-name");
                if (step != 0) Label(button, details[i], "new-game-map-detail");
                button.tooltip = names[i] + " — " + details[i];
            }
            setupNextButton.text = step == 0 ? "NEXT  →" : "START GAME  →";
            setupIndex = step == 0 ? Array.IndexOf(new[] { "easy", "normal", "hard" }, selectedDifficulty) : selectedMapIndex;
            SetSetupSelection(setupIndex);
        }

        void SetSetupSelection(int index)
        {
            int max = (setupStep == 0 ? 3 : 4) - 1;
            setupIndex = Mathf.Clamp(index, 0, max);
            for (int i = 0; i < setupChoices.Length; i++)
                setupChoices[i].EnableInClassList("selected", i == setupIndex);
        }

        void ChooseSetupOption(int index)
        {
            SetSetupSelection(index);
            AdvanceNewGameSetup();
        }

        void AdvanceNewGameSetup()
        {
            if (worldLoadingActive) return;
            if (setupStep == 0)
            {
                selectedDifficulty = new[] { "easy", "normal", "hard" }[setupIndex];
                ShowSetupStep(1);
                return;
            }
            selectedMapIndex = setupIndex;
            string size = new[] { "small", "medium", "large", "xl" }[setupIndex];
            game.Save();
            BeginWorldLoading();
            game.StartNewRunWithLoading(size, selectedDifficulty);
        }

        public void BackFromNewGameSetup()
        {
            if (setupStep == 1) ShowSetupStep(0);
            else
            {
                setupStep = -1;
                newGameSetup.style.display = DisplayStyle.None;
                SetStartMenuSelection(0);
            }
        }

        void OnStartScreenGeometryChanged(GeometryChangedEvent evt)
        {
            if (evt == null || startCanvas == null) return;
            ApplyStartCanvasScale(evt.newRect.width, evt.newRect.height);
        }

        void UpdateStartScreenScale()
        {
            if (startScreen == null || startCanvas == null) return;
            ApplyStartCanvasScale(startScreen.resolvedStyle.width, startScreen.resolvedStyle.height);
        }

        void ApplyStartCanvasScale(float width, float height)
        {
            if (startCanvas == null || width <= 10f || height <= 10f) return;
            float scale = Mathf.Max(width / 960f, height / 540f);
            startCanvas.style.scale = new StyleScale(new Scale(new Vector2(scale, scale)));
        }

        public void SetStartMenuSelection(int index)
        {
            startMenuIndex = Mathf.Clamp(index, 0, 3);
            int[] caretTops = { 263, 299, 335, 371 };
            if (startCaret != null)
            {
                startCaret.style.top = caretTops[startMenuIndex];
            }
            if (startCaretBlank != null)
            {
                startCaretBlank.style.display = startMenuIndex == 0 ? DisplayStyle.None : DisplayStyle.Flex;
            }
        }

        public void SelectPreviousStartMenuItem()
        {
            if (IsNewGameSetupOpen) { SetSetupSelection((setupIndex + 2) % 3); return; }
            SetStartMenuSelection((startMenuIndex - 1 + 4) % 4);
        }

        public void SelectNextStartMenuItem()
        {
            if (IsNewGameSetupOpen) { SetSetupSelection((setupIndex + 1) % 3); return; }
            SetStartMenuSelection((startMenuIndex + 1) % 4);
        }

        public void ActivateCurrentStartMenuItem()
        {
            if (IsNewGameSetupOpen) { AdvanceNewGameSetup(); return; }
            switch (startMenuIndex)
            {
                case 0:
                    StartNewGame();
                    break;
                case 1:
                    ContinueGame();
                    break;
                case 2:
                    ShowMenu();
                    break;
                case 3:
                    game.Save();
                    Application.Quit();
                    break;
            }
        }

        public void ShowStartScreen()
        {
            worldLoadingActive = false;
            if (worldLoading != null) worldLoading.style.display = DisplayStyle.None;
            setupStep = -1;
            if (newGameSetup != null) newGameSetup.style.display = DisplayStyle.None;
            IsStartScreenOpen = true;
            game.Paused = true;
            if (missionCard != null) missionCard.style.display = DisplayStyle.None;
            if (suppliesCard != null) suppliesCard.style.display = DisplayStyle.None;
            if (rosterCard != null) rosterCard.style.display = DisplayStyle.None;
            if (actionDock != null) actionDock.style.display = DisplayStyle.None;
            if (hudHelper != null) hudHelper.style.display = DisplayStyle.None;
            if (incursionBanner != null) incursionBanner.style.display = DisplayStyle.None;
            if (inspector != null) inspector.style.display = DisplayStyle.None;
            if (backdrop != null) backdrop.style.display = DisplayStyle.None;
            if (startScreen != null)
            {
                startScreen.style.display = DisplayStyle.Flex;
                SetStartMenuSelection(0);
                UpdateStartScreenScale();
            }
        }

        public void HideStartScreen()
        {
            setupStep = -1;
            if (newGameSetup != null) newGameSetup.style.display = DisplayStyle.None;
            IsStartScreenOpen = false;
            if (startScreen != null) startScreen.style.display = DisplayStyle.None;
            if (missionCard != null) missionCard.style.display = DisplayStyle.Flex;
            if (suppliesCard != null) suppliesCard.style.display = DisplayStyle.Flex;
            if (rosterCard != null) rosterCard.style.display = DisplayStyle.Flex;
            if (actionDock != null) actionDock.style.display = DisplayStyle.Flex;
            if (hudHelper != null) hudHelper.style.display = DisplayStyle.Flex;
            game.Paused = false;
            game.Speed = 1;
        }

        public void StartNewGame()
        {
            selectedDifficulty = "normal";
            ShowSetupStep(0);
        }

        public void ContinueGame()
        {
            if (!SaveStore.HasSave)
            {
                StartNewGame();
                return;
            }
            HideStartScreen();
            Notify("Refuge Resumed", $"Day {game.Frame?.day ?? 1} · Stay vigilant.");
        }

        public void ShowCustomGameSetup()
        {
            var panel = Open("CUSTOM REFUGE SETUP");
            Label(panel, "Choose your starting territory, terrain generator, and starting season.", "body");

            Card(panel, "WORLD GENERATOR", "Generate an expansive procedural map with clustered POIs and wilderness decor, or load the classic Outpost territory.");

            var mapRow = Element(panel, "row");
            Button(mapRow, "Procedural World (Medium)", () => {
                CloseModal();
                HideStartScreen();
                game.NewRun();
                game.Simulation.GenerateWorld("medium", UnityEngine.Random.Range(1, 99999));
                game.RefreshTerrain();
                game.World.RebuildTerrain(game.Simulation.ReadTerrain());
                game.World.Present(game.Frame);
                Notify("Procedural World Generated", "Explore POIs and scavenge outside the refuge gates.");
            }, true, "primary");

            Button(mapRow, "Outpost Map (Survival Kit)", () => {
                CloseModal();
                HideStartScreen();
                game.NewRun();
                game.Simulation.LoadOutpostMap();
                game.RefreshTerrain();
                game.World.RebuildTerrain(game.Simulation.ReadTerrain());
                game.World.Present(game.Frame);
                Notify("Outpost Territory Loaded", "Defend the perimeter and manage your crew.");
            }, true, "primary");

            Button(mapRow, "Procedural World (Large)", () => {
                CloseModal();
                HideStartScreen();
                game.NewRun();
                game.Simulation.GenerateWorld("large", UnityEngine.Random.Range(1, 99999));
                game.RefreshTerrain();
                game.World.RebuildTerrain(game.Simulation.ReadTerrain());
                game.World.Present(game.Frame);
                Notify("Large World Generated", "A vast wilderness awaits.");
            }, true, "primary");

            Label(panel, "STARTING SEASON", "section");
            var seasonRow = Element(panel, "row");
            Button(seasonRow, "Spring (Days 1–6)", () => { game.Simulation.SetSeason("spring"); game.World.RebuildTerrain(game.Simulation.ReadTerrain()); Notify("Season Set", "Starting in Spring."); });
            Button(seasonRow, "Summer (Days 7–12)", () => { game.Simulation.SetSeason("summer"); game.World.RebuildTerrain(game.Simulation.ReadTerrain()); Notify("Season Set", "Starting in Summer."); });
            Button(seasonRow, "Fall (Days 13–18)", () => { game.Simulation.SetSeason("fall"); game.World.RebuildTerrain(game.Simulation.ReadTerrain()); Notify("Season Set", "Starting in Fall."); });
            Button(seasonRow, "Winter (Days 19–24)", () => { game.Simulation.SetSeason("winter"); game.World.RebuildTerrain(game.Simulation.ReadTerrain()); Notify("Season Set", "Starting in Winter."); });

            Button(panel, "Cancel / Return", () => {
                CloseModal();
                ShowStartScreen();
            });
        }
    }
}
