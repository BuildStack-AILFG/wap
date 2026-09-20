"""
Seed the `plans` table with WhatsApp-only quota tiers. Prices are INR in paise, per month, for each billing period (mirrors the reference
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
        "price_monthly": 99900,  # per month, in paise (₹999) when billed monthly
        "price_quarterly": 89900,  # per month when billed quarterly
        "price_yearly": 79900,  # per month when billed yearly
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
        "price_monthly": 249900,
        "price_quarterly": 224900,
        "price_yearly": 199900,
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
        "price_monthly": 599900,
        "price_quarterly": 539900,
        "price_yearly": 479900,
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
