"""Completed visits implied by the fixed route, before the demo clock."""

from __future__ import annotations

from datetime import timedelta

from vale_verde_etl.agenda import parse_iso, route_runs_on


def build_visits(fixture: dict, lookback_days: int = 28) -> list[dict]:
    demo_today = fixture["demoToday"]
    start = parse_iso(demo_today) - timedelta(days=lookback_days)
    missed_stores = set(fixture.get("missedStoresBeforeToday", []))
    missed_ids = set(fixture.get("missedStopIds", []))
    promoters = [person["id"] for person in fixture["people"] if person["role"] == "promoter"]
    visits = []
    cursor = start
    last = parse_iso(demo_today)
    while cursor < last:
        iso = cursor.isoformat()
        for promoter_id in promoters:
            for route in fixture["routes"]:
                if route["promoterId"] != promoter_id:
                    continue
                if not route_runs_on(route, iso):
                    continue
                stop_id = f"{iso}:{promoter_id}:{route['storeId']}"
                if route["storeId"] in missed_stores or stop_id in missed_ids:
                    continue
                visits.append(
                    {
                        "id": f"vis_{stop_id}",
                        "stopId": stop_id,
                        "storeId": route["storeId"],
                        "promoterId": promoter_id,
                        "date": iso,
                        "status": "completed",
                    }
                )
        cursor += timedelta(days=1)
    return visits
