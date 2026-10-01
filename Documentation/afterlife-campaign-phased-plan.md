# AfterLife Campaign — Phased Build Plan (rev 2, for review)

- **Source:** `~/Desktop/afterlife_campaign_implementation_plan.md`, which covers campaign Phases 0–2 and Appendices A and B.
- **Scope:** the browser build only (`web/`, `backend/data/`, `tests/`). Nothing in Unity.
- **Naming:** the build steps are called **Milestones M0–M10** so they don't clash with the campaign's own Phase 0/1/2.

---

## 1. Decisions (locked)

| # | Decision | What it means in the build |
|---|---|---|
| D1 | **Merge the existing `web/src/engine/campaign/` module into the game, overwriting it where needed.** | `Game` becomes the only engine. Its subsystems (`economy`, `survivors`, `staff`, `health`, `combat`, `harvest`, `progression`, `expeditions`, `recruitment`) take over the campaign logic. The module's data tables, Appendix A/B copy, task definitions and formulas get moved, rewritten or replaced as each milestone needs them. The standalone `CampaignEngine`, `CampaignLedger`, `CampaignSurvivor` and similar classes are deleted once their logic lives in `Game`. By M10 nothing in `campaign/` is a parallel source of truth. |
| D2 | **Keep the current map sizes. Scavenging and expedition sites are real places on the map generated at game start.** | See §2. Teams walk out of camp to an actual generated POI and come back. Spec distances become *bands relative to the generated map* rather than absolute tile counts. |
| D3 | **New Game starts the campaign.** | The legacy 3-survivor `camp` start and the `refuge` scenario stay only for tests and the admin console. |
| D4 | **Rename `metal` to `scrap_metal` everywhere and add the new resources.** | Save schema goes to v4, with a migration from v3. |
| D5 | **Write any missing copy myself, in the document's satirical corporate tone.** | Every string goes in `backend/data/campaign/strings.json` with `source: "spec"` or `source: "generated"`. You can filter for the lines I wrote and review or replace them in the content studio. The voices come from the existing copy: CentroCom is chipper, legalistic and quietly alarming, e.g. *"staring at crops is not classified as agricultural labor"*. Mara is dry, private and practical. |
| — | **Day length = 1008 s** (42 s per game hour). | The "720 s" line in the source doc is ignored. |
| — | **Blueprint placement** checks only the footprint, slope ≤ 10° and staying off the migration corridor. | The 32×32 area rule applies only to the landing-site audit. |
| — | **Cost letters**: see the table below. | |

### Cost-letter key (inferred from the document)

| Letter | Resource | Evidence |
|---|---|---|
| W | wood | Used alongside "Wood" throughout. |
| S | scrap_metal | Phase 1 W/S pairs. The emergency delivery lists "80 W, 50 S". |
| C | **cloth** | Aid Station 6 C, Makeshift Shelter 8 C, Barracks 12 C and Reinforced Shelter 12 C are all fabric-heavy builds. Cloth is a starting resource (20) and is guaranteed locally (40). The emergency delivery lists "10 C" separately from "4 E". |
| E | **components** | §6.4 says a "6 Component reserve [is] required for the Radio Relay", and the Relay costs "6 E". The 8 starting Components cover Radio Kit (3) + Ops Board (1) + Clinic (2) + ammo, with E03 refunding 6 for the Relay. It's not *Equipment*: Equipment is weapon and kit items, which no building consumes. |
| D | **seed_packets** | Garden Plot and Field Farm each cost 1 D. The spec says "1 per plot, not consumed per harvest". S was already taken by scrap. |
| P | planks | Phase 2 manufactured material. |
| M | metal_parts | Phase 2 manufactured material. |

---

## 2. How D2 works: campaign sites on the generated map

### Map sizes
- The spec's Compact / Standard / Large map onto worldgen v4's **medium / large / xl** (160×112 / 240×176 / 320×224).
- **Small (96×72) isn't offered in the campaign.** Lookout range (45 tiles), Watchtower range (70 tiles) and the migration corridor would cover almost the whole map.

### Distance scaling
- Each map size gets a `regionScale` in `backend/data/campaign/tuning.json`. The default is the generated map's half-diagonal divided by the spec's 256-tile half-width.
- **What scales:** the spec's regional numbers. That covers POI distance bands (60–100 / 100–220 / 180–300), the migration corridor's 40–70 tiles, and the 60-tile local-resource radius.
- **What doesn't scale:** detection, patrol and weapon ranges. They stay in absolute tiles because they're about local feel, and they get a sanity pass at M5.

### Assigning sites to POIs
After generation, an **assignment pass** maps the campaign's 11 sites onto real generated POIs. It works by distance rank from camp and by type affinity:

| Campaign site | Preferred POI types | Band |
|---|---|---|
| Grocery Annex, Hardware Yard (Phase 2 low-risk) | town, truck stop, gas stop | nearest |
| Abandoned Clinic, Roadside Depot, Scrapyard Route, Foraging Route, + 2 more scavenging sites | town, industrial, farm, ruin, gas, stop | middle |
| E01 Old Access Road, E02 Maintenance Crew site, E03 Regional Relay | industrial, ranger post, chapel, ruin | farthest |

- **When there are fewer distinct POIs than sites:**
  - Larger POIs (towns, industrial yards) host more than one site, each at a different building.
  - If still short, the audit picks a roadside vignette location, such as a wreck cluster or checkpoint.
  - The pass is part of the 32-attempt landing audit and the seed-sweep tests.
- **Persistence:** each site's state (remaining stock, cooldown, discovered/revealed, tokens) is saved and **never re-rolled** on reload.
- **Map markers:** sites show on the minimap and on the **Regional Intelligence** tablet screen, which is the generated map with site markers, distances and status.
- **Story sites:** E01 *reveals* the E02 and E03 sites on the map, as in the spec.

### Missions on the map
- **Movement:** the team really leaves through a camp exit and walks the road and path network to the POI. They're visible on the map, followed by a mission marker.
- **Travel time:** one-way hours = `max(0.5, pathTiles / 80)`, the spec formula using the *real path length*. Team speed is set so the walk takes exactly that long, which keeps it deterministic.
- **Site work:** the team stays at the site for the spec's site hours. Events, encounter cards and loot happen there.
- **Return:** they walk back and unload at storage. If storage is full the cargo goes into overflow, with an amber warning.
- **Mission danger (decided): infected on the map do NOT ignore teams.** A team out on a run can be seen and attacked like anyone else, both on the road and at the site.
  - The spec's event rolls (delay / cargo loss / site injury) still apply to site work on top of real encounters.
  - The first two mandatory runs (Grocery Annex, Hardware Yard) stay low-risk by clearing generated infected packs along their routes and site radius when the sites are assigned, and by keeping ambient spawns off those routes until both runs have returned. They are not made invulnerable.
  - Teams have a Recall order and a retreat stance. A Downed member can be carried by teammates or left, with the spec's 2 h Downed timer.
  - The no-combat-required win condition depends on the player choosing safe routes and sending armed teams. M7 tests verify that a careful zero-kill path is still possible.

### Migration corridor
- The corridor is a validated route between two generated map exits.
- It passes the camp at the scaled 40–70 tile band and is kept out of the build area.
- P1-09 and P2-12 hordes walk it for real on the map.

---

## 3. Codebase starting point (short)

- **Engine:** `Game` (`model.mjs` plus mixins) is the live simulation, driven through the `unity.mjs` JS boundary. `HOUR_SECONDS = 42` already matches the spec.
- **Gaps:**
  - Only 3 resources, with no storage cap or escrow.
  - The day starts at 06:00.
  - Survivors have 60 + 9·END HP.
  - Food consumption is about 24 per person per day, against the spec's 1.
- **Content pipeline:** `backend/data/*.json` goes through the content studio into the generated `gameContent.mjs`. All campaign tunables move into it.
- **Tests:** 148 tests, **4 already failing on this branch**. M0 fixes them.

---

## 4. Milestones

Each milestone ends with the suite green (`node --test tests/`), a browser preview smoke test, and its own commit. **⏸ = review checkpoint**: I stop and hand you a playable build.

### M0 — Groundwork ✅ done
- Fixed the 4 failing tests: a stray unpublished `test` quest, the catalog count (now derived from content), camp-buildable art lookups, and the lock assertion (scoped to structures a legacy quest unlocks).
- `Game` has a `mode` ('campaign' | 'legacy') alongside `start` ('camp' | 'refuge'), and campaign runs carry `game.campaign` (settings, phase, classification) in `web/src/engine/campaignState.mjs`. New Game starts a campaign; tests and the refuge scenario stay legacy. The campaign object is saved and restored.
- Campaign content lives in **12 studio categories**, stored flat as `backend/data/campaign_*.json` (and seeded in `backend/seed/`):

  | Category | Contents |
  |---|---|
  | `campaign_resources` | the 12 resources with unit weights and categories |
  | `campaign_difficulties` | Standard / Assisted / Severe |
  | `campaign_traits`, `campaign_jobs` | traits; the 6 jobs with attribute and multiplier |
  | `campaign_buildings` | B00–B29 |
  | `campaign_items`, `campaign_recipes` | equipment; C01–C11 |
  | `campaign_sites` | 11 sites with bands and preferred map-location types |
  | `campaign_expeditions` | E01–E03 with encounter cards |
  | `campaign_tasks` | P1-01…P2-13 and S01–S05, declarative objectives and both certifications |
  | `campaign_strings` | Appendix A, Appendix B and other copy, each tagged `spec` or `generated` |
  | `campaign_tuning` | every formula constant, in groups |

- `backend/campaign_schema.py` validates it (references, cost letters, task-chain cycles, build objectives asking for later structures), renames references across categories, and exports it as `CAMPAIGN` in `gameContent.mjs`. The studio lists the categories under **AfterLife Campaign**.
- The old `web/src/engine/campaign/` data files are marked superseded; the standalone engine is deleted as its logic moves into `Game`.

### M1 — Clock, speeds, 12-resource ledger, saves ✅ done
- **Clock:** a campaign starts on Day 1 at 07:00 and its day turns at midnight; work runs 07:00–19:00 (`game.workShift`); there is no 24-day end. CentroCom sends the daily operations summary at 07:00. Legacy runs keep their 06:00 start and 24-day run.
- **Speeds and pause:** pause/1×/2×/4× already existed. The host now also has pause holds (`holdPause`/`releasePause`) so the letter, tutorials and encounter cards can stop the clock without fighting the player's pause button.
- **Ledger** (`web/src/engine/ledger.mjs`): owned / reserved / available, reservations with commit and progress-based refunds, 40% demolition and 25% ruin shares, weight-based storage from working storage buildings, overflow that stays spendable but halts production and gathering (`deposit`), forced deposits for rewards, refunds and cargo.
- A campaign deploys with the spec's supply cache scaled by difficulty, eats 1 Food per resident per day, and has no passive income or trader.
- **Rename:** `metal` is `scrap_metal` everywhere (content, engine, HUD, tests); the UI says "scrap".
- **Saves:** version 4 with open reservations; v1–3 saves have their metal migrated on load. Campaign saves can run past day 24. Fixed a pre-existing bug that dropped any saved map wider than 256 tiles (XL worlds).
- **HUD:** the supplies card shows shared storage (weight / capacity, overflow warning), the three essentials with reserved amounts and days of food left, and the other eight resources; the tablet stockpile groups all twelve. Clock and tablet show the work shift.
- **Autosave:** the host already saves every 5 seconds; the simulation can now also ask for an immediate save (`requestAutosave`).

### M2 — Survivor model ✅ done
- Campaign survivors (`model: 'campaign'`, `web/src/engine/crew.mjs`): stats 1–10 for STR/END/AGI/INT/CHA, rolled as a bell around 5; founders follow archetypes A–E with every stat ≥ 3 and quality ≥ 9.
- Traits: up to two, at most one drawback; the starting crew never rolls Violent, Contagious or Refuses Work. Trait effects are data (`modifiers`: labor bonus by kind of work, max HP, detection, fatigue cost).
- Jobs: the six campaign jobs map onto engine roles (unassigned survivors are General Workers). Proficiency 0–20, +1 per 4 effective work hours.
- Labor factor per the formula, by kind of work (gather, build, craft, treat, farm, scavenge), with Engineer ×1.5 for build/craft, health and fatigue bands. It is exposed now and drives output from M4.
- Fatigue: +4/h work, +7 overtime, +8 combat, +5 off-site; −8 resting in a bed, −4 sleeping rough; Restless +10%. At 100 a survivor rests until 40.
- Work shift 07:00–19:00 for campaign survivors (sentries keep their watch rota).
- Health: 100 HP (+10 Sturdy). Campaign survivors improve by job proficiency, not levels. Light wounds mend 1 HP/h while resting (a generated default; treatment arrives in M5).
- Hunger: after 12 h without food morale falls 5/day; after 24 h health falls 10/day; in Phase 1 hunger stops at 1 HP. Morale is tracked (0–100) with no other effects yet.
- UI: inspector shows job, proficiency, labor rate, fatigue, morale and traits; the crew dossier shows campaign attributes with their work factors, traits and fatigue; roster and crew cards show the job.

### M3 — New Game flow, world audit, site assignment, deployment ✅ done (review checkpoint)
- **Start screen** (New Game = campaign): Deployment Settings (Standard / Assisted / Severe from content; Overseer name, 1–24 characters, any script) → Regional Assignment (Compact / Standard / Large = medium / large / xl; seed as any text up to 64 characters; water and spawn options kept).
- **Seed** (`web/src/engine/seed.mjs`): a number up to 2^64−1 is used as is; other text is MurmurHash3 x64-128 over UTF-8 (verified against published vectors). Terrain, crew and layout draw separate streams. The seed is settled when the region step is left, so rereading the letter never rerolls it. Region codes look like `KX-9722`.
- **Recruitment letter** (`LegalAgreement.jsx`, Appendix A): I AGREE stays disabled until the letter is read to the end, by wheel, touch, End / Page / arrow keys or "Go to final acknowledgment". It is a labelled document of headed sections, and live hints announce when it can be accepted. An acceptance notice follows.
- **Deployment** (`web/src/engine/deployment.mjs`): up to 32 surveys of the seed, each audited for:
  - a buildable landing square at ≥ 90% (rocky ground counts as too steep, since maps have no elevation);
  - a footpath to the road and road links to two map exits;
  - a migration corridor (A* between map edges, held to the distance band);
  - three reserved 6×6 patches inside the protected perimeter;
  - finite debris meeting the exact local quotas, at least half inside the perimeter;
  - all 11 regional sites placed on real map locations by walking-distance band and location type (towns host up to 3, industrial yards and truck stops 2; a roadside spot if locations run out).
  After 32 failures it uses a logged fallback (the first survey without water, audited leniently).
- **Scales:** ground around the camp uses one local scale (0.41: perimeter 18 tiles, debris radius 25, corridor 16–29, landing 13); site distance bands scale with map size (0.38 / 0.41 / 0.54).
- **Package:** campfire, cache (600), five tents, five founders (archetypes A–E, crew drawn from the seed), five wooden clubs carried, two clubs and two basic pistols spare (347.5 weight; 517.25 on Assisted). Campaign gear goes by campaign job; pistols are for guards.
- **Landing:** 11 progress messages, then Phase 1 begins, the "Deployment - Day 1" autosave is written, the region fades in under `REGION XX-0000 / DAY 1 / 07:00` with the clock held, CentroCom's welcome and Mara's note arrive, and the SeerPad button pulses until opened.
- **Protected perimeter:** no infected arrive until the campaign switches threats on (P1-07, M5).
- **Regional Intelligence:** the tablet map shows revealed sites (story sites stay hidden until E01), debris, reserved patches, the perimeter ring and the migration route.
- **Saves:** fixed two pre-existing bugs that dropped Large (XL) maps on load (width and object-count limits).
- **Tests:** seeds, the audit, determinism, quotas, package weight, saves, protection and the setup flow; a 6-seed-per-size sweep runs in CI and `web/tools/campaignSeedSweep.mjs` runs 1000.
- **Still legacy until M4:** the quests on the orders card (Firewood), and gathering (debris is placed and drawn but can't be worked yet).

### M4 — SeerPad, task engine, P1-01…P1-04 (vertical slice) ✅ done (review checkpoint)
- **SeerPad:**
  - Rail groups: Command (Tasks, Messages, Journal), Settlement (Survivors, Build, Resources, Crafting, Defense, Recruitment), Region (Operations, Regional Intelligence), and Pending Authorization (Trade, Research, Policies, Municipal, greyed: *"Requires later settlement authorization"*). Defense, Recruitment and Operations show a "coming later" note until M5 and M7.
  - Messages filter between CentroCom (official) and Mara Venn (private).
  - Resources shows the ledger (owned / reserved / available) and a food forecast. Crafting lists every workstation with its queue.
  - Appendix B alerts speak at most once per two game hours each.
- **Task engine** (`web/src/engine/tasks.mjs`, replacing the old `campaignTasks` module):
  - States LOCKED → AVAILABLE → ACTIVE → OBJECTIVES_MET → COMPLETED. Main tasks start themselves when their predecessors are done.
  - Structures, recipes, jobs and SeerPad modules unlock when a task *starts*, so its objectives can be met.
  - Cumulative counters (gather, harvest, craft) count only what happens after the task starts. Built and staffed objectives count only working structures (not blueprints, above 25% HP).
  - Rewards are paid once, keyed by transaction id. Completion messages, Mara's notes and a "Task complete" autosave follow.
  - Legacy quests stay in the content for legacy mode (tests and the refuge scenario) instead of being archived.
- **Gathering:** click a debris pile to mark it. Survivors work it (small piles 1 worker, large 2 at 0.85× each), carry up to 10 per trip to the nearest working storage, and the pile disappears when empty. Deliveries stop while storage overflows.
- **Construction:**
  - Placing a blueprint reserves its cost. It sits at 25% HP, can't be lived in or staffed, and is drawn see-through with a progress bar.
  - Up to 2 builders (1.0× and 0.75×); Engineers are picked first and build at 1.5×; anyone free can build.
  - Cancelling refunds everything if unstarted, `floor(cost × (1 − progress/2))` once started.
  - Placement: inside the protected perimeter, on dry, non-rocky ground, clear of trees, debris, ruins and the migration corridor. Land parcels don't apply in the campaign.
- **Garden Plot:** a posted farmer adds labor during the work shift; the first crop after 12 effective hours, then a batch every 3 (0.25 food per work-hour). Seeds aren't used up.
- **Field Workbench:** a 10-order queue; inputs are reserved when an order is queued and refunded on cancel; a new operator keeps the progress. Only C01 Wooden Club can be made this milestone: bandages and kits wait for M5's treatment system.
- **Campaign mode turns off** the legacy walk-up/radio recruitment, the trader and the legacy quest progress tick.
- **Quests P1-01…P1-04** use the spec copy, with generated copy for gaps (job descriptions included).
- **Fixed during the browser pass:**
  - Builders and operators stalled forever when crowding pushed a structure's approach point beyond arm's reach.
  - A legacy walk-up appeared at the gate.
- **Tests** (`tests/campaign-tasks.test.mjs`): the task engine, alerts, placement, escrow and refunds, builders, gathering and overflow, crops, the workbench queue, the P1-01→P1-04 chain played headless (done on day 3 with nothing left in escrow), and a mid-task save.
- **Deviations:**
  - Structure footprints keep the existing art sizes rather than the spec's tile sizes (the Garden Plot is 2×1 tiles, not 4×4).
  - Spec movement speeds (path vs off-path) aren't applied yet.
  - Side tasks S01–S05 aren't activated yet (M6).

### M5 — Medical, defense, detection, recruitment (P1-05…P1-08) ✅ done
- **Medicine** (`web/src/engine/medical.mjs`):
  - **Aid Station:** one bed and one Medic. Treatment gives +8 HP and −2 infection per patient-hour and uses a Medical Supply at the start of every 4 patient-hours; with no supplies, treatment stops and an alert fires.
  - **Patients:** a survivor who is bleeding, infected or below 95% health takes a free staffed bed (an isolated bed takes only the infected). They leave when fully healed.
  - **Medic:** works from the station. A hurt Medic with an empty bed treats themselves at half speed.
  - **At night:** a posted Medic still counts as staffing the station. They get up for a patient, and a bleeding or infected survivor gets up to take the bed.
  - **Bleeding** (10% a blow) costs 1 HP an hour. A Bandage (+10 HP) or First Aid Kit (+25 HP) stops it; anyone uses them from stock, at most one of each per 6 hours.
  - **Infection** (a bite at the difficulty's 3/5/7%) starts at 20 and grows 1 an hour. At 100 a two-hour warning, then death and reanimation where they stand. An isolated bed holds them instead.
  - **Downed** lasts exactly 2 hours. A rescuer lifts them (0.25 labor-hours), then carries them at half speed to an Aid Station bed, which stabilizes them and stops the bleeding. With no Aid Station standing at all, they are stabilized where they fell.
  - **Deaths:** each is recorded with CentroCom, and Mara writes after the first.
  - **C03 Bandage** is made at the Field Workbench into a medical stock (bandages and kits weigh as equipment).
  - **P1-05's scripted cut:** 15 HP, no bleed or bite, on the least-fatigued healthy non-medic. It waits for a staffed station and a bandage in stock.
- **Defense** (`web/src/engine/defense.mjs`):
  - **Infected:** spec Wanderer stats (45 HP, 8 a blow every 2 s, 4 a second against structures, 12-tile sight).
  - **Guard Post:**
    - Up to two guards, each on the Perimeter loop or the Approach watch (toward the migration corridor), within 20 tiles.
    - Intercept (default) chases what is seen within 10 tiles past that radius and answers alerts there; Hold stays on its route.
    - Guards follow the work shift but get up for a threat within reach of their post.
  - **Pistols:** issued with 5+ rounds in stock; a round a shot; put back for a melee weapon at none, with the ammo alert.
  - **Lookout Post:** its Guard is on watch (a sentry), sees 45 tiles all round from the platform, raises alerts, and never counts as a patrol or answers alerts.
  - The camp notices any infected inside the protected perimeter.
  - **P1-07's Wanderer:**
    - One marked infected 50 tiles out (toward the corridor), once a watch and a separate patrol are posted, during the work shift.
    - Its blows never take anyone below 50 HP and roll no bleed or bite. One replacement if it dies unseen.
    - Detection posts the spec alert with an Acknowledge action.
    - Completing P1-07 ends the protected period.
  - **After P1-07** a lone Wanderer drifts in from beyond the perimeter about every 10 hours (scaled by difficulty), two after day 10. The big tests are the migrations (M6).
  - The campfire can't be broken; a campaign is lost only when nobody is left alive.
- **Radio** (`web/src/engine/radio.mjs`):
  - **Broadcast:** costs 2 Food and half an hour of the free survivor with the best Charisma, then a 24-hour cooldown.
  - **Replies:** a reply comes 4–8 hours later. The first always succeeds with Quality 16+; later ones succeed at the difficulty's rate.
  - **Accepting** needs a free bed and a day's Food for the larger camp. The recruit walks in from beyond the perimeter, untouched, and counts on arrival.
  - **Rejecting** costs nothing. Unanswered candidates move on after a day.
- **SeerPad:**
  - **Defense:** acknowledge card, ammunition, each guard's stance and route, the watch, open alerts.
  - **Recruitment:** radio status and Broadcast; candidate cards with stats, traits, HP and food demand, and Accept/Reject with the reason it's blocked.
  - **Resources:** medical stock.
  - **Messages:** Acknowledge and Review candidate actions.
- **Inspector:**
  - Aid Station: bed, patient and isolation toggle.
  - Guard Post: stance and route per guard.
  - Lookout: the watcher.
  - Radio Kit: Broadcast button.
  - Survivors: a medical card (downed timer, bleeding, infection and turn timer, care).
- **Settings screen:** campaign copy (overseer, region, "New deployment") in place of the refuge text.
- **Tests** (`tests/campaign-medical-defense.test.mjs`): treatment and supplies, self-treatment, night care, the scripted cut, bleeding and first aid, infection and isolation, rescue and carry, bleed-out, blows and the tutorial cap, pistols and ammunition, routes, stances and the watch rule, the patrol hold clock, Lookout range, P1-07 with its replacement, radio timing and acceptance rules, rejection and expiry, the loss rule, saves, and P1-05→P1-08 played headless (done by about day 4).
- **Range check:** the P1-05→P1-08 chain and four days of live threats played on Compact, Standard and Large maps. With a guard posted, about 10 infected arrive and are killed over four days with nobody hurt; a pistol guard uses about 22 rounds in that time.
- **Deviations:**
  - The recruit's walk is about 32 tiles rather than a full hour.
  - Treatment is a flat +8 HP an hour, not scaled by the Medic.
  - Noise (gunshots, workstations, broadcasts drawing infected) isn't modelled yet.
  - The Lookout isn't watched at night.

### M6 — Shelter, first migration, Camp certification (P1-09, P1-10) ✅ done (review checkpoint)
- **Makeshift Shelter** (`web/src/engine/migration.mjs`): 8 emergency slots, never housing.
  - **Shelter All:** suspends work, gathering, crafting and broadcasts, and calls every resident in. The downed and ill go first, then non-combatants, then guards. Four go through each door at a time, ten game minutes each, and anyone without a slot is named on an Outside list. Residents away on operations are reported separately.
  - **Seal:** stops arrivals (anyone not inside is left out). A sealed shelter is never noticed or attacked.
  - **Unsealed:** occupants' detection is cut by 75%, so an infected notices an occupied shelter only at a quarter of its sight.
  - **Release:** opens by itself once the route has been clear for an hour. Releasing earlier asks first (Appendix B copy).
- **The first migration:**
  - Scheduled once P1-09 is active, shelter covers everyone, nobody is downed and no infected are near.
  - Three hours' warning (spec copy, with an alert action), then 12 Wanderers spawn over two hours and walk the stretch of the migration corridor that passes the camp.
  - A migrant turns aside only for prey it can see. Afterward it rejoins the corridor at the nearest waypoint, and one that makes no headway for 15 seconds wanders off.
  - Survival is recorded with no kills needed: everyone sheltered and sealed for an hour of the passage, then the route clear. Then a 24-hour cooldown.
  - The trickle of lone infected stands aside during a migration.
- **Established Camp** (`web/src/engine/certification.mjs`):
  - **The checklist:** P1-01 to P1-09 complete; population 6+ with nobody downed or bleeding; beds and shelter slots for everyone; staffed gardens projecting at least a Food a resident a day, and twice the population in reserve; an Aid Station with a Medic; a working Workbench; a watch Guard and a separate patrol Guard; a Radio Kit and a recruit.
  - Posted people count while asleep. The 12-hour hold resets on any failure, and CentroCom names the reason (UI_HOLD_RESET).
  - **On completion:** Phase 2, the Established Camp classification (starvation protection ends) and Mara's note. A classification screen holds the simulation until `[ BEGIN PHASE 2 ]`.
- **Emergency deliveries:** when the current main task's required structures can't be paid for from stock and remaining debris, CentroCom sends the shortfall once per resource, within the spec's caps, six hours later, logged in the journal.
- **Side tasks:** offered when their situation arises and taken on from Tasks.
  - **S01:** food under a day and a half; accepting marks a 12-Food ration crate inside the perimeter to gather.
  - **S02:** a structure below 75%; done when repaired.
  - **S03:** two residents at 85+ fatigue; done when both rest to 40.
  - **S04:** a candidate with no bed; done when there is room, or they are accepted or declined.
  - **S05:** a reserve of 2 First Aid Kits and 30 Ammo, already in the content. It opens with the kit recipe in Phase 2.
- **Loss screen:**
  - **Load autosave:** the host keeps the last milestone autosave (deployment, task completions, Established Camp) apart from the rolling save, in browser storage when it can.
  - **Restart this region:** redeploys on the same seed, map size, difficulty and Overseer.
  - **Title Screen.**
- **SeerPad:**
  - **Defense:** the Emergency Shelter section (migration banner, Shelter All / Seal / Release, inside, on the way, outside, away).
  - **Tasks:** the certification checklist with its hold bar, and an Optional Tasks section with Accept.
- **Tests** (`tests/campaign-migration.test.mjs`):
  - Shelter: slots, Shelter All priority and door limits, sealing and release, detection rules.
  - Migration: its schedule, passage, clearing and cooldown, and the migrant rejoin and failsafe.
  - The rest: certification and its hold reset, deliveries, the four Phase 1 side tasks, a save mid-migration, and **deployment to Established Camp headless (done by day 8) with no kills during the migration**.
- **Fixed:** a deployment test flaked when the day's first infected had already been killed; it now counts arrivals.
- **Deviations:**
  - Downed survivors keep their shelter slot but are carried to the Aid Station, not into the shelter.
  - Noise isn't modelled, so "noisy work" is simply all work.
  - Later side-task repeats aren't offered: each side task runs at most once.

### M7 — Operations Board, on-map scavenging, manufacturing (P2-01…P2-05) ✅ done
- **Operations** (`web/src/engine/operations.mjs`, replacing the standalone `campaign/campaignOperations.mjs`):
  - **Board:** one team at a time from a working Operations Board, 2–3 residents per scavenging run.
  - **Eligibility:** nobody downed, under treatment, sheltering or exhausted; infection ≤ 50, health ≥ 60%, fatigue ≤ 70.
  - **At launch:** rations are reserved (1 Food a person a day, whole days) and settled on return by what was actually eaten. Members keep their beds and posts; posts left empty raise the spec warning.
  - **Travel:** each member really walks to the site and back, at their own pace, so each leg takes the formula's `max(0.5, path tiles / 80)` hours (tested within 15%). They work the site for its hours (+2 if the team's best INT is under 5), then carry home Σ(15 + 2·STR) in the site's stock order.
  - **Sites:** stock is finite and what isn't carried stays for the next run. Recurring routes restock 48 h after a run, with their bonus.
  - **Events:** rolled at the site with the spec formula: delay +2 h; injury 15 HP, softened to −5 by a kit or −8 by 2 rounds of ammunition; a cargo loss drops a fifth of anything the current task isn't waiting on.
  - **Danger:** the infected on the map can reach a team anywhere. A downed member turns the team home, and teammates make the rescue.
  - **Recall** turns the team round with whatever they had gathered so far.
  - **First two runs:** no event rolls, and the ambient trickle holds off while they're out.
  - **Return:** cargo goes to storage (overflow if it must), a report is written with a CentroCom message linking to it, and an autosave is taken.
  - **Saves:** everything persists, a team mid-walk included.
- **Salvage Yard:** posted General Workers turn 6 Raw Salvage into 4 Scrap Metal per labor-hour, pausing without salvage or with storage full. The post uses the engine's spare `logger` role so saves stay valid; the crew screen calls it "Salvage Yard".
- **Workshop:** a 20-order queue (C04 Planks, C05 Metal Parts, C11 Seed Packet after P2-02). A second operator works at 0.75.
- **Storage Depot:** +1000 capacity.
- **Art:** the Operations Board, Salvage Yard and Storage Depot are drawn in `campBuildArt.js` at the spec footprints (3×2, 5×4, 5×4) and sit on their footprint. Menu cards and ghosts are baked. The Workshop keeps its existing 5×4 art.
- **SeerPad Operations:**
  - **Site cards:** distance, hours each way, site hours, remaining stock, a SAFE RUN / RISK / DEPLETED / recovering badge.
  - **Team picker:** each resident's eligibility, stats and post, with a live preview of hours away, carry capacity, rations, event risk and posts left empty.
  - **Team-out panel:** progress, ETA, cargo and Recall.
  - **Return reports:** with "mark reviewed".
  - P2-01's interactions are recorded as the screen is used.
  - The survivor panel shows "ON OPERATION".
- **Fixes:** `web/tools/bakeBuildableArt.mjs` no longer rewrites `src/hud/uiSprites.json`. That file belongs to the Unity asset exporter, and rewriting it failed the asset check.
- **Tests** (`tests/campaign-operations.test.mjs`): site opening and the formulas, eligibility, launch rules, the Grocery run's timing and exact cargo, carry limits and leftover stock, the recurring route, every event outcome, an ambush on the road, a downed teammate, the Salvage Yard ratio, the Workshop's queue and second operator, the Depot and P2-05, a save mid-walk, the held trickle, and P2-01→P2-05 headless.
- **Still to absorb:** the rest of `web/src/engine/campaign/` (authored expeditions and their encounter cards) goes in with M9. `tests/campaign.test.mjs` still covers the standalone engine until then.

### M8 — Outpost growth (P2-06…P2-08) ✅ done
- **Field Farm:** one crop lane per farmer (2 slots) at 0.5 Food per work-hour, each lane with the 12-hour first crop and 3-hour batches. Two average farmers make 12 Food in a 12-hour workday. Garden Plots share the lane code (one lane, 0.25). The scheduled gross Food/day (P2-06, the checklist and the forecast) counts both.
- **Barracks:** 6 beds. A campaign structure's beds are now its housing capacity.
- **Foraging Route:** opens with P2-06 (it was already in the site data).
- **Field Clinic:** 2 beds, both treated at once by one Medic at +12 HP per patient-hour, with supplies drawn per patient-hour. Medical code now handles any station's bed count: Shelter, rescue, isolation and the inspector work for Aid Stations and Clinics alike.
- **Watchtower:** a watch post like the Lookout, seeing 70 tiles from a taller platform. A firearm on it gains +5 tiles of range and no damage. Campaign watch posts no longer get the legacy tower's damage and range bonuses, so the Lookout adds nothing.
- **Recipes C06–C10** at the Workshop:
  - C06 Ammo, C07 Medical Supplies, C08 First Aid Kit and C10 Basic Pistol.
  - C09 Reinforced Club takes a spare Wooden Club (in the stock, carried by nobody), set aside when the order is queued, freed on cancel, consumed on completion, and saved.
- **Component reserve warning:** an order that would leave fewer than the Radio Relay's 6 Components, while no Relay stands, asks first using the spec copy (Crafting screen and inspector).
- **Art:** the Field Farm (6×6), Field Clinic (4×4) and Watchtower (3×3) are drawn at the spec footprints. The Barracks keeps its existing 5×4 art.
- **Fixed:** a structure standing across the camp's nearest way out (a 6×6 farm on the land's edge) left builders unable to path out. Pathfinding now tries the next nearest ways out.
- **Tests** (`tests/campaign-growth.test.mjs`): farm lanes and output, Barracks and the route, the two-bed clinic, the Watchtower's watch and range, C06/C09/C10 with the item input, the component warning, the pathfinding regression, saves, and P2-06→P2-08 headless.
- **Noted in testing:** an unbuilt blueprint has 25% of its integrity, so a single wandering infected can knock down a large blueprint overnight if no guard answers. That follows the spec, but it can be costly.

### M9 — Authored expeditions, relay (P2-09…P2-11) ✅ done (review checkpoint)
- **Expeditions** (`web/src/engine/story.mjs`, built on the operations missions):
  - E01–E03 go out from the Operations Board to their story sites on the map, which appear as they are revealed.
  - **Teams and provisions:** each takes its spec team (3, or 3–4) and provisions: ammunition set aside, First Aid Kits taken from the medical stock, both returned if unused.
  - **Encounter card:** reaching the site opens it. The team does nothing on site and the HUD holds the game until a choice is made, and a save in between reopens it.
  - **INT:** a team whose best INT is under 5 takes 2 more hours on site but is never refused.
  - **E01:** reveals the service depot and relay sites.
  - **E02:** contacts the crew and gives the keycard token.
    - "Offer a place" makes two crew candidates who still need beds and Food; left unanswered, they become standing contacts instead of leaving.
    - "Deliver aid" spends the provisioned kit for 20 Food and leaves them as contacts.
    - Contacts can be invited from the Recruitment screen.
  - **E03:** gives the battery token, the relay blueprint and 6 Components. The risky choice hurts one member by 10, or 5 with a provisioned kit.
  - Tokens are unique states (`held`, `installed`, `lost`), never counts, so they can't be duplicated.
- **Radio Relay:**
  - **Battery:** placement needs the battery and the blueprint takes it. Cancelling or demolishing gives it back. If the relay is destroyed the battery is lost with it, and E03 can be run again as a safe 2-hour recovery with no encounter and no second reward.
  - **While standing:** an 18 h broadcast cooldown, replies in 2–4 h, +10% success (cap 95%), and migrations announced 6 h sooner.
- **Reinforced Shelter:** 16 emergency slots, adding to the Makeshift Shelter's 8 (24). An unsealed, occupied one is noticed only at a tenth of an infected's sight (−90%).
- **SeerPad and HUD:** expedition cards on Operations (briefing, objective, provisions, team size, the INT note), the encounter card dialog, encounter results and story text on return reports, and crew contacts with Invite on Recruitment. P2-09's report-reading step counts when reports are marked reviewed.
- **Art:** the Reinforced Shelter (5×5 bunker) and the Radio Relay (3×3 mast and shed) are drawn at the spec footprints.
- **Pathfinding fixes:**
  - A camp's grid can be split in two by its buildings. Ways in and out now open into the same part as the destination, and approach points prefer the part the walker can reach. Before this, a team coming home from the relay stood at the site forever.
- **Content:** E02's expedition-level 20 Food was removed; the spec puts it only in the "deliver aid" choice, which would otherwise pay 40.
- **D1 finished:** the standalone `web/src/engine/campaign/` engine and its test (`tests/campaign.test.mjs`) are removed. Everything they covered now lives in the campaign `Game` and its tests.
- **Tests** (`tests/campaign-story.test.mjs`): E01's opening and provisions, the held encounter across a save, the INT rule, both E02 outcomes with contacts and invitation, E03 with and without a kit, the relay battery's life cycle and recovery, the relay's effects, the Reinforced Shelter, the split-camp pathfinding regression, and P2-09→P2-11 headless.
- **Deviations:**
  - The lost battery is recovered by the short E03 repeat; there is no separate ruin pile to search.
  - Expeditions have their encounter but no random site events.

### M10 — Readiness horde, Outpost certification, wrap-up ⏸
- **P2-12:** 24 Wanderers over 3 h, with a 6 h warning (12 h with the relay). Sheltering or fighting both qualify.
- **P2-13:** 48 h certification. The stability guard holds off random migrations during the final hold.
- **Ending:**
  - CentroCom "ESTABLISHED OUTPOST" and Mara's closing message.
  - `[ CONTINUE MANAGING OUTPOST ]` / `[ RETURN TO MENU ]`.
  - The save is marked complete, and Phase 3 modules stay locked.
- **Telemetry:** a local-only ring buffer that never records the Overseer's name, plus a dev-only debug panel for predicates and hold timers.
- **Tests:**
  - A full scripted campaign: zero-kill and combat variants.
  - Save and reload at every autosave trigger, with no duplicate rewards.
  - A determinism hash across the seed sweep.
- **Cleanup:** delete what's left of `web/src/engine/campaign/` (D1).

---

## 5. Risks
- **M1 and M2 touch nearly everything.** The resource rename and survivor rebalance affect the HUD, saves, costs and legacy `refuge` tests. Each lands as its own commit so it's easy to review or revert.
- **On-map missions (§2):** teams face real infected, so balance of route danger vs. the spec's risk model needs tuning at M7. Mid-walk save and reload is the trickiest persistence case and gets dedicated tests.
- **Small maps are dropped from the campaign.** Assigning 11 sites on medium maps relies on towns hosting several sites. The seed sweep will show whether that holds up.
- **Pacing:** at 1×, campaign Phase 1 is a multi-hour real-time run. The M4 checkpoint is where to adjust it.
- **Generated copy:** every line is tagged `source: "generated"` so you can audit tone in one place.
