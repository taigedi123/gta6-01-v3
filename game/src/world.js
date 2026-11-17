// The city itself: a road grid over ten districts, with buildings, trees,
// parks, a beach and a harbour, all placed once from a seeded RNG so the
// same seed always builds the same Vermilion Bay.
import { WORLD_W, WORLD_H, BLOCK, ROAD_W, DISTRICTS } from './config.js';
import { makeRng } from './util.js';

export function buildWorld(seed) {
  const rng = makeRng(seed || 20261118);
  const buildings = [];
  const trees = [];
  const parks = [];
  const props = []; // benches, hydrants, lamps, crates, containers
  // One building per city block (the space between roads), sometimes two.
  for (let bx = 0; bx < WORLD_W / BLOCK; bx++) {
    for (let by = 0; by < WORLD_H / BLOCK; by++) {
      const x0 = bx * BLOCK + ROAD_W / 2 + 14;
      const y0 = by * BLOCK + ROAD_W / 2 + 14;
      const x1 = (bx + 1) * BLOCK - ROAD_W / 2 - 14;
      const y1 = (by + 1) * BLOCK - ROAD_W / 2 - 14;
      if (x1 - x0 < 60 || y1 - y0 < 60) continue;
      // The south strip is beach, not buildings.
      if (y0 > WORLD_H - 160) continue;
      // Parks: a few blocks stay green.
      if (rng() < 0.10) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        for (let t = 0; t < 6; t++) {
          trees.push({ x: x0 + 20 + rng() * (x1 - x0 - 40), y: y0 + 20 + rng() * (y1 - y0 - 40), r: 9 + rng() * 7 });
        }
        continue;
      }
      const d = DISTRICTS.find((dd) => bx * BLOCK + BLOCK / 2 >= dd.x && bx * BLOCK + BLOCK / 2 < dd.x + dd.w
        && by * BLOCK + BLOCK / 2 >= dd.y && by * BLOCK + BLOCK / 2 < dd.y + dd.h);
      const two = rng() < 0.35;
      if (two) {
        const split = rng() < 0.5;
        if (split) {
          buildings.push(makeBuilding(rng, d, x0, y0, (x1 - x0) / 2 - 8, y1 - y0));
          buildings.push(makeBuilding(rng, d, x0 + (x1 - x0) / 2 + 8, y0, (x1 - x0) / 2 - 8, y1 - y0));
        } else {
          buildings.push(makeBuilding(rng, d, x0, y0, x1 - x0, (y1 - y0) / 2 - 8));
          buildings.push(makeBuilding(rng, d, x0, y0 + (y1 - y0) / 2 + 8, x1 - x0, (y1 - y0) / 2 - 8));
        }
      } else {
        buildings.push(makeBuilding(rng, d, x0, y0, x1 - x0, y1 - y0));
      }
      // Street trees and lamps along the block edges.
      if (rng() < 0.7) trees.push({ x: x0 + 8, y: y0 + 8, r: 8 + rng() * 5 });
      if (rng() < 0.5) trees.push({ x: x1 - 8, y: y1 - 8, r: 8 + rng() * 5 });
      if (rng() < 0.4) props.push({ kind: 'lamp', x: x0 + (x1 - x0) / 2, y: y0 - 6 });
      if (rng() < 0.25) props.push({ kind: 'bench', x: x0 + 30, y: y1 - 4 });
    }
  }
  // Docklands cranes and containers along the west harbour.
  for (let i = 0; i < 5; i++) {
    props.push({ kind: 'crane', x: 120 + i * 180, y: 1180 + (i % 2) * 300 });
  }
  for (let i = 0; i < 14; i++) {
    props.push({ kind: 'container', x: 180 + rng() * 700, y: 1300 + rng() * 700, c: ['#c85a2a', '#2a7d9e', '#d8a03c', '#4a7d5a'][i % 4] });
  }
  // Beach umbrellas and the pier.
  for (let i = 0; i < 10; i++) {
    props.push({ kind: 'umbrella', x: 200 + i * 200 + rng() * 60, y: WORLD_H - 100 + rng() * 30 });
  }
  return { seed, buildings, trees, parks, props };
}

function makeBuilding(rng, d, x, y, w, h) {
  const tall = rng() < 0.18;
  return {
    x, y, w, h,
    color: d ? d.build : '#c8c0a0',
    roof: d ? d.accent : '#8a7a5a',
    tall,
    hgt: tall ? 26 + rng() * 30 : 8 + rng() * 10,
    windows: Math.floor(2 + rng() * 4),
  };
}

// Is a world point on a road (within the road band, or on the beach strip)?
export function onRoad(x, y) {
  if (y > WORLD_H - 120) return true; // beach promenade
  const mx = ((x % BLOCK) + BLOCK) % BLOCK;
  const my = ((y % BLOCK) + BLOCK) % BLOCK;
  return mx < ROAD_W / 2 + 8 || mx > BLOCK - ROAD_W / 2 - 8 || my < ROAD_W / 2 + 8 || my > BLOCK - ROAD_W / 2 - 8;
}

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return DISTRICTS[0];
}

// Snap a point to the nearest road centre line.
export function nearestRoadPoint(x, y) {
  const rx = Math.round(x / BLOCK) * BLOCK;
  const ry = Math.round(y / BLOCK) * BLOCK;
  if (Math.abs(x - rx) < Math.abs(y - ry)) return { x: rx, y };
  return { x, y: ry };
}

// A random point on a road, anywhere in the city.
export function randomRoadPoint(rng) {
  const gx = Math.floor(rng() * (WORLD_W / BLOCK));
  const gy = Math.floor(rng() * (WORLD_H / BLOCK));
  if (rng() < 0.5) return { x: gx * BLOCK, y: gy * BLOCK + (rng() - 0.5) * (BLOCK - ROAD_W) };
  return { x: gx * BLOCK + (rng() - 0.5) * (BLOCK - ROAD_W), y: gy * BLOCK };
}
