"""
Validation for Afterlife content: per-item schema checks, cross-references between categories,
prerequisite cycles, and a dry run of the campaign that finds quests or ranks that can never be
completed. Errors block publishing to the game; warnings don't.
"""

import re
from typing import Dict, Any, List, Optional, Set

from .schemas import (
    CATEGORIES, TITLE_FIELD, RESOURCES, STAT_KEYS, OBJECTIVE_KINDS, SURVIVOR_PERK_TYPES,
    RESEARCH_BRANCHES, MESSAGE_TRIGGERS, MESSAGE_TONES, ENGINE_REQUIRED, SHIFT_COUNT,
)

from .campaign_schema import CampaignChecks

ID_PATTERN = re.compile(r"^[a-z][a-z0-9_]*$")
COLOR_PATTERN = re.compile(r"^#[0-9a-fA-F]{6}$")


def is_number(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def structural_errors(category: str, item: Dict[str, Any], others: List[Dict[str, Any]]) -> List[str]:
    """Problems that stop an item being saved at all (everything else is reported, not refused)."""
    errors = []
    item_id = item.get("id")
    if not isinstance(item_id, str) or not ID_PATTERN.match(item_id):
        errors.append("Id must start with a letter and use only lowercase letters, digits and underscores.")
    elif any(o.get("id") == item_id for o in others):
        errors.append(f"An item with id '{item_id}' already exists in {category}.")
    return errors


class ContentValidator(CampaignChecks):
    def __init__(self, content: Dict[str, List[Dict[str, Any]]]):
        self.content = {cat: content.get(cat, []) or [] for cat in CATEGORIES}
        self.errors: List[Dict[str, Any]] = []
        self.warnings: List[Dict[str, Any]] = []
        self.ids = {cat: [i.get("id") for i in items if isinstance(i, dict)] for cat, items in self.content.items()}
        self.buildables = {b.get("id"): b for b in self.content["buildables"]}
        self.roles = {r.get("id"): (j, r) for j in self.content["jobs"] for r in j.get("roles", []) or []}
        self.ranks = [r.get("id") for r in self.content["ranks"]]

    # ---- Reporting ----
    def error(self, cat, item_id, message, field=None):
        self.errors.append({"category": cat, "id": item_id, "field": field, "message": message})

    def warn(self, cat, item_id, message, field=None):
        self.warnings.append({"category": cat, "id": item_id, "field": field, "message": message})

    # ---- Entry point ----
    def validate_all(self) -> Dict[str, Any]:
        self.errors.clear()
        self.warnings.clear()
        for cat in CATEGORIES:
            seen: Set[str] = set()
            for idx, item in enumerate(self.content[cat]):
                item_id = item.get("id") if isinstance(item, dict) else None
                if not isinstance(item_id, str) or not ID_PATTERN.match(item_id):
                    self.error(cat, item_id or f"#{idx + 1}", "Missing or malformed id.", "id")
                    continue
                if item_id in seen:
                    self.error(cat, item_id, f"Duplicate id '{item_id}'.", "id")
                seen.add(item_id)
                name_field = TITLE_FIELD.get(cat, "name")
                name = item.get(name_field)
                if not isinstance(name, str) or not name.strip():
                    self.error(cat, item_id, f"Missing {name_field}.", name_field)
                getattr(self, f"_check_{cat}")(item_id, item)
        self._check_required()
        self._check_campaign()
        self._check_campaign_chain()
        return {
            "valid": not self.errors,
            "error_count": len(self.errors),
            "warning_count": len(self.warnings),
            "errors": self.errors,
            "warnings": self.warnings,
        }

    # ---- Shared field checks ----
    def _resources(self, cat, item_id, field, value, allowed=RESOURCES, required=False):
        if value is None:
            if required:
                self.error(cat, item_id, f"'{field}' is required.", field)
            return
        if not isinstance(value, dict):
            self.error(cat, item_id, f"'{field}' must map resources to amounts.", field)
            return
        for res, amount in value.items():
            if res not in allowed:
                self.error(cat, item_id, f"Unknown resource '{res}' in {field} (use {', '.join(allowed)}).", field)
            elif not is_number(amount) or amount < 0:
                self.error(cat, item_id, f"{field}.{res} must be a number of 0 or more.", field)

    def _ref(self, cat, item_id, field, ref, target, allow_empty=True):
        if ref in (None, "") and allow_empty:
            return
        if ref not in self.ids[target]:
            self.error(cat, item_id, f"{field} refers to unknown {target[:-1] if target.endswith('s') else target} '{ref}'.", field)

    def _positive(self, cat, item_id, item, field, integer=False):
        v = item.get(field)
        if not is_number(v) or v <= 0 or (integer and int(v) != v):
            self.error(cat, item_id, f"'{field}' must be a positive {'whole number' if integer else 'number'}.", field)

    def _objectives(self, cat, item_id, field, objectives, allow_empty=False):
        if not isinstance(objectives, list):
            self.error(cat, item_id, f"'{field}' must be a list.", field)
            return
        if not objectives and not allow_empty:
            self.error(cat, item_id, "Needs at least one objective.", field)
        for x in objectives:
            kind = x.get("kind") if isinstance(x, dict) else None
            if kind not in OBJECTIVE_KINDS:
                self.error(cat, item_id, f"Unknown objective kind '{kind}'.", field)
                continue
            count = x.get("count")
            if not isinstance(count, int) or isinstance(count, bool) or count < 1:
                self.error(cat, item_id, f"Objective '{kind}' needs a whole-number count of 1 or more.", field)
            if kind == "build":
                if x.get("type") not in self.buildables:
                    self.error(cat, item_id, f"Build objective refers to unknown buildable '{x.get('type')}'.", field)
                elif self.buildables[x["type"]].get("fixture"):
                    self.warn(cat, item_id, f"Build objective asks for '{x['type']}', a fixture players can't build.", field)
            if kind == "staff" and x.get("role") not in self.roles:
                self.error(cat, item_id, f"Staff objective refers to unknown job post '{x.get('role')}'.", field)

    # ---- Categories ----
    def _check_buildables(self, item_id, b):
        for field in ("w", "h", "hp"):
            self._positive("buildables", item_id, b, field)
        for field in ("w", "h"):
            if is_number(b.get(field)) and b[field] % 16:
                self.warn("buildables", item_id, f"Footprint {field} {b[field]} is not a multiple of the 16-unit grid.", field)
        self._resources("buildables", item_id, "cost", b.get("cost"), required=True)
        if not COLOR_PATTERN.match(str(b.get("color", ""))):
            self.error("buildables", item_id, "Colour must be a #rrggbb hex value.", "color")
        upgrades = b.get("upgrades", [])
        if not isinstance(upgrades, list):
            self.error("buildables", item_id, "'upgrades' must be a list.", "upgrades")
            return
        nodes = {}
        for node in upgrades:
            nid = node.get("id")
            if not isinstance(nid, str) or not ID_PATTERN.match(nid):
                self.error("buildables", item_id, f"Upgrade with malformed id '{nid}'.", "upgrades")
                continue
            if nid in nodes:
                self.error("buildables", item_id, f"Duplicate upgrade id '{nid}'.", "upgrades")
            nodes[nid] = node
            if not str(node.get("name", "")).strip():
                self.error("buildables", item_id, f"Upgrade '{nid}' needs a name.", "upgrades")
            self._resources("buildables", item_id, "upgrades", node.get("cost"), required=True)
        max_tier = max([r.get("tier", 0) for r in self.content["ranks"] if is_number(r.get("tier"))] or [0])
        for nid, node in nodes.items():
            req = node.get("requires")
            if req and req not in nodes:
                self.error("buildables", item_id, f"Upgrade '{nid}' requires unknown upgrade '{req}'.", "upgrades")
        for nid in nodes:
            depth, seen, n = 1, {nid}, nodes[nid]
            while n.get("requires") in nodes:
                n = nodes[n["requires"]]
                if n["id"] in seen:
                    self.error("buildables", item_id, f"Upgrade chain loops back on '{nid}'.", "upgrades")
                    depth = 0
                    break
                seen.add(n["id"])
                depth += 1
            if depth > max_tier:
                self.error("buildables", item_id, f"Upgrade '{nid}' is tier {depth} but no status unlocks past tier {max_tier}.", "upgrades")

    def _check_jobs(self, item_id, job):
        for field in ("primaryStat", "secondaryStat"):
            if job.get(field) not in STAT_KEYS:
                self.error("jobs", item_id, f"{field} must be one of {', '.join(STAT_KEYS)}.", field)
        roles = job.get("roles", [])
        if not isinstance(roles, list) or not roles:
            self.error("jobs", item_id, "A job needs at least one post (role).", "roles")
            return
        for role in roles:
            rid = role.get("id")
            if not isinstance(rid, str) or not ID_PATTERN.match(rid):
                self.error("jobs", item_id, f"Post with malformed id '{rid}'.", "roles")
                continue
            owners = [j for j in self.content["jobs"] for r in j.get("roles", []) if r.get("id") == rid]
            if len(owners) > 1:
                self.error("jobs", item_id, f"Post id '{rid}' is used more than once across jobs.", "roles")
            if not str(role.get("name", "")).strip():
                self.error("jobs", item_id, f"Post '{rid}' needs a name.", "roles")
            building = role.get("building")
            if building:
                if building not in self.buildables:
                    self.error("jobs", item_id, f"Post '{rid}' works at unknown buildable '{building}'.", "roles")
                    continue
                hosts = [r.get("id") for j in self.content["jobs"] for r in j.get("roles", []) if r.get("building") == building]
                if len(hosts) > 1 and hosts[0] == rid:
                    self.error("jobs", item_id, f"'{building}' hosts more than one post ({', '.join(hosts)}); a buildable can host one.", "roles")
                slots = role.get("slots")
                if not isinstance(slots, int) or slots < 1:
                    self.error("jobs", item_id, f"Post '{rid}' needs at least 1 slot at '{building}'.", "roles")
                if rid == "sentry" and slots != SHIFT_COUNT:
                    self.warn("jobs", item_id, f"Sentries keep {SHIFT_COUNT} shifts; a tower with {slots} slots won't match the shift rota.", "roles")
                tree = {u.get("id") for u in self.buildables[building].get("upgrades", [])}
                for bonus in role.get("slotBonus", []) or []:
                    if bonus.get("upgrade") not in tree:
                        self.error("jobs", item_id, f"Post '{rid}' slot bonus needs unknown {building} upgrade '{bonus.get('upgrade')}'.", "roles")
                    if not isinstance(bonus.get("slots"), int) or bonus["slots"] < 1:
                        self.error("jobs", item_id, f"Post '{rid}' slot bonus must add at least 1 slot.", "roles")
        if job.get("workplace") and job["workplace"] not in self.buildables:
            self.error("jobs", item_id, f"Workplace refers to unknown buildable '{job['workplace']}'.", "workplace")
        levels = [r.get("level") for r in job.get("careerRanks", []) or []]
        if levels != sorted(levels) or len(set(levels)) != len(levels):
            self.warn("jobs", item_id, "Career ranks should have distinct levels in ascending order.", "careerRanks")
        for r in job.get("careerRanks", []) or []:
            for k in (r.get("requiredStats") or {}):
                if k not in STAT_KEYS:
                    self.error("jobs", item_id, f"Career rank '{r.get('title')}' requires unknown stat '{k}'.", "careerRanks")

    def _check_quests(self, item_id, q):
        if q.get("rank") not in self.ranks:
            self.error("quests", item_id, f"Unknown status '{q.get('rank')}'.", "rank")
        self._objectives("quests", item_id, "objectives", q.get("objectives"))
        for t in q.get("unlock", []) or []:
            if t not in self.buildables:
                self.error("quests", item_id, f"Unlocks unknown buildable '{t}'.", "unlock")
            elif self.buildables[t].get("fixture"):
                self.warn("quests", item_id, f"Unlocks '{t}', a fixture that can't be built.", "unlock")
        self._resources("quests", item_id, "reward", q.get("reward"), required=True)
        if not str(q.get("brief", "")).strip():
            self.warn("quests", item_id, "No brief: the player won't be told what to do.", "brief")
        if not str(q.get("log", "")).strip():
            self.warn("quests", item_id, "No journal entry for when it's done.", "log")
        self._ref("quests", item_id, "chapter", q.get("chapter"), "chapters")
        self._ref("quests", item_id, "giver", q.get("giver"), "characters")

    def _check_ranks(self, item_id, r):
        if not isinstance(r.get("tier"), int) or r["tier"] < 0:
            self.error("ranks", item_id, "Tier must be a whole number of 0 or more.", "tier")
        first = self.content["ranks"] and self.content["ranks"][0].get("id") == item_id
        self._objectives("ranks", item_id, "milestones", r.get("milestones", []), allow_empty=first)
        if not first:
            self._resources("ranks", item_id, "reward", r.get("reward"), required=True)

    def _check_research(self, item_id, t):
        if t.get("branch") not in RESEARCH_BRANCHES:
            self.warn("research", item_id, f"Branch '{t.get('branch')}' is not one of {', '.join(RESEARCH_BRANCHES)}.", "branch")
        self._resources("research", item_id, "cost", t.get("cost"), required=True)
        self._positive("research", item_id, t, "hours")
        for req in t.get("requires", []) or []:
            self._ref("research", item_id, "requires", req, "research", allow_empty=False)
        for u in t.get("unlocks", []) or []:
            building, _, upgrade = str(u).partition(".")
            if building not in self.buildables:
                self.error("research", item_id, f"Unlocks unknown buildable '{building}'.", "unlocks")
            elif upgrade and upgrade not in {n.get("id") for n in self.buildables[building].get("upgrades", [])}:
                self.error("research", item_id, f"Unlocks unknown {building} upgrade '{upgrade}'.", "unlocks")
        if not isinstance(t.get("effects", {}), dict):
            self.error("research", item_id, "Effects must map an effect name to a value.", "effects")

    def _check_job_perks(self, item_id, p):
        self._ref("job_perks", item_id, "job", p.get("job"), "jobs", allow_empty=False)
        self._resources("job_perks", item_id, "cost", p.get("cost"), required=True)
        req = p.get("requires")
        if req:
            same_job = {x.get("id") for x in self.content["job_perks"] if x.get("job") == p.get("job")}
            if req not in same_job:
                self.error("job_perks", item_id, f"Requires unknown {p.get('job')} perk '{req}'.", "requires")

    def _check_survivor_perks(self, item_id, p):
        if p.get("category") not in SURVIVOR_PERK_TYPES:
            self.error("survivor_perks", item_id, f"Category must be one of {', '.join(SURVIVOR_PERK_TYPES)}.", "category")
        self._resources("survivor_perks", item_id, "cost", p.get("cost"), allowed=RESOURCES + ["xp"])
        for req in p.get("requires", []) or []:
            self._ref("survivor_perks", item_id, "requires", req, "survivor_perks", allow_empty=False)
        for k in (p.get("statRequirements") or {}):
            if k != "minLevel" and k not in STAT_KEYS:
                self.warn("survivor_perks", item_id, f"Unknown stat requirement '{k}'.", "statRequirements")

    def _check_chapters(self, item_id, c):
        if not isinstance(c.get("act"), int) or c["act"] < 1:
            self.warn("chapters", item_id, "Act should be a whole number from 1.", "act")
        if not any(q.get("chapter") == item_id for q in self.content["quests"]):
            self.warn("chapters", item_id, "No quests are in this chapter yet.", "quests")

    def _check_characters(self, item_id, c):
        if c.get("color") and not COLOR_PATTERN.match(str(c["color"])):
            self.error("characters", item_id, "Colour must be a #rrggbb hex value.", "color")

    def _check_messages(self, item_id, m):
        self._ref("messages", item_id, "from", m.get("from"), "characters", allow_empty=False)
        self._ref("messages", item_id, "chapter", m.get("chapter"), "chapters")
        if m.get("tone", "") not in MESSAGE_TONES:
            self.error("messages", item_id, "Tone must be neutral, good or warn.", "tone")
        if not str(m.get("body", "")).strip():
            self.warn("messages", item_id, "Message has no body.", "body")
        trigger = m.get("trigger") or {}
        on, ref = trigger.get("on"), trigger.get("ref")
        if on not in MESSAGE_TRIGGERS:
            self.error("messages", item_id, f"Unknown trigger '{on}'.", "trigger")
        elif on in ("quest_start", "quest_complete"):
            self._ref("messages", item_id, "trigger", ref, "quests", allow_empty=False)
        elif on == "rank_earned":
            self._ref("messages", item_id, "trigger", ref, "ranks", allow_empty=False)
        elif on == "day" and (not isinstance(trigger.get("day"), int) or trigger["day"] < 1):
            self.error("messages", item_id, "A day trigger needs a day of 1 or more.", "trigger")

    def _check_expeditions(self, item_id, e):
        self._positive("expeditions", item_id, e, "hours")
        self._resources("expeditions", item_id, "cost", e.get("cost"), required=True)
        self._resources("expeditions", item_id, "reward", e.get("reward"), required=True)
        for field in ("risk", "rescueChance"):
            v = e.get(field)
            if not is_number(v) or not 0 <= v <= 1:
                self.error("expeditions", item_id, f"'{field}' must be between 0 and 1.", field)
        recruit = e.get("recruit")
        if not isinstance(recruit, dict) or not str(recruit.get("label", "")).strip():
            self.error("expeditions", item_id, "Needs a recruit label (who might be found).", "recruit")
        else:
            opts = recruit.get("options") or {}
            ranges = {"qualityFloor": (3, 18), "qualityShift": (-15, 15), "budgetBonus": (-13, 13), "levelOverride": (1, 50)}
            for k, v in opts.items():
                if k in ranges:
                    lo, hi = ranges[k]
                    if not isinstance(v, int) or not lo <= v <= hi:
                        self.error("expeditions", item_id, f"Recruit option {k} must be a whole number from {lo} to {hi}.", "recruit")
                elif k in ("forcedPrimaryStat", "forcedSecondaryStat", "forcedWeakStat"):
                    if v not in STAT_KEYS:
                        self.error("expeditions", item_id, f"Recruit option {k} must be a stat.", "recruit")
                else:
                    self.error("expeditions", item_id, f"Unknown recruit option '{k}'.", "recruit")
            forced = [opts.get(k) for k in ("forcedPrimaryStat", "forcedSecondaryStat", "forcedWeakStat") if opts.get(k)]
            if len(set(forced)) != len(forced):
                self.error("expeditions", item_id, "A stat can hold only one forced aptitude.", "recruit")
        weapon = e.get("weapon")
        if weapon:
            v = weapon.get("chance")
            if not is_number(v) or not 0 <= v <= 1:
                self.error("expeditions", item_id, "Weapon find chance must be between 0 and 1.", "weapon")
            types = weapon.get("types") or []
            if not types:
                self.error("expeditions", item_id, "Weapon finds need at least one weapon type.", "weapon")
            for t in types:
                if t not in self.ids["weapons"] or t == "fists":
                    self.error("expeditions", item_id, f"Weapon find refers to unknown weapon '{t}'.", "weapon")

    def _check_weapons(self, item_id, w):
        for field in ("damage", "range", "cooldown"):
            self._positive("weapons", item_id, w, field)
        if not isinstance(w.get("melee"), bool):
            self.error("weapons", item_id, "'melee' must be true or false.", "melee")
        # Campaign gear is made from a campaign recipe instead of bought at the workshop.
        if w.get("recipe"):
            self._ref("weapons", item_id, "recipe", w.get("recipe"), "campaign_recipes")
            self._resources("weapons", item_id, "cost", w.get("cost"))
        elif item_id != "fists":
            self._resources("weapons", item_id, "cost", w.get("cost"), required=True)

    # ---- Engine dependencies ----
    def _check_required(self):
        for bid in ENGINE_REQUIRED["buildables"]:
            if bid not in self.buildables:
                self.error("buildables", bid, f"The engine needs a buildable with id '{bid}'.", "id")
        for rid in ENGINE_REQUIRED["roles"]:
            if rid not in self.roles:
                self.error("jobs", rid, f"The engine needs a job post with id '{rid}'.", "roles")
        for wid in ENGINE_REQUIRED["weapons"]:
            if wid not in self.ids["weapons"]:
                self.error("weapons", wid, f"The engine needs a weapon with id '{wid}'.", "id")
        if not self.content["ranks"]:
            self.error("ranks", "ranks", "At least one status is needed.")
        elif self.content["ranks"][0].get("milestones"):
            self.warn("ranks", self.ranks[0], "The first status is where a run starts; its milestones are never checked.", "milestones")
        tiers = [r.get("tier") for r in self.content["ranks"] if isinstance(r.get("tier"), int)]
        if tiers != sorted(tiers):
            self.warn("ranks", "ranks", "Status tiers go down somewhere; a later status would allow fewer upgrades.")
        seen: Dict[str, str] = {}
        for q in self.content["quests"]:
            for t in q.get("unlock", []) or []:
                if t in seen:
                    self.warn("quests", q.get("id"), f"'{t}' is already unlocked by quest '{seen[t]}'.", "unlock")
                seen.setdefault(t, q.get("id"))

    # ---- Campaign dry run ----
    def campaign(self) -> Dict[str, Any]:
        """
        Plays the quest chain and status ladder forward, assuming the player can meet any objective
        whose structures are available. Returns the order things happen in and where it gets stuck.
        """
        quests, ranks = self.content["quests"], self.content["ranks"]
        rank_index = {rid: i for i, rid in enumerate(self.ranks)}
        locked_by = {}
        for q in quests:
            for t in q.get("unlock", []) or []:
                locked_by.setdefault(t, q.get("id"))
        unlocked: Set[str] = set()
        steps: List[Dict[str, Any]] = []
        role_building = {rid: r.get("building") for rid, (_, r) in self.roles.items()}

        def blockers(objectives) -> List[str]:
            out = []
            for x in objectives or []:
                need = x.get("type") if x.get("kind") == "build" else role_building.get(x.get("role")) if x.get("kind") == "staff" else None
                if need and need in locked_by and need not in unlocked:
                    out.append(need)
            return out

        qi, rank = 0, 0
        while True:
            q = quests[qi] if qi < len(quests) else None
            q_rank = rank_index.get(q.get("rank"), 0) if q else None
            if q and q_rank <= rank and not blockers(q.get("objectives")):
                unlocked.update(q.get("unlock", []) or [])
                steps.append({"kind": "quest", "id": q.get("id"), "rank": self.ranks[rank] if ranks else ""})
                qi += 1
                continue
            if rank + 1 < len(ranks) and not blockers(ranks[rank + 1].get("milestones")):
                rank += 1
                steps.append({"kind": "rank", "id": self.ranks[rank]})
                continue
            break
        stuck = []
        if qi < len(quests):
            q = quests[qi]
            need = blockers(q.get("objectives"))
            if need:
                stuck.append({"category": "quests", "id": q.get("id"), "message": f"Quest '{q.get('id')}' needs {', '.join(need)}, which no earlier quest unlocks."})
            elif rank + 1 < len(ranks):
                r = ranks[rank + 1]
                stuck.append({"category": "ranks", "id": r.get("id"), "message": f"Quest '{q.get('id')}' waits for {r.get('name')} status, whose milestones need {', '.join(blockers(r.get('milestones')))}, which is still locked."})
            else:
                stuck.append({"category": "quests", "id": q.get("id"), "message": f"Quest '{q.get('id')}' needs a status the ladder never reaches."})
        elif rank + 1 < len(ranks):
            r = ranks[rank + 1]
            stuck.append({"category": "ranks", "id": r.get("id"), "message": f"{r.get('name')} status can never be earned: its milestones need {', '.join(blockers(r.get('milestones')))}, which no quest unlocks."})
        never = [t for t in locked_by if t not in unlocked]
        return {"steps": steps, "stuck": stuck, "never_unlocked": never, "unlocked": sorted(unlocked)}

    def _check_campaign(self):
        if not self.content["ranks"]:
            return
        for s in self.campaign()["stuck"]:
            self.error(s["category"], s["id"], "Campaign dead end: " + s["message"])
