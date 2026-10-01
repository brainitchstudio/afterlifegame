"""
REST API for the Afterlife content studio. server.py hands every /api/content/ request here.

  GET    /api/content/summary              counts, validity and whether the game has the latest content
  GET    /api/content/all                  every category
  GET    /api/content/validate             errors and warnings
  GET    /api/content/campaign             dry run of the quest chain and status ladder
  GET    /api/content/hooks                where the game's code refers to buildables, upgrades and posts
  GET    /api/content/art                  building sprites the studio can show
  GET    /api/content/preview              the module that publishing would write
  POST   /api/content/publish              write web/src/engine/gameContent.mjs (refused while there are errors)
  POST   /api/content/import               {mode: merge|replace, data}
  POST   /api/content/reset-defaults       restore the shipped content
  GET    /api/content/<cat>                list (?search=, and any field=value filter)
  POST   /api/content/<cat>                create ({..., _position} inserts at an index)
  PUT    /api/content/<cat>                {order: [ids]} reorders
  GET    /api/content/<cat>/_template      blank item
  GET    /api/content/<cat>/<id>           one item
  PUT    /api/content/<cat>/<id>           merge (?replace=1 replaces); a new id renames references too
  GET    /api/content/<cat>/<id>/references  what uses this item
  DELETE /api/content/<cat>/<id>           delete (?force=1 even if referenced)
"""

import json
import urllib.parse
from typing import Tuple, Dict, Any, Optional

from .content_manager import ContentManager
from .schemas import CATEGORIES


class ContentApiHandler:
    def __init__(self, manager: Optional[ContentManager] = None):
        self.manager = manager or ContentManager()

    def handle(self, method: str, raw_path: str, body_bytes: bytes) -> Tuple[int, Any]:
        parsed = urllib.parse.urlparse(raw_path)
        query = {k: v[0] for k, v in urllib.parse.parse_qs(parsed.query).items()}
        body: Any = {}
        if body_bytes:
            try:
                body = json.loads(body_bytes.decode("utf-8"))
            except ValueError:
                return 400, {"error": "Invalid JSON body."}
            if not isinstance(body, dict):
                return 400, {"error": "Request body must be a JSON object."}

        parts = [urllib.parse.unquote(p) for p in parsed.path.strip("/").split("/") if p]
        if parts[:2] != ["api", "content"]:
            return 404, {"error": "Not a content API endpoint."}
        sub = parts[2:]
        m = self.manager

        try:
            if len(sub) == 1 and sub[0] not in CATEGORIES:
                action = sub[0]
                if method == "GET" and action == "summary":
                    return 200, m.get_summary()
                if method == "GET" and action == "all":
                    return 200, m.get_all()
                if method == "GET" and action == "validate":
                    return 200, m.validate()
                if method == "GET" and action == "campaign":
                    return 200, m.campaign()
                if method == "GET" and action == "hooks":
                    return 200, m.hooks()
                if method == "GET" and action == "art":
                    return 200, {"buildings": m.art()}
                if method == "GET" and action == "preview":
                    return 200, {"module": m.preview()}
                if method == "POST" and action == "publish":
                    return 200, m.publish()
                if method == "POST" and action == "import":
                    return 200, m.import_content(body.get("data", {}), mode=body.get("mode", "merge"))
                if method == "POST" and action == "reset-defaults":
                    return 200, m.reset_defaults()
                return 404, {"error": f"Unknown endpoint '{action}'."}

            if not sub or sub[0] not in CATEGORIES:
                return 404, {"error": f"Unknown category '{sub[0] if sub else ''}'."}
            category = sub[0]

            if len(sub) == 1:
                if method == "GET":
                    search = query.pop("search", None)
                    items = m.get_category(category, search=search, **query)
                    return 200, {"category": category, "items": items, "count": len(items)}
                if method == "POST":
                    position = body.pop("_position", None)
                    return 201, {"status": "created", "item": m.create_item(category, body, position=position)}
                if method == "PUT" and isinstance(body.get("order"), list):
                    return 200, {"status": "reordered", "items": m.reorder(category, body["order"])}

            if len(sub) == 2 and sub[1] == "_template" and method == "GET":
                return 200, m.template(category)

            if len(sub) == 2:
                item_id = sub[1]
                if method == "GET":
                    item = m.get_item(category, item_id)
                    return (200, item) if item else (404, {"error": f"Item '{item_id}' not found in {category}."})
                if method in ("PUT", "POST"):
                    item = m.update_item(category, item_id, body, replace=query.get("replace") == "1")
                    return 200, {"status": "updated", "item": item}
                if method == "DELETE":
                    return 200, m.delete_item(category, item_id, force=query.get("force") == "1")

            if len(sub) == 3 and sub[2] == "references" and method == "GET":
                return 200, {"references": m.references(category, sub[1])}

            return 404, {"error": f"Endpoint not found: {parsed.path}"}
        except KeyError as e:
            return 404, {"error": f"Unknown category {e}."}
        except ValueError as e:
            return 400, {"error": str(e)}
        except Exception as e:  # noqa: BLE001 - reported to the dashboard
            return 500, {"error": f"Server error: {e}"}
