import json
import sqlite3
import subprocess
from pathlib import Path

from vale_verde_etl.pipeline import load_json, run_pipeline

ROOT = Path(__file__).resolve().parents[2]


def test_pipeline_loads_every_line_and_ranks_the_route(tmp_path):
    fixture = load_json(ROOT / "shared" / "fixture.json")
    stops = run_pipeline(
        fixture,
        tmp_path / "erp.sqlite",
        tmp_path / "warehouse.sqlite",
        "2026-11-19",
        "promo_camila",
    )
    by_store = {stop["storeId"]: stop for stop in stops}
    assert len(stops) == 7
    assert by_store["store_serra_clara"]["score"] > by_store["store_padaria_aurora"]["score"]
    assert by_store["store_serra_clara"]["lot"]["daysLeft"] == 6

    conn = sqlite3.connect(tmp_path / "warehouse.sqlite")
    lines = conn.execute("select count(*) from fact_shipment_line").fetchone()[0]
    expected = sum(len(invoice["lines"]) for invoice in fixture["invoices"])
    assert lines == expected
    stored = conn.execute(
        "select score from agenda_stop where store_id = ?",
        ("store_serra_clara",),
    ).fetchone()[0]
    assert stored == by_store["store_serra_clara"]["score"]
    conn.close()


def test_javascript_parity(tmp_path):
    raw = subprocess.check_output(["node", "scripts/dump-agenda.mjs"], cwd=ROOT, text=True)
    javascript = {stop["id"]: stop for stop in json.loads(raw)}
    fixture = load_json(ROOT / "shared" / "fixture.json")
    python_stops = run_pipeline(
        fixture,
        tmp_path / "erp.sqlite",
        tmp_path / "warehouse.sqlite",
        "2026-11-19",
    )
    assert len(python_stops) == len(javascript)
    for stop in python_stops:
        other = javascript[stop["id"]]
        assert stop["score"] == other["score"]
        assert stop["daysSinceVisit"] == other["daysSinceVisit"]
        assert stop["volumeCents"] == other["volumeCents"]
        assert stop["stockoutEvents14d"] == other["stockoutEvents14d"]
        for key, value in stop["parts"].items():
            assert abs(value - other["parts"][key]) < 1e-9
        if stop["lot"] is None:
            assert other["lot"] is None
        else:
            assert stop["lot"]["daysLeft"] == other["lot"]["daysLeft"]
            assert stop["lot"]["sku"] == other["lot"]["sku"]
