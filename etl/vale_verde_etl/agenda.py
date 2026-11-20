"""Build one promoter's visit agenda for a date. Mirrors shared/agenda.js."""

from __future__ import annotations

from datetime import date, timedelta

from vale_verde_etl.score import (
    abc_component,
    expiry_component,
    key_account_component,
    priority_score,
    recency_component,
    stockout_component,
    volume_component,
)


def parse_iso(value: str) -> date:
    year, month, day = (int(part) for part in value.split("-"))
    return date(year, month, day)


def to_iso(value: date) -> str:
    return value.isoformat()


def add_days(iso: str, days: int) -> str:
    return to_iso(parse_iso(iso) + timedelta(days=days))


def diff_days(later: str, earlier: str) -> int:
    return (parse_iso(later) - parse_iso(earlier)).days


def route_runs_on(route: dict, iso_date: str) -> bool:
    current = parse_iso(iso_date)
    if route["weekday"] != current.isoweekday():
        return False
    if route["frequency"] == "weekly":
        return True
    if route["frequency"] == "biweekly":
        return current.isocalendar().week % 2 == route["weekParity"]
    return False


def scheduled_stops(routes: list[dict], promoter_id: str, iso_date: str) -> list[dict]:
    due = [
        route
        for route in routes
        if route["promoterId"] == promoter_id and route_runs_on(route, iso_date)
    ]
    due.sort(key=lambda route: (0 if route["shift"] == "morning" else 1, route["order"]))
    return [
        {
            "id": f"{iso_date}:{promoter_id}:{route['storeId']}",
            "date": iso_date,
            "promoterId": promoter_id,
            "storeId": route["storeId"],
            "shift": route["shift"],
            "order": route["order"],
            "frequency": route["frequency"],
        }
        for route in due
    ]


def _revenue_cents(line: dict) -> int:
    if isinstance(line.get("revenueCents"), int):
        return line["revenueCents"]
    return int(line["qty"]) * int(line["unitPriceCents"])


def store_volume_cents(
    invoices: list[dict], store_id: str, visit_date: str, window_days: int = 28
) -> int:
    start = add_days(visit_date, -window_days)
    total = 0
    for invoice in invoices:
        if invoice["storeId"] != store_id:
            continue
        if invoice["date"] < start or invoice["date"] >= visit_date:
            continue
        total += sum(_revenue_cents(line) for line in invoice["lines"])
    return total


def days_since_last_visit(visits: list[dict], store_id: str, visit_date: str) -> int | None:
    latest = None
    for visit in visits:
        if visit["storeId"] != store_id or visit["status"] != "completed":
            continue
        if visit["date"] >= visit_date:
            continue
        if latest is None or visit["date"] > latest:
            latest = visit["date"]
    if latest is None:
        return None
    return diff_days(visit_date, latest)


def stockout_events(
    stockouts: list[dict], store_id: str, visit_date: str, window_days: int = 14
) -> int:
    start = add_days(visit_date, -window_days)
    return sum(
        1
        for event in stockouts
        if event["storeId"] == store_id and start <= event["date"] < visit_date
    )


def worst_lot(
    invoices: list[dict],
    products_by_sku: dict[str, dict],
    store_id: str,
    visit_date: str,
    lookback_days: int = 45,
) -> dict | None:
    start = add_days(visit_date, -lookback_days)
    latest_by_sku: dict[str, str] = {}
    for invoice in invoices:
        if invoice["storeId"] != store_id:
            continue
        if invoice["date"] < start or invoice["date"] >= visit_date:
            continue
        for line in invoice["lines"]:
            previous = latest_by_sku.get(line["sku"])
            if previous is None or invoice["date"] > previous:
                latest_by_sku[line["sku"]] = invoice["date"]
    worst = None
    for sku, invoice_date in latest_by_sku.items():
        product = products_by_sku.get(sku)
        if not product:
            continue
        expiry = add_days(invoice_date, int(product["shelfLifeDays"]))
        days_left = diff_days(expiry, visit_date)
        if worst is None or days_left < worst["daysLeft"]:
            worst = {
                "sku": sku,
                "invoiceDate": invoice_date,
                "expiry": expiry,
                "daysLeft": days_left,
            }
    return worst


def build_agenda(
    *,
    promoter_id: str,
    visit_date: str,
    routes: list[dict],
    stores_by_id: dict[str, dict],
    products_by_sku: dict[str, dict],
    invoices: list[dict],
    visits: list[dict],
    stockouts: list[dict],
) -> list[dict]:
    due = scheduled_stops(routes, promoter_id, visit_date)
    volumes = [store_volume_cents(invoices, stop["storeId"], visit_date) for stop in due]
    low = min(volumes) if volumes else 0
    high = max(volumes) if volumes else 0
    scored = []
    for stop, volume in zip(due, volumes, strict=True):
        store = stores_by_id[stop["storeId"]]
        days = days_since_last_visit(visits, stop["storeId"], visit_date)
        events = stockout_events(stockouts, stop["storeId"], visit_date)
        lot = worst_lot(invoices, products_by_sku, stop["storeId"], visit_date)
        parts = {
            "volume": volume_component(volume, low, high),
            "abc": abc_component(store["abc"]),
            "recency": recency_component(days),
            "stockout": stockout_component(events),
            "keyAccount": key_account_component(bool(store["keyAccount"])),
            "expiry": expiry_component(lot["daysLeft"] if lot else None),
        }
        scored.append(
            {
                **stop,
                "volumeCents": volume,
                "daysSinceVisit": days,
                "stockoutEvents14d": events,
                "lot": lot,
                "parts": parts,
                "score": priority_score(parts),
            }
        )
    return scored
