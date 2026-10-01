"""
Content categories, vocabularies and blank templates for the Afterlife content studio.

The live categories are published into web/src/engine/gameContent.mjs and drive the game:
buildables (with their upgrade trees), jobs (with the posts that tie them to buildables),
quests, ranks, expeditions and weapons. The rest (research, perks and the story) are authored
here and exported alongside for systems the engine does not have yet.
"""

from typing import Dict, Any, List

from .campaign_schema import CAMPAIGN_CATEGORIES, CAMPAIGN_TITLE_FIELD, CAMPAIGN_TEMPLATES

CATEGORIES: List[str] = [
    "buildables",
    "jobs",
    "quests",
    "ranks",
    "research",
    "job_perks",
    "survivor_perks",
    "chapters",
    "characters",
    "messages",
    "expeditions",
    "weapons",
    *CAMPAIGN_CATEGORIES,
]

# Categories the engine reads. Everything else is exported for reference only.
LIVE_CATEGORIES = {"buildables", "jobs", "quests", "ranks", "expeditions", "weapons"}

# Where a category's display name lives.
TITLE_FIELD = {"quests": "title", "chapters": "title", "messages": "subject", **CAMPAIGN_TITLE_FIELD}

RESOURCES = ["wood", "scrap_metal", "food"]
STAT_KEYS = ["str", "agi", "end", "int", "cha"]
OBJECTIVE_KINDS = ["fell", "build", "staff", "survivors", "day", "kills", "upgrades", "land"]
SURVIVOR_PERK_TYPES = ["combat", "survival", "work", "leadership"]
RESEARCH_BRANCHES = ["defense", "industry", "medicine", "recon"]
MESSAGE_TRIGGERS = ["game_start", "quest_start", "quest_complete", "rank_earned", "day", "event", "manual"]
MESSAGE_TONES = ["", "good", "warn"]

# Ids the engine's code depends on by name: removing one breaks the game.
ENGINE_REQUIRED = {
    "buildables": ["core", "campfire", "tent", "cache", "workbench", "barricade", "gate", "tower", "dorm"],
    "roles": ["patrol", "scavenger", "guard", "sentry", "medic", "engineer", "farmer", "logger"],
    "weapons": ["fists"],
}
# A watchtower is kept in three 8-hour shifts, one sentry each (data.mjs SHIFTS).
SHIFT_COUNT = 3

DEFAULT_TEMPLATES: Dict[str, Dict[str, Any]] = {
    "buildables": {
        "name": "New Structure", "subtitle": "What it does, in one line", "w": 32, "h": 16, "hp": 150,
        "cost": {"wood": 20}, "icon": "▦", "color": "#9a8157", "upgrades": [],
    },
    "jobs": {
        "name": "New Job", "icon": "◆", "description": "", "scaling": "", "workplaceName": "", "workplaceBonus": "",
        "primaryStat": "str", "secondaryStat": "end", "careerRanks": [], "roles": [],
    },
    "quests": {
        "rank": "camp", "title": "New Orders", "brief": "What Command wants done, and why.",
        "objectives": [{"kind": "build", "count": 1, "type": "farm"}], "unlock": [], "reward": {"wood": 10},
        "log": "", "chapter": "", "giver": "command",
    },
    "ranks": {
        "name": "New Status", "tier": 2, "blurb": "", "milestones": [{"kind": "day", "count": 20}],
        "reward": {"wood": 50}, "log": "",
    },
    "research": {
        "name": "New Research", "icon": "⚗", "branch": "industry", "description": "", "cost": {"wood": 30, "scrap_metal": 20},
        "hours": 4, "requires": [], "effects": {}, "unlocks": [],
    },
    "job_perks": {
        "job": "guard", "name": "New Job Perk", "description": "", "tier": 1, "requires": None,
        "cost": {"wood": 25, "scrap_metal": 15}, "perkEffect": {}, "icon": "◆",
    },
    "survivor_perks": {
        "name": "New Survivor Perk", "description": "", "category": "combat", "tier": 1, "icon": "◆",
        "cost": {"xp": 50}, "statRequirements": {"minLevel": 1}, "effects": {}, "requires": [], "tags": [],
    },
    "chapters": {"title": "New Chapter", "act": 1, "summary": "", "goal": "", "notes": ""},
    "characters": {"name": "New Character", "title": "", "faction": "", "icon": "◆", "color": "#9fa8a3", "bio": "", "inGame": ""},
    "messages": {
        "from": "command", "subject": "New message", "body": "", "tone": "",
        "trigger": {"on": "manual", "ref": "", "day": 0}, "chapter": "",
    },
    "expeditions": {
        "name": "New Expedition", "description": "", "hours": 4, "cost": {"food": 8}, "reward": {"wood": 30},
        "risk": 0.2, "rescueChance": 0.1, "recruit": {"label": "Stranger", "options": {}},
    },
    "weapons": {"name": "New Weapon", "melee": True, "damage": 10, "range": 30, "cooldown": 1.0, "cost": {"scrap_metal": 10}},
    **CAMPAIGN_TEMPLATES,
}
