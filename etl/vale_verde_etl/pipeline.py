"""Extract the fictional ERP, load a Postgres-shaped warehouse, score the agenda."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

from vale_verde_etl.agenda import build_agenda
from vale_verde_etl.erp import connect, extract, load_fixture
from vale_verde_etl.transform import recompute_store_abc, transform_row

WAREHOUSE_DDL = """
create table dim_seller (id text primary key, name text not null, email text not null);
create table dim_store (
  id text primary key,
  name text not null,
  city text not null,
  abc_curve text not null,
  abc_calculated text not null,
  key_account integer not null,
  seller_id text not null
);
create table dim_product (
  sku text primary key,
  name text not null,
  category text not null,
  shelf_life_days integer not null,
  abc_curve text not null
);
create table fact_shipment (
  id text primary key,
  issued_on text not null,
  store_id text not null,
  seller_id text not null
);
create table fact_shipment_line (
  invoice_id text not null,
  sku text not null,
  qty integer not null,
  unit_price_cents integer not null,
  revenue_cents integer not null,
  estimated_expiry text not null
);
create table agenda_stop (
  id text primary key,
  visit_date text not null,
  promoter_id text not null,
  store_id text not null,
  shift text not null,
  visit_order integer not null,
  frequency text not null,
  score real not null,
  volume_cents integer not null,
  days_since_visit integer,
  stockout_events_14d integer not null,
  days_to_expiry integer,
  parts_json text not null
);
"""


def load_json(path: str | Path) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def run_pipeline(
    fixture: dict,
    erp_path: str | Path,
    warehouse_path: str | Path,
    visit_date: str,
    promoter_id: str | None = None,
) -> list[dict]:
    erp = connect(erp_path)
    try:
        load_fixture(erp, fixture)
        rows = extract(erp)
    finally:
        erp.close()

    lines = [transform_row(row) for row in rows]
    revenue: dict[str, int] = {}
    for line in lines:
        revenue[line.store_id] = revenue.get(line.store_id, 0) + line.revenue_cents
    calculated = recompute_store_abc(revenue)

    warehouse = sqlite3.connect(warehouse_path)
    try:
        warehouse.executescript(WAREHOUSE_DDL)
        for person in fixture["people"]:
            if person["role"] != "seller":
                continue
            warehouse.execute(
                "insert into dim_seller (id, name, email) values (?, ?, ?)",
                (person["id"], person["name"], person["email"]),
            )
        for store in fixture["stores"]:
            warehouse.execute(
                """
                insert into dim_store
                  (id, name, city, abc_curve, abc_calculated, key_account, seller_id)
                values (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    store["id"],
                    store["name"],
                    store["city"],
                    store["abc"],
                    calculated.get(store["id"], "C"),
                    1 if store["keyAccount"] else 0,
                    store["sellerId"],
                ),
            )
        for product in fixture["products"]:
            warehouse.execute(
                """
                insert into dim_product (sku, name, category, shelf_life_days, abc_curve)
                values (?, ?, ?, ?, ?)
                """,
                (
                    product["sku"],
                    product["name"],
                    product["category"],
                    product["shelfLifeDays"],
                    product["abc"],
                ),
            )
        seen_invoices = set()
        for line in lines:
            if line.invoice_id not in seen_invoices:
                warehouse.execute(
                    "insert into fact_shipment (id, issued_on, store_id, seller_id) values (?, ?, ?, ?)",
                    (line.invoice_id, line.issued_on.isoformat(), line.store_id, line.seller_id),
                )
                seen_invoices.add(line.invoice_id)
            warehouse.execute(
                """
                insert into fact_shipment_line
                  (invoice_id, sku, qty, unit_price_cents, revenue_cents, estimated_expiry)
                values (?, ?, ?, ?, ?, ?)
                """,
                (
                    line.invoice_id,
                    line.sku,
                    line.qty,
                    line.unit_price_cents,
                    line.revenue_cents,
                    line.estimated_expiry.isoformat(),
                ),
            )

        stores_by_id = {store["id"]: store for store in fixture["stores"]}
        products_by_sku = {product["sku"]: product for product in fixture["products"]}
        promoters = [
            person["id"]
            for person in fixture["people"]
            if person["role"] == "promoter" and (promoter_id is None or person["id"] == promoter_id)
        ]
        stops: list[dict] = []
        for promoter in promoters:
            stops.extend(
                build_agenda(
                    promoter_id=promoter,
                    visit_date=visit_date,
                    routes=fixture["routes"],
                    stores_by_id=stores_by_id,
                    products_by_sku=products_by_sku,
                    invoices=fixture["invoices"],
                    visits=fixture["visits"],
                    stockouts=fixture["stockouts"],
                )
            )
        for stop in stops:
            warehouse.execute(
                """
                insert into agenda_stop
                  (id, visit_date, promoter_id, store_id, shift, visit_order, frequency,
                   score, volume_cents, days_since_visit, stockout_events_14d,
                   days_to_expiry, parts_json)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    stop["id"],
                    stop["date"],
                    stop["promoterId"],
                    stop["storeId"],
                    stop["shift"],
                    stop["order"],
                    stop["frequency"],
                    stop["score"],
                    stop["volumeCents"],
                    stop["daysSinceVisit"],
                    stop["stockoutEvents14d"],
                    stop["lot"]["daysLeft"] if stop["lot"] else None,
                    json.dumps(stop["parts"]),
                ),
            )
        warehouse.commit()
        return stops
    finally:
        warehouse.close()
