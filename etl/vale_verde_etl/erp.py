"""SQLite stand-in for the commercial ERP (invoice header, items, catalog, customer, seller)."""

from __future__ import annotations

import sqlite3
from pathlib import Path

ERP_DDL = """
create table invoice_header (
  id text primary key,
  issued_on text not null,
  customer_id text not null,
  seller_id text not null
);
create table invoice_item (
  id integer primary key,
  invoice_id text not null,
  sku text not null,
  qty integer not null,
  unit_price_cents integer not null
);
create table product (
  sku text primary key,
  name text not null,
  category text not null,
  shelf_life_days integer not null,
  abc_curve text not null,
  planogram_facings integer not null,
  unit_price_cents integer not null,
  weight_kg real not null
);
create table customer (
  id text primary key,
  name text not null,
  city text not null,
  abc_curve text not null,
  key_account integer not null,
  seller_id text not null,
  latitude real,
  longitude real
);
create table seller (
  id text primary key,
  name text not null,
  email text not null
);
"""

# Header -> items -> product catalog -> customer and seller.
EXTRACT_SQL = """
select
  h.id as invoice_id,
  h.issued_on as issued_on,
  h.customer_id as store_id,
  c.name as store_name,
  c.abc_curve as store_abc,
  c.key_account as key_account,
  h.seller_id as seller_id,
  s.name as seller_name,
  i.sku as sku,
  p.name as product_name,
  p.category as category,
  p.shelf_life_days as shelf_life_days,
  p.abc_curve as product_abc,
  i.qty as qty,
  i.unit_price_cents as unit_price_cents
from invoice_header h
join invoice_item i on i.invoice_id = h.id
join product p on p.sku = i.sku
join customer c on c.id = h.customer_id
join seller s on s.id = h.seller_id
order by h.issued_on, h.id, i.id
"""


def connect(path: str | Path) -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def init_erp(conn: sqlite3.Connection) -> None:
    conn.executescript(ERP_DDL)


def load_fixture(conn: sqlite3.Connection, fixture: dict) -> None:
    init_erp(conn)
    for person in fixture["people"]:
        if person["role"] != "seller":
            continue
        conn.execute(
            "insert into seller (id, name, email) values (?, ?, ?)",
            (person["id"], person["name"], person["email"]),
        )
    for store in fixture["stores"]:
        conn.execute(
            """
            insert into customer
              (id, name, city, abc_curve, key_account, seller_id, latitude, longitude)
            values (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                store["id"],
                store["name"],
                store["city"],
                store["abc"],
                1 if store["keyAccount"] else 0,
                store["sellerId"],
                store["lat"],
                store["lng"],
            ),
        )
    for product in fixture["products"]:
        conn.execute(
            """
            insert into product
              (sku, name, category, shelf_life_days, abc_curve, planogram_facings,
               unit_price_cents, weight_kg)
            values (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                product["sku"],
                product["name"],
                product["category"],
                product["shelfLifeDays"],
                product["abc"],
                product["facings"],
                product["unitPriceCents"],
                product["weightKg"],
            ),
        )
    item_id = 1
    for invoice in fixture["invoices"]:
        conn.execute(
            "insert into invoice_header (id, issued_on, customer_id, seller_id) values (?, ?, ?, ?)",
            (invoice["id"], invoice["date"], invoice["storeId"], invoice["sellerId"]),
        )
        for line in invoice["lines"]:
            conn.execute(
                """
                insert into invoice_item (id, invoice_id, sku, qty, unit_price_cents)
                values (?, ?, ?, ?, ?)
                """,
                (item_id, invoice["id"], line["sku"], line["qty"], line["unitPriceCents"]),
            )
            item_id += 1
    conn.commit()


def extract(conn: sqlite3.Connection) -> list[dict]:
    return [dict(row) for row in conn.execute(EXTRACT_SQL)]
