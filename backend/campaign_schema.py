"""
The AfterLife campaign's content (Phases 0-2): resources, structures, recipes, equipment, regional
sites, authored expeditions, the task chain with its certifications, copy and every tuning number.

Each category is a list of items with ids, like the rest of the studio's content. They are exported
together as CAMPAIGN in gameContent.mjs. Copy the design document doesn't supply is written in its
voice and marked: strings carry `source: "generated"` and tasks and expeditions list the generated
fields in `generated`.
"""

from typing import Dict, Any, List, Set

CAMPAIGN_CATEGORIES: List[str] = [
    "campaign_resources",
    "campaign_difficulties",
    "campaign_traits",
    "campaign_jobs",
    "campaign_buildings",
    "campaign_items",
    "campaign_recipes",
    "campaign_sites",
    "campaign_expeditions",
    "campaign_tasks",
    "campaign_strings",
    "campaign_tuning",
]

CAMPAIGN_TITLE_FIELD = {"campaign_tasks": "title", "campaign_strings": "id"}

# The ledger the engine is written against: removing one breaks the game.
CAMPAIGN_RESOURCES = ["wood", "scrap_metal", "food", "ammo", "medical_supplies", "cloth", "components",
                      "seed_packets", "raw_salvage", "planks", "metal_parts", "equipment"]
STAT_KEYS4 = ["str", "end", "agi", "int"]
ITEM_KINDS = ["melee", "firearm", "medical"]
TRAIT_TYPES = ["bonus", "drawback"]
SITE_KINDS = ["scavenging", "route", "story"]
SITE_BANDS = ["near", "mid", "far"]
POI_TYPES = ["town", "farm", "gas", "ruin", "chapel", "camp", "industrial", "stop", "wild"]
OBJECTIVE_TYPES = ["interaction", "build", "staff", "predicate", "continuous_time",
                   "cumulative_gather", "cumulative_harvest", "cumulative_craft", "cumulative_process"]
CONDITION_OPS = [">=", ">", "<=", "<", "==", "true", "false", "includesAll"]
STRING_SOURCES = ["spec", "generated"]
TASK_KINDS = ["main", "side"]
# Kinds of work the labor factor scales; tuning.labor.attributeFor maps each to its attribute.
WORK_CATEGORIES = ["gather", "build", "craft", "treat", "farm", "food", "scavenge"]
TRAIT_MODIFIERS = ["labor", "maxHp", "detection", "fatigueCost"]

CAMPAIGN_TEMPLATES: Dict[str, Dict[str, Any]] = {
    "campaign_resources": {"name": "New Resource", "weight": 1.0, "category": "raw"},
    "campaign_difficulties": {"name": "New Difficulty", "resourceMult": 1.0, "threatMult": 1.0, "biteChance": 0.05, "recruitChance": 0.75, "description": ""},
    "campaign_traits": {"name": "New Trait", "type": "bonus", "effect": "", "modifiers": {}},
    "campaign_jobs": {"name": "New Job", "attribute": "str", "multiplier": 1.0, "multiplierAppliesTo": [], "role": None},
    "campaign_buildings": {"code": "B99", "name": "New Structure", "phase": 1, "unlockedBy": "p1_01", "cost": {"wood": 10}, "tokens": {},
                           "laborHours": 1.0, "tiles": {"w": 2, "h": 2}, "hp": 100, "workerSlots": 0, "job": None, "capacity": {}, "effect": ""},
    "campaign_items": {"name": "New Item", "kind": "melee", "weight": 2, "damage": 5, "cooldown": 1.5, "reachTiles": 1},
    "campaign_recipes": {"code": "C99", "name": "New Recipe", "station": "field_workbench", "unlockedBy": "p1_04", "inputs": {"wood": 1},
                         "itemInputs": {}, "output": {"resource": "planks", "count": 1}, "laborHours": 1.0, "effect": ""},
    "campaign_sites": {"name": "New Site", "kind": "scavenging", "band": "mid", "preferredPoiTypes": ["town"], "unlockedBy": "p2_02",
                       "siteWorkHours": 2, "stock": {"food": 5}, "bonusRange": None, "recurring": False, "cooldownHours": 0,
                       "baseEventChance": 0.2, "tutorialSafe": False, "description": ""},
    "campaign_expeditions": {"code": "E99", "name": "New Expedition", "site": "", "unlockedBy": "p2_09", "objective": "", "siteWorkHours": 4,
                             "team": [3, 4], "provisions": {}, "rationsPerPersonPerDay": 1, "reward": {}, "tokens": [], "briefing": "",
                             "encounter": {"title": "", "text": "", "choices": []}, "report": ""},
    "campaign_tasks": {"code": "P9-99", "title": "New Task", "phase": 1, "kind": "main", "predecessors": [], "copy": {"body": ""},
                       "objectives": [], "reward": {}, "effects": {},
                       "unlocks": {"buildings": [], "jobs": [], "recipes": [], "modules": [], "commands": [], "routes": [], "expeditions": []}},
    "campaign_strings": {"group": "messages", "text": "", "source": "generated"},
    "campaign_tuning": {"name": "New Tuning Group", "values": {}},
}


def _num(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool)


class CampaignChecks:
    """Mixed into ContentValidator: one _check_<category> per campaign category, plus the chain check."""

    def _cids(self, cat) -> Set[str]:
        return set(self.ids.get(cat, []))

    def _camp_amounts(self, cat, item_id, field, value, allowed, what="resource"):
        if value in (None, {}):
            return
        if not isinstance(value, dict):
            self.error(cat, item_id, f"'{field}' must map {what}s to amounts.", field)
            return
        for k, n in value.items():
            if k not in allowed:
                self.error(cat, item_id, f"Unknown {what} '{k}' in {field}.", field)
            elif not _num(n) or n < 0:
                self.error(cat, item_id, f"{field}.{k} must be a number of 0 or more.", field)

    def _camp_task_ref(self, cat, item_id, field, ref, allow_starter=False):
        if allow_starter and ref == "starter":
            return
        if ref not in self._cids("campaign_tasks"):
            self.error(cat, item_id, f"{field} refers to unknown task '{ref}'.", field)

    @property
    def _camp_resources(self) -> Set[str]:
        return self._cids("campaign_resources")

    def _check_campaign_resources(self, item_id, r):
        if not _num(r.get("weight")) or r["weight"] <= 0:
            self.error("campaign_resources", item_id, "'weight' must be a positive number.", "weight")

    def _check_campaign_difficulties(self, item_id, d):
        for f in ("resourceMult", "threatMult", "biteChance", "recruitChance"):
            if not _num(d.get(f)) or d[f] < 0:
                self.error("campaign_difficulties", item_id, f"'{f}' must be a number of 0 or more.", f)

    def _check_campaign_traits(self, item_id, t):
        if t.get("type") not in TRAIT_TYPES:
            self.error("campaign_traits", item_id, f"'type' must be one of {', '.join(TRAIT_TYPES)}.", "type")
        mods = t.get("modifiers") or {}
        for k, v in mods.items():
            if k not in TRAIT_MODIFIERS:
                self.error("campaign_traits", item_id, f"Unknown modifier '{k}' (use {', '.join(TRAIT_MODIFIERS)}).", "modifiers")
            elif k == "labor":
                for cat, n in (v or {}).items():
                    if cat not in WORK_CATEGORIES or not _num(n):
                        self.error("campaign_traits", item_id, f"Labor modifier needs a work category ({', '.join(WORK_CATEGORIES)}) and a number.", "modifiers")
            elif not _num(v):
                self.error("campaign_traits", item_id, f"Modifier '{k}' must be a number.", "modifiers")

    def _check_campaign_jobs(self, item_id, j):
        if j.get("attribute") not in STAT_KEYS4:
            self.error("campaign_jobs", item_id, f"'attribute' must be one of {', '.join(STAT_KEYS4)}.", "attribute")
        if not _num(j.get("multiplier")) or j["multiplier"] <= 0:
            self.error("campaign_jobs", item_id, "'multiplier' must be a positive number.", "multiplier")
        if j.get("workCategory") is not None and j["workCategory"] not in WORK_CATEGORIES:
            self.error("campaign_jobs", item_id, f"'workCategory' must be one of {', '.join(WORK_CATEGORIES)} or empty.", "workCategory")
        for cat in j.get("multiplierAppliesTo") or []:
            if cat not in WORK_CATEGORIES:
                self.error("campaign_jobs", item_id, f"multiplierAppliesTo lists unknown work '{cat}'.", "multiplierAppliesTo")

    def _check_campaign_buildings(self, item_id, b):
        cat = "campaign_buildings"
        self._camp_amounts(cat, item_id, "cost", b.get("cost"), self._camp_resources)
        self._camp_task_ref(cat, item_id, "unlockedBy", b.get("unlockedBy"), allow_starter=True)
        tiles = b.get("tiles") or {}
        if not all(isinstance(tiles.get(k), int) and tiles.get(k) > 0 for k in ("w", "h")):
            self.error(cat, item_id, "'tiles' needs whole-number w and h.", "tiles")
        for f in ("hp", "laborHours"):
            if not _num(b.get(f)) or b[f] < 0:
                self.error(cat, item_id, f"'{f}' must be a number of 0 or more.", f)
        if b.get("job") and b["job"] not in self._cids("campaign_jobs"):
            self.error(cat, item_id, f"'job' refers to unknown campaign job '{b['job']}'.", "job")

    def _check_campaign_items(self, item_id, i):
        if i.get("kind") not in ITEM_KINDS:
            self.error("campaign_items", item_id, f"'kind' must be one of {', '.join(ITEM_KINDS)}.", "kind")

    def _check_campaign_recipes(self, item_id, r):
        cat = "campaign_recipes"
        if r.get("station") not in self._cids("campaign_buildings"):
            self.error(cat, item_id, f"'station' refers to unknown structure '{r.get('station')}'.", "station")
        self._camp_task_ref(cat, item_id, "unlockedBy", r.get("unlockedBy"))
        self._camp_amounts(cat, item_id, "inputs", r.get("inputs"), self._camp_resources)
        self._camp_amounts(cat, item_id, "itemInputs", r.get("itemInputs"), self._cids("campaign_items"), "item")
        out = r.get("output") or {}
        if out.get("item") not in self._cids("campaign_items") and out.get("resource") not in self._camp_resources:
            self.error(cat, item_id, "'output' needs an existing item or resource.", "output")
        if not isinstance(out.get("count"), int) or out["count"] < 1:
            self.error(cat, item_id, "'output.count' must be a whole number of 1 or more.", "output")
        if not _num(r.get("laborHours")) or r["laborHours"] <= 0:
            self.error(cat, item_id, "'laborHours' must be positive.", "laborHours")

    def _check_campaign_sites(self, item_id, s):
        cat = "campaign_sites"
        if s.get("kind") not in SITE_KINDS:
            self.error(cat, item_id, f"'kind' must be one of {', '.join(SITE_KINDS)}.", "kind")
        if s.get("band") not in SITE_BANDS:
            self.error(cat, item_id, f"'band' must be one of {', '.join(SITE_BANDS)}.", "band")
        for t in s.get("preferredPoiTypes") or []:
            if t not in POI_TYPES:
                self.error(cat, item_id, f"Unknown map location type '{t}'.", "preferredPoiTypes")
        self._camp_task_ref(cat, item_id, "unlockedBy", s.get("unlockedBy"))
        self._camp_amounts(cat, item_id, "stock", s.get("stock"), self._camp_resources)
        if s.get("kind") == "story" and s.get("expedition") not in self._cids("campaign_expeditions"):
            self.error(cat, item_id, "A story site needs an existing 'expedition'.", "expedition")

    def _check_campaign_expeditions(self, item_id, e):
        cat = "campaign_expeditions"
        if e.get("site") not in self._cids("campaign_sites"):
            self.error(cat, item_id, f"'site' refers to unknown site '{e.get('site')}'.", "site")
        self._camp_task_ref(cat, item_id, "unlockedBy", e.get("unlockedBy"))
        self._camp_amounts(cat, item_id, "provisions", e.get("provisions"), self._camp_resources)
        self._camp_amounts(cat, item_id, "reward", e.get("reward"), self._camp_resources)
        self._camp_amounts(cat, item_id, "itemProvisions", e.get("itemProvisions"), self._cids("campaign_items"), "item")
        for s in e.get("reveals") or []:
            if s not in self._cids("campaign_sites"):
                self.error(cat, item_id, f"'reveals' refers to unknown site '{s}'.", "reveals")
        choices = (e.get("encounter") or {}).get("choices") or []
        if not choices:
            self.error(cat, item_id, "The encounter needs at least one choice.", "encounter")
        for c in choices:
            self._camp_amounts(cat, item_id, "encounter", c.get("grant"), self._camp_resources)
            self._camp_amounts(cat, item_id, "encounter", c.get("consumeItems"), self._cids("campaign_items"), "item")
            if not c.get("id") or not c.get("label") or not c.get("result"):
                self.error(cat, item_id, "Every encounter choice needs an id, a label and a result.", "encounter")

    def _check_campaign_tasks(self, item_id, t):
        cat = "campaign_tasks"
        if t.get("kind") not in TASK_KINDS:
            self.error(cat, item_id, f"'kind' must be one of {', '.join(TASK_KINDS)}.", "kind")
        for p in t.get("predecessors") or []:
            self._camp_task_ref(cat, item_id, "predecessors", p)
        if t.get("kind") == "side" and not t.get("trigger"):
            self.error(cat, item_id, "A side task needs a trigger.", "trigger")
        for c in t.get("trigger") or []:
            self._camp_condition(item_id, "trigger", c)
        for o in t.get("objectives") or []:
            kind = o.get("type")
            if kind not in OBJECTIVE_TYPES:
                self.error(cat, item_id, f"Unknown objective type '{kind}'.", "objectives")
                continue
            target = o.get("target")
            if kind == "build" and target not in self._cids("campaign_buildings"):
                self.error(cat, item_id, f"Build objective refers to unknown structure '{target}'.", "objectives")
            if kind == "staff" and o.get("role") not in self._cids("campaign_jobs"):
                self.error(cat, item_id, f"Staff objective refers to unknown job '{o.get('role')}'.", "objectives")
            if kind in ("cumulative_gather", "cumulative_harvest", "cumulative_process") and target not in self._camp_resources:
                self.error(cat, item_id, f"Objective refers to unknown resource '{target}'.", "objectives")
            if kind == "cumulative_craft" and target not in self._camp_resources | self._cids("campaign_items"):
                self.error(cat, item_id, f"Craft objective refers to unknown item '{target}'.", "objectives")
            if kind == "cumulative_harvest" and o.get("building") not in self._cids("campaign_buildings"):
                self.error(cat, item_id, f"Harvest objective refers to unknown structure '{o.get('building')}'.", "objectives")
            if kind == "predicate" and not o.get("conditions"):
                self.error(cat, item_id, f"Predicate objective '{o.get('id')}' needs conditions.", "objectives")
            for c in o.get("conditions") or []:
                self._camp_condition(item_id, "objectives", c)
        self._camp_amounts(cat, item_id, "reward", t.get("reward"), self._camp_resources)
        unlocks = t.get("unlocks") or {}
        for field, target in (("buildings", "campaign_buildings"), ("jobs", "campaign_jobs"), ("recipes", "campaign_recipes"),
                              ("routes", "campaign_sites"), ("expeditions", "campaign_expeditions")):
            for ref in unlocks.get(field) or []:
                if ref not in self._cids(target):
                    self.error(cat, item_id, f"unlocks.{field} refers to unknown '{ref}'.", "unlocks")
        cert = t.get("certification")
        if cert:
            if not _num(cert.get("holdHours")) or cert["holdHours"] <= 0:
                self.error(cat, item_id, "certification.holdHours must be positive.", "certification")
            for c in cert.get("conditions") or []:
                self._camp_condition(item_id, "certification", c)

    def _camp_condition(self, item_id, field, c):
        if not isinstance(c, dict) or not c.get("metric") or c.get("op") not in CONDITION_OPS:
            self.error("campaign_tasks", item_id, f"Malformed condition {c!r}: needs a metric and an op ({', '.join(CONDITION_OPS)}).", field)
            return
        if c["op"] in (">=", ">", "<=", "<", "==") and not _num(c.get("value")) and not c.get("ref"):
            self.error("campaign_tasks", item_id, f"Condition on '{c['metric']}' needs a number value or a ref metric.", field)
        if c["op"] == "includesAll":
            target = "campaign_expeditions" if c["metric"] == "expeditionsCompleted" else "campaign_tasks"
            for ref in c.get("value") or []:
                if ref not in self._cids(target):
                    self.error("campaign_tasks", item_id, f"Condition lists unknown '{ref}'.", field)

    def _check_campaign_strings(self, item_id, s):
        if not isinstance(s.get("text"), str) or not s["text"].strip():
            self.error("campaign_strings", item_id, "'text' is empty.", "text")
        if s.get("source") not in STRING_SOURCES:
            self.error("campaign_strings", item_id, "'source' must be 'spec' or 'generated'.", "source")

    def _check_campaign_tuning(self, item_id, t):
        if not isinstance(t.get("values"), dict) or not t["values"]:
            self.error("campaign_tuning", item_id, "'values' must be a non-empty object.", "values")

    # ---- The task chain ----
    def _check_campaign_chain(self):
        """Main tasks form one acyclic chain from a root, and every unlock points at a task that exists."""
        tasks = {t.get("id"): t for t in self.content["campaign_tasks"] if t.get("kind") == "main"}
        for rid in CAMPAIGN_RESOURCES:
            if self.content["campaign_resources"] and rid not in self._camp_resources:
                self.error("campaign_resources", rid, f"The campaign ledger needs a resource with id '{rid}'.", "id")
        state: Dict[str, int] = {}

        def visit(tid, trail):
            if state.get(tid) == 2:
                return
            if state.get(tid) == 1:
                self.error("campaign_tasks", tid, "Task predecessors form a cycle: " + " → ".join(trail + [tid]) + ".", "predecessors")
                return
            state[tid] = 1
            for p in (tasks.get(tid) or {}).get("predecessors") or []:
                if p in tasks:
                    visit(p, trail + [tid])
            state[tid] = 2

        for tid in tasks:
            visit(tid, [])
        if tasks and not any(not t.get("predecessors") for t in tasks.values()):
            self.error("campaign_tasks", next(iter(tasks)), "No main task is free of predecessors, so the campaign can't start.", "predecessors")
        # Build objectives must ask for a structure unlocked by this task or one before it.
        order = {tid: i for i, tid in enumerate(self.ids["campaign_tasks"])}
        unlocked_at = {b.get("id"): order.get(b.get("unlockedBy"), -1) for b in self.content["campaign_buildings"]}
        for tid, t in tasks.items():
            for o in t.get("objectives") or []:
                if o.get("type") == "build" and unlocked_at.get(o.get("target"), -1) > order.get(tid, 0):
                    self.error("campaign_tasks", tid, f"Asks for '{o['target']}', which a later task unlocks.", "objectives")


def rename_campaign_references(content: Dict[str, List[Dict[str, Any]]], category: str, old: str, new: str) -> int:
    """The campaign half of rename_references: points every reference to `category`/`old` at `new`."""
    moved = 0

    def swap(obj, key):
        nonlocal moved
        if isinstance(obj, dict) and obj.get(key) == old:
            obj[key] = new
            moved += 1

    def swap_list(obj, key):
        nonlocal moved
        values = obj.get(key) if isinstance(obj, dict) else None
        if isinstance(values, list) and old in values:
            obj[key] = [new if v == old else v for v in values]
            moved += 1

    tasks = content.get("campaign_tasks", [])
    if category == "campaign_tasks":
        for t in tasks:
            swap_list(t, "predecessors")
            for c in (t.get("certification") or {}).get("conditions") or []:
                if c.get("metric") == "tasksCompleted":
                    swap_list(c, "value")
            for c in t.get("trigger") or []:
                swap(c, "task")
        for cat in ("campaign_buildings", "campaign_recipes", "campaign_sites", "campaign_expeditions"):
            for x in content.get(cat, []):
                swap(x, "unlockedBy")
    elif category == "campaign_buildings":
        for t in tasks:
            swap_list(t.get("unlocks") or {}, "buildings")
            for o in t.get("objectives") or []:
                if o.get("type") == "build":
                    swap(o, "target")
                swap(o, "building")
        for r in content.get("campaign_recipes", []):
            swap(r, "station")
    elif category == "campaign_items":
        for r in content.get("campaign_recipes", []):
            swap(r.get("output") or {}, "item")
            if old in (r.get("itemInputs") or {}):
                r["itemInputs"][new] = r["itemInputs"].pop(old)
                moved += 1
        for t in tasks:
            for o in t.get("objectives") or []:
                if o.get("type") == "cumulative_craft":
                    swap(o, "target")
    elif category == "campaign_recipes":
        for t in tasks:
            swap_list(t.get("unlocks") or {}, "recipes")
    elif category == "campaign_jobs":
        for b in content.get("campaign_buildings", []):
            swap(b, "job")
        for t in tasks:
            swap_list(t.get("unlocks") or {}, "jobs")
            for o in t.get("objectives") or []:
                if o.get("type") == "staff":
                    swap(o, "role")
    elif category == "campaign_sites":
        for e in content.get("campaign_expeditions", []):
            swap(e, "site")
            swap_list(e, "reveals")
        for t in tasks:
            swap_list(t.get("unlocks") or {}, "routes")
    elif category == "campaign_expeditions":
        for s in content.get("campaign_sites", []):
            swap(s, "expedition")
        for t in tasks:
            swap_list(t.get("unlocks") or {}, "expeditions")
            for c in (t.get("certification") or {}).get("conditions") or []:
                if c.get("metric") == "expeditionsCompleted":
                    swap_list(c, "value")
    return moved


def campaign_tables(content: Dict[str, List[Dict[str, Any]]]) -> Dict[str, Any]:
    """The CAMPAIGN export: lookups by id, the task chain in order, strings by id and tuning by group."""
    by_id = lambda cat: {x["id"]: {k: v for k, v in x.items() if k not in ("id", "generated")} for x in content.get(cat, [])}
    strings = content.get("campaign_strings", [])
    return {
        "resources": by_id("campaign_resources"),
        "difficulties": by_id("campaign_difficulties"),
        "traits": by_id("campaign_traits"),
        "jobs": by_id("campaign_jobs"),
        "buildings": by_id("campaign_buildings"),
        "items": by_id("campaign_items"),
        "recipes": by_id("campaign_recipes"),
        "sites": by_id("campaign_sites"),
        "expeditions": by_id("campaign_expeditions"),
        "tasks": [{k: v for k, v in t.items() if k != "generated"} for t in content.get("campaign_tasks", [])],
        "strings": {s["id"]: s["text"] for s in strings},
        "letter": [{"id": s["id"], "title": s.get("title", ""), "text": s["text"]} for s in strings if s.get("group") == "appendix_a" and s["id"].startswith("letter_section_")],
        "tuning": {t["id"]: t.get("values", {}) for t in content.get("campaign_tuning", [])},
    }
