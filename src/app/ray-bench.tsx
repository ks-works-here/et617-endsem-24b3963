"use client";

import { useEffect, useRef } from "react";
import { measure, rays, type Settings } from "./optics";

export default function RayBench({ settings, reveal = true, rayCount = 3, screen = true }: {
  settings: Settings; reveal?: boolean; rayCount?: number; screen?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const result = measure(settings);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const width = canvas.width, height = canvas.height;
    const centre = width / 2, axis = height / 2;
    const scale = Math.min(5, (centre - 35) / Math.max(settings.distance, settings.screen, settings.focal, Math.min(150, Math.abs(result.v ?? 0))), (axis - 30) / Math.max(settings.height, Math.min(25, Math.abs(result.height ?? 0))));
    const x = (n: number) => centre + n * scale;
    const y = (n: number) => axis - n * scale;
    const edge = (centre - 10) / scale;
    function line(points: number[][], color: string, dashed = false, weight = 2) {
      ctx!.strokeStyle = color;
      ctx!.lineWidth = weight;
      ctx!.setLineDash(dashed ? [6, 5] : []);
      ctx!.beginPath();
      points.forEach(([a, b], i) => i ? ctx!.lineTo(x(a), y(b)) : ctx!.moveTo(x(a), y(b)));
      ctx!.stroke();
    }
    function arrow(position: number, h: number, color: string, dashed = false) {
      const tip = Math.min((axis - 18) / scale, Math.max(-(axis - 18) / scale, h));
      line([[position, 0], [position, tip]], color, dashed, 3);
      const base = tip - Math.sign(tip) * 8 / scale;
      line([[position - 5 / scale, base], [position, tip], [position + 5 / scale, base]], color);
    }
    ctx.fillStyle = "#0b1728";
    ctx.fillRect(0, 0, width, height);
    for (let tick = 0; tick < width; tick += 24) {
      ctx.fillStyle = "#15283d";
      ctx.fillRect(tick, 0, 1, height);
    }
    for (let tick = 0; tick < height; tick += 24) {
      ctx.fillStyle = "#15283d";
      ctx.fillRect(0, tick, width, 1);
    }
    line([[-edge, 0], [edge, 0]], "#7b8ca6", true, 1);
    const lensHeight = (axis - 25) / scale;
    const top = 25;
    const bottom = height - top;
    const convex = settings.type === "convex";
    const rim = convex ? 4 : 17;
    const curve = convex ? 32 : 3;
    const glass = ctx.createLinearGradient(centre - 25, 0, centre + 25, 0);
    glass.addColorStop(0, "#5dc7ee55");
    glass.addColorStop(0.5, "#b5edff35");
    glass.addColorStop(1, "#5dc7ee55");
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(centre - rim, top);
    ctx.lineTo(centre + rim, top);
    ctx.bezierCurveTo(centre + curve, top + 36, centre + curve, bottom - 36, centre + rim, bottom);
    ctx.lineTo(centre - rim, bottom);
    ctx.bezierCurveTo(centre - curve, bottom - 36, centre - curve, top + 36, centre - rim, top);
    ctx.closePath();
    ctx.fillStyle = glass;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#b5edff";
    ctx.stroke();
    line([[0, -lensHeight], [0, lensHeight]], "#b5edff70", true, 1);
    ctx.fillStyle = "#c5edff";
    ctx.font = "600 13px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(convex ? "Convex lens" : "Concave lens", centre, 17);
    ctx.textAlign = "start";
    for (const sign of [-1, 1]) {
      for (const n of [1, 2]) {
        const position = sign * n * settings.focal;
        if (Math.abs(position) > edge - 4) continue;
        ctx.fillStyle = "#bfcee2";
        ctx.fillRect(x(position) - 2, axis - 2, 4, 4);
        ctx.font = "12px system-ui";
        ctx.fillText(n === 1 ? "F" : "2F", x(position) - 5, axis + 20);
      }
    }
    if (screen) line([[settings.screen, -lensHeight], [settings.screen, lensHeight]], result.sharp && reveal ? "#5ee4a4" : "#8799aa", true);
    arrow(-settings.distance, settings.height, "#ffcf79");
    rays(settings).slice(0, rayCount).forEach((ray, i) => {
      const color = ["#4ddce9", "#a48bff", "#ffab78"][i];
      if (Math.abs(ray.y) > lensHeight) return;
      line([[-settings.distance, settings.height], [0, ray.y], [edge, ray.y + ray.slope * edge]], color);
      if (reveal && result.v !== null && result.v < 0) {
        const end = Math.max(result.v, -edge);
        line([[0, ray.y], [end, ray.y + ray.slope * end]], color, true);
      }
    });
    if (reveal && result.v !== null && result.height !== null && Math.abs(result.v) < edge) arrow(result.v, result.height, "#5ee4a4", result.v < 0);
  }, [settings, result.v, result.height, result.sharp, reveal, rayCount, screen]);
  return <figure className="bench"><canvas ref={ref} width={768} height={330} role="img" aria-label={reveal ? `Ray diagram, ${settings.type} lens, ${result.nature} outcome` : `Partial ray diagram for a ${settings.type} lens`} />
    <figcaption className="ray-legend"><span style={{ color: "#ffcf79" }}>Object</span><span style={{ color: "#4ddce9" }}>Parallel incident ray</span>{rayCount >= 2 && <span style={{ color: "#a48bff" }}>Centre ray</span>}{rayCount === 3 && <span style={{ color: "#ffab78" }}>Focal ray</span>}{screen && <span>Movable screen</span>}{reveal && result.v !== null && <span style={{ color: "#5ee4a4" }}>{result.v < 0 ? "Dashed virtual image" : "Real image"}</span>}</figcaption>
  </figure>;
}
