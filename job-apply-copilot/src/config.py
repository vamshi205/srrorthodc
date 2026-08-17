from __future__ import annotations

from pathlib import Path

import yaml

CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"


def load_search_config() -> dict:
    with open(CONFIG_DIR / "search.yaml") as f:
        return yaml.safe_load(f)


def load_profile() -> dict:
    profile_path = CONFIG_DIR / "profile.yaml"
    if not profile_path.exists():
        raise FileNotFoundError(
            "config/profile.yaml not found. Copy config/profile.yaml.example to "
            "config/profile.yaml and fill in your details first."
        )
    with open(profile_path) as f:
        return yaml.safe_load(f)
