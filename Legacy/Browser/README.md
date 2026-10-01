# Afterlife

A full-window, top-down pixel art zombie survival game built from the Incremancer project. Hold a central refuge for **24 days**, with daytime preparation and stronger zombie attacks at night.

## Run locally

Serve this directory with any static HTTP server:

```sh
python3 -m http.server 8087 --bind 127.0.0.1
```

Open http://127.0.0.1:8087 in a browser. No build step or package installation is required. JavaScript modules require an HTTP server; opening `index.html` directly as a file is unsupported.

Module URLs are versioned through the import map in `index.html` (`?v=…`), so a browser never mixes cached and updated modules. When you change any module, or re-import `afterlife/ui-kit/`, bump that version (and the one on `main.mjs` and `style.css`).

## Play

- Click a survivor or their roster entry to pick their job or patrol side and see their stats.
- Open **EXPED** in the bottom-right toolbar (or press E) to manage expeditions: see who is away and when they return, choose a destination, and pick who goes. The refuge pauses while the menu is open.
- Click a building for its upgrade tree, production information, repairs, or dismantling.
- Farms produce food automatically. Survivors consume food and lose health if it runs out. Farms work at 40% output at night until upgraded to a greenhouse.
- Dormitories add four survivor spaces. Bunk beds and an annex increase capacity further. Recruit survivors using food and wood.
- Workshops produce wood and metal. The HQ also provides a small baseline income to allow recovery from losses.
- **The wall.** The perimeter fence is a real wall: nobody on the ground can see or shoot over it. Watchtowers are part of the wall, one either side of every gate and one at every outer corner (12 on the starting land). They move out with the fence when you buy land, and a broken one is rebuilt from the catalog by snapping it back into its slot. Only someone up on a tower sees both sides, and a tower's own gun only fires while someone is on it.
- Guards (patrols and barracks guards) go out through the gates and walk a lane around the outside of the wall, fighting the dead before they reach it. Survivors outside path around the lane and steer around trees rather than walk through the wall. The dead battering the wall or a building are heard by everyone, which dispatches guards to them. Wounded guards don't go out: they climb the nearest free tower and shoot from there, or wait inside a gate if every tower is taken. Workers inside only fight what gets through.
- Post survivors to buildings (from the survivor's panel or the building's) to give them a role. Everyone still fights anything in range; the role decides what they do between fights:
  - **Clinic → Medic** (2 posts): tends the most injured survivor. Clinic salves and ward upgrades make medics heal faster.
  - **Workshop → Engineer** (2 posts): rebuilds fence panels the dead tore down (for a barricade's usual 12 wood and 2 metal; panels you dismantle yourself stay open), then repairs the most damaged building or barricade, spending wood at the same rate as a manual repair. Power tools make engineers repair 50% faster.
  - **Barracks → Guard** (4 posts, 6 with Night watch): patrols all the way round outside the wall and runs down zombies within 260 units that they can see; under the alarm they climb the wall towers. +30 health and +25% damage. The barracks also adds 2 beds, and its upgrades improve guard damage, armor, speed and fire rate.
  - **Watchtower → Sentry** (1 post): climbs their wall tower for +60% damage, +50 range (plus the tower's range upgrades) and 30% faster fire. Zombies that reach anyone up on a tower damage the tower instead.
  - Choosing a patrol side returns a survivor to patrol duty: they walk their side's stretch of the outer lane there and back. If a building is destroyed or dismantled, its staff go back on patrol.
- Each 24-hour game day lasts 16 min 48 s of real time at 1× speed: 1 game hour = 42 s, 10 game minutes = 7 s. A full 24-day run is about 6 h 43 min and flows through five phases: **Dawn** (05–08), **Daylight** (08–17), **Dusk** (17–20), the **Midnight swarm** (20–01) and the **Dead of night** (01–05). The HUD day track is coloured by phase.
- Zombies spawn just beyond the visible window edges. Arrivals follow a smooth circadian curve: nearly quiet around 11:00, rising through dusk and peaking at 23:00. Walkers appear immediately, runners from Day 3 (more often at night), and brutes from Day 5. Threats increase throughout the run.
- A threat director paces attacks: **lull** (fewer arrivals) → **build-up** (tension rises with the hour) → **incursion** (a pack bursts in from one edge) → **respite** (no arrivals). Each incursion is announced by a red edge alert 5 seconds ahead, or 9 seconds if a sentry is stationed on a watchtower. At dusk the dead pick a prevailing side; most packs and many stragglers come from there, and some follow the roads. If the HQ drops below 35%, the director grants a respite, at most once every three game hours.
- Defend the HQ for 24 complete days to win. HQ destruction ends the run.

### Controls

| Control | Action |
| --- | --- |
| Click / tap | Select a survivor or building; place a construction (placement stays active for the next one) |
| B | Open construction catalog |
| E | Open expeditions |
| Space | Pause / resume |
| R | Rotate a barricade during placement |
| Escape / right click | Finish placing or close details |
| HUD 1× / 2× / 4× | Change simulation speed |

The game autosaves locally every five seconds and on leaving the page. Menus and hidden tabs pause the simulation. Saves belong to the browser and origin (hostname and port). Afterlife uses a separate save key from Incremancer.

### Survivors (V1)

- **Stats.** Every survivor has Strength, Agility, Endurance, Intelligence and Charisma on a 1–10 scale. Starting stats come from a deterministic generator (3d6 quality roll → a 17–30 point budget, three distinct hidden aptitudes, weighted allocation from a floor of 2 to a starting cap of 8). The same world seed, survivor id and spawn event always produce the same survivor, and stats are stored, so viewing, accepting or reloading never rerolls anyone. Each level grants one seeded, aptitude-weighted stat point, capped at 10.
- **What stats do.** Endurance sets health and bleed-out time; Agility sets speed, ranged damage and fire rate; Strength sets melee damage and how much an expedition carries home; Intelligence speeds treatment, repairs and farming; the settlement's best Charisma improves trades, cheapens radio broadcasts and brings more walk-ups.
- **Five jobs.** Guard (patrol a side outside the wall, hunt from the barracks, or man a wall tower), Medic (clinic), Engineer (workshop), Farmer (farm, 2 posts, raises output) and Scavenger (no building; prepares at the HQ and is listed first for expeditions). Everyone fights anything in range; jobs never limit weapons.
- **Recruitment and beds.** Candidates come from radio broadcasts (half a game hour), walk-ups during the day, and expedition encounters (the depot's rail mechanic is an authored encounter with stat overrides). Every resident needs a bed: HQ 2 (+2 with the radio antenna), each bunkhouse 4 (+2 bunks, +4 annex), barracks 2. Losing housing leaves people unhoused, never deleted.
- **Equipment.** A shared stockpile of pipes, pistols and rifles; each weapon is reserved by one survivor, guards (sentries first) get first pick, and nobody downgrades. Gear is released on death and when leaving on an expedition. Make weapons at a workshop. Unarmed survivors fight bare-handed.
- **Health.** Healthy → Injured (below 50%) → Downed (0 HP) → Dead. Resting only heals light wounds; injured survivors walk to a clinic with a medic on duty when it is safe. The downed bleed out in about three game hours (Endurance extends it) unless a medic — or, with no medic on duty, any healthy survivor, more slowly — stabilizes them. Death releases bed, gear and tasks.
- **Towers, alerts and the alarm.** A sentry on a standing tower sees 330 units out. Sightings of the same group merge into one alert with a last known position, and the nearest guards are dispatched (1 for a single zombie, 2 for up to 5, 3 for more). Workers who fight shout a short-range report. **ALARM** in the toolbar pulls all guards off routine patrols (barracks guards climb the wall towers); it clears after an hour of quiet.
- **Attack orders.** Click a zombie and press **Attack**: up to three of the nearest free survivors (guards first) pursue it and give up if it stays out of sight for a few seconds.
- **Shelter.** Select the HQ, a bunkhouse or the barracks to shelter everyone except guards. Capacity is enforced and anyone left out is named. Sheltered survivors can't be reached; the building can still fall.
- **Expeditions.** Parties are capped by population (1–5: 1 member, 6–10: 2, 11–20: 3, 21–35: 4, 36+: 5). Trips take 4–7 game hours and cost food per member; bigger parties bring back more and are safer, and each member rolls injury (and, rarely, death).
- **Tuning.** Every knob — generation, stat coefficients, XP, health thresholds, bleed-out, alert radius and timeout, dispatch counts, party table, food rate — is in `TUNING` in `afterlife/survivors.mjs`. In-world durations are in game hours.
- **Deferred / open.** Skill trees (the old survivor skill tree is removed; old saves are converted to stat points), personal loadouts, carrying animations, quests, crafting as engineer work, and daily food consumption (food still drains continuously; the overview shows daily demand).

## Source

- `afterlife/survivors.mjs`: survivor tuning data, weapons, and the seeded stat generator.
- `afterlife/model.mjs`: the `Game` coordinator (time, warnings and the fixed-timestep `step`). It re-exports the shared constants, so other code imports from here.
- `afterlife/data.mjs` and `afterlife/rules.mjs`: constants and data tables (buildings, upgrade trees, expeditions, roles, phases), plus pure rules such as building durability and survivor stats.
- Game subsystems, each a class whose methods are installed onto `Game`: `buildings.mjs` (construction, repairs, land, housing, shelter), `economy.mjs` (production, trader, weapons), `expeditions.mjs`, `recruitment.mjs`, `staff.mjs` (posts, roles, work, levelling), `navigation.mjs`, `health.mjs` (injury, rescue, clinic care), `combat.mjs` (spawning, threat director, alerts, alarm, attack orders) and `save.mjs`.
- Library wrappers, the only files that import from `afterlife/vendor/`: `spatial.mjs` (proximity queries), `pathing.mjs` (A* pathfinding) and `saveSchema.mjs` (the save format, one schema per `SAVE_VERSION`).
- `afterlife/view.mjs`: Pixi rendering of the tiled terrain, buildings, walls, characters and gunfire, plus lighting and selection.
- `afterlife/art.mjs` and `afterlife/hudSkin.mjs`: build the game's art from `afterlife/ui-kit/`, the pixel generators imported unchanged from the Claude Design project (tileset, buildings, survivor and zombie sheets, gunfire and molotov FX, HUD kit). `art.mjs` feeds the map; `hudSkin.mjs` skins the HUD.
- `afterlife/main.mjs`: HUD, floating menus, pointer and keyboard controls, persistence and game loop.
- `afterlife/style.css`: responsive full-window HUD and menus.
- `tests/game.test.mjs`: integration tests for the game systems.

The bundled Pixi library is reused; all Afterlife art is generated from `afterlife/ui-kit/`, and the original sprite sheets are only used by Incremancer. The original Incremancer entry page is retained as `incremancer.html`; its bundle, templates and assets remain available. The Afterlife entry page does not load the old third-party analytics or account integrations.

## Third-party libraries

Vendored as ES modules in `afterlife/vendor/`, with no build step and nothing loaded from the network at runtime. Each file's first line records its version and source. Licenses are listed in `afterlife/vendor/LICENSES.md`.

| Library | Version | Used for | Wrapper |
|---|---|---|---|
| [kdbush](https://github.com/mourner/kdbush) | 4.1.0 | Spatial index for "who is near this point" queries during each simulation step | `spatial.mjs` |
| [PathFinding.js](https://github.com/qiao/PathFinding.js) (+ [heap](https://github.com/qiao/heap.js)) | 0.4.18 (heap 0.2.5) | A* with diagonal moves over the navigation grid | `pathing.mjs` |
| [Valibot](https://valibot.dev) | 1.5.0 | Save-file validation | `saveSchema.mjs` |

To update one, download the new ESM file (for example from `https://cdn.jsdelivr.net/npm/<name>@<version>/…`), replace the vendored file and keep its header line, then run the tests. PathFinding.js hasn't had a release since 2016. If it ever needs replacing, only `pathing.mjs` has to change.

## Verify

Using Node.js 18 or newer:

```sh
node --test tests/game.test.mjs
```

The tests cover time progression, day phases, the circadian spawn curve, threat director pacing and incursion warnings, edge spawning, food and starvation, dorm capacity, construction validation, recruitment spawn clearance, upgrade prerequisites, patrol navigation, combat, wall towers and line of sight over the wall, guards patrolling outside, watchtower staffing, survivor roles (medics, engineers, guards, sentries), repairs, victory/defeat and save restoration.
