"""
Finds where the game's code refers to content by id. Most behaviour (what an upgrade does, how a
building or job post acts) is written in code keyed on the id, so the studio shows whether an
item is wired up, and warns when a purchasable upgrade has no effect anywhere.
"""

import re
from pathlib import Path
from typing import Dict, Any, List

SOURCE_DIRS = ["web/src/engine", "web/src/host", "web/src/hud"]
SKIP = {"gameContent.mjs", "contentData.mjs"}


def _sources(root_dir: Path) -> Dict[str, str]:
    out = {}
    for d in SOURCE_DIRS:
        base = root_dir / d
        if not base.exists():
            continue
        for path in sorted(base.rglob("*")):
            if path.suffix in (".mjs", ".js", ".jsx") and path.name not in SKIP and "vendor" not in path.parts:
                try:
                    out[str(path.relative_to(root_dir))] = path.read_text(encoding="utf-8")
                except OSError:
                    pass
    return out


def _count(pattern: re.Pattern, sources: Dict[str, str]) -> List[Dict[str, Any]]:
    hits = []
    for name, text in sources.items():
        n = len(pattern.findall(text))
        if n:
            hits.append({"file": name, "count": n})
    return hits


def scan(content: Dict[str, List[Dict[str, Any]]], root_dir: Path) -> Dict[str, Any]:
    sources = _sources(root_dir)
    result: Dict[str, Any] = {"buildables": {}, "upgrades": {}, "roles": {}}
    for b in content.get("buildables", []):
        bid = re.escape(b["id"])
        # type === 'x', BUILDINGS.x, case 'x': and { type: 'x' }.
        pattern = re.compile(rf"(?:type\s*[!=]==?\s*'{bid}'|'{bid}'\s*(?:===|!==)\s*\w+\.type|(?:BUILDINGS|BUILDING_TREES)\.{bid}\b|case\s+'{bid}'|\btype:\s*'{bid}')")
        result["buildables"][b["id"]] = _count(pattern, sources)
        for n in b.get("upgrades", []):
            nid = re.escape(n["id"])
            # has(b, 'x'), upgrades.includes('x'), or x: 150 in a per-upgrade table (rules.mjs integrity extras).
            pattern = re.compile(rf"(?:has\([^,()]+,\s*'{nid}'\)|upgrades\.includes\('{nid}'\)|\b{nid}:\s*\d)")
            result["upgrades"][f"{b['id']}.{n['id']}"] = _count(pattern, sources)
    for j in content.get("jobs", []):
        for r in j.get("roles", []):
            rid = re.escape(r["id"])
            pattern = re.compile(rf"(?:role\s*[!=]==?\s*'{rid}'|ROLES\.{rid}\b)")
            result["roles"][r["id"]] = _count(pattern, sources)
    return result
