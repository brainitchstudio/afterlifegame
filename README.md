# Afterlife

Afterlife now runs as a **React + Python** web game. Double-click **Play Afterlife.command** (or run `python3 server.py`) and open <http://127.0.0.1:8087/>. The launcher rebuilds the frontend with npm when `web/` has changed. The Python server has no dependencies. It serves `dist/` and keeps your save in `save.json`, replacing it atomically and keeping the previous save as `save.json.bak`.

## Web version (React + Python)

The web build is a port of the Unity build. Nothing was dropped:

- **Simulation:** `web/src/engine/` is the simulation's source of truth (it started as the modules from `Assets/Afterlife/Simulation/`, which is no longer kept in step). The web host drives them through the same boundary Unity used (`unity.mjs`: `afCommand`, `afDetails`, `afHud`, `afPlacement`, `afParty`, ...), so every command and view matches.
- **Host** (`web/src/host/`): ports of `AfterlifeGame.cs`, `Simulation.cs`, `SaveStore.cs`, `WorldView.cs`, `SurvivalLighting.cs` + the GradedSprite shader, `AudioManager.cs` and `PlayerSmokeCheck.cs`. It runs a fixed 0.05 s step with bounded catch-up and autosaves every 5 s, on blur and on close. It pauses for menus and unfocused windows, can pause on incursions, and supports the Z/H debug keys.
- **World:** drawn with Pixi from Unity's baked atlas. It covers procedural map ground, seasons, decor, world buildings, POI badges, walking/burning sprites, watchtower overlays, flashlights at night, time-of-day grading with window glow, gunfire/blood/casing effects, health bars, target lines, selection brackets and placement ghosts. The camera has smooth cursor-directed zoom, panning, focus and follow.
- **HUD** (`web/src/hud/`): a port of `GameHud.cs` using Unity's class names. Its styles are generated from `Afterlife.uss` and it scales like the PanelSettings (1440 × 900). It includes:
  - the mission clock, supplies, roster and action dock, with its incursion banner, toasts and journal
  - the building, survivor and zombie inspectors
  - the overseer's tablet, which holds crew management, construction, recruitment, the stockpile and trader, and expeditions (including map POIs)
  - the menu (save, clipboard import/export, open save folder, quit) and the outcome screen
  - the title screen, new-game setup, world-loading progress and custom territory & seasons

- **Starter camp** (`web/src/engine/camp.mjs`, `harvest.mjs`; from the design kit's Starter Camp): you are the overseer, dropped into the region with three survivors around a campfire, three tents, a supply cache (30 wood, 40 metal, 90 food) and a wood pile. There are no walls, and nothing can be built until quests unlock it.
  - Click a tree to mark it for felling (click again to cancel). The nearest free patrol or logger walks out, chops it and carries the logs to the pile: pine 4 wood, oak 5, dead tree 2, more for strong survivors. A felled tree grows back after 60 game seconds (90 for a dead tree). Nobody fells trees at night or under the alarm.
  - The campfire is the camp's heart: the dead make for it, and the run ends if it goes out. An open camp can be left anywhere along its edge; once any fence is built it behaves like a walled refuge, and bought land comes with fence.
  - `new Game(random, { start: 'refuge' })` still starts the walled refuge (HQ, starting buildings and full fence), which scenario tests use. It has every structure and upgrade tier. Saves from before the camp load as refuges; camp saves from the workbench days load with a supply cache, with the quests picked up from what they had unlocked and built.
- **Progression** (`web/src/engine/progression.mjs`):
  - **Quests** unlock structures one at a time, in order, from Firewood (fell 3 trees, unlocks barricades) to Arsenal (build an armory). Each quest rewards supplies, and later quests wait for the settlement's status.
  - **Milestones** raise the settlement from Camp to Outpost, Settlement, Town and City. Each status needs survivors, buildings, kills and days, and brings a supply drop. Outpost unlocks the first upgrade of every structure (cross bracing, barbed wire, irrigation); Settlement unlocks the second tier (steel plating, spikes, greenhouses).
  - **Arrivals**: word of the base (0–100, from quests, status and buildings) brings survivors to the gate in daylight once the gate quest is done, more as it grows. The radio broadcast still works whenever you can pay for it. When someone is waiting and there is no free bed or too little food, a message says to build a bunkhouse or more farms.
  - **Messages** from Regional Command and the gate, and the overseer's **journal** (a day-by-day log plus quest and status entries), are kept in the save.
- **Overseer tablet** (`web/src/hud/Tablet.jsx`; Tab, the TABLET dock button, or click the supply cache): every menu is a screen on the tablet, grouped on its rail.
  - **Command**: quests, milestones, messages, and the journal with this session's event log.
  - **Settlement**: construction (pick a building to close the tablet and place it); the stockpile with the workshop and trader; and the crew (roster and dossiers, jobs and careers, shifts, and anyone at the gate with the radio).
  - **World**: the region map (click a site to plan an expedition, anywhere else to move the camera) and expeditions.
  - **System**: settings and the admin console.
  - The dock's BUILD, CREW, EXPED, BASE, ADMIN and MENU buttons and the B, C, E, J and ~ / F1 keys open their screens. A key switches screens while the tablet is open, and closes it when its screen is already showing. LAND and ALARM act on the map directly. The current orders also show under the mission clock.
  - The tablet is drawn with the design kit's parts. Its bezel and the quest, journal, message, milestone and tablet icons are generated in `Tools/ArtSource/ui-kit/pixel-ui.js` and exported like the other kit UI sprites; the supply cache is drawn in `web/src/host/campArt.js`.
- **World generation** (`web/src/engine/worldgen.mjs`): based on the design kit's World Generator, fitted to the game.
  - The starting base is the game's real 3 × 3-parcel territory: a grassy clearing with the camp's trodden ground around the campfire at its centre and two-tile footpaths out to the four gate roads, which run into a road network that reaches every point of interest.
  - The wall and outer patrol lane are kept clear, and ruins and towns stay out of the first parcel of expansion.
  - Distances use plain `sqrt`, so a seed gives the same map everywhere. `fingerprint(map)` hashes a map.
  - In the simulation, units steer around the visible generated trees (only trunks 30 units apart block movement), claimed parcels are cleared and turned to dirt, and only parcels on the map and free of ruins can be claimed.
  - Enter a seed on the map-size screen to replay or share a world; the current seed is shown in the menu.
- **Supplies card**: the design kit's pixel card (`Tools/ArtSource/ui-kit/pixel-supplies.js`) shows stock against storage capacity, income per game minute and fill bars, and folds to a strip (chevron). Storage capacity is a base stockpile plus each Storage Depot. The simulation does not cap stock; anything over capacity shows amber.
- **Content studio** (`backend/`, open <http://127.0.0.1:8087/dashboard/> while `server.py` runs): where the game's content is authored.
  - **Live content** drives the game: buildables (footprint, integrity, cost, look and upgrade trees), jobs and their posts (each post is tied to the buildable that hosts it, with its slots and any upgrades that add slots), quests, statuses (milestones), expeditions and weapons.
  - **Story and progression** are validated and exported but not simulated yet: chapters, characters and triggered messages; research trees; job and survivor perk trees.
  - The **campaign flow** plays the quest chain and status ladder forward and flags dead ends, such as a quest that needs a structure no earlier quest unlocks. Upgrade trees show each tier's status and whether any code acts on an upgrade (upgrade effects are written in the engine against their ids).
  - Edits are saved to `backend/data/*.json`, with the previous file kept in `backend/data/backups/`. Renaming an id updates everything that refers to it. **Publish to game** writes `web/src/engine/gameContent.mjs`, which `data.mjs`, `progression.mjs` and `survivors.mjs` read. Publishing is refused while there are errors. The shipped defaults are in `backend/seed/`.
- **Kit sprites**: `python3 Tools/export-kit-ui.py` serves `Tools/ArtSource/export-kit-ui.html`, which renders the kit's UI sprites (Silkscreen text needs a browser) into `Assets/Afterlife/Resources`. It verifies against shipped art first.

Open the game with `?debug` for the developer tools, or with `?smoke` to run the smoke check without touching the save.

```sh
cd web && npm install && npm run build       # build dist/
cd web && npm run dev                        # Vite dev server; run python3 server.py alongside for saves
node Tools/export-web-assets.mjs             # re-copy atlas, UI art and converted USS after changing Unity resources
node --test tests/game.test.mjs tests/unity-boundary.test.mjs tests/web-host.test.mjs tests/worldgen.test.mjs tests/content-framework.test.mjs
python3 -m unittest tests/test_content_backend.py
```

`tests/game.test.mjs`, `tests/worldgen.test.mjs` and `tests/unity-boundary.test.mjs` exercise `web/src/engine`. `tests/web-host.test.mjs` fails if the exported assets go stale. It also fails if the HUD issues a command outside the boundary allowlist, or if the server's save handling regresses. `tests/content-framework.test.mjs` and `tests/test_content_backend.py` cover the content studio. They fail if `gameContent.mjs` is out of date with `backend/data`.

## Unity project

The Unity 6 project remains in this folder for reference. Open it in **Unity 6000.6.3f1**, open `Assets/afterlifev1.unity`, and press **Play**.

## Open and build

1. In Unity Hub, choose **Add → Add project from disk**, then select this folder.
2. Open `Assets/afterlifev1.unity`. If regenerating project assets, use **Afterlife → Prepare Project**.
3. Press **Play** to start or continue your saved refuge.
4. Choose **Afterlife → Build → macOS** for `Builds/macOS/Afterlife.app`. Windows and Linux commands are included; install the corresponding platform support through Unity Hub first. Standard Unity Build Profiles work too; the Afterlife scene is in the build list.

The desktop builds use the Mono scripting backend. WebGL and IL2CPP are not validated targets for this project.

## What was converted

- **Native Unity presentation & camera:** interactive pan (WASD/arrows/middle-drag) and zoom (scroll wheel / +/- / HUD toolbar) orthographic camera with tactical compound framing, cursor-directed zoom, bounds clamping, depth-sorted SpriteRenderers, clean Hierarchy containers, original pixel-art atlas, walking characters, walls and gates, terrain, trees, placement previews, health bars, combat effects and day/night tint.
- **Dynamic procedural audio:** built-in retro chiptune synthesizer (zero external dependencies) providing authentic audio feedback for gunshots, zombie hits, building placement, repairs, medical healing, alarms, dawn/dusk chimes, and UI button clicks.
- **Native UI Toolkit:** resource HUD, survivor roster and inspector, building upgrades and staffing, recruitment, expeditions, weapon fabrication, trader, alarms, shelter, land purchases, repairs, pause and speed controls.
- **Original gameplay:** all existing simulation modules are retained, including survivor generation, health, jobs, shifts, navigation, economy, director pacing, construction, expeditions, recruitment, and save validation/migrations. They execute **inside Unity through the managed Jint interpreter**. This is a hybrid C#/JavaScript Unity project, not a line-by-line C# rewrite or a WebView wrapper.
- **Local desktop persistence:** autosaves every five seconds and on losing focus/quitting, with atomic replacement, a backup, and clipboard save import/export. Existing browser saves can be imported as JSON; browser local storage is not read automatically.

The original browser project and Incremancer assets are preserved intact in `Legacy/Browser/`. They are not included in Unity player builds. The browser's exact HTML/CSS layout and Pixi lighting have been replaced with Unity equivalents.

## Controls

| Control | Action |
| --- | --- |
| Click | Inspect a survivor/building/zombie, place construction, or claim highlighted land |
| WASD / Arrows / Middle Drag | Pan camera viewport |
| Scroll / + / - / HUD Buttons | Zoom camera in and out (cursor-directed) |
| F / Home / HUD ⌂ | Focus on selected entity or reset to tactical camera view |
| Tab | Overseer tablet: every menu, grouped as command, settlement, world and system |
| B / C / E / J / ~ | Tablet screens: construction / crew / expeditions / journal / admin |
| L | Land expansion |
| R | Rotate a wall or gate during placement |
| Space | Pause or resume |
| 1 / 2 / 4 | Simulation speed |
| Escape / right click | Close a menu or finish placement/selection |
| Menu | Save, audio toggle, import/export save, new run, or quit |

Hold the HQ for **24 complete days**. One game hour lasts 42 real seconds at 1×. Menus and an unfocused window pause the simulation. For detailed rules, see the original [game guide](Legacy/Browser/README.md); the source code is authoritative where older guide entries differ (for example, free-standing watchtowers and sentry shifts).

## Project layout

| Path | Purpose |
| --- | --- |
| `Assets/afterlifev1.unity` | Main playable scene and build entry |
| `Assets/Afterlife/Prefabs/Afterlife.prefab` | Game entry prefab |
| `Assets/Afterlife/Scripts/` | C# lifecycle, renderer, native UI, save store and simulation boundary |
| `Assets/Afterlife/Simulation/` | Canonical original game rules and vendored ES modules; edit these to change gameplay |
| `Assets/Afterlife/Resources/` | Baked sprite atlas, sprite manifest, UI stylesheet, panel settings and generated simulation bundle |
| `Assets/Afterlife/Editor/` | Project preparation, automatic bundling, validation and build commands |
| `Assets/Plugins/Jint/` | Pinned managed runtime assemblies and third-party notices |
| `Tools/ArtSource/` | Original procedural pixel-art generators and source design sheets |
| `Tools/` | Reproducible atlas/bundle exporters and check script |
| `tests/` | Original simulation regression suite and Unity-boundary tests |
| `Legacy/Browser/` | Preserved browser version, independent of the Unity player |

## Development and verification

Editing `.mjs` files under `Assets/Afterlife/Simulation` automatically rebuilds the packaged module bundle in the editor, and the bundle is also refreshed before builds. Restart Play mode after changing simulation code; an already running Jint instance keeps the version it loaded. Do not hand-edit `Resources/Simulation.json`.

Node.js is only needed for optional source tests or regenerating pixel art:

```sh
node --test tests/game.test.mjs tests/unity-boundary.test.mjs
node Tools/export-unity-assets.mjs
node Tools/bundle-simulation.mjs --check
node Tools/bundle-simulation.mjs # only when deliberately refreshing the bundle outside Unity
```

In Unity, use **Afterlife → Validate Embedded Simulation** for gameplay/save smoke checks, **Afterlife → Run Original Regression Suite in Unity** for the original 72 simulation tests, and **Afterlife → Run Watchtower Play Mode Test** for placement and rendering. These checks read the current bundle and fail when it is stale; they do not prepare or rewrite the project. `Tools/run-unity-checks.sh` runs Node tests, Unity validation, and the watchtower Play Mode test from the command line. Close the interactive Unity Editor before running it; Unity cannot open the same project in two processes. Set `UNITY_EDITOR` if your editor is elsewhere.

Runtime scripts have no CLR/file/network access. The C# host exposes an explicit gameplay command allowlist and serialized view state. Art is exported with point filtering and no texture compression. The live `World` hierarchy and UI document are generated by the scene's Afterlife prefab at runtime.

Third-party versions, licenses and package checksums are recorded in `Assets/Plugins/Jint/THIRD_PARTY_NOTICES.md`; original JavaScript dependencies retain their notices under `Assets/Afterlife/Simulation/vendor/`.

## Unity quality-of-life improvements

- **Full Survivor & Crew Management System (`C` or HUD Dock):** A dedicated military-grade management center featuring:
  - **Colony Roster Tab:** Full survivor list with role filter pills (`Guards`, `Specialists`, `Scavengers`, `Casualties`), health condition badges, weapons, and level progression.
  - **Shifts & Duties Scheduler:** 24-hour colony clock synchronization, rotating 8-hour watchtower sentry shifts (Day, Evening, Night) with active shift status and instant assignment/relief, perimeter defense coverage matrix (North, East, South, West, All Sides), and colony facility staffing (Clinic, Workshop, Farm, Barracks, Scavenger Pool).
  - **Survivor Dossier View:** Deep RPG profile for every survivor displaying seed-generated core attributes (`STR`, `AGI`, `END`, `INT`, `CHA`) with primary/secondary/weak aptitude indicators and combat/work formulas, weapon loadout ratings, duty assignments, and an interactive **Job Upgrade Synergy Tree** allowing facility tech upgrades (e.g. Clinic herbal salves, Workshop power tools, Barracks drills) to be researched directly from the dossier. Fast survivor cycling via `◄ Prev` and `Next ►` controls.
- **Settlement Journal (`J` or warning badge):** Shows active warnings and the latest 100 notifications from the current session. Opening it pauses the simulation.
- **Tactical Camera Controls:** Close-up tactical fort zoom with smooth cursor-directed mouse wheel zooming, HUD zoom controls, and focus centering (`F`).
- **Preferences & Persistence:** Menu includes an optional **Pause on incursion** setting; sound and incursion preferences persist across launches. Debug zombie controls are available only in the editor and development builds.

Editing scripts during Play mode saves the current run and stops Play mode before recompilation because the embedded simulation cannot survive a Unity assembly reload. Press Play again to continue. The standalone smoke harness (`--afterlife-smoke`) uses a fresh simulation without loading or writing player saves.
