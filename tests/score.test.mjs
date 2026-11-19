import assert from "node:assert/strict";
import test from "node:test";
import cases from "../shared/score-cases.json" with { type: "json" };
import {
  abcComponent,
  expiryComponent,
  priorityScore,
  recencyComponent,
  stockoutComponent,
  volumeComponent,
  WEIGHTS,
} from "../shared/score.js";

test("weights sum to 1", () => {
  const total = Object.values(WEIGHTS).reduce((sum, weight) => sum + weight, 0);
  assert.ok(Math.abs(total - 1) < 1e-12);
});

test("shared score cases match the published formula", () => {
  for (const item of cases) {
    assert.equal(priorityScore(item.parts), item.expected, item.name);
  }
});

test("component edges", () => {
  assert.equal(abcComponent("A"), 1);
  assert.equal(abcComponent("B"), 0.6);
  assert.equal(abcComponent("C"), 0.3);
  assert.equal(abcComponent("?"), 0.3);
  assert.equal(recencyComponent(null), 1);
  assert.equal(recencyComponent(0), 0);
  assert.equal(recencyComponent(21), 1);
  assert.equal(recencyComponent(40), 1);
  assert.equal(stockoutComponent(0), 0);
  assert.equal(stockoutComponent(3), 1);
  assert.equal(stockoutComponent(9), 1);
  assert.equal(expiryComponent(null), 0);
  assert.equal(expiryComponent(20), 0);
  assert.equal(expiryComponent(10), 0.5);
  assert.equal(expiryComponent(0), 1);
  assert.equal(expiryComponent(-4), 1);
  assert.equal(volumeComponent(0, 0, 0), 0);
  assert.equal(volumeComponent(5, 5, 5), 1);
  assert.equal(volumeComponent(5, 0, 10), 0.5);
});
