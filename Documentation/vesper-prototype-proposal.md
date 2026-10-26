# VESPER — Prototype Concept Proposal (rev 1, for review)

- **Source:** *VESPER: The Shattered Expanse — Game Design & Development Specification* v1.0 (25 Oct 2026), 17 pp.
- **What this covers:** a plan for the GDD's **Phase 0 prototype**: what we build, why, how, in what order, and how we decide whether it worked. It contains no code.
- **What it doesn't cover:** Phases 1–4 (vertical slice to live ops), monetization, Syndicates, territory, PvP and seasons. Those depend on what the prototype tells us.

---

## 1. Summary

VESPER is a broad game. It combines a base builder (the arkship), a collectible-crew RPG with a gacha, a fleet autobattler, a third-person action mode, a persistent galaxy and guild territory war. The GDD's own risk register calls *feature breadth* the top risk: each of these demands different engineering skills.

The prototype therefore shouldn't be a small version of the whole game. It should be a **set of focused experiments on one shared simulation core**, answering the questions that would be expensive to get wrong later:

1. Is managing an arkship with **power, water and heat** readable and interesting, rather than a chore?
2. Does the **three-spectrum counter** (Pulse > Armor-Piercing > Disruptor > Pulse) plus stances create real choices in a fleet battle the player only watches?
3. Is a **three-Specialist ground expedition** with squad switching and an extraction decision fun in a 5–10 minute session, and which camera works?
4. Can the **deterministic, server-authoritative command model** (ledger, idempotent commands, seeded battles, auditable recruitment) be built at the quality the GDD requires?
5. Do the three modes **feed each other** in a loop worth repeating?

**Proposed duration:** 10 weeks inside the GDD's 8–12 week budget, plus a 1-week decision gate.
**Proposed team:** 1 designer, 2 engineers, 1 technical artist/UI generalist, and part-time QA and playtest support.

---

## 2. Prototype goals and hypotheses

Each hypothesis has a test and a pass bar. A prototype that fails a hypothesis has still succeeded if it tells us so cheaply.

| # | Hypothesis | How we test it | Pass bar |
|---|---|---|---|
| H1 | Utility grids (power/water/heat + adjacency) create meaningful layout decisions. | Moderated playtests: "fix the brownout" and "fit a new Drydock" tasks. | ≥ 70% of testers explain *why* a brownout happened without help; ≥ 50% rearrange rooms for adjacency without being told to. |
| H2 | The spectrum counter is legible and decisive in the pre-battle preview. | Players pick fleet loadouts against 3 previewed enemy fleets. | Correct counter-pick in ≥ 75% of choices after one tutorial battle; a counter-pick changes the win rate by a clear margin in 1,000-battle simulations (target 60–70%, not 95%+). |
| H3 | Ground expeditions with squad switching and extraction are fun in short sessions. | Playtests of one Salvage mission; post-session survey. | Median session 6–10 min; ≥ 60% of testers take at least one optional cache (risk/reward reads); "would play again" ≥ 3.5/5. |
| H4 | The deterministic core holds up. | Automated tests (see §7). | Every Appendix B scenario in scope passes; replaying a battle from seed and snapshot gives an identical log hash; save/load round-trips exactly. |
| H5 | The three modes form a loop. | A 30-minute guided session that mirrors the GDD's tutorial beats. | Testers can state what they're working toward next; no dead ends where the player has nothing to spend. |

---

## 3. Scope

### 3.1 In scope

The GDD's Phase 0 list, adjusted where the list doesn't support its own tests (see §3.3):

**Arkship layer**
- Deck grid with one expansion step, so expansion is tested.
- 8 rooms: Bridge, Reactor, Condenser, Hydroponics, Habitation, Drydock, Contract Bureau, plus a **Radiator** (see §9, Q1). Cargo Hold is optional if storage caps need testing.
- Footprints of 1×1, 1×2 and 2×2; levels 1–5 for each room.
- Full utility equations: power budget, water flow, heat balance, brownout at 50% output with protected life support, and the 20% fabrication slowdown under excess heat.
- The four adjacency bonuses from the GDD, capped at 20% per room.
- One construction queue, upgrade timers on the GDD formula with a debug time-scale, and offline production capped at 12 hours.

**Crew layer**
- 3 playable Specialists (Vanguard, Striker, Medic), plus a stub roster of about 12 data-only units for recruitment.
- Deterministic stat growth, `Stat(L) = BaseStat + Growth × (L − 1)`, levels 1–20 only.
- One assignment slot type (Reactor), to test the "every unit has a job" promise.
- Recruitment: core banner with the published rates, the Elite guarantee at 10 and the Mythic hard pity at 60, duplicates turning into Echo Fragments, and an odds/pity disclosure screen. No featured banner.

**Fleet layer**
- 1 hull (Frigate) with 3 interchangeable weapon modules, one per spectrum, so one ship class can still test the counter triangle.
- Formation (front 2 / middle 3 / rear 3) and the 3 stances.
- A server-side battle sim: 1-second ticks, 180-second cap, the GDD damage and mitigation formulas, seeded 0.95–1.05 variance.
- Client playback of the combat log and a pre-battle preview showing counter effects.
- 3 authored enemy fleets.

**Ground layer**
- 1 mission (Salvage) built from about 6 authored modular rooms.
- Direct control of one Specialist, switching between three with a cooldown.
- Primary attack, one active skill, one ultimate (100 energy) and one passive per Specialist.
- AI teammates on the GDD's finite-state machine (Follow → SeekCover → Engage → Ability → Revive → Retreat).
- 2 enemy archetypes and 1 elite.
- Optional caches that raise a threat meter; extraction points; on a team wipe, a partial loss of unbanked salvage.

**Platform**
- Command endpoint: `POST /commands/{type}` with an idempotency key and expected state version.
- Append-only resource ledger and save/load.
- Content as versioned JSON definitions (`RoomDef`, `SpecialistDef`, `ShipHullDef`, `WeaponDef`, `EncounterDef`, `BannerDef`) validated in CI.
- A debug panel: time-scale, grant resources, reset pity, replay battle from seed.

### 3.2 Out of scope (deferred, with reason)

| Feature | Why it waits |
|---|---|
| Galaxy map, travel, fog, expeditions | Interesting, but it doesn't de-risk anything above. One fixed "launch to encounter" button stands in for it. |
| Trade, market, commissions, Anchor Haven | Economy tuning needs the whole faucet/sink model; that's Phase 1 work. |
| Syndicates, rallies, relay territory, PvP, events | Multiplayer infrastructure; the risk is operational and social, which a prototype can't test with a handful of players. |
| Seasons, research tree, breakthroughs | Long-horizon progression; it needs retention data. |
| Store, Lumen Credits, cosmetics, passes | No real money in the prototype. Recruitment uses free test tokens. |
| Equipment, Ascension, bond perks, featured banner | They layer on top of systems the prototype already proves. |
| Mobile build, localization, full accessibility | Desktop only. We still follow the accessibility rules that are cheap from day one: colorblind-safe counter *symbols*, scalable text, remappable keys. |
| Co-op ground, PvP ground | Explicitly deferred by the GDD. |

### 3.3 Changes to the GDD's Phase 0 list

| GDD says | Proposal | Reason |
|---|---|---|
| "one Specialist" | 3 playable Specialists | The ground mission is defined as a three-person squad with switching; one Specialist can't test it. |
| "one recruit roll prototype" | The full core banner pity state machine, with no featured pool | A single roll proves nothing. The pity rules are the part that must be exactly right (Appendix B). |
| "one ship class" | 1 hull, 3 weapon modules | The counter triangle needs three spectra on the field. |
| "power/water simulation" | Power, water **and heat** | Heat and the radiator adjacency are a large part of the "arkship isn't a normal city builder" pitch. |

---

## 4. The prototype play session

The target is a 30-minute guided first session based on the GDD's tutorial beats, compressed with the debug time-scale:

1. **0–5 min, Arkship.** Repair the reactor and restore power. Name the ship. Build a Condenser and watch water go positive. Trigger a scripted heat spike, then fix it with a Radiator placed for adjacency.
2. **5–12 min, Crew + Ground.** Receive 3 starter Specialists (the guaranteed starter). Run the Salvage mission: learn switching, decide on one optional cache, extract.
3. **12–20 min, Fleet.** Spend salvage Alloy on a Frigate in the Drydock. Preview an enemy fleet and pick weapon modules and a stance. Watch the battle play back.
4. **20–30 min, Loop.** Battle and mission rewards pay for room upgrades and Signal Tokens. Do a 10-pull with visible odds and pity, assign a duplicate-tier unit to the Reactor, and see the production bonus.

The session ends on a visible goal: "Upgrade the Drydock to unlock a second fleet slot", which is stubbed. That gives H5 something to measure.

---

## 5. Technical approach

### 5.1 Architecture

Follow the GDD's model at small scale: **the client sends commands, a server applies them, and the server owns outcomes.**

- **Simulation core:** one deterministic module (seeded RNG, fixed-point or integer maths where results must match exactly). It holds the room/utility model, the stat model, the pity state machine and the battle sim. Server and test runner use the same core; the client uses it only for previews and playback.
- **Server:** one process with a modular-monolith shape (Arkship, Recruitment, Combat and Inventory modules behind the command endpoint). It stores state in a single file or SQLite database, and every balance change is one ledger transaction.
- **Ground mission:** the only real-time piece. It runs on the client. The server checks the result (time, objectives, salvage claimed) against plausibility bounds, as the GDD describes, and doesn't simulate the fight itself.

### 5.2 Client and engine choice

The GDD suggests Unity or Godot and lists the ground-combat camera as an open question. Recommendation:

- **Arkship, recruitment and fleet playback:** a 2D/UI-heavy client. Management screens and battle playback don't need 3D to test H1, H2 or H4.
- **Ground mission:** a **greybox, top-down or high-angle three-quarter view first**, built so the camera can be switched to over-the-shoulder for an A/B playtest in week 8. The camera decision is then made from data, as the GDD asks.
- **Engine:** if the team expects to ship in Unity, build the ground greybox in Unity from the start and keep the management client thin. If it's still open, a web stack is faster for the management layers. Either way the simulation core stays engine-agnostic, so this choice doesn't trap the sim work.

**Relationship to this repository:** Afterlife is a different game, and VESPER shouldn't share its codebase. Some of its patterns are worth copying, though: the fixed-step simulation with bounded catch-up, atomic save with backup, the JSON content files with a validator in `backend/`, and the Node test suite. Proposal: start VESPER in its own repository and reuse those patterns rather than the code. Confirm this before kickoff.

### 5.3 Content and data

- All tuning values from the GDD go into versioned JSON from day one. Nothing is hardcoded. This matches §19 of the GDD and lets the designer tune without engineering.
- A **balance workbook** (a spreadsheet) mirrors the utility, damage and pity formulas so the designer can sanity-check numbers before they reach the build.
- A **headless batch simulator** runs 10,000 battles per change and writes win-rate tables for each spectrum and stance. That's the GDD's §19 balance process at prototype scale.

---

## 6. Schedule (10 weeks + gate)

| Week | Milestone | Main output |
|---|---|---|
| 1 | **Foundations** | Repo, CI, content schemas and validator, command endpoint skeleton, ledger, seeded RNG, save/load. Design: room and Specialist data sheets; balance workbook v1. |
| 2–3 | **M1 Arkship** | Deck grid UI, placement and upgrades, utility simulation with brownout and heat, adjacency, queue and timers, offline catch-up. **Playtest 1 (H1)** at the end of week 3, internal. |
| 3–4 | **M2 Recruitment & crew** | Pity state machine, draw audit log, duplicates and fragments, disclosure screen, roster, Reactor assignment. Appendix B pity tests green. |
| 4–6 | **M3 Fleet** | Hull and modules, formation and stance editor, battle sim, combat log and hash, playback client, preview, batch simulator. **Playtest 2 (H2)** at week 6. |
| 5–8 | **M4 Ground** | Greybox mission rooms, controller and switching, abilities and energy, AI state machine, enemies, caches/threat/extraction, server-side result check. Camera A/B in week 8. **Playtest 3 (H3)**. |
| 9 | **M5 Loop** | Connect the modes with the reward flow and the 30-minute guided session; tune and fix. |
| 10 | **M6 Playtest & report** | **Playtest 4 (H5)** with 8–12 external testers, analytics review, findings report. |
| 11 | **Decision gate** | Go / pivot / cut review against §8. |

M2 and M3 run alongside M1 and M4 with a two-engineer split: one engineer on the simulation core and server (M1 sim, M2, M3 sim, batch tools), the other on the client (M1 UI, M3 playback, M4 ground). The tech artist supports UI in weeks 2–6 and greybox ground art in weeks 5–8.

---

## 7. Acceptance criteria

**Functional.** These are the in-scope Appendix B scenarios, run as automated tests:
- After 59 pulls without a Mythic, the next core draw yields a Mythic and resets the Mythic counter.
- With too few Signal Tokens, a recruitment command debits nothing, grants nothing and leaves pity unchanged.
- When demand exceeds power, lower-priority rooms brown out and life support stays active.
- Two simultaneous fleet commands can't deploy the same fleet twice (optimistic concurrency on the state version).
- The same battle seed and snapshot give an identical result and log hash, on two runs and on two machines.
- Repeating a command with the same idempotency key returns the original result and changes nothing.

**Property tests.** No balance ever goes negative. The ledger replays to the current balances. Pity counters stay within 0–9 and 0–59 for any draw sequence.

**Experience.** The pass bars for H1–H5 in §2.

**Technical.** Desktop build at 60 fps in the ground mission on a mid-range laptop. Save/load round-trips byte-identical. Cold start to playable in under 10 seconds.

---

## 8. Decision gate (week 11)

The team reviews the playtest report, test results and balance sims, and makes one call for each mode:

| Result | Action |
|---|---|
| Hypothesis passes | Carry the mode into the Phase 1 vertical slice as designed. |
| Passes with friction | Carry it forward with a named redesign item (for example "simplify heat to a single per-deck value"). |
| Fails | Cut the mode or rescope it. **Ground ops in particular:** if H3 fails, consider turning ground missions into a fleet-style auto-resolved mode and defer action combat. That would remove a whole engineering discipline from the plan. |

The gate also locks: ground camera, client engine, art direction for the vertical slice, and revised Phase 1 estimates.

**Deliverables at the gate:** the playable build, the test suite, the balance workbook and batch-sim reports, a playtest findings report, and a one-page go/pivot memo.

---

## 9. Open questions found in the GDD

These need a designer's ruling before or during the prototype. They're listed in the order they block work.

| # | Issue | Where | Proposed default |
|---|---|---|---|
| Q1 | **There's no Radiator room.** Heat balance subtracts "radiator removal" and an adjacency bonus names a radiator, but the room catalog has none. | §4 | Add Radiator as a 1×1 room that removes heat and draws a little power. |
| Q2 | **The upgrade-time formula doesn't match its own examples.** `3 × level^1.45 × tier` minutes gives 3 minutes (180 s) at level 1, yet "early upgrades are 30–180 seconds". | §4 | Use seconds for tier 1 (for example `30 × level^1.45`), or a tier multiplier below 1 for early tiers. Decide in the balance workbook. |
| Q3 | **Power is a capacity, water a flow.** The Reactor gives "120 power"; the Condenser gives "80 water/h" and Hydroponics draws "20 water". It isn't clear whether water is stored and what happens on a deficit. | §4 | Power is an instant budget. Water is a per-hour flow into a stored tank, and a deficit drains the tank and then browns out water consumers. |
| Q4 | **Brownout priority ordering is unclear.** "Rooms with power priority below the available budget" doesn't say who sets priority or in what order rooms are cut. | §4 | Fixed priority by room category (life support > production > comfort), which the player can reorder within a category. |
| Q5 | **The battle timeout has no outcome.** The 180-second cap is set but what happens at 180 s isn't. | §8 | Draw on time-out, decided by remaining hull percentage. The attacker loses ties. |
| Q6 | **Phase 0 asks for one Specialist,** but a ground mission needs three. | §9, §20 | 3 Specialists (see §3.3). |
| Q7 | **Heat overflow affects only fabrication.** No other room is affected. Is that intended? | §4 | Keep it as written for the prototype; review after H1. |
| Q8 | **Ground camera** (open design choice). | §22 | Decide by the A/B test in week 8. |
| Q9 | **Asymmetric counter values** (+12% advantage / −8% disadvantage). Is the asymmetry intended? | §8 | Keep it; the batch sim will show whether it's decisive enough for H2. |

---

## 10. Risks during the prototype

| Risk | Likelihood | Mitigation |
|---|---|---|
| Ground mode eats the schedule (it's the only real-time, content-heavy piece). | High | Greybox only, one mission, hard time box. If it slips past week 8, playtest what exists. |
| Determinism breaks across platforms (floating-point drift). | Medium | Integer or fixed-point maths in the battle sim; a cross-machine hash test in CI from M3. |
| Utility management feels like a chore. | Medium | It's H1. Playtest early (week 3) so there's time to simplify. |
| Prototype scope creep toward the vertical slice (galaxy, trade). | Medium | §3.2 is the contract; anything new goes to a Phase 1 backlog. |
| Too few playtesters for reliable signals. | Medium | Recruit 8–12 external testers in week 7, and combine survey answers with recorded sessions. |

---

## 11. What I need from you

1. Approve or adjust the **scope changes** in §3.3.
2. Make the calls on **Q1–Q5** in §9, or accept the proposed defaults.
3. Confirm the **engine direction** (§5.2), and whether VESPER gets its own repository.
4. Confirm **team availability** for a 10-week run.
