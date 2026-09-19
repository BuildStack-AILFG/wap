from __future__ import annotations

from pydantic import BaseModel


class SettingsOut(BaseModel):
    settings: dict


class SettingsPatch(BaseModel):
    """Shallow-merged into tenant.settings — each top-level key replaces wholesale, matching how the
    frontend already treats each settings section (auto_replies, ai_agents, intent_matching) as one unit."""

    settings: dict
