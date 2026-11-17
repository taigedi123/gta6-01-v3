// The living city: weather that rolls in and out, and random street events
// — a brawl, an ambulance crossing town, a rival ambush, a lucky stash —
// so no two drives through Vermilion Bay feel the same.
import { WEATHER, PLACES } from './config.js';
import { dist } from './util.js';
import { spawnEnforcer } from './pedestrians.js';
import { dropPickup } from './player.js';
import { sfx } from './audio.js';

export function makeWeather() {
  return { kind: 'clear', timer: 60, rainDrops: [] };
}

export function updateWeather(G, dt) {
  const w = G.weather;
  w.timer -= dt;
  if (w.timer <= 0) {
    const kinds = WEATHER.kinds;
    let next = kinds[Math.floor(Math.random() * kinds.length)];
    if (next === w.kind) next = 'clear';
    w.kind = next;
    w.timer = WEATHER.minDuration + Math.random() * (WEATHER.maxDuration - WEATHER.minDuration);
    if (next === 'rain') { G.message = 'Rain over Vermilion Bay — roads are slick.'; G.messageTimer = 3; }
    if (next === 'storm') { G.message = 'A storm is rolling in off the bay.'; G.messageTimer = 3; }
    if (next === 'fog') { G.message = 'Fog drifting in from the harbour.'; G.messageTimer = 3; }
    if (next === 'clear') { G.message = 'The sun is back out over the Bay.'; G.messageTimer = 3; }
  }
  // Rain streaks fall across the screen.
  if (w.kind === 'rain' || w.kind === 'storm') {
    const n = w.kind === 'storm' ? 3 : 2;
    for (let i = 0; i < n; i++) {
      w.rainDrops.push({
        x: G.camera.x + Math.random() * 1280, y: G.camera.y - 20,
        vy: 700 + Math.random() * 300, life: 1.2,
      });
    }
  }
  for (let i = w.rainDrops.length - 1; i >= 0; i--) {
    const d = w.rainDrops[i];
    d.y += d.vy * dt;
    d.x += (w.kind === 'storm' ? 160 : 60) * dt;
    d.life -= dt;
    if (d.life <= 0 || d.y > G.camera.y + 820) w.rainDrops.splice(i, 1);
  }
  if (w.rainDrops.length > 400) w.rainDrops.splice(0, w.rainDrops.length - 400);
}

export function updateEvents(G, dt) {
  G.eventTimer -= dt;
  if (G.eventTimer > 0) return;
  G.eventTimer = 35 + Math.random() * 45;
  const p = G.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  const roll = Math.random();
  if (roll < 0.28) {
    // Street brawl: two enforcers scrapping near the player.
    spawnEnforcer(G, px + 120, py - 80);
    spawnEnforcer(G, px + 160, py + 40);
    G.message = 'A street brawl broke out nearby — Marconi muscle.';
    G.messageTimer = 3;
    sfx('horn');
  } else if (roll < 0.48) {
    // Lucky stash: cash hidden near the player.
    const spots = [PLACES.diner, PLACES.club, PLACES.beach, PLACES.campus, PLACES.midtown];
    const s = spots[Math.floor(Math.random() * spots.length)];
    dropPickup(G, 'stash', s.x + (Math.random() - 0.5) * 200, s.y + (Math.random() - 0.5) * 200, 250 + Math.floor(Math.random() * 250));
    G.message = 'Word on the street: someone stashed cash near ' + s.label + '.';
    G.messageTimer = 4;
  } else if (roll < 0.68) {
    // Rival ambush: enforcers spawn and open fire.
    for (let i = 0; i < 2; i++) spawnEnforcer(G, px + (Math.random() - 0.5) * 300, py + (Math.random() - 0.5) * 300);
    G.message = 'Marconi ambush! They found you.';
    G.messageTimer = 3;
    sfx('wanted');
  } else if (roll < 0.84) {
    // A health pickup appears at the hospital.
    dropPickup(G, 'health', PLACES.hospital.x + 40, PLACES.hospital.y + 40, 0);
    G.message = 'Bay General left a medkit outside — free, if you hurry.';
    G.messageTimer = 3;
  } else {
    // Armour drop at the gun shop.
    dropPickup(G, 'armor', PLACES.gunshop.x + 60, PLACES.gunshop.y - 40, 0);
    G.message = 'Iron & Oak is giving away a vest sample — grab it.';
    G.messageTimer = 3;
  }
}
