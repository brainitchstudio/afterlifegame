"""
Storage layer for Afterlife game content.
Handles persistent JSON file storage with atomic writes, automatic backups,
and seeding from the shipped defaults in backend/seed/.
"""

import json
import os
import shutil
from pathlib import Path
from typing import Dict, Any, List

from .schemas import CATEGORIES

SEED_DIR = Path(__file__).resolve().parent / "seed"


def get_seed_content() -> Dict[str, List[Dict[str, Any]]]:
    """The content the game ships with, as extracted from the engine's original tables."""
    seed = {}
    for cat in CATEGORIES:
        path = SEED_DIR / f"{cat}.json"
        seed[cat] = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
    return seed


class ContentStorage:
    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.backup_dir = self.data_dir / "backups"
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        self._ensure_initialized()

    def _ensure_initialized(self):
        """Seed initial JSON files if they don't already exist."""
        seed = get_seed_content()
        for cat in CATEGORIES:
            file_path = self.data_dir / f"{cat}.json"
            if not file_path.exists():
                items = seed.get(cat, [])
                self.save_category(cat, items, create_backup=False)

    def load_category(self, category: str) -> List[Dict[str, Any]]:
        file_path = self.data_dir / f"{category}.json"
        if not file_path.exists():
            return []
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            return []

    def load_all(self) -> Dict[str, List[Dict[str, Any]]]:
        result = {}
        for cat in CATEGORIES:
            result[cat] = self.load_category(cat)
        return result

    def save_category(self, category: str, items: List[Dict[str, Any]], create_backup: bool = True) -> bool:
        file_path = self.data_dir / f"{category}.json"
        temp_path = self.data_dir / f"{category}.json.tmp.{os.getpid()}"

        if create_backup and file_path.exists():
            backup_path = self.backup_dir / f"{category}.json.bak"
            try:
                shutil.copy2(file_path, backup_path)
            except OSError:
                pass

        try:
            with open(temp_path, "w", encoding="utf-8") as f:
                json.dump(items, f, indent=2, ensure_ascii=False)
                f.write("\n")
            os.replace(temp_path, file_path)
            return True
        except OSError:
            if temp_path.exists():
                temp_path.unlink()
            return False

    def save_all(self, content: Dict[str, List[Dict[str, Any]]]) -> bool:
        success = True
        for cat in CATEGORIES:
            if cat in content:
                if not self.save_category(cat, content[cat]):
                    success = False
        return success

    def reset_to_seed(self) -> Dict[str, List[Dict[str, Any]]]:
        """Resets all data to the shipped defaults; the previous files are kept as backups."""
        seed = get_seed_content()
        self.save_all(seed)
        return seed
