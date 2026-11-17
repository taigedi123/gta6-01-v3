// Cars: making them, parking them, traffic that follows the roads, the
// player's driving physics, stealing, damage and wrecks.
import { WORLD_W, WORLD_H, BLOCK, VEHICLES } from './config.js';
import { clamp, dist, angleDiff, makeRng } from './util.js';
import { onRoad, randomRoadPoint, nearestRoadPoint } from './world.js';
import { sfx, engineSound } from './audio.js';
import { burst, smoke, sparks, fire, addSkid } from './particles.js';

export function makeVehicle(type, x, y, angle, color) {
  const t = VEHICLES[type] || VEHICLES.sedan;
  return {
    type, x, y, angle: angle || 0, speed: 0,
    color: color || t.colors[Math.floor(Math.random() * t.colors.length)],
    len: t.len, wid: t.wid,
    hp: type === 'truck' ? 160 : 100,
    maxHp: type === 'truck' ? 160 : 100,
    driver: 'parked', // parked | traffic | player | cop | target | wreck
    targetAngle: angle || 0,
    steer: 0,
    upgrades: {},
    nitrous: 0,
    smokeTimer: 0,
    stuckTimer: 0,
    honkTimer: 0,
  };
}

export function spawnParked(G) {
  const rng = makeRng(777);
  const types = ['sedan', 'sedan', 'taxi', 'van', 'pickup', 'muscle', 'sports', 'sedan', 'van', 'pickup', 'sedan', 'taxi'];
  for (let i = 0; i < 42; i++) {
    const p = randomRoadPoint(rng);
    const type = types[i % types.length];
    const angle = (Math.floor(rng() * 4) * Math.PI) / 2;
    const car = makeVehicle(type, p.x, p.y, angle);
    car.driver = 'parked';
    G.cars.push(car);
  }
}

export function spawnTraffic(G, n) {
  const rng = makeRng(4242);
  const types = ['sedan', 'taxi', 'van', 'pickup', 'sedan', 'muscle', 'sedan', 'van'];
  for (let i = 0; i < n; i++) {
    const p = randomRoadPoint(rng);
    const car = makeVehicle(types[i % types.length], p.x, p.y, (Math.floor(rng() * 4) * Math.PI) / 2);
    car.driver = 'traffic';
    car.speed = 90 + rng() * 90;
    G.cars.push(car);
  }
  // A few sports cars and a limo cruise the rich districts.
  const limo = makeVehicle('limo', 3920, 560, Math.PI / 2);
  limo.driver = 'traffic';
  limo.speed = 120;
  G.cars.push(limo);
}

function carBlockedByBuilding(G, x, y, len, wid, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  for (const b of G.world.buildings) {
    if (x + len > b.x && x - len < b.x + b.w && y + wid > b.y && y - wid < b.y + b.h) {
      // Corner check in the car's frame.
      const dx = clamp(x, b.x, b.x + b.w) - x;
      const dy = clamp(y, b.y, b.y + b.h) - y;
      const lx = dx * c + dy * s;
      const ly = -dx * s + dy * c;
      if (Math.abs(lx) < len / 2 + 2 && Math.abs(ly) < wid / 2 + 2) return b;
    }
  }
  return null;
}

export function driveCar(G, car, dt, input) {
  const t = VEHICLES[car.type];
  const p = G.player;
  const up = car.upgrades || {};
  const grip = (up.handling ? 0.96 : t.grip) * (G.weather.kind === 'rain' || G.weather.kind === 'storm' ? 0.88 : 1);
  const top = t.top * (up.engine ? 1.35 : 1);
  const accel = t.accel * (up.engine ? 1.35 : 1);
  const nitro = up.nitrous && input.down('KeyN') && car.nitrous > 0;
  if (nitro) car.nitrous -= dt;
  const gas = input.down('KeyW') || input.down('ArrowUp') ? 1 : input.down('KeyS') || input.down('ArrowDown') ? -0.6 : 0;
  const steerIn = (input.down('KeyA') || input.down('ArrowLeft') ? -1 : 0) + (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0);
  const handbrake = input.down('Space');
  const targetTop = top * (nitro ? 1.4 : 1);
  car.speed += gas * accel * dt * (nitro ? 1.6 : 1);
  if (gas === 0) car.speed *= Math.pow(0.4, dt);
  car.speed = clamp(car.speed, -top * 0.45, targetTop);
  if (handbrake) car.speed *= Math.pow(0.2, dt);
  const steerAmount = steerIn * t.turn * (up.handling ? 1.25 : 1) * clamp(Math.abs(car.speed) / 120, 0, 1) * (handbrake ? 1.5 : 1);
  car.angle += steerAmount * dt * (car.speed >= 0 ? 1 : -1);
  // Skids when turning hard at speed or handbraking.
  if ((Math.abs(steerIn) > 0 && Math.abs(car.speed) > 300) || (handbrake && Math.abs(car.speed) > 120)) {
    addSkid(G, car.x, car.y, car.angle);
    if (Math.random() < 0.3) smoke(G, car.x, car.y, '#555555');
  }
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (carBlockedByBuilding(G, nx, ny, car.len, car.wid, car.angle)) {
    if (Math.abs(car.speed) > 200) {
      sfx('crash');
      damageCar(G, car, Math.abs(car.speed) * 0.12);
      burst(G, nx, ny, '#ffcc44', 8, 120);
      G.camera.shake = 8;
    } else if (Math.abs(car.speed) > 60) {
      sfx('bump');
      damageCar(G, car, 2);
    }
    car.speed *= -0.25;
  } else {
    car.x = nx;
    car.y = ny;
  }
  car.x = clamp(car.x, 20, WORLD_W - 20);
  car.y = clamp(car.y, 20, WORLD_H - 20);
  // Slip: the car's velocity direction lags its heading a little.
  car.speed *= Math.pow(grip, dt * 8);
  // Damage smoke.
  if (car.hp < car.maxHp * 0.4) {
    car.smokeTimer -= dt;
    if (car.smokeTimer <= 0) {
      smoke(G, car.x - Math.cos(car.angle) * car.len / 2, car.y - Math.sin(car.angle) * car.len / 2, '#333333');
      car.smokeTimer = 0.12;
    }
  }
  engineSound(car.speed, top, true);
  if (p.inCar === car) {
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
  }
}

export function enterCar(G, car) {
  const p = G.player;
  if (car.driver === 'traffic' || car.driver === 'cop') {
    // Stealing a driven car: the driver bails, the law notices.
    car.driver = 'player';
    p.inCar = car;
    p.x = car.x;
    p.y = car.y;
    addWantedLocal(G, 1);
    G.stats.carsStolen = (G.stats.carsStolen || 0) + 1;
    sfx('door');
    G.message = 'You stole the ' + VEHICLES[car.type].name + '!';
    G.messageTimer = 2.5;
    return true;
  }
  if (car.driver === 'parked' || car.driver === 'target') {
    car.driver = 'player';
    p.inCar = car;
    p.x = car.x;
    p.y = car.y;
    sfx('door');
    return true;
  }
  return false;
}

function addWantedLocal(G, n) {
  // Local helper so vehicles.js does not import pedestrians.js (a cycle).
  G.player.wanted = clamp((G.player.wanted || 0) + n, 0, 5);
  G.player.seenTimer = 8;
  if (G.player.wanted >= 2) sfx('wanted');
}

export function exitCar(G, silent) {
  const p = G.player;
  if (!p.inCar) return;
  const car = p.inCar;
  car.driver = 'parked';
  car.speed = 0;
  p.inCar = null;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
  p.angle = car.angle;
  if (!silent) sfx('door');
  engineSound(0, 1, false);
}

export function nearestCar(G, x, y, maxDist) {
  let best = null;
  let bd = maxDist || 70;
  for (const c of G.cars) {
    if (c.driver === 'wreck') continue;
    const d = dist(x, y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

export function damageCar(G, car, amount) {
  if (car.upgrades && car.upgrades.armor) amount *= 0.5;
  car.hp -= amount;
  if (car.hp <= 0 && car.driver !== 'wreck') {
    car.driver = 'wreck';
    car.speed = 0;
    burst(G, car.x, car.y, '#ff8c1a', 24, 220);
    fire(G, car.x, car.y);
    sfx('explosion');
    G.camera.shake = 12;
    if (G.player.inCar === car) {
      exitCar(G, true);
      G.player.hp -= 25;
    }
  }
}

// Traffic AI: follow the road grid, turn at intersections, brake for the
// car ahead, honk when stuck. Cops chase the player instead.
export function updateTraffic(G, dt) {
  const p = G.player;
  for (const car of G.cars) {
    if (car.driver !== 'traffic') continue;
    // Steer toward the nearest road line, then along it.
    const rp = nearestRoadPoint(car.x, car.y);
    const onX = Math.abs(car.x - rp.x) < 6;
    const onY = Math.abs(car.y - rp.y) < 6;
    let want = car.angle;
    if (onX && !onY) want = car.y < rp.y ? Math.PI / 2 : -Math.PI / 2;
    else if (onY && !onX) want = car.x < rp.x ? 0 : Math.PI;
    else if (!onX && !onY) want = Math.abs(car.x - rp.x) < Math.abs(car.y - rp.y) ? (car.y < rp.y ? Math.PI / 2 : -Math.PI / 2) : (car.x < rp.x ? 0 : Math.PI);
    else {
      // At an intersection: sometimes turn.
      if (Math.random() < dt * 0.25) {
        const turns = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
        want = turns[Math.floor(Math.random() * turns.length)];
      }
    }
    const diff = angleDiff(car.angle, want);
    car.angle += clamp(diff, -2.2 * dt, 2.2 * dt);
    // Brake for the car ahead.
    let blocked = false;
    for (const other of G.cars) {
      if (other === car) continue;
      const d = dist(car.x, car.y, other.x, other.y);
      if (d < 70) {
        const a = Math.atan2(other.y - car.y, other.x - car.x);
        if (Math.abs(angleDiff(car.angle, a)) < 0.6) { blocked = true; break; }
      }
    }
    const target = blocked ? 0 : 110 + (car.type === 'van' ? -20 : 0);
    car.speed += (target - car.speed) * Math.min(1, dt * 1.2);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = clamp(car.x, 30, WORLD_W - 30);
    car.y = clamp(car.y, 30, WORLD_H - 30);
    // Panic: traffic flees gunfire nearby.
    if (G.gunfireTimer > 0 && dist(car.x, car.y, p.x, p.y) < 500) {
      car.speed = Math.min(car.speed + 200 * dt, 320);
    }
  }
  // Car-car collisions: push apart, damage both a little.
  for (let i = 0; i < G.cars.length; i++) {
    for (let j = i + 1; j < G.cars.length; j++) {
      const a = G.cars[i];
      const b = G.cars[j];
      if (a.driver === 'wreck' || b.driver === 'wreck') continue;
      const d = dist(a.x, a.y, b.x, b.y);
      const min = (a.len + b.len) / 2 - 12;
      if (d < min && d > 0.01) {
        const push = (min - d) / 2;
        const nx = (b.x - a.x) / d;
        const ny = (b.y - a.y) / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const rel = Math.abs(a.speed - b.speed);
        if (rel > 120) {
          damageCar(G, a, rel * 0.04);
          damageCar(G, b, rel * 0.04);
          sparks(G, (a.x + b.x) / 2, (a.y + b.y) / 2);
          if (a.driver === 'player' || b.driver === 'player') {
            sfx('crash');
            G.camera.shake = 6;
          }
        }
      }
    }
  }
  // Clean up wrecks far from the player so the list stays short.
  if (G.cars.length > 120) {
    for (let i = G.cars.length - 1; i >= 0; i--) {
      const c = G.cars[i];
      if (c.driver === 'wreck' && dist(c.x, c.y, p.x, p.y) > 1600) G.cars.splice(i, 1);
    }
  }
}
