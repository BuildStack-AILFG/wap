"""
Seed the `plans` table with WhatsApp-only quota tiers (mirrors the reference
product's lib/plans.js PLAN_QUOTAS, translated to WhatsApp-only fields per
the plan file's "Auth, Plans & Dashboard Shell" section).

Run once, after migrations: python scripts/seed_plans.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.plan import Plan

PLANS: list[dict] = [
    {
        "id": "free",
        "name": "Free",
        "price_monthly": None,
        "price_quarterly": None,
        "price_yearly": None,
        "is_default_trial": False,
        "quotas": {
            "max_whatsapp_numbers": 1,
            "max_team_members": 1,
            "max_automation_flows": 1,
            "max_contacts": 200,
            "max_broadcast_recipients_per_month": 200,
            "ai_replies_included_per_month": 0,
            "max_knowledge_sources": 0,
        },
    },
    {
        "id": "trial",
        "name": "Trial",
        "price_monthly": None,
        "price_quarterly": None,
        "price_yearly": None,
        "is_default_trial": True,
        "quotas": {
            "max_whatsapp_numbers": 1,
            "max_team_members": 3,
            "max_automation_flows": 5,
            "max_contacts": 1000,
            "max_broadcast_recipients_per_month": 1000,
            "ai_replies_included_per_month": 200,
            "max_knowledge_sources": 2,
        },
    },
    {
        "id": "starter",
        "name": "Starter",
        "price_monthly": 1900,  # smallest currency unit, e.g. $19.00
        "price_quarterly": 1700,
        "price_yearly": 1500,
        "is_default_trial": False,
        "quotas": {
            "max_whatsapp_numbers": 1,
            "max_team_members": 2,
            "max_automation_flows": 3,
            "max_contacts": 2000,
            "max_broadcast_recipients_per_month": 2000,
            "ai_replies_included_per_month": 500,
            "max_knowledge_sources": 3,
        },
    },
    {
        "id": "growth",
        "name": "Growth",
        "price_monthly": 4900,
        "price_quarterly": 4400,
        "price_yearly": 3900,
        "is_default_trial": False,
        "quotas": {
            "max_whatsapp_numbers": 3,
            "max_team_members": 7,
            "max_automation_flows": 15,
            "max_contacts": 10000,
            "max_broadcast_recipients_per_month": 10000,
            "ai_replies_included_per_month": 2000,
            "max_knowledge_sources": 10,
        },
    },
    {
        "id": "scale",
        "name": "Scale",
        "price_monthly": 9900,
        "price_quarterly": 8900,
        "price_yearly": 7900,
        "is_default_trial": False,
        "quotas": {
            "max_whatsapp_numbers": 10,
            "max_team_members": 20,
            "max_automation_flows": 50,
            "max_contacts": 50000,
            "max_broadcast_recipients_per_month": 50000,
            "ai_replies_included_per_month": 10000,
            "max_knowledge_sources": 25,
        },
    },
    {
        "id": "enterprise",
        "name": "Enterprise",
        "price_monthly": None,
        "price_quarterly": None,
        "price_yearly": None,
        "is_default_trial": False,
        "quotas": {
            "max_whatsapp_numbers": 999999,
            "max_team_members": 999999,
            "max_automation_flows": 999999,
            "max_contacts": 999999,
            "max_broadcast_recipients_per_month": 999999,
            "ai_replies_included_per_month": 999999,
            "max_knowledge_sources": 999999,
        },
    },
]


def main() -> None:
    settings = get_settings()
    engine = create_engine(settings.database_url_sync)

    with Session(engine) as session:
        for plan_data in PLANS:
            existing = session.get(Plan, plan_data["id"])
            if existing is not None:
                for key, value in plan_data.items():
                    setattr(existing, key, value)
            else:
                session.add(Plan(**plan_data))
        session.commit()

    print(f"Seeded {len(PLANS)} plans.")


if __name__ == "__main__":
    main()
