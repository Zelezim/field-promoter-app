"""Visit priority score. The formula matches shared/score.js exactly."""

from __future__ import annotations

import math

WEIGHTS = {
    "volume": 0.30,
    "abc": 0.20,
    "recency": 0.15,
    "stockout": 0.15,
    "key_account": 0.10,
    "expiry": 0.10,
}

ABC_SCORE = {"A": 1.0, "B": 0.6, "C": 0.3}


def clamp(value: float, low: float, high: float) -> float:
    return min(high, max(low, value))


def round1(value: float) -> float:
    """One decimal, half away from zero (not banker's rounding)."""
    sign = -1 if value < 0 else 1
    return sign * math.floor(abs(value) * 10 + 0.5) / 10


def abc_component(curve: str | None) -> float:
    return ABC_SCORE.get(curve or "", ABC_SCORE["C"])


def recency_component(days_since: int | None, cap: int = 21) -> float:
    if days_since is None:
        return 1.0
    return clamp(days_since / cap, 0.0, 1.0)


def stockout_component(events: int, cap: int = 3) -> float:
    return clamp(events / cap, 0.0, 1.0)


def expiry_component(days_left: int | None, horizon: int = 20) -> float:
    if days_left is None:
        return 0.0
    return clamp((horizon - days_left) / horizon, 0.0, 1.0)


def volume_component(volume: float, low: float, high: float) -> float:
    if high == low:
        return 1.0 if volume > 0 else 0.0
    return clamp((volume - low) / (high - low), 0.0, 1.0)


def key_account_component(is_key: bool) -> float:
    return 1.0 if is_key else 0.0


def priority_score(parts: dict[str, float]) -> float:
    raw = (
        WEIGHTS["volume"] * parts["volume"]
        + WEIGHTS["abc"] * parts["abc"]
        + WEIGHTS["recency"] * parts["recency"]
        + WEIGHTS["stockout"] * parts["stockout"]
        + WEIGHTS["key_account"] * parts["keyAccount"]
        + WEIGHTS["expiry"] * parts["expiry"]
    )
    return round1(raw * 100)
