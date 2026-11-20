"""Run the nightly job against the committed fictional fixture."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from vale_verde_etl.pipeline import load_json, run_pipeline

ROOT = Path(__file__).resolve().parents[2]


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build the Vale Verde next-day agenda from the fictional ERP."
    )
    parser.add_argument("--fixture", default=str(ROOT / "shared" / "fixture.json"))
    parser.add_argument("--erp", default=str(ROOT / "etl" / ".local" / "erp.sqlite"))
    parser.add_argument("--warehouse", default=str(ROOT / "etl" / ".local" / "warehouse.sqlite"))
    parser.add_argument("--date", default="2026-11-19")
    parser.add_argument("--promoter", default="promo_camila")
    parser.add_argument("--json", action="store_true", dest="as_json")
    args = parser.parse_args()

    for path in (args.erp, args.warehouse):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        if Path(path).exists():
            Path(path).unlink()

    fixture = load_json(args.fixture)
    stops = run_pipeline(fixture, args.erp, args.warehouse, args.date, args.promoter)
    if args.as_json:
        print(json.dumps(stops, ensure_ascii=False, indent=2))
        return

    print(f"Vale Verde Dairy — agenda {args.date} — {args.promoter}")
    print(f"{'score':>6}  {'shift':<10} {'store':<28} signals")
    stores = {store["id"]: store["name"] for store in fixture["stores"]}
    for stop in stops:
        flags = []
        if stop["parts"]["keyAccount"]:
            flags.append("key")
        if stop["stockoutEvents14d"]:
            flags.append(f"stockout×{stop['stockoutEvents14d']}")
        if stop["daysSinceVisit"] is None:
            flags.append("no recent visit")
        elif stop["daysSinceVisit"] >= 14:
            flags.append(f"{stop['daysSinceVisit']}d")
        if stop["lot"] and stop["lot"]["daysLeft"] <= 10:
            flags.append(f"expiry {stop['lot']['daysLeft']}d")
        print(
            f"{stop['score']:6.1f}  {stop['shift']:<10} {stores[stop['storeId']]:<28} {', '.join(flags)}"
        )


if __name__ == "__main__":
    main()
