"""Write shared/fixture.json. All names, stores, and documents are fictional."""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "etl"))

from vale_verde_etl.agenda import build_agenda  # noqa: E402
from vale_verde_etl.history import build_visits  # noqa: E402

DEMO_TODAY = "2026-11-19"
WEEK_PARITY = date(2026, 11, 19).isocalendar().week % 2

PRODUCTS = [
    {"sku": "VV-FRE-500", "name": "Queijo Minas Frescal 500g", "nameEn": "Minas fresh cheese 500g", "category": "cheese", "shelfLifeDays": 21, "abc": "A", "facings": 4, "unitPriceCents": 1890, "weightKg": 0.5},
    {"sku": "VV-MUS-150", "name": "Mussarela fatiada 150g", "nameEn": "Sliced mozzarella 150g", "category": "cheese", "shelfLifeDays": 40, "abc": "A", "facings": 6, "unitPriceCents": 950, "weightKg": 0.15},
    {"sku": "VV-PRA-400", "name": "Queijo prato 400g", "nameEn": "Prato cheese 400g", "category": "cheese", "shelfLifeDays": 50, "abc": "B", "facings": 3, "unitPriceCents": 2200, "weightKg": 0.4},
    {"sku": "VV-MAN-200", "name": "Manteiga com sal 200g", "nameEn": "Salted butter 200g", "category": "butter", "shelfLifeDays": 120, "abc": "A", "facings": 5, "unitPriceCents": 1140, "weightKg": 0.2},
    {"sku": "VV-MAN-200-U", "name": "Manteiga sem sal 200g", "nameEn": "Unsalted butter 200g", "category": "butter", "shelfLifeDays": 120, "abc": "B", "facings": 3, "unitPriceCents": 1210, "weightKg": 0.2},
    {"sku": "VV-REQ-220", "name": "Requeijão cremoso 220g", "nameEn": "Creamy requeijão 220g", "category": "requeijao", "shelfLifeDays": 70, "abc": "A", "facings": 5, "unitPriceCents": 890, "weightKg": 0.22},
    {"sku": "VV-REQ-180-L", "name": "Requeijão light 180g", "nameEn": "Light requeijão 180g", "category": "requeijao", "shelfLifeDays": 70, "abc": "C", "facings": 2, "unitPriceCents": 940, "weightKg": 0.18},
    {"sku": "VV-BLM-200", "name": "Bebida láctea morango 200ml", "nameEn": "Strawberry dairy drink 200ml", "category": "drink", "shelfLifeDays": 150, "abc": "A", "facings": 8, "unitPriceCents": 240, "weightKg": 0.2},
    {"sku": "VV-BLC-1000", "name": "Bebida láctea chocolate 1L", "nameEn": "Chocolate dairy drink 1L", "category": "drink", "shelfLifeDays": 150, "abc": "B", "facings": 4, "unitPriceCents": 780, "weightKg": 1.0},
    {"sku": "VV-LEI-1000", "name": "Leite integral UHT 1L", "nameEn": "Whole UHT milk 1L", "category": "milk", "shelfLifeDays": 180, "abc": "A", "facings": 8, "unitPriceCents": 490, "weightKg": 1.03},
    {"sku": "VV-LED-1000", "name": "Leite desnatado UHT 1L", "nameEn": "Skim UHT milk 1L", "category": "milk", "shelfLifeDays": 180, "abc": "B", "facings": 4, "unitPriceCents": 510, "weightKg": 1.03},
    {"sku": "VV-LEZ-1000", "name": "Leite zero lactose 1L", "nameEn": "Lactose-free milk 1L", "category": "milk", "shelfLifeDays": 120, "abc": "B", "facings": 3, "unitPriceCents": 670, "weightKg": 1.03},
]

PEOPLE = [
    {"id": "promo_camila", "name": "Camila Duarte", "role": "promoter", "routeName": "Serra Norte", "email": "camila.duarte@vale-verde.example"},
    {"id": "promo_henrique", "name": "Henrique Lopes", "role": "promoter", "routeName": "Vale Central", "email": "henrique.lopes@vale-verde.example"},
    {"id": "promo_beatriz", "name": "Beatriz Nunes", "role": "promoter", "routeName": "Rota Leste", "email": "beatriz.nunes@vale-verde.example"},
    {"id": "seller_otavio", "name": "Otávio Lima", "role": "seller", "email": "otavio.lima@vale-verde.example"},
    {"id": "seller_marina", "name": "Marina Costa", "role": "seller", "email": "marina.costa@vale-verde.example"},
    {"id": "manager_renata", "name": "Renata Pacheco", "role": "manager", "routeName": "All routes", "email": "renata.pacheco@vale-verde.example"},
]

STORES = [
    {"id": "store_serra_clara", "name": "Mercado Serra Clara", "city": "Serra Clara", "address": "Rua das Vertentes, 120", "abc": "A", "keyAccount": True, "sellerId": "seller_otavio", "lat": -21.2500, "lng": -44.9000, "channel": "supermarket"},
    {"id": "store_padaria_aurora", "name": "Padaria Aurora", "city": "Serra Clara", "address": "Travessa do Pão, 45", "abc": "C", "keyAccount": False, "sellerId": "seller_otavio", "lat": -21.2560, "lng": -44.8920, "channel": "bakery"},
    {"id": "store_emporio_flores", "name": "Empório das Flores", "city": "Ribeirão das Flores", "address": "Avenida das Flores, 800", "abc": "B", "keyAccount": False, "sellerId": "seller_otavio", "lat": -21.3100, "lng": -44.8600, "channel": "emporium"},
    {"id": "store_trevo", "name": "Conveniência do Trevo", "city": "Serra Clara", "address": "Estrada do Trevo, s/n", "abc": "C", "keyAccount": False, "sellerId": "seller_otavio", "lat": -21.2420, "lng": -44.9180, "channel": "convenience"},
    {"id": "store_super_ribeiro", "name": "Super Ribeiro", "city": "Ribeirão das Flores", "address": "Rua Ribeiro de Cima, 310", "abc": "A", "keyAccount": True, "sellerId": "seller_otavio", "lat": -21.3020, "lng": -44.8480, "channel": "supermarket"},
    {"id": "store_hortifruti", "name": "Hortifruti Bela Serra", "city": "Serra Clara", "address": "Alameda Bela Serra, 77", "abc": "B", "keyAccount": False, "sellerId": "seller_marina", "lat": -21.2610, "lng": -44.9050, "channel": "grocery"},
    {"id": "store_vila_aurora", "name": "Mercado Vila Aurora", "city": "Vila Aurora", "address": "Praça da Vila, 12", "abc": "B", "keyAccount": False, "sellerId": "seller_marina", "lat": -21.2200, "lng": -44.9400, "channel": "supermarket"},
    {"id": "store_atacado_porto", "name": "Atacado Porto Leite", "city": "Porto Leite", "address": "Rodovia do Leite, km 3", "abc": "A", "keyAccount": True, "sellerId": "seller_marina", "lat": -21.1800, "lng": -44.8000, "channel": "cash_and_carry"},
    {"id": "store_estrela", "name": "Supermercado Estrela do Vale", "city": "Porto Leite", "address": "Rua da Estrela, 500", "abc": "B", "keyAccount": False, "sellerId": "seller_marina", "lat": -21.1880, "lng": -44.8120, "channel": "supermarket"},
    {"id": "store_mini_nova", "name": "Mini Mercado Vila Nova", "city": "Vila Aurora", "address": "Beco Novo, 8", "abc": "C", "keyAccount": False, "sellerId": "seller_otavio", "lat": -21.2280, "lng": -44.9510, "channel": "minimarket"},
    {"id": "store_margarida", "name": "Empório Santa Margarida", "city": "Santa Margarida", "address": "Largo Santa Margarida, 19", "abc": "B", "keyAccount": False, "sellerId": "seller_marina", "lat": -21.1500, "lng": -44.8300, "channel": "emporium"},
    {"id": "store_km12", "name": "Mercado do Km 12", "city": "Km 12", "address": "Estrada Municipal, km 12", "abc": "C", "keyAccount": False, "sellerId": "seller_otavio", "lat": -21.2700, "lng": -44.9800, "channel": "minimarket"},
]

FULL = [product["sku"] for product in PRODUCTS]
ASSORTMENT = {
    "store_serra_clara": FULL,
    "store_super_ribeiro": FULL,
    "store_atacado_porto": FULL,
    "store_estrela": FULL,
    "store_hortifruti": ["VV-FRE-500", "VV-MUS-150", "VV-MAN-200", "VV-REQ-220", "VV-BLM-200", "VV-BLC-1000", "VV-LEI-1000", "VV-LEZ-1000"],
    "store_emporio_flores": ["VV-FRE-500", "VV-MUS-150", "VV-PRA-400", "VV-MAN-200", "VV-REQ-220", "VV-BLM-200", "VV-LEI-1000"],
    "store_margarida": ["VV-MUS-150", "VV-PRA-400", "VV-MAN-200", "VV-REQ-220", "VV-BLM-200", "VV-LEI-1000"],
    "store_vila_aurora": ["VV-FRE-500", "VV-MUS-150", "VV-MAN-200", "VV-REQ-220", "VV-BLM-200", "VV-LEI-1000"],
    "store_mini_nova": ["VV-MUS-150", "VV-MAN-200", "VV-REQ-220", "VV-BLM-200", "VV-LEI-1000"],
    "store_padaria_aurora": ["VV-MAN-200", "VV-MAN-200-U", "VV-REQ-220", "VV-BLM-200"],
    "store_trevo": ["VV-BLM-200", "VV-BLC-1000", "VV-LEI-1000", "VV-LED-1000", "VV-REQ-220"],
    "store_km12": ["VV-LEI-1000", "VV-MAN-200", "VV-BLM-200", "VV-REQ-220"],
}
BASE_QTY = {
    "VV-FRE-500": 4,
    "VV-MUS-150": 8,
    "VV-PRA-400": 3,
    "VV-MAN-200": 6,
    "VV-MAN-200-U": 3,
    "VV-REQ-220": 6,
    "VV-REQ-180-L": 2,
    "VV-BLM-200": 12,
    "VV-BLC-1000": 4,
    "VV-LEI-1000": 10,
    "VV-LED-1000": 5,
    "VV-LEZ-1000": 4,
}
SCALE = {
    "store_serra_clara": 8,
    "store_super_ribeiro": 7,
    "store_atacado_porto": 11,
    "store_estrela": 4,
    "store_hortifruti": 4,
    "store_emporio_flores": 3,
    "store_margarida": 3,
    "store_vila_aurora": 2,
    "store_mini_nova": 2,
    "store_padaria_aurora": 1,
    "store_trevo": 1,
    "store_km12": 1,
}
INVOICE_DATES = ["2026-10-22", "2026-10-29", "2026-11-05", "2026-11-12", "2026-11-18"]
PRICE = {product["sku"]: product["unitPriceCents"] for product in PRODUCTS}


def route(promoter, store, weekday, shift, order, frequency="weekly", week_parity=0):
    return {
        "promoterId": promoter,
        "storeId": store,
        "weekday": weekday,
        "shift": shift,
        "order": order,
        "frequency": frequency,
        "weekParity": week_parity,
    }


def build_routes():
    return [
        route("promo_camila", "store_mini_nova", 1, "morning", 1),
        route("promo_camila", "store_serra_clara", 1, "morning", 2),
        route("promo_camila", "store_hortifruti", 2, "morning", 1),
        route("promo_camila", "store_padaria_aurora", 3, "morning", 1),
        route("promo_camila", "store_serra_clara", 4, "morning", 1),
        route("promo_camila", "store_padaria_aurora", 4, "morning", 2),
        route("promo_camila", "store_emporio_flores", 4, "morning", 3, "biweekly", WEEK_PARITY),
        route("promo_camila", "store_trevo", 4, "morning", 4),
        route("promo_camila", "store_super_ribeiro", 4, "afternoon", 1),
        route("promo_camila", "store_hortifruti", 4, "afternoon", 2),
        route("promo_camila", "store_vila_aurora", 4, "afternoon", 3),
        route("promo_camila", "store_mini_nova", 5, "morning", 1),
        route("promo_henrique", "store_atacado_porto", 1, "afternoon", 1),
        route("promo_henrique", "store_estrela", 2, "afternoon", 1),
        route("promo_henrique", "store_margarida", 3, "afternoon", 1),
        route("promo_henrique", "store_atacado_porto", 4, "morning", 1),
        route("promo_henrique", "store_estrela", 4, "morning", 2),
        route("promo_henrique", "store_margarida", 4, "afternoon", 1),
        route("promo_henrique", "store_atacado_porto", 5, "morning", 1),
        route("promo_beatriz", "store_km12", 1, "morning", 1),
        route("promo_beatriz", "store_km12", 4, "afternoon", 1),
        route("promo_beatriz", "store_km12", 5, "morning", 1),
    ]


def build_invoices():
    sellers = {store["id"]: store["sellerId"] for store in STORES}
    invoices = []
    number = 260001
    for store_id, skus in ASSORTMENT.items():
        for issued_on in INVOICE_DATES:
            lines = []
            for sku in skus:
                if store_id == "store_serra_clara" and sku == "VV-FRE-500" and issued_on >= "2026-11-05":
                    continue
                qty = BASE_QTY[sku] * SCALE[store_id]
                lines.append({"sku": sku, "qty": qty, "unitPriceCents": PRICE[sku], "revenueCents": qty * PRICE[sku]})
            invoices.append({
                "id": f"NF-{number}",
                "date": issued_on,
                "storeId": store_id,
                "sellerId": sellers[store_id],
                "lines": lines,
            })
            number += 1
    frescal_qty = BASE_QTY["VV-FRE-500"] * SCALE["store_serra_clara"]
    invoices.append({
        "id": f"NF-{number}",
        "date": "2026-11-04",
        "storeId": "store_serra_clara",
        "sellerId": sellers["store_serra_clara"],
        "lines": [{
            "sku": "VV-FRE-500",
            "qty": frescal_qty,
            "unitPriceCents": PRICE["VV-FRE-500"],
            "revenueCents": frescal_qty * PRICE["VV-FRE-500"],
        }],
    })
    invoices.sort(key=lambda invoice: (invoice["date"], invoice["id"]))
    return invoices


def build_fixture():
    fixture = {
        "brand": "Vale Verde Dairy",
        "product": "Rota Clara",
        "demoToday": DEMO_TODAY,
        "disclaimer": "Fictional data for a public portfolio. Not a real dairy, store, person, or ERP.",
        "products": PRODUCTS,
        "people": PEOPLE,
        "stores": STORES,
        "routes": build_routes(),
        "invoices": build_invoices(),
        "stockouts": [
            {"id": "so-01", "date": "2026-11-16", "storeId": "store_serra_clara", "sku": "VV-LEZ-1000", "reason": "supplier"},
            {"id": "so-02", "date": "2026-11-10", "storeId": "store_serra_clara", "sku": "VV-FRE-500", "reason": "shelf"},
            {"id": "so-03", "date": "2026-11-17", "storeId": "store_hortifruti", "sku": "VV-BLM-200", "reason": "shelf"},
            {"id": "so-04", "date": "2026-11-15", "storeId": "store_hortifruti", "sku": "VV-REQ-220", "reason": "space"},
            {"id": "so-05", "date": "2026-11-12", "storeId": "store_hortifruti", "sku": "VV-MAN-200", "reason": "price"},
            {"id": "so-06", "date": "2026-11-18", "storeId": "store_vila_aurora", "sku": "VV-REQ-220", "reason": "no_order"},
            {"id": "so-07", "date": "2026-11-11", "storeId": "store_emporio_flores", "sku": "VV-PRA-400", "reason": "expiry"},
            {"id": "so-old", "date": "2026-10-20", "storeId": "store_serra_clara", "sku": "VV-LEI-1000", "reason": "supplier"},
        ],
        "missedStoresBeforeToday": ["store_vila_aurora"],
        "missedStopIds": ["2026-11-16:promo_henrique:store_atacado_porto"],
        "shelfPresets": {
            "store_serra_clara": {
                "VV-FRE-500": {"onHand": 3, "facings": 2},
                "VV-LEZ-1000": {"onHand": 0, "facings": 0, "reason": "supplier"},
            },
            "store_hortifruti": {
                "VV-BLM-200": {"onHand": 0, "facings": 0, "reason": "shelf"},
                "VV-REQ-220": {"onHand": 2, "facings": 2, "reason": "space"},
            },
        },
    }
    fixture["visits"] = build_visits(fixture)
    return fixture


def render(fixture: dict) -> str:
    return json.dumps(fixture, indent=2, ensure_ascii=False) + "\n"


def main():
    fixture = build_fixture()
    target = ROOT / "shared" / "fixture.json"
    text = render(fixture)
    if "--check" in sys.argv:
        current = target.read_text(encoding="utf-8") if target.exists() else ""
        if current != text:
            raise SystemExit("shared/fixture.json is stale. Run: python scripts/generate_fixture.py")
        return
    target.write_text(text, encoding="utf-8")
    if "--quiet" in sys.argv:
        return
    stores = {store["id"]: store for store in fixture["stores"]}
    products = {product["sku"]: product for product in fixture["products"]}
    stops = build_agenda(
        promoter_id="promo_camila",
        visit_date=DEMO_TODAY,
        routes=fixture["routes"],
        stores_by_id=stores,
        products_by_sku=products,
        invoices=fixture["invoices"],
        visits=fixture["visits"],
        stockouts=fixture["stockouts"],
    )
    print(f"Wrote {target} ({len(fixture['invoices'])} invoices, {len(fixture['visits'])} visits)")
    for stop in stops:
        print(
            f"  {stop['score']:5.1f}  {stop['shift'][:2]}  {stores[stop['storeId']]['name']:<28} "
            f"vol={stop['parts']['volume']:.2f} abc={stop['parts']['abc']:.1f} "
            f"rec={stop['parts']['recency']:.2f} so={stop['parts']['stockout']:.2f} "
            f"key={stop['parts']['keyAccount']:.0f} exp={stop['parts']['expiry']:.2f} "
            f"days={stop['daysSinceVisit']}"
        )


if __name__ == "__main__":
    main()
