/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { bench, measure, rays } = require("../src/app/optics.ts");

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} differs from ${b}`);

test("image positions, orientation, and ray intersections agree", () => {
  const cases = [
    ["convex", 60, 30, -0.5, "real"],
    ["convex", 40, 40, -1, "real"],
    ["convex", 30, 60, -2, "real"],
    ["convex", 12, -30, 2.5, "virtual"],
    ["concave", 20, -10, 0.5, "virtual"],
  ];
  for (const [type, distance, v, m, nature] of cases) {
    const settings = { ...bench, type, distance, screen: Math.abs(v) };
    const result = measure(settings);
    close(result.v, v);
    close(result.m, m);
    close(result.height, m * bench.height);
    assert.equal(result.nature, nature);
    assert.equal(result.sharp, nature === "real");
    for (const ray of rays(settings)) close(ray.y + ray.slope * v, result.height);
  }
});

test("focal-plane rays are parallel and have no finite image", () => {
  const settings = { ...bench, distance: 20 };
  const result = measure(settings);
  assert.equal(result.v, null);
  assert.equal(result.m, null);
  assert.equal(result.sharp, false);
  assert.equal(result.nature, "parallel");
  const [parallel, centre] = rays(settings);
  close(parallel.slope, centre.slope);
});
