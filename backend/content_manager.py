"""
Central content manager for Afterlife: CRUD with reference-aware renames, ordering, validation,
the campaign dry run, code-hook lookup and publishing into the game.
"""

import copy
from pathlib import Path
from typing import Dict, Any, List, Optional

from .schemas import CATEGORIES, LIVE_CATEGORIES, DEFAULT_TEMPLATES, TITLE_FIELD
from .storage import ContentStorage
from .validator import ContentValidator, structural_errors
from . import exporter, hooks
from .campaign_schema import rename_campaign_references


def _rename_in_objectives(objectives, key, old, new):
    for x in objectives or []:
        if x.get(key) == old:
            x[key] = new


def rename_references(content: Dict[str, List[Dict[str, Any]]], category: str, old: str, new: str) -> int:
    """Points every reference to `category`/`old` at `new`. Returns how many references moved."""
    moved = 0

    def swap(obj, key):
        nonlocal moved
        if obj.get(key) == old:
            obj[key] = new
            moved += 1

    def swap_list(obj, key):
        nonlocal moved
        values = obj.get(key)
        if isinstance(values, list) and old in values:
            obj[key] = [new if v == old else v for v in values]
            moved += 1

    if category == "buildables":
        for q in content["quests"]:
            swap_list(q, "unlock")
            before = sum(1 for x in q.get("objectives", []) if x.get("type") == old)
            _rename_in_objectives(q.get("objectives"), "type", old, new)
            moved += before
        for r in content["ranks"]:
            before = sum(1 for x in r.get("milestones", []) if x.get("type") == old)
            _rename_in_objectives(r.get("milestones"), "type", old, new)
            moved += before
        for j in content["jobs"]:
            swap(j, "workplace")
            for role in j.get("roles", []):
                swap(role, "building")
        for t in content["research"]:
            unlocks = t.get("unlocks", [])
            renamed = [new + u[len(old):] if u == old or u.startswith(old + ".") else u for u in unlocks]
            if renamed != unlocks:
                t["unlocks"] = renamed
                moved += 1
    elif category == "ranks":
        for q in content["quests"]:
            swap(q, "rank")
        for m in content["messages"]:
            if m.get("trigger", {}).get("on") == "rank_earned":
                swap(m["trigger"], "ref")
    elif category == "quests":
        for m in content["messages"]:
            if m.get("trigger", {}).get("on") in ("quest_start", "quest_complete"):
                swap(m["trigger"], "ref")
    elif category == "jobs":
        for p in content["job_perks"]:
            swap(p, "job")
    elif category == "research":
        for t in content["research"]:
            swap_list(t, "requires")
    elif category == "survivor_perks":
        for p in content["survivor_perks"]:
            swap_list(p, "requires")
    elif category == "job_perks":
        for p in content["job_perks"]:
            swap(p, "requires")
    elif category == "chapters":
        for q in content["quests"]:
            swap(q, "chapter")
        for m in content["messages"]:
            swap(m, "chapter")
    elif category == "characters":
        for q in content["quests"]:
            swap(q, "giver")
        for m in content["messages"]:
            swap(m, "from")
    elif category == "weapons":
        for e in content["expeditions"]:
            weapon = e.get("weapon")
            if weapon:
                swap_list(weapon, "types")
    elif category.startswith("campaign_"):
        moved += rename_campaign_references(content, category, old, new)
    return moved


def find_references(content: Dict[str, List[Dict[str, Any]]], category: str, item_id: str) -> List[Dict[str, str]]:
    """Which items would be left pointing at nothing if `category`/`item_id` were deleted."""
    probe = copy.deepcopy(content)
    marker = "\u0000deleted"
    refs = []
    rename_references(probe, category, item_id, marker)
    for cat in CATEGORIES:
        for before, after in zip(content[cat], probe[cat]):
            if before != after:
                refs.append({"category": cat, "id": before.get("id"), "name": before.get(TITLE_FIELD.get(cat, "name"), "")})
    return refs


class ContentManager:
    def __init__(self, root_dir: Optional[Path] = None, data_dir: Optional[Path] = None):
        self.root_dir = root_dir or Path(__file__).resolve().parent.parent
        self.data_dir = data_dir or self.root_dir / "backend" / "data"
        self.storage = ContentStorage(self.data_dir)

    # ---- Reading ----
    def get_all(self) -> Dict[str, List[Dict[str, Any]]]:
        return self.storage.load_all()

    def get_category(self, category: str, search: Optional[str] = None, **filters) -> List[Dict[str, Any]]:
        self._require(category)
        items = self.storage.load_category(category)
        if search:
            q = search.lower().strip()
            fields = ("id", "name", "title", "subject", "description", "brief", "subtitle", "summary", "body")
            items = [i for i in items if any(q in str(i.get(f, "")).lower() for f in fields)]
        for key, value in filters.items():
            if value is not None:
                items = [i for i in items if str(i.get(key)) == str(value)]
        return items

    def get_item(self, category: str, item_id: str) -> Optional[Dict[str, Any]]:
        self._require(category)
        return next((i for i in self.storage.load_category(category) if i.get("id") == item_id), None)

    def template(self, category: str) -> Dict[str, Any]:
        self._require(category)
        return copy.deepcopy(DEFAULT_TEMPLATES.get(category, {}))

    # ---- Writing ----
    def create_item(self, category: str, data: Dict[str, Any], position: Optional[int] = None) -> Dict[str, Any]:
        self._require(category)
        items = self.storage.load_category(category)
        item = {"id": data.get("id"), **{k: v for k, v in self.template(category).items() if k not in data}, **data}
        errors = structural_errors(category, item, items)
        if errors:
            raise ValueError(errors[0])
        if position is None or not 0 <= position <= len(items):
            items.append(item)
        else:
            items.insert(position, item)
        self.storage.save_category(category, items)
        return item

    def update_item(self, category: str, item_id: str, data: Dict[str, Any], replace: bool = False) -> Dict[str, Any]:
        """Merges `data` into the item (or replaces it). A changed id renames it everywhere it is referenced."""
        self._require(category)
        content = self.storage.load_all()
        items = content[category]
        idx = next((i for i, item in enumerate(items) if item.get("id") == item_id), -1)
        if idx < 0:
            raise ValueError(f"Item '{item_id}' not found in {category}.")
        updated = dict(data) if replace else {**items[idx], **data}
        updated.setdefault("id", item_id)
        others = items[:idx] + items[idx + 1:]
        errors = structural_errors(category, updated, others)
        if errors:
            raise ValueError(errors[0])
        items[idx] = updated
        moved = 0
        if updated["id"] != item_id:
            moved = rename_references(content, category, item_id, updated["id"])
            self.storage.save_all(content)
        else:
            self.storage.save_category(category, items)
        return {**updated, "_renamedReferences": moved} if moved else updated

    def delete_item(self, category: str, item_id: str, force: bool = False) -> Dict[str, Any]:
        self._require(category)
        content = self.storage.load_all()
        items = content[category]
        if not any(i.get("id") == item_id for i in items):
            raise ValueError(f"Item '{item_id}' not found in {category}.")
        refs = find_references(content, category, item_id)
        if refs and not force:
            names = ", ".join(f"{r['category']}/{r['id']}" for r in refs[:6])
            raise ValueError(f"'{item_id}' is still used by {names}{'…' if len(refs) > 6 else ''}. Delete with force to leave them dangling.")
        self.storage.save_category(category, [i for i in items if i.get("id") != item_id])
        return {"status": "deleted", "id": item_id, "category": category, "danglingReferences": refs}

    def reorder(self, category: str, order: List[str]) -> List[Dict[str, Any]]:
        self._require(category)
        items = self.storage.load_category(category)
        by_id = {i.get("id"): i for i in items}
        if sorted(order) != sorted(by_id):
            raise ValueError("The new order must list every item exactly once.")
        items = [by_id[i] for i in order]
        self.storage.save_category(category, items)
        return items

    def import_content(self, data: Dict[str, Any], mode: str = "merge") -> Dict[str, Any]:
        """'merge' adds or updates items by id; 'replace' swaps out each category it includes."""
        for cat in CATEGORIES:
            incoming = data.get(cat)
            if not isinstance(incoming, list):
                continue
            if mode == "replace":
                self.storage.save_category(cat, incoming)
            else:
                existing = self.storage.load_category(cat)
                index = {i.get("id"): n for n, i in enumerate(existing)}
                for item in incoming:
                    if item.get("id") in index:
                        existing[index[item["id"]]] = item
                    elif item.get("id"):
                        existing.append(item)
                self.storage.save_category(cat, existing)
        return self.validate()

    def reset_defaults(self) -> Dict[str, Any]:
        seed = self.storage.reset_to_seed()
        return {"status": "reset", "total_items": sum(len(v) for v in seed.values())}

    # ---- Analysis ----
    def validate(self) -> Dict[str, Any]:
        return ContentValidator(self.storage.load_all()).validate_all()

    def campaign(self) -> Dict[str, Any]:
        return ContentValidator(self.storage.load_all()).campaign()

    def hooks(self) -> Dict[str, Any]:
        return hooks.scan(self.storage.load_all(), self.root_dir)

    def art(self) -> List[str]:
        """Building sprites the studio can show (web/public/unity/Buildings/*.png, by file stem)."""
        folder = self.root_dir / "web" / "public" / "unity" / "Buildings"
        return sorted(p.stem for p in folder.glob("*.png")) if folder.exists() else []

    def references(self, category: str, item_id: str) -> List[Dict[str, str]]:
        self._require(category)
        return find_references(self.storage.load_all(), category, item_id)

    def get_summary(self) -> Dict[str, Any]:
        content = self.storage.load_all()
        result = ContentValidator(content).validate_all()
        return {
            "total_items": sum(len(v) for v in content.values()),
            "categories": {cat: len(content[cat]) for cat in CATEGORIES},
            "live": sorted(LIVE_CATEGORIES),
            "valid": result["valid"],
            "error_count": result["error_count"],
            "warning_count": result["warning_count"],
            "published": exporter.is_published(content, self.root_dir),
            "output": str(exporter.GENERATED_PATH),
        }

    # ---- Publishing ----
    def preview(self) -> str:
        return exporter.to_module(self.storage.load_all())

    def publish(self) -> Dict[str, Any]:
        content = self.storage.load_all()
        result = ContentValidator(content).validate_all()
        if not result["valid"]:
            raise ValueError(f"Fix {result['error_count']} error(s) before publishing; the game would not load this content.")
        return exporter.publish(content, self.root_dir)

    def _require(self, category: str):
        if category not in CATEGORIES:
            raise KeyError(category)
