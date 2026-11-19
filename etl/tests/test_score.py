import json
from pathlib import Path

from vale_verde_etl.score import (
    abc_component,
    expiry_component,
    priority_score,
    recency_component,
    round1,
    stockout_component,
    volume_component,
)

ROOT = Path(__file__).resolve().parents[2]
CASES = json.loads((ROOT / "shared" / "score-cases.json").read_text(encoding="utf-8"))


def test_score_cases_match_javascript_contract():
    for case in CASES:
        assert priority_score(case["parts"]) == case["expected"]


def test_round_half_away_from_zero():
    assert round1(1.25) == 1.3
    assert round1(1.24) == 1.2


def test_component_edges():
    assert abc_component("A") == 1
    assert abc_component(None) == 0.3
    assert recency_component(None) == 1
    assert recency_component(21) == 1
    assert stockout_component(3) == 1
    assert expiry_component(None) == 0
    assert expiry_component(10) == 0.5
    assert volume_component(0, 0, 0) == 0
    assert volume_component(4, 0, 8) == 0.5
