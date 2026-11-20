from datetime import date

from vale_verde_etl.erp import EXTRACT_SQL, connect, init_erp
from vale_verde_etl.transform import (
    estimate_expiry,
    line_revenue_cents,
    recompute_store_abc,
    transform_row,
)


def test_expiry_is_invoice_date_plus_shelf_life():
    assert estimate_expiry(date(2026, 11, 4), 21) == date(2026, 11, 25)


def test_revenue_is_qty_times_cents():
    assert line_revenue_cents(4, 1890) == 7560


def test_transform_row_carries_the_estimate():
    line = transform_row(
        {
            "invoice_id": "NF-1",
            "issued_on": "2026-11-04",
            "store_id": "store_serra_clara",
            "seller_id": "seller_otavio",
            "sku": "VV-FRE-500",
            "qty": 4,
            "unit_price_cents": 1890,
            "shelf_life_days": 21,
        }
    )
    assert line.revenue_cents == 7560
    assert line.estimated_expiry == date(2026, 11, 25)


def test_abc_pareto_bands():
    curve = recompute_store_abc({"a": 50, "b": 30, "c": 15, "d": 5})
    assert curve == {"a": "A", "b": "A", "c": "B", "d": "C"}


def test_extract_joins_header_item_product_customer_seller_and_drops_orphans(tmp_path):
    conn = connect(tmp_path / "erp.sqlite")
    init_erp(conn)
    conn.execute(
        "insert into seller (id, name, email) values ('seller_otavio', 'Otávio Lima', 'otavio.lima@vale-verde.example')"
    )
    conn.execute(
        """
        insert into customer (id, name, city, abc_curve, key_account, seller_id, latitude, longitude)
        values ('store_serra_clara', 'Mercado Serra Clara', 'Serra Clara', 'A', 1, 'seller_otavio', 0, 0)
        """
    )
    conn.execute(
        """
        insert into product (sku, name, category, shelf_life_days, abc_curve, planogram_facings, unit_price_cents, weight_kg)
        values ('VV-FRE-500', 'Queijo', 'cheese', 21, 'A', 4, 1890, 0.5)
        """
    )
    conn.execute(
        "insert into invoice_header (id, issued_on, customer_id, seller_id) values ('NF-1', '2026-11-04', 'store_serra_clara', 'seller_otavio')"
    )
    conn.execute(
        "insert into invoice_item (id, invoice_id, sku, qty, unit_price_cents) values (1, 'NF-1', 'VV-FRE-500', 4, 1890)"
    )
    conn.execute(
        "insert into invoice_item (id, invoice_id, sku, qty, unit_price_cents) values (2, 'NF-1', 'MISSING-SKU', 1, 100)"
    )
    conn.commit()

    rows = [dict(row) for row in conn.execute(EXTRACT_SQL)]
    assert len(rows) == 1
    assert rows[0]["sku"] == "VV-FRE-500"
    assert rows[0]["store_name"] == "Mercado Serra Clara"
    assert rows[0]["seller_name"] == "Otávio Lima"
    joined = " ".join(EXTRACT_SQL.split())
    assert "join invoice_item" in joined
    assert "join product" in joined
    assert "join customer" in joined
    assert "join seller" in joined
    conn.close()
