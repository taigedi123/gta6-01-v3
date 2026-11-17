// The player on foot: walking, sprinting, aiming with the mouse, shooting,
// punching, picking up cash, health and armour, and the bullets flying
// around the city.
import { WORLD_W, WORLD_H, PLAYER, WEAPONS } from './config.js';
import { clamp, dist, angleTo } from './util.js';
import { sfx } from './audio.js';
import { burst, floatText, fire, smoke } from './particles.js';
import { nearestCar, enterCar, damageCar } from './vehicles.js';
import { addWanted } from './pedestrians.js';

export function makePlayer(x, y) {
  return {
    x, y, angle: 0, hp: PLAYER.hp, armor: 0,
    weapon: 'fists', ownedWeapons: ['fists'],
    ammo: { pistol: 60, shotgun: 12, smg: 60, rifle: 30, sniper: 6, molotov: 3 },
    cash: 150, wanted: 0, seenTimer: 0,
    inCar: null, shootTimer: 0, hurtTimer: 0, rep: 0,
  };
}

export function updatePlayer(G, dt) {
  const p = G.player;
  const input = G.input;
  if (p.inCar) {
    // In a car, the mouse still aims nothing; E exits, F honks.
    if (input.hit('KeyF')) sfx('horn');
    return;
  }
  p.hurtTimer = Math.max(0, p.hurtTimer - dt);
  p.shootTimer -= dt;
  const ax = input.axis();
  const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
  const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  let nx = p.x + ax.x * speed * dt;
  let ny = p.y + ax.y * speed * dt;
  // Buildings block walking: try each axis separately so the player slides.
  if (!blockedByBuilding(G, nx, p.y)) p.x = nx;
  if (!blockedByBuilding(G, p.x, ny)) p.y = ny;
  p.x = clamp(p.x, 20, WORLD_W - 20);
  p.y = clamp(p.y, 20, WORLD_H - 20);
  // Aim at the mouse (screen space -> world space).
  const wx = G.camera.x + input.mouseX;
  const wy = G.camera.y + input.mouseY;
  p.angle = angleTo(p.x, p.y, wx, wy);
  // Enter the nearest car with E.
  if (input.hit('KeyE')) {
    const car = nearestCar(G, p.x, p.y, 70);
    if (car) enterCar(G, car);
  }
  // Cycle weapon with Q... no: Q starts jobs. Use 1-7 and wheel: keys 1..7.
  const order = ['fists', 'pistol', 'shotgun', 'smg', 'rifle', 'sniper', 'molotov'];
  for (let i = 0; i < order.length; i++) {
    if (input.hit('Digit' + (i + 1)) && p.ownedWeapons.includes(order[i])) {
      p.weapon = order[i];
      sfx('click');
    }
  }
  // Shoot with mouse or Space. Fists punch instead.
  const firing = input.mouseDown || input.down('Space');
  if (firing && p.shootTimer <= 0) {
    fireWeapon(G);
  }
}

function blockedByBuilding(G, x, y) {
  for (const b of G.world.buildings) {
    if (x > b.x - 6 && x < b.x + b.w + 6 && y > b.y - 6 && y < b.y + b.h + 6) return true;
  }
  return false;
}

function fireWeapon(G) {
  const p = G.player;
  const w = WEAPONS[p.weapon];
  p.shootTimer = w.rate;
  G.gunfireTimer = 1.2;
  if (p.weapon === 'fists') {
    // Punch: hit the nearest ped or cop in front.
    let best = null;
    let bd = PLAYER.punchRange;
    const targets = G.peds.concat(G.cops);
    for (const t of targets) {
      const d = dist(p.x, p.y, t.x, t.y);
      if (d < bd) { bd = d; best = t; }
    }
    if (best) {
      best.hp -= w.damage;
      burst(G, best.x, best.y, '#ffffff', 6, 100);
      sfx('bump');
      if (best.kind === 'ped') addWanted(G, 1);
    }
    return;
  }
  if ((p.ammo[p.weapon] || 0) <= 0) {
    sfx('click');
    G.message = 'Out of ammo — buy more at Iron & Oak (B).';
    G.messageTimer = 2;
    return;
  }
  p.ammo[p.weapon]--;
  const pellets = w.pellets || 1;
  for (let i = 0; i < pellets; i++) {
    const a = p.angle + (Math.random() - 0.5) * 2 * w.spread;
    G.bullets.push({
      x: p.x + Math.cos(p.angle) * 20, y: p.y + Math.sin(p.angle) * 20,
      angle: a, speed: 780, damage: w.damage, life: w.range / 780,
      owner: 'player', color: '#ffe94a', fire: !!w.fire,
    });
  }
  G.camera.shake = Math.max(G.camera.shake, p.weapon === 'shotgun' ? 4 : 2);
  if (p.weapon === 'shotgun') sfx('shotgun');
  else if (p.weapon === 'sniper') sfx('sniper');
  else if (p.weapon === 'molotov') sfx('molotov');
  else sfx('shoot');
  // Firing in public draws the law.
  if (Math.random() < 0.35) addWanted(G, 1);
}

export function updateBullets(G, dt) {
  const p = G.player;
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.life -= dt;
    b.x += Math.cos(b.angle) * b.speed * dt;
    b.y += Math.sin(b.angle) * b.speed * dt;
    let dead = b.life <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD_W || b.y > WORLD_H;
    // Hit a building?
    if (!dead) {
      for (const bl of G.world.buildings) {
        if (b.x > bl.x && b.x < bl.x + bl.w && b.y > bl.y && b.y < bl.y + bl.h) {
          dead = true;
          burst(G, b.x, b.y, '#c8c8c8', 4, 80);
          break;
        }
      }
    }
    if (!dead && b.owner === 'player') {
      // Hit a ped, cop or enforcer.
      for (const t of G.peds) {
        if (dist(b.x, b.y, t.x, t.y) < 16) {
          t.hp -= b.damage;
          dead = true;
          burst(G, b.x, b.y, '#ff5a5a', 6, 100);
          if (t.kind === 'ped') addWanted(G, 1);
          break;
        }
      }
      if (!dead) {
        for (const c of G.cops) {
          if (dist(b.x, b.y, c.x, c.y) < 16) {
            c.hp -= b.damage;
            dead = true;
            addWanted(G, 1);
            burst(G, b.x, b.y, '#ff5a5a', 6, 100);
            break;
          }
        }
      }
      if (!dead) {
        // Hit a car.
        for (const car of G.cars) {
          if (car.driver === 'wreck') continue;
          const dx = b.x - car.x;
          const dy = b.y - car.y;
          const c = Math.cos(-car.angle);
          const s = Math.sin(-car.angle);
          const lx = dx * c - dy * s;
          const ly = dx * s + dy * c;
          if (Math.abs(lx) < car.len / 2 + 4 && Math.abs(ly) < car.wid / 2 + 4) {
            damageCar(G, car, b.damage);
            dead = true;
            burst(G, b.x, b.y, '#ffd94a', 5, 90);
            break;
          }
        }
      }
      if (!dead && b.fire) {
        // Molotov: a patch of fire where it lands.
        fire(G, b.x, b.y);
        for (const t of G.peds) if (dist(b.x, b.y, t.x, t.y) < 60) t.hp -= 20;
        for (const c of G.cops) if (dist(b.x, b.y, c.x, c.y) < 60) c.hp -= 20;
      }
    }
    if (!dead && b.owner === 'enemy') {
      // Hit the player (on foot) or the player's car.
      if (!p.inCar && dist(b.x, b.y, p.x, p.y) < 16) {
        hurtPlayer(G, b.damage);
        dead = true;
      } else if (p.inCar && dist(b.x, b.y, p.inCar.x, p.inCar.y) < 30) {
        damageCar(G, p.inCar, b.damage * 0.4);
        dead = true;
      }
    }
    if (dead) G.bullets.splice(i, 1);
  }
}

export function hurtPlayer(G, amount) {
  const p = G.player;
  if (p.hurtTimer > 0) return;
  p.hurtTimer = 0.4;
  let left = amount;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, left);
    p.armor -= absorbed;
    left -= absorbed;
  }
  p.hp -= left;
  sfx('hurt');
  G.camera.shake = 5;
  if (p.hp <= 0) {
    p.hp = 0;
    G.screen = 'busted';
    G.bustedFine = 0;
    G.message = 'You were taken down. The Bay General patched you up — for a fee.';
    p.cash = Math.max(0, p.cash - 200);
    sfx('fail');
  }
}

export function updatePickups(G, dt) {
  const p = G.player;
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const pk = G.pickups[i];
    pk.life -= dt;
    if (pk.life <= 0) { G.pickups.splice(i, 1); continue; }
    const px = p.inCar ? p.inCar.x : p.x;
    const py = p.inCar ? p.inCar.y : p.y;
    if (dist(pk.x, pk.y, px, py) < 40) {
      if (pk.kind === 'cash') {
        p.cash += pk.amount;
        floatText(G, pk.x, pk.y, '+$' + pk.amount, '#7dff6a');
        sfx('cash');
      } else if (pk.kind === 'health') {
        p.hp = Math.min(100, p.hp + 40);
        floatText(G, pk.x, pk.y, '+40 HP', '#ff6a6a');
        sfx('heal');
      } else if (pk.kind === 'armor') {
        p.armor = Math.min(100, p.armor + 50);
        floatText(G, pk.x, pk.y, '+50 Armor', '#6ab8ff');
        sfx('pickup');
      } else if (pk.kind === 'stash') {
        p.cash += pk.amount;
        floatText(G, pk.x, pk.y, 'Stash! +$' + pk.amount, '#ffd94a');
        sfx('cash');
        G.stats.stashes = (G.stats.stashes || 0) + 1;
      }
      G.pickups.splice(i, 1);
    }
  }
}

export function dropPickup(G, kind, x, y, amount) {
  G.pickups.push({ kind, x, y, amount: amount || 0, life: 60 });
}
