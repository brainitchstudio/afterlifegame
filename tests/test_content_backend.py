"""
Tests for the Afterlife content studio backend: validation, the campaign dry run, reference-aware
renames and deletes, publishing into the engine, and the REST API. Each test works on a copy of
the shipped content in a temporary directory.
"""

import copy
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend import exporter
from backend.api_handler import ContentApiHandler
from backend.content_manager import ContentManager
from backend.storage import get_seed_content
from backend.validator import ContentValidator


def messages(result, key="errors"):
    return [e["message"] for e in result[key]]


class ContentStudioTest(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix="afterlife_content_"))
        self.manager = ContentManager(self.root)
        self.api = ContentApiHandler(self.manager)

    def tearDown(self):
        shutil.rmtree(self.root, ignore_errors=True)

    def call(self, method, path, body=None):
        return self.api.handle(method, path, json.dumps(body).encode() if body is not None else b"")

    # ---- Shipped content ----
    def test_shipped_content_is_valid_and_playable(self):
        result = self.manager.validate()
        self.assertEqual(result["errors"], [])
        campaign = self.manager.campaign()
        self.assertEqual(campaign["stuck"], [])
        quests = [s["id"] for s in campaign["steps"] if s["kind"] == "quest"]
        self.assertEqual(quests, [q["id"] for q in self.manager.get_category("quests")])
        self.assertEqual([s["id"] for s in campaign["steps"] if s["kind"] == "rank"], ["outpost", "settlement", "town", "city"])

    def test_published_module_matches_the_authored_content(self):
        content = ContentManager(ROOT).get_all()
        self.assertTrue(exporter.is_published(content, ROOT),
                        "web/src/engine/gameContent.mjs is out of date with backend/data; publish from /dashboard.")

    def test_export_uses_engine_shapes(self):
        tables = exporter.engine_tables(get_seed_content())
        self.assertEqual(tables["ROLE_FOR"]["barracks"], "guard")
        self.assertEqual(tables["POSTS"]["barracks"], {"role": "guard", "slots": 4, "bonus": [{"upgrade": "nightwatch", "slots": 2}]})
        self.assertNotIn("building", tables["ROLES"]["patrol"])
        self.assertEqual(tables["JOB_OF"]["sentry"], "guard")
        self.assertEqual(tables["QUESTS"][0]["rank"], 0)
        self.assertEqual(tables["QUESTS"][7]["rank"], 1)
        self.assertTrue(tables["BUILDINGS"]["campfire"]["fixture"])
        self.assertNotIn("upgrades", tables["BUILDINGS"]["farm"])
        self.assertIsNone(tables["BUILDING_TREES"]["farm"][0]["requires"])
        self.assertNotIn("id", tables["WEAPONS"]["pistol"])

    # ---- Validation ----
    def test_campaign_dead_end_is_an_error(self):
        content = self.manager.get_all()
        quests = content["quests"]
        # Unlock the farm only at the very end: "Something to Eat" can then never be done.
        for q in quests:
            q["unlock"] = [t for t in q["unlock"] if t != "farm"]
        quests[-1]["unlock"].append("farm")
        result = ContentValidator(content).validate_all()
        self.assertTrue(any("Campaign dead end" in m and "crops" in m for m in messages(result)))

    def test_status_that_needs_a_locked_building_is_a_dead_end(self):
        content = self.manager.get_all()
        next(r for r in content["ranks"] if r["id"] == "outpost")["milestones"].append({"kind": "build", "count": 1, "type": "armory"})
        campaign = ContentValidator(content).campaign()
        self.assertEqual(campaign["stuck"][0]["id"], "outpost")

    def test_upgrade_deeper_than_any_status_allows(self):
        content = self.manager.get_all()
        farm = next(b for b in content["buildables"] if b["id"] == "farm")
        farm["upgrades"].append({"id": "hydroponics", "name": "Hydroponics", "description": "", "cost": {"scrap_metal": 5}, "requires": "greenhouse"})
        self.assertTrue(any("tier 3" in m for m in messages(ContentValidator(content).validate_all())))

    def test_upgrade_cycle(self):
        content = self.manager.get_all()
        tree = next(b for b in content["buildables"] if b["id"] == "tower")["upgrades"]
        tree[0]["requires"] = tree[2]["id"]
        self.assertTrue(any("loops back" in m for m in messages(ContentValidator(content).validate_all())))

    def test_a_buildable_hosts_one_post(self):
        content = self.manager.get_all()
        medic = next(j for j in content["jobs"] if j["id"] == "medic")
        medic["roles"][0]["building"] = "farm"
        self.assertTrue(any("hosts more than one post" in m for m in messages(ContentValidator(content).validate_all())))

    def test_slot_bonus_needs_an_upgrade_of_that_building(self):
        content = self.manager.get_all()
        guard = next(r for j in content["jobs"] for r in j["roles"] if r["id"] == "guard")
        guard["slotBonus"] = [{"upgrade": "irrigation", "slots": 1}]
        self.assertTrue(any("unknown barracks upgrade 'irrigation'" in m for m in messages(ContentValidator(content).validate_all())))

    def test_engine_required_ids(self):
        content = self.manager.get_all()
        content["buildables"] = [b for b in content["buildables"] if b["id"] != "gate"]
        self.assertTrue(any("needs a buildable with id 'gate'" in m for m in messages(ContentValidator(content).validate_all())))

    def test_story_references(self):
        content = self.manager.get_all()
        content["messages"].append({"id": "ghost", "from": "nobody", "subject": "Hi", "body": "x", "tone": "", "trigger": {"on": "quest_start", "ref": "no_such_quest"}, "chapter": ""})
        errors = messages(ContentValidator(content).validate_all())
        self.assertTrue(any("unknown character 'nobody'" in m for m in errors))
        self.assertTrue(any("unknown quest 'no_such_quest'" in m for m in errors))

    def test_research_graph(self):
        content = self.manager.get_all()
        content["research"][0]["requires"] = [content["research"][-1]["id"]]
        content["research"][0]["unlocks"] = ["farm.nonexistent"]
        self.assertTrue(any("unknown farm upgrade" in m for m in messages(ContentValidator(content).validate_all())))

    # ---- Editing ----
    def test_create_rejects_bad_and_duplicate_ids(self):
        with self.assertRaises(ValueError):
            self.manager.create_item("buildables", {"id": "Bad Id"})
        with self.assertRaises(ValueError):
            self.manager.create_item("buildables", {"id": "farm"})
        made = self.manager.create_item("buildables", {"id": "well", "name": "Well"})
        self.assertEqual(made["hp"], 150)  # filled from the template
        self.assertEqual(made["upgrades"], [])

    def test_create_at_position(self):
        self.manager.create_item("quests", {"id": "scout", "title": "Scout"}, position=1)
        self.assertEqual([q["id"] for q in self.manager.get_category("quests")][:3], ["firewood", "scout", "palisade"])

    def test_renaming_a_buildable_updates_references(self):
        self.manager.create_item("research", {"id": "mills", "name": "Mills", "unlocks": ["lumber_mill", "lumber_mill.circular_saw"]})
        item = self.manager.update_item("buildables", "lumber_mill", {"id": "sawmill"})
        self.assertGreater(item["_renamedReferences"], 0)
        content = self.manager.get_all()
        self.assertIn("sawmill", next(q for q in content["quests"] if q["id"] == "beds")["unlock"])
        self.assertEqual(next(q for q in content["quests"] if q["id"] == "timber")["objectives"][0]["type"], "sawmill")
        self.assertEqual(next(r for j in content["jobs"] for r in j["roles"] if r["id"] == "logger")["building"], "sawmill")
        self.assertEqual(next(t for t in content["research"] if t["id"] == "mills")["unlocks"], ["sawmill", "sawmill.circular_saw"])
        self.assertEqual(self.manager.validate()["errors"], [])

    def test_renaming_a_status_and_a_character(self):
        self.manager.update_item("ranks", "outpost", {"id": "foothold"})
        self.manager.update_item("characters", "command", {"id": "hq"})
        quests = self.manager.get_category("quests")
        self.assertEqual(next(q for q in quests if q["id"] == "depot")["rank"], "foothold")
        self.assertTrue(all(q["giver"] == "hq" for q in quests))
        self.assertEqual(self.manager.get_item("messages", "msg_welcome")["from"], "hq")
        self.assertEqual(self.manager.validate()["errors"], [])

    def test_delete_refuses_while_referenced(self):
        with self.assertRaises(ValueError) as ctx:
            self.manager.delete_item("chapters", "ch1_drop")
        self.assertIn("quests/firewood", str(ctx.exception))
        result = self.manager.delete_item("chapters", "ch1_drop", force=True)
        self.assertTrue(result["danglingReferences"])
        self.assertTrue(any("unknown chapter 'ch1_drop'" in m for m in messages(self.manager.validate())))

    def test_reorder(self):
        ids = [q["id"] for q in self.manager.get_category("quests")]
        self.manager.reorder("quests", ids[::-1])
        self.assertEqual([q["id"] for q in self.manager.get_category("quests")], ids[::-1])
        with self.assertRaises(ValueError):
            self.manager.reorder("quests", ids[:-1])

    def test_publish(self):
        result = self.manager.publish()
        path = self.root / exporter.GENERATED_PATH
        self.assertTrue(path.exists())
        self.assertTrue(result["changed"])
        self.assertFalse(self.manager.publish()["changed"])
        self.assertTrue(self.manager.get_summary()["published"])
        text = path.read_text(encoding="utf-8")
        self.assertIn("export const BUILDINGS = {", text)
        self.assertIn("export const CONTENT_HASH = '", text)
        self.manager.update_item("buildables", "farm", {"hp": 999})
        self.assertFalse(self.manager.get_summary()["published"])

    def test_publish_is_refused_with_errors(self):
        self.manager.update_item("quests", "firewood", {"rank": "nowhere"})
        with self.assertRaises(ValueError):
            self.manager.publish()
        self.assertFalse((self.root / exporter.GENERATED_PATH).exists())

    def test_reset_defaults(self):
        self.manager.update_item("buildables", "farm", {"name": "Plot"})
        self.manager.reset_defaults()
        self.assertEqual(self.manager.get_item("buildables", "farm")["name"], "Farm")

    # ---- API ----
    def test_api_flow(self):
        status, summary = self.call("GET", "/api/content/summary")
        self.assertEqual(status, 200)
        self.assertTrue(summary["valid"])
        self.assertEqual(summary["categories"]["buildables"], len(get_seed_content()["buildables"]))

        status, tpl = self.call("GET", "/api/content/messages/_template")
        self.assertEqual((status, tpl["trigger"]["on"]), (200, "manual"))

        status, data = self.call("POST", "/api/content/messages", {**tpl, "id": "radio_day3", "trigger": {"on": "day", "ref": "", "day": 3}, "body": "Static."})
        self.assertEqual(status, 201)
        status, data = self.call("GET", "/api/content/messages?search=static")
        self.assertEqual([m["id"] for m in data["items"]], ["radio_day3"])

        status, data = self.call("PUT", "/api/content/messages/radio_day3?replace=1", {"id": "radio_day3", "from": "gate", "subject": "Knock", "body": "b", "tone": "warn", "trigger": {"on": "day", "day": 4}, "chapter": ""})
        self.assertEqual((status, data["item"]["from"], data["item"]["trigger"]["day"]), (200, "gate", 4))
        self.assertNotIn("_renamedReferences", self.manager.get_item("messages", "radio_day3"))

        status, data = self.call("GET", "/api/content/buildables/farm/references")
        self.assertIn("crops", [r["id"] for r in data["references"]])

        status, _ = self.call("DELETE", "/api/content/messages/radio_day3")
        self.assertEqual(status, 200)

        status, data = self.call("PUT", "/api/content/ranks", {"order": ["camp", "outpost"]})
        self.assertEqual(status, 400)
        self.assertEqual(self.call("GET", "/api/content/nope")[0], 404)
        self.assertEqual(self.api.handle("POST", "/api/content/quests", b"{not json")[0], 400)
        self.assertEqual(self.call("GET", "/api/content/campaign")[0], 200)
        status, data = self.call("POST", "/api/content/publish")
        self.assertEqual((status, data["status"]), (200, "published"))

    def test_hooks_find_coded_upgrades(self):
        hooks = ContentManager(ROOT).hooks()
        self.assertTrue(hooks["upgrades"]["barracks.nightwatch"])
        self.assertTrue(hooks["roles"]["sentry"])
        self.assertTrue(hooks["buildables"]["gate"])


class CampaignContentTest(unittest.TestCase):
    """The AfterLife campaign's categories: shipped data, the cost-letter reading, validation and renames."""

    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix="afterlife_campaign_"))
        self.manager = ContentManager(self.root)

    def tearDown(self):
        shutil.rmtree(self.root, ignore_errors=True)

    def edit(self, category, item_id, change):
        item = copy.deepcopy(self.manager.get_item(category, item_id))
        change(item)
        self.manager.update_item(category, item_id, item, replace=True)
        return messages(self.manager.validate())

    def test_shipped_campaign_is_valid_and_complete(self):
        self.assertEqual(self.manager.validate()["errors"], [])
        content = self.manager.get_all()
        tasks = content["campaign_tasks"]
        self.assertEqual([t["code"] for t in tasks if t["kind"] == "main"],
                         [f"P1-{i:02d}" for i in range(1, 11)] + [f"P2-{i:02d}" for i in range(1, 14)])
        self.assertEqual([t["code"] for t in tasks if t["kind"] == "side"], ["S01", "S02", "S03", "S04", "S05"])
        self.assertEqual(len(content["campaign_resources"]), 12)
        self.assertEqual([r["code"] for r in content["campaign_recipes"]], [f"C{i:02d}" for i in range(1, 12)])
        self.assertEqual(len(content["campaign_sites"]), 11)
        self.assertEqual(next(t for t in tasks if t["id"] == "p1_10")["certification"]["holdHours"], 12)
        self.assertEqual(next(t for t in tasks if t["id"] == "p2_13")["certification"]["holdHours"], 48)

    def test_cost_letters_read_as_cloth_components_and_seeds(self):
        b = {x["id"]: x for x in self.manager.get_category("campaign_buildings")}
        self.assertEqual(b["aid_station"]["cost"], {"wood": 15, "scrap_metal": 10, "cloth": 6})
        self.assertEqual(b["radio_kit"]["cost"], {"wood": 10, "scrap_metal": 15, "components": 3})
        self.assertEqual(b["garden_plot"]["cost"], {"wood": 12, "scrap_metal": 4, "seed_packets": 1})
        self.assertEqual(b["radio_relay"]["cost"], {"planks": 20, "metal_parts": 15, "components": 6})
        self.assertEqual(b["radio_relay"]["tokens"], {"battery_token": 1})

    def test_starting_supplies_weigh_what_the_spec_says(self):
        tuning = {t["id"]: t["values"] for t in self.manager.get_category("campaign_tuning")}
        weights = {r["id"]: r["weight"] for r in self.manager.get_category("campaign_resources")}
        dep = tuning["deployment"]
        raw = sum(n * weights[r] for r, n in dep["startingSupplies"].items())
        spare = sum(e["count"] for e in dep["startingEquipment"] if e["state"] == "spare") * weights["equipment"]
        self.assertEqual(raw + spare, 347.5)
        self.assertLessEqual(raw + spare, dep["cacheCapacity"])

    def test_generated_copy_is_marked(self):
        strings = self.manager.get_category("campaign_strings")
        self.assertTrue(all(s["source"] in ("spec", "generated") for s in strings))
        self.assertTrue(any(s["source"] == "generated" for s in strings))
        for e in self.manager.get_category("campaign_expeditions"):
            self.assertIn("encounter", e["generated"])

    def test_bad_campaign_references_are_errors(self):
        errs = self.edit("campaign_buildings", "tent", lambda b: b["cost"].update(metal=4))
        self.assertTrue(any("Unknown resource 'metal'" in m for m in errs))
        self.manager.reset_defaults()
        errs = self.edit("campaign_tasks", "p1_03", lambda t: t["predecessors"].append("p1_05"))
        self.assertTrue(any("cycle" in m for m in errs))
        self.manager.reset_defaults()
        errs = self.edit("campaign_tasks", "p1_02", lambda t: t["objectives"].append({"id": "x", "type": "build", "target": "watchtower", "count": 1}))
        self.assertTrue(any("later task unlocks" in m for m in errs))
        self.manager.reset_defaults()
        errs = self.edit("campaign_expeditions", "e01", lambda e: e["encounter"].update(choices=[]))
        self.assertTrue(any("at least one choice" in m for m in errs))

    def test_renaming_campaign_items_updates_references(self):
        self.manager.update_item("campaign_buildings", "field_workbench", {"id": "bench"})
        self.manager.update_item("campaign_tasks", "p1_04", {"id": "tools"})
        self.manager.update_item("campaign_items", "wooden_club", {"id": "club"})
        content = self.manager.get_all()
        recipes = {r["id"]: r for r in content["campaign_recipes"]}
        self.assertEqual(recipes["c01"]["station"], "bench")
        self.assertEqual(recipes["c01"]["unlockedBy"], "tools")
        self.assertEqual(recipes["c01"]["output"]["item"], "club")
        self.assertEqual(recipes["c09"]["itemInputs"], {"club": 1})
        tasks = {t["id"]: t for t in content["campaign_tasks"]}
        self.assertIn("bench", tasks["tools"]["unlocks"]["buildings"])
        self.assertEqual(tasks["p1_05"]["predecessors"], ["tools"])
        self.assertIn("tools", next(c for c in tasks["p1_10"]["certification"]["conditions"] if c["id"] == "tasks")["value"])
        self.assertEqual(self.manager.validate()["errors"], [])

    def test_export_shapes_the_campaign_table(self):
        c = exporter.engine_tables(get_seed_content())["CAMPAIGN"]
        self.assertEqual(c["resources"]["ammo"]["weight"], 0.25)
        self.assertNotIn("id", c["buildings"]["tent"])
        self.assertEqual(c["tasks"][0]["id"], "p1_01")
        self.assertNotIn("generated", c["tasks"][2])
        self.assertTrue(c["strings"]["ui_reserve"].startswith("Available stock"))
        self.assertEqual(c["letter"][-1]["title"], "FINAL ACKNOWLEDGMENT")
        self.assertEqual(c["tuning"]["time"]["hourSeconds"], 42)


if __name__ == "__main__":
    unittest.main()
