// Pedestrians and the law: walkers who stroll, flee gunfire and call the
// police, cops who chase on foot and in patrol cars, roadblocks, and the
// helicopter that hunts the player at four stars and up.
import { WORLD_W, WORLD_H, WANTED } from './config.js';
import { clamp, dist, angleDiff, makeRng } from './util.js';
import { onRoad, randomRoadPoint } from './world.js';
import { makeVehicle, damageCar } from './vehicles.js';
import { sfx } from './audio.js';
import { burst, floatText } from './particles.js';

const PED_COLORS = ['#d8a03c', '#3c7dc8', '#c83c6a', '#4a9e5a', '#8a5a9e', '#e8e8e8', '#3c3c3c'];

export function spawnPeds(G, n) {
  const rng = makeRng(99);
  for (let i = 0; i < n; i++) {
    const p = randomRoadPoint(rng);
    G.peds.push({
      x: p.x, y: p.y, angle: rng() * Math.PI * 2,
      hp: 50, kind: 'ped', speed: 30 + rng() * 40,
      color: PED_COLORS[i % PED_COLORS.length],
      state: 'walk', stateTimer: 2 + rng() * 4,
      targetX: p.x, targetY: p.y,
    });
  }
}

export function spawnCop(G, x, y) {
  const cop = {
    x, y, angle: 0, hp: 60, kind: 'cop', speed: 150,
    color: '#2a4a8a', state: 'chase', stateTimer: 0,
    targetX: x, targetY: y,
  };
  G.cops.push(cop);
  return cop;
}

export function spawnEnforcer(G, x, y) {
  const e = {
    x, y, angle: 0, hp: 80, kind: 'enforcer', speed: 110,
    color: '#5a1a1a', state: 'guard', stateTimer: 0,
    targetX: x, targetY: y,
  };
  G.peds.push(e);
  return e;
}

export function addWanted(G, n) {
  const p = G.player;
  const before = p.wanted || 0;
  p.wanted = clamp(before + n, 0, 5);
  p.seenTimer = 8;
  if (p.wanted > before) {
    if (p.wanted >= 3) sfx('wanted');
    else if (p.wanted >= 1) sfx('siren');
    if (p.wanted >= WANTED.roadblockAt && !G.roadblock) spawnRoadblock(G);
  }
}

export function spawnRoadblock(G) {
  const p = G.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  // Two patrol cars parked across the road ahead of the player.
  const a = p.angle || 0;
  const bx = px + Math.cos(a) * 420;
  const by = py + Math.sin(a) * 420;
  G.roadblock = { x: bx, y: by, life: 25 };
  const c1 = makeVehicle('police', bx, by - 40, a + Math.PI / 2);
  c1.driver = 'cop';
  const c2 = makeVehicle('police', bx, by + 40, a + Math.PI / 2);
  c2.driver = 'cop';
  G.cars.push(c1, c2);
  spawnCop(G, bx - 60, by);
  spawnCop(G, bx + 60, by);
  G.message = 'Roadblock ahead! The Bay PD is closing in.';
  G.messageTimer = 3;
}

function pedStep(G, ped, dt) {
  const p = G.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  const dPlayer = dist(ped.x, ped.y, px, py);
  // Flee gunfire and nearby speeding cars.
  if (G.gunfireTimer > 0 && dPlayer < 420) {
    ped.state = 'flee';
    ped.stateTimer = 2;
    if (Math.random() < dt * 0.4) addWanted(G, 1);
  }
  if (ped.state === 'flee') {
    const away = Math.atan2(ped.y - py, ped.x - px);
    ped.angle = away;
    ped.x += Math.cos(away) * 190 * dt;
    ped.y += Math.sin(away) * 190 * dt;
    ped.stateTimer -= dt;
    if (ped.stateTimer <= 0) ped.state = 'walk';
    return;
  }
  if (ped.kind === 'enforcer') {
    // Enforcers guard their spot, then charge the player when close.
    if (dPlayer < 320) {
      ped.state = 'chase';
      const a = Math.atan2(py - ped.y, px - ped.x);
      ped.angle = a;
      ped.x += Math.cos(a) * ped.speed * dt;
      ped.y += Math.sin(a) * ped.speed * dt;
      ped.shootTimer = (ped.shootTimer || 0) - dt;
      if (dPlayer < 300 && ped.shootTimer <= 0) {
        ped.shootTimer = 1.2;
        G.bullets.push({ x: ped.x, y: ped.y, angle: a + (Math.random() - 0.5) * 0.2, speed: 520, damage: 8, life: 0.8, owner: 'enemy', color: '#ffb84a' });
        sfx('shoot');
      }
    }
    return;
  }
  // Ordinary walkers: stroll to a nearby point, pause, pick another.
  ped.stateTimer -= dt;
  if (ped.stateTimer <= 0) {
    const t = randomRoadPoint(makeRng((Math.random() * 1e9) | 0));
    ped.targetX = clamp(ped.x + (Math.random() - 0.5) * 500, 30, WORLD_W - 30);
    ped.targetY = clamp(ped.y + (Math.random() - 0.5) * 500, 30, WORLD_H - 30);
    ped.stateTimer = 4 + Math.random() * 5;
  }
  const d = dist(ped.x, ped.y, ped.targetX, ped.targetY);
  if (d > 12) {
    const a = Math.atan2(ped.targetY - ped.y, ped.targetX - ped.x);
    ped.angle = a;
    ped.x += Math.cos(a) * ped.speed * dt;
    ped.y += Math.sin(a) * ped.speed * dt;
  }
}

export function updatePeds(G, dt) {
  for (let i = G.peds.length - 1; i >= 0; i--) {
    const ped = G.peds[i];
    pedStep(G, ped, dt);
    ped.x = clamp(ped.x, 20, WORLD_W - 20);
    ped.y = clamp(ped.y, 20, WORLD_H - 20);
    if (ped.hp <= 0) {
      burst(G, ped.x, ped.y, ped.color, 10, 120);
      G.peds.splice(i, 1);
      if (ped.kind === 'enforcer') {
        G.stats.kills = (G.stats.kills || 0) + 1;
        floatText(G, ped.x, ped.y, '+$50', '#ffd94a');
        G.player.cash += 50;
      }
    }
  }
  // Keep the streets populated.
  if (G.peds.length < 40 && Math.random() < dt * 0.5) {
    const p = randomRoadPoint(makeRng((Math.random() * 1e9) | 0));
    const pl = G.player;
    if (dist(p.x, p.y, pl.x, pl.y) > 600) {
      G.peds.push({
        x: p.x, y: p.y, angle: Math.random() * Math.PI * 2, hp: 50, kind: 'ped',
        speed: 30 + Math.random() * 40, color: PED_COLORS[Math.floor(Math.random() * PED_COLORS.length)],
        state: 'walk', stateTimer: 3, targetX: p.x, targetY: p.y,
      });
    }
  }
}

export function updateCops(G, dt) {
  const p = G.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  // Wanted decays while the player is unseen; cops keep it alive while near.
  if ((p.wanted || 0) > 0) {
    const nearCop = G.cops.some((c) => dist(c.x, c.y, px, py) < 500)
      || G.cars.some((c) => c.driver === 'cop' && dist(c.x, c.y, px, py) < 600);
    if (!nearCop) {
      p.seenTimer -= dt;
      if (p.seenTimer <= 0) {
        p.wanted = Math.max(0, (p.wanted || 0) - WANTED.decayPerSec * dt);
        if (p.wanted < 1) { p.wanted = 0; G.heli = null; G.roadblock = null; }
      }
    } else {
      p.seenTimer = 6;
    }
  }
  // Spawn cops up to the wanted level's allowance.
  if ((p.wanted || 0) >= 1) {
    G.copTimer -= dt;
    const want = Math.min(WANTED.maxCops, 1 + Math.floor(p.wanted));
    if (G.copTimer <= 0 && G.cops.length + G.cars.filter((c) => c.driver === 'cop').length < want) {
      G.copTimer = WANTED.copSpawnInterval;
      const a = Math.random() * Math.PI * 2;
      const d = 500 + Math.random() * 200;
      if (p.wanted >= 2 && Math.random() < 0.6) {
        const car = makeVehicle('police', px + Math.cos(a) * d, py + Math.sin(a) * d, a);
        car.driver = 'cop';
        car.speed = 300;
        G.cars.push(car);
      } else {
        spawnCop(G, px + Math.cos(a) * d, py + Math.sin(a) * d);
      }
      sfx('siren');
    }
  }
  // Helicopter at 4 stars: circles overhead, spotlights the player.
  if ((p.wanted || 0) >= WANTED.heliAt && !G.heli) {
    G.heli = { x: px, y: py - 300, angle: 0, timer: 0 };
    G.message = 'A police helicopter is on you!';
    G.messageTimer = 3;
  }
  if (G.heli) {
    const h = G.heli;
    h.timer += dt;
    const a = Math.atan2(py - h.y, px - h.x);
    h.angle = a;
    h.x += Math.cos(a) * 180 * dt;
    h.y += Math.sin(a) * 180 * dt;
    if ((p.wanted || 0) < WANTED.heliAt) G.heli = null;
  }
  // Roadblock fades.
  if (G.roadblock) {
    G.roadblock.life -= dt;
    if (G.roadblock.life <= 0) G.roadblock = null;
  }
  // On-foot cops chase and brawl.
  for (let i = G.cops.length - 1; i >= 0; i--) {
    const cop = G.cops[i];
    const d = dist(cop.x, cop.y, px, py);
    if ((p.wanted || 0) === 0 && d > 700) { G.cops.splice(i, 1); continue; }
    if (cop.hp <= 0) { burst(G, cop.x, cop.y, '#2a4a8a', 10, 120); G.cops.splice(i, 1); continue; }
    const a = Math.atan2(py - cop.y, px - cop.x);
    cop.angle = a;
    const speed = d > 200 ? 170 : 150;
    cop.x += Math.cos(a) * speed * dt;
    cop.y += Math.sin(a) * speed * dt;
    // Busted: a cop touches the player on foot at 1-2 stars.
    if (d < 26 && !p.inCar && (p.wanted || 0) <= 2) {
      G.bustedFine = Math.min(500, 100 + Math.floor(p.cash * 0.1));
      p.cash -= G.bustedFine;
      p.wanted = 0;
      G.cops = [];
      G.heli = null;
      G.screen = 'busted';
      sfx('fail');
      return;
    }
    // Cops shoot at 3+ stars.
    if ((p.wanted || 0) >= 3 && d < 380 && !p.inCar) {
      cop.shootTimer = (cop.shootTimer || 0) - dt;
      if (cop.shootTimer <= 0) {
        cop.shootTimer = 1.4;
        G.bullets.push({ x: cop.x, y: cop.y, angle: a + (Math.random() - 0.5) * 0.15, speed: 540, damage: 7, life: 0.8, owner: 'enemy', color: '#ffb84a' });
        sfx('shoot');
      }
    }
  }
  // Cop cars chase and ram the player's car.
  for (const car of G.cars) {
    if (car.driver !== 'cop') continue;
    const d = dist(car.x, car.y, px, py);
    if ((p.wanted || 0) === 0 && d > 900) { car.driver = 'parked'; car.speed = 0; continue; }
    const a = Math.atan2(py - car.y, px - car.x);
    const diff = angleDiff(car.angle, a);
    car.angle += clamp(diff, -3.2 * dt, 3.2 * dt);
    const target = d > 120 ? 520 : 300;
    car.speed += (target - car.speed) * Math.min(1, dt * 1.5);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = clamp(car.x, 20, WORLD_W - 20);
    car.y = clamp(car.y, 20, WORLD_H - 20);
    // Ramming the player's car damages it.
    if (p.inCar && d < 60) {
      damageCar(G, p.inCar, 14 * dt);
      if (Math.random() < dt * 2) sfx('bump');
    }
  }
}
