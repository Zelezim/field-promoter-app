"""Shape an ERP shipment extract into warehouse rows."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta


@dataclass(frozen=True)
class ShipmentLine:
    invoice_id: str
    issued_on: date
    store_id: str
    seller_id: str
    sku: str
    qty: int
    unit_price_cents: int
    revenue_cents: int
    shelf_life_days: int
    estimated_expiry: date


def estimate_expiry(issued_on: date, shelf_life_days: int) -> date:
    """Lot expiry estimate: invoice date + catalog shelf life. Not a scanned lot."""
    return issued_on + timedelta(days=shelf_life_days)


def line_revenue_cents(qty: int, unit_price_cents: int) -> int:
    if qty <= 0:
        raise ValueError("qty must be positive")
    if unit_price_cents < 0:
        raise ValueError("price cannot be negative")
    return qty * unit_price_cents


def transform_row(row: dict) -> ShipmentLine:
    issued_on = date.fromisoformat(row["issued_on"])
    shelf_life = int(row["shelf_life_days"])
    qty = int(row["qty"])
    price = int(row["unit_price_cents"])
    return ShipmentLine(
        invoice_id=row["invoice_id"],
        issued_on=issued_on,
        store_id=row["store_id"],
        seller_id=row["seller_id"],
        sku=row["sku"],
        qty=qty,
        unit_price_cents=price,
        revenue_cents=line_revenue_cents(qty, price),
        shelf_life_days=shelf_life,
        estimated_expiry=estimate_expiry(issued_on, shelf_life),
    )


def recompute_store_abc(revenues: dict[str, int]) -> dict[str, str]:
    """Pareto curve on trailing revenue. A to 80%, B to 95%, then C.

    A store is classified by the cumulative share *before* it is added, so the
    store that crosses a threshold still belongs to the band it started in.
    """
    ranked = sorted(revenues.items(), key=lambda item: (-item[1], item[0]))
    total = sum(value for _, value in ranked)
    if total <= 0:
        return {store_id: "C" for store_id, _ in ranked}
    assigned: dict[str, str] = {}
    running = 0
    for store_id, revenue in ranked:
        share_before = running / total
        running += revenue
        if share_before < 0.80:
            assigned[store_id] = "A"
        elif share_before < 0.95:
            assigned[store_id] = "B"
        else:
            assigned[store_id] = "C"
    return assigned
