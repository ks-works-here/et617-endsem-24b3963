export type Settings = { type: "convex" | "concave"; focal: number; distance: number; height: number; screen: number };
export const bench: Settings = { type: "convex", focal: 20, distance: 12, height: 5, screen: 40 };

export function measure(s: Settings) {
  const u = -s.distance;
  const f = s.type === "convex" ? s.focal : -s.focal;
  const v = u === -f ? null : 1 / (1 / f + 1 / u);
  const m = v === null ? null : v / u;
  return { u, f, v, m, height: m === null ? null : m * s.height, nature: v === null ? "parallel" : v > 0 ? "real" : "virtual", sharp: v !== null && v > 0 && Math.abs(v - s.screen) <= 0.5 };
}

export function rays(s: Settings) {
  const { f } = measure(s);
  const centreSlope = -s.height / s.distance;
  const focalRayHeight = f === s.distance ? null : s.height * f / (f - s.distance);
  return [
    { y: s.height, slope: -s.height / f },
    { y: 0, slope: centreSlope },
    ...(focalRayHeight === null ? [] : [{ y: focalRayHeight, slope: 0 }]),
  ];
}
