// Rendering: the camera, the city, every car and pedestrian, day/night
// lighting, rain and fog, particles, the HUD with its minimap, and all the
// menu screens. This is the file the screenshots are made of, so it draws
// dense, readable systems: stars, cash, health, weapon, objective, clock
// and minimap.
import { WORLD_W, WORLD_H, BLOCK, ROAD_W, DISTRICTS, WEAPONS, UPGRADES, PLACES, REP_RANKS } from './config.js';
import { clamp, money, clockString, timeOfDayName, dist } from './util.js';
import { districtAt, onRoad } from './world.js';
import { radioName } from './audio.js';
import { slotInfo, repName } from './economy.js';
import { MISSION_DEFS } from './missions.js';

const VW = 1280;
const VH = 800;

export function setupCanvas(canvas) {
  canvas.width = VW;
  canvas.height = VH;
}

export function nightFactor(dayTime) {
  // 0 = full day, 1 = deep night. Dawn 6-8, dusk 18-20.
  const h = dayTime % 24;
  if (h >= 8 && h < 18) return 0;
  if (h >= 20 || h < 5) return 1;
  if (h >= 5 && h < 8) return 1 - (h - 5) / 3;
  return (h - 18) / 2;
}

export function render(G) {
  const ctx = G.ctx;
  ctx.clearRect(0, 0, VW, VH);
  // Camera follows the player (or their car) with shake.
  const px = G.player.inCar ? G.player.inCar.x : G.player.x;
  const py = G.player.inCar ? G.player.inCar.y : G.player.y;
  G.camera.x = clamp(px - VW / 2, 0, WORLD_W - VW);
  G.camera.y = clamp(py - VH / 2, 0, WORLD_H - VH);
  const shakeX = (Math.random() - 0.5) * G.camera.shake;
  const shakeY = (Math.random() - 0.5) * G.camera.shake;
  G.camera.shake = Math.max(0, G.camera.shake - 30 * G.frameDt);
  ctx.save();
  ctx.translate(-G.camera.x + shakeX, -G.camera.y + shakeY);

  drawGround(ctx, G);
  drawSkids(ctx, G);
  drawProps(ctx, G);
  drawPickups(ctx, G);
  drawCars(ctx, G);
  drawPeds(ctx, G);
  drawBullets(ctx, G);
  drawParticles(ctx, G);
  drawFloaters(ctx, G);
  drawPlayer(ctx, G);
  drawHeli(ctx, G);
  drawMarkers(ctx, G);
  ctx.restore();

  // Day/night lighting over the world.
  const night = nightFactor(G.dayTime);
  if (night > 0.02) {
    ctx.fillStyle = 'rgba(8, 12, 40,' + (night * 0.42).toFixed(3) + ')';
    ctx.fillRect(0, 0, VW, VH);
    // Warm lamp glow at night around the player.
    const gx = px - G.camera.x;
    const gy = py - G.camera.y;
    const grad = ctx.createRadialGradient(gx, gy, 40, gx, gy, 340);
    grad.addColorStop(0, 'rgba(255, 210, 120,' + (night * 0.20).toFixed(3) + ')');
    grad.addColorStop(1, 'rgba(255, 210, 120, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VW, VH);
  } else if (G.dayTime % 24 >= 17 && G.dayTime % 24 < 19) {
    ctx.fillStyle = 'rgba(255, 140, 60, 0.10)';
    ctx.fillRect(0, 0, VW, VH);
  }
  // Weather overlays.
  if (G.weather.kind === 'rain' || G.weather.kind === 'storm') {
    ctx.strokeStyle = 'rgba(180, 200, 255, 0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const d of G.weather.rainDrops) {
      const sx = d.x - G.camera.x;
      const sy = d.y - G.camera.y;
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - 6, sy + 16);
    }
    ctx.stroke();
    if (G.weather.kind === 'storm') {
      ctx.fillStyle = 'rgba(40, 50, 80, 0.12)';
      ctx.fillRect(0, 0, VW, VH);
    }
  }
  if (G.weather.kind === 'fog') {
    ctx.fillStyle = 'rgba(200, 205, 210, 0.16)';
    ctx.fillRect(0, 0, VW, VH);
  }

  // The title screen is clean: no HUD panels behind it.
  if (G.screen !== 'title') drawHUD(ctx, G);
  if (G.screen === 'title') drawTitle(ctx, G);
  else if (G.screen === 'pause') drawPause(ctx, G);
  else if (G.screen === 'busted') drawBusted(ctx, G);
  else if (G.screen === 'complete') drawComplete(ctx, G);
  else if (G.screen === 'shop') drawShop(ctx, G);
  else if (G.screen === 'garage') drawGarage(ctx, G);
  else if (G.screen === 'stats') drawStats(ctx, G);
  else if (G.screen === 'help') drawHelp(ctx, G);
}

// ---- World ----

function drawGround(ctx, G) {
  const cam = G.camera;
  // District ground.
  for (const d of DISTRICTS) {
    const ix = Math.max(d.x, cam.x - 40);
    const iy = Math.max(d.y, cam.y - 40);
    const iw = Math.min(d.x + d.w, cam.x + VW + 40) - ix;
    const ih = Math.min(d.y + d.h, cam.y + VH + 40) - iy;
    if (iw <= 0 || ih <= 0) continue;
    ctx.fillStyle = d.ground;
    ctx.fillRect(ix, iy, iw, ih);
    // District name painted on the ground, big and faint.
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.label, d.x + d.w / 2, d.y + d.h / 2);
  }
  // Beach strip and water along the south edge.
  ctx.fillStyle = '#e8d49a';
  ctx.fillRect(0, WORLD_H - 120, WORLD_W, 120);
  ctx.fillStyle = '#3f8fb8';
  ctx.fillRect(0, WORLD_H - 36, WORLD_W, 36);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let x = 0; x < WORLD_W; x += 90) {
    ctx.fillRect(x + ((G.time * 20) % 90), WORLD_H - 40, 46, 3);
  }
  // Parks.
  for (const pk of G.world.parks) {
    if (pk.x + pk.w < cam.x - 40 || pk.x > cam.x + VW + 40 || pk.y + pk.h < cam.y - 40 || pk.y > cam.y + VH + 40) continue;
    ctx.fillStyle = '#5d9e4a';
    ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
  }
  // Roads.
  ctx.fillStyle = '#3f3f3f';
  for (let x = 0; x <= WORLD_W; x += BLOCK) ctx.fillRect(x - ROAD_W / 2, 0, ROAD_W, WORLD_H);
  for (let y = 0; y <= WORLD_H; y += BLOCK) ctx.fillRect(0, y - ROAD_W / 2, WORLD_W, ROAD_W);
  // Road centre dashes.
  ctx.fillStyle = '#e8c832';
  for (let x = 0; x <= WORLD_W; x += BLOCK) {
    for (let y = 0; y < WORLD_H; y += 64) ctx.fillRect(x - 2, y, 4, 28);
  }
  for (let y = 0; y <= WORLD_H; y += BLOCK) {
    for (let x = 0; x < WORLD_W; x += 64) ctx.fillRect(x, y - 2, 28, 4);
  }
  // Sidewalks.
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 4;
  for (let x = 0; x <= WORLD_W; x += BLOCK) {
    ctx.beginPath(); ctx.moveTo(x - ROAD_W / 2 - 6, 0); ctx.lineTo(x - ROAD_W / 2 - 6, WORLD_H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + ROAD_W / 2 + 6, 0); ctx.lineTo(x + ROAD_W / 2 + 6, WORLD_H); ctx.stroke();
  }
  for (let y = 0; y <= WORLD_H; y += BLOCK) {
    ctx.beginPath(); ctx.moveTo(0, y - ROAD_W / 2 - 6); ctx.lineTo(WORLD_W, y - ROAD_W / 2 - 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, y + ROAD_W / 2 + 6); ctx.lineTo(WORLD_W, y + ROAD_W / 2 + 6); ctx.stroke();
  }
  // Buildings with roofs, windows and a drop shadow.
  for (const b of G.world.buildings) {
    if (b.x + b.w < cam.x - 60 || b.x > cam.x + VW + 60 || b.y + b.h < cam.y - 60 || b.y > cam.y + VH + 60) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 5, b.y + 5, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 10, b.y + 10, b.w - 20, b.h - 20);
    ctx.fillStyle = 'rgba(255, 240, 180, 0.85)';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 26));
    for (let cx = 0; cx < cols; cx++) {
      for (let cy = 0; cy < rows; cy++) {
        if ((cx * 7 + cy * 3 + b.x) % 5 === 0) continue;
        ctx.fillRect(b.x + 8 + cx * 24, b.y + 8 + cy * 24, 10, 10);
      }
    }
    if (b.tall) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(b.x + b.w / 2 - 6, b.y + b.h / 2 - 6, 12, 12);
    }
  }
  // Trees.
  for (const t of G.world.trees) {
    if (t.x < cam.x - 30 || t.x > cam.x + VW + 30 || t.y < cam.y - 30 || t.y > cam.y + VH + 30) continue;
    ctx.fillStyle = '#2a5a2a';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#4a8a3a';
    ctx.beginPath(); ctx.arc(t.x - 2, t.y - 2, t.r * 0.7, 0, Math.PI * 2); ctx.fill();
  }
  // Named places: a small plaque dot and label.
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  for (const key of Object.keys(PLACES)) {
    const pl = PLACES[key];
    if (pl.x < cam.x - 100 || pl.x > cam.x + VW + 100 || pl.y < cam.y - 100 || pl.y > cam.y + VH + 100) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(pl.x - 5, pl.y - 5, 10, 10);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(pl.label, pl.x, pl.y - 12);
  }
}

function drawSkids(ctx, G) {
  ctx.strokeStyle = 'rgba(20,20,20,0.4)';
  ctx.lineWidth = 4;
  for (const s of G.skids) {
    ctx.beginPath();
    ctx.moveTo(s.x - Math.cos(s.angle) * 10, s.y - Math.sin(s.angle) * 10);
    ctx.lineTo(s.x + Math.cos(s.angle) * 10, s.y + Math.sin(s.angle) * 10);
    ctx.stroke();
  }
}

function drawProps(ctx, G) {
  const cam = G.camera;
  for (const pr of G.world.props) {
    if (pr.x < cam.x - 60 || pr.x > cam.x + VW + 60 || pr.y < cam.y - 60 || pr.y > cam.y + VH + 60) continue;
    if (pr.kind === 'lamp') {
      ctx.strokeStyle = '#2a2a2a';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(pr.x, pr.y); ctx.lineTo(pr.x, pr.y - 26); ctx.stroke();
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath(); ctx.arc(pr.x, pr.y - 28, 5, 0, Math.PI * 2); ctx.fill();
    } else if (pr.kind === 'bench') {
      ctx.fillStyle = '#7a5a3a';
      ctx.fillRect(pr.x - 14, pr.y - 4, 28, 8);
    } else if (pr.kind === 'crane') {
      ctx.strokeStyle = '#c85a2a';
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(pr.x, pr.y); ctx.lineTo(pr.x, pr.y - 90); ctx.lineTo(pr.x + 70, pr.y - 90); ctx.stroke();
      ctx.fillStyle = '#c85a2a';
      ctx.fillRect(pr.x - 10, pr.y - 6, 20, 6);
    } else if (pr.kind === 'container') {
      ctx.fillStyle = pr.c;
      ctx.fillRect(pr.x - 30, pr.y - 14, 60, 28);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(pr.x - 30, pr.y - 14, 60, 6);
    } else if (pr.kind === 'umbrella') {
      ctx.fillStyle = '#e83c6a';
      ctx.beginPath(); ctx.arc(pr.x, pr.y, 14, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = '#5a3a2a';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(pr.x, pr.y); ctx.lineTo(pr.x, pr.y + 12); ctx.stroke();
    }
  }
}

function drawPickups(ctx, G) {
  for (const pk of G.pickups) {
    const bob = Math.sin(G.time * 4 + pk.x) * 3;
    if (pk.kind === 'cash') {
      ctx.fillStyle = '#7dff6a';
      ctx.fillRect(pk.x - 10, pk.y - 7 + bob, 20, 14);
      ctx.fillStyle = '#1a5a1a';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', pk.x, pk.y + 4 + bob);
    } else if (pk.kind === 'health') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(pk.x - 10, pk.y - 10 + bob, 20, 20);
      ctx.fillStyle = '#ff3c3c';
      ctx.fillRect(pk.x - 3, pk.y - 7 + bob, 6, 14);
      ctx.fillRect(pk.x - 7, pk.y - 3 + bob, 14, 6);
    } else if (pk.kind === 'armor') {
      ctx.fillStyle = '#6ab8ff';
      ctx.fillRect(pk.x - 10, pk.y - 10 + bob, 20, 20);
      ctx.fillStyle = '#1a3a5a';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('A', pk.x, pk.y + 4 + bob);
    } else if (pk.kind === 'stash') {
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#7a5a1a';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', pk.x, pk.y + 4 + bob);
    }
  }
}

function drawCarShape(ctx, car) {
  const len = car.len;
  const wid = car.wid;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-len / 2 + 3, -wid / 2 + 3, len, wid);
  // Body.
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.roundRect(-len / 2, -wid / 2, len, wid, 7);
  ctx.fill();
  // Cabin / windshield.
  ctx.fillStyle = 'rgba(20, 30, 50, 0.85)';
  const cab = car.type === 'limo' ? len * 0.5 : len * 0.34;
  ctx.fillRect(-cab / 2 + 4, -wid / 2 + 4, cab, wid - 8);
  // Headlights and taillights.
  ctx.fillStyle = '#fff8c8';
  ctx.fillRect(len / 2 - 3, -wid / 2 + 3, 3, 5);
  ctx.fillRect(len / 2 - 3, wid / 2 - 8, 3, 5);
  ctx.fillStyle = '#ff3c3c';
  ctx.fillRect(-len / 2, -wid / 2 + 3, 3, 5);
  ctx.fillRect(-len / 2, wid / 2 - 8, 3, 5);
  // Type details.
  if (car.type === 'taxi') {
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
  } else if (car.type === 'police') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-len / 2 + 8, -wid / 2 + 2, len - 16, 5);
    ctx.fillStyle = '#ff3c3c';
    ctx.beginPath(); ctx.arc(0, -wid / 2 + 1, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3c7dff';
    ctx.beginPath(); ctx.arc(6, -wid / 2 + 1, 3, 0, Math.PI * 2); ctx.fill();
  } else if (car.type === 'truck' || car.type === 'van') {
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(-len / 2 + 4, -wid / 2 + 4, len * 0.5, wid - 8);
  }
  // Damage: smoke-darkened hood and cracks.
  if (car.hp < car.maxHp * 0.5) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(len / 2 - 14, -wid / 2, 14, wid);
  }
  ctx.restore();
}

function drawCars(ctx, G) {
  for (const car of G.cars) {
    if (car.x < G.camera.x - 120 || car.x > G.camera.x + VW + 120 || car.y < G.camera.y - 120 || car.y > G.camera.y + VH + 120) continue;
    if (car.driver === 'wreck') {
      // Wreck: tilted, darkened, smoking.
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle + 0.3);
      ctx.fillStyle = '#2a2a2a';
      ctx.beginPath();
      ctx.roundRect(-car.len / 2, -car.wid / 2, car.len, car.wid, 7);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,120,20,0.5)';
      ctx.fillRect(-car.len / 2 + 6, -car.wid / 2 + 4, car.len / 3, car.wid - 8);
      ctx.restore();
      continue;
    }
    drawCarShape(ctx, car);
    // Target cars for missions get a red ring.
    if (car.driver === 'target') {
      ctx.strokeStyle = '#ff3c3c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(car.x, car.y, car.len * 0.75 + Math.sin(G.time * 5) * 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawPed(ctx, ped) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  ctx.rotate(ped.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(2, 3, 9, 7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ped.color;
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8c8a0';
  ctx.beginPath(); ctx.arc(5, 0, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  if (ped.hp < 50) {
    ctx.fillStyle = '#ff3c3c';
    ctx.fillRect(ped.x - 10, ped.y - 18, 20 * (ped.hp / 50), 3);
  }
}

function drawPeds(ctx, G) {
  for (const ped of G.peds) {
    if (ped.x < G.camera.x - 40 || ped.x > G.camera.x + VW + 40 || ped.y < G.camera.y - 40 || ped.y > G.camera.y + VH + 40) continue;
    drawPed(ctx, ped);
    if (ped.kind === 'enforcer') {
      ctx.strokeStyle = '#ff3c3c';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ped.x, ped.y, 14, 0, Math.PI * 2); ctx.stroke();
    }
  }
  for (const cop of G.cops) {
    if (cop.x < G.camera.x - 40 || cop.x > G.camera.x + VW + 40 || cop.y < G.camera.y - 40 || cop.y > G.camera.y + VH + 40) continue;
    drawPed(ctx, cop);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', cop.x, cop.y - 14);
  }
}

function drawBullets(ctx, G) {
  for (const b of G.bullets) {
    ctx.strokeStyle = b.color || '#ffe94a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x - Math.cos(b.angle) * 14, b.y - Math.sin(b.angle) * 14);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

function drawParticles(ctx, G) {
  for (const p of G.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFloaters(ctx, G) {
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  for (const f of G.floaters) {
    ctx.globalAlpha = Math.min(1, f.life);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function drawPlayer(ctx, G) {
  const p = G.player;
  if (p.inCar) return; // the car is drawn already
  const px = p.x;
  const py = p.y;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(p.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(2, 3, 10, 8, 0, 0, Math.PI * 2); ctx.fill();
  // Rico Vega: red jacket, dark jeans.
  ctx.fillStyle = '#c81e1e';
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f0c8a0';
  ctx.beginPath(); ctx.arc(6, 0, 5, 0, Math.PI * 2); ctx.fill();
  // Gun in hand when armed.
  if (p.weapon !== 'fists') {
    ctx.fillStyle = '#222222';
    ctx.fillRect(8, -2, 12, 4);
  }
  ctx.restore();
  // Aim line, short and subtle.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(px + Math.cos(p.angle) * 16, py + Math.sin(p.angle) * 16);
  ctx.lineTo(px + Math.cos(p.angle) * 34, py + Math.sin(p.angle) * 34);
  ctx.stroke();
}

function drawHeli(ctx, G) {
  const h = G.heli;
  if (!h) return;
  ctx.save();
  ctx.translate(h.x, h.y);
  // Searchlight cone on the player.
  const p = G.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  ctx.fillStyle = 'rgba(255, 240, 180, 0.14)';
  ctx.beginPath();
  ctx.moveTo(h.x, h.y);
  ctx.lineTo(px - 40, py - 40);
  ctx.lineTo(px + 40, py + 40);
  ctx.closePath();
  ctx.fill();
  ctx.rotate(h.angle);
  ctx.fillStyle = '#2a4a8a';
  ctx.beginPath(); ctx.ellipse(0, 0, 26, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8ab8ff';
  ctx.beginPath(); ctx.arc(12, 0, 6, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 3;
  const spin = G.time * 30;
  ctx.beginPath();
  ctx.moveTo(Math.cos(spin) * 34, Math.sin(spin) * 34);
  ctx.lineTo(-Math.cos(spin) * 34, -Math.sin(spin) * 34);
  ctx.stroke();
  ctx.restore();
}

function drawMarkers(ctx, G) {
  const m = G.mission;
  const drawMarker = (x, y, color, label) => {
    const bob = Math.sin(G.time * 4) * 6;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - 34 + bob);
    ctx.lineTo(x + 12, y - 12 + bob);
    ctx.lineTo(x - 12, y - 12 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (label) {
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, x, y - 42 + bob);
    }
  };
  if (m.marker) drawMarker(m.marker.x, m.marker.y, '#ffd94a', null);
  if (G.taxi.active) drawMarker(G.taxi.x, G.taxi.y, '#7dff6a', 'TAXI');
  if (G.courier.active) drawMarker(G.courier.x, G.courier.y, '#7dff6a', 'DROP');
  if (G.race.active) drawMarker(G.race.x, G.race.y, '#ff8c1a', 'RACE');
  if (G.vigilante.active && G.vigilante.target) drawMarker(G.vigilante.target.x, G.vigilante.target.y, '#ff3c3c', 'TARGET');
  if (G.repo.active) drawMarker(G.repo.x, G.repo.y, '#ff8c1a', 'REPO');
  // Safehouse / shop / garage beacons when near.
  const p = G.player;
  const px = p.inCar ? p.inCar.x : p.x;
  const py = p.inCar ? p.inCar.y : p.y;
  const near = [
    { pl: PLACES.gunshop, label: 'GUN SHOP [B]', color: '#6ab8ff' },
    { pl: PLACES.garage, label: 'GARAGE [G]', color: '#ff8c1a' },
    { pl: PLACES.safehouse1, label: 'SAFEHOUSE', color: '#7dff6a' },
    { pl: PLACES.safehouse2, label: 'SAFEHOUSE', color: '#7dff6a' },
  ];
  for (const n of near) {
    if (dist(px, py, n.pl.x, n.pl.y) < 500) drawMarker(n.pl.x, n.pl.y, n.color, n.label);
  }
}

// ---- HUD ----

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8, 12, 20, 0.72)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function bar(ctx, x, y, w, h, frac, color, bg) {
  ctx.fillStyle = bg || 'rgba(255,255,255,0.2)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
}

function drawHUD(ctx, G) {
  const p = G.player;
  const m = G.mission;
  // Top-left: cash, rep, health, armour, weapon.
  panel(ctx, 12, 12, 300, 118);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#7dff6a';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(money(p.cash), 24, 42);
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('★ ' + repName(p.rep || 0), 24, 62);
  ctx.fillStyle = '#ffffff';
  ctx.font = '12px sans-serif';
  ctx.fillText('HP', 24, 84);
  bar(ctx, 80, 74, 92, 12, p.hp / 100, p.hp > 30 ? '#3ddc5a' : '#ff3c3c');
  ctx.fillText('ARMOR', 24, 106);
  bar(ctx, 80, 96, 92, 12, p.armor / 100, '#6ab8ff');
  const w = WEAPONS[p.weapon];
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(w.name, 186, 84);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#cccccc';
  ctx.fillText(w.maxAmmo > 0 ? 'Ammo ' + (p.ammo[p.weapon] || 0) + '/' + w.maxAmmo : '∞', 186, 106);
  // Wanted stars, top-centre.
  const stars = p.wanted || 0;
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < Math.floor(stars) ? '#ffd94a' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', VW / 2 - 60 + i * 30, 40);
  }
  if (stars > 0) {
    ctx.fillStyle = '#ff5a5a';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(stars >= 4 ? 'HELICOPTER ON YOU' : stars >= 3 ? 'ROADBLOCKS ACTIVE' : 'BAY PD AFTER YOU', VW / 2, 60);
  }
  // Top-right: minimap + clock + weather.
  drawMinimap(ctx, G);
  panel(ctx, VW - 236, 236, 224, 66);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(clockString(G.dayTime), VW - 224, 262);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#cccccc';
  ctx.fillText(timeOfDayName(G.dayTime) + ' · ' + districtAt(p.x, p.y).name, VW - 224, 282);
  ctx.fillText(weatherLabel(G.weather.kind) + ' · ' + radioName(), VW - 224, 298);
  // Objective, bottom-left.
  panel(ctx, 12, VH - 96, 560, 84);
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(m.active ? 'JOB ' + (m.index + 1) + '/12 · ' + MISSION_DEFS[m.index].name : 'VERMILION BAY', 24, VH - 70);
  ctx.fillStyle = '#ffffff';
  ctx.font = '15px sans-serif';
  ctx.fillText(m.objective, 24, VH - 46);
  const side = sideJobLine(G);
  if (side) {
    ctx.fillStyle = '#7dff6a';
    ctx.font = '13px sans-serif';
    ctx.fillText(side, 24, VH - 24);
  }
  // Speed + car, bottom-right.
  if (p.inCar) {
    panel(ctx, VW - 212, VH - 96, 200, 84);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(Math.abs(p.inCar.speed) * 0.36) + ' km/h', VW - 24, VH - 56);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#cccccc';
    ctx.fillText(p.inCar.type.toUpperCase() + '  ·  HP ' + Math.max(0, Math.round(p.inCar.hp)), VW - 24, VH - 32);
    bar(ctx, VW - 200, VH - 22, 176, 6, p.inCar.hp / p.inCar.maxHp, '#ff8c1a');
    ctx.textAlign = 'left';
  }
  // Messages, centre-top under the stars.
  if (G.messageTimer > 0 && G.message) {
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    const wpx = ctx.measureText(G.message).width + 28;
    panel(ctx, VW / 2 - wpx / 2, 78, wpx, 30);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(G.message, VW / 2, 99);
    if (G.message2) {
      ctx.font = '14px sans-serif';
      const w2 = ctx.measureText(G.message2).width + 28;
      panel(ctx, VW / 2 - w2 / 2, 112, w2, 26);
      ctx.fillStyle = '#e8e8e8';
      ctx.fillText(G.message2, VW / 2, 130);
    }
  }
  // Controls hint, bottom-centre.
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillText('WASD drive / walk · E enter car · Mouse aim + click shoot · Q job · T taxi · U courier · V race · X repo · B shop · G garage · P pause', VW / 2, VH - 8);
}

function weatherLabel(kind) {
  if (kind === 'rain') return '☂ Rain';
  if (kind === 'storm') return '⛈ Storm';
  if (kind === 'fog') return '☁ Fog';
  return '☀ Clear';
}

function sideJobLine(G) {
  if (G.taxi.active) return 'TAXI: ' + (G.taxi.phase === 'pickup' ? 'pick up the fare' : 'drop off — $' + G.taxi.fare) + ' · ' + Math.ceil(G.taxi.timer) + 's';
  if (G.courier.active) return 'COURIER: drop ' + (G.courier.drops + 1) + ' of 3 · ' + Math.ceil(G.courier.timer) + 's';
  if (G.race.active) return 'RACE: checkpoint ' + (G.race.cp + 1) + ' of 4 · ' + Math.ceil(G.race.timer) + 's';
  if (G.vigilante.active) return 'VIGILANTE: wreck the getaway car · ' + Math.ceil(G.vigilante.timer) + 's';
  if (G.repo.active) return 'REPO: steal the ' + G.repo.type + ', deliver to Solano Garage';
  return null;
}

function drawMinimap(ctx, G) {
  const mx = VW - 236;
  const my = 12;
  const mw = 224;
  const mh = 224;
  const scale = mw / WORLD_W;
  const px = G.player.inCar ? G.player.inCar.x : G.player.x;
  const py = G.player.inCar ? G.player.inCar.y : G.player.y;
  panel(ctx, mx, my, mw, mh);
  ctx.save();
  ctx.beginPath();
  ctx.rect(mx + 4, my + 4, mw - 8, mh - 8);
  ctx.clip();
  // Districts.
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.ground;
    ctx.fillRect(mx + 4 + d.x * scale, my + 4 + d.y * scale, d.w * scale, d.h * scale);
  }
  // Roads.
  ctx.fillStyle = '#3f3f3f';
  for (let x = 0; x <= WORLD_W; x += BLOCK) ctx.fillRect(mx + 4 + (x - ROAD_W / 2) * scale, my + 4, ROAD_W * scale, mh - 8);
  for (let y = 0; y <= WORLD_H; y += BLOCK) ctx.fillRect(mx + 4, my + 4 + (y - ROAD_W / 2) * scale, mw - 8, ROAD_W * scale);
  // Water.
  ctx.fillStyle = '#3f8fb8';
  ctx.fillRect(mx + 4, my + 4 + (WORLD_H - 36) * scale, mw - 8, 36 * scale);
  // Mission marker.
  const mark = (x, y, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(mx + 4 + x * scale, my + 4 + y * scale, r, 0, Math.PI * 2); ctx.fill();
  };
  if (G.mission.marker) mark(G.mission.marker.x, G.mission.marker.y, '#ffd94a', 6);
  if (G.taxi.active) mark(G.taxi.x, G.taxi.y, '#7dff6a', 5);
  if (G.courier.active) mark(G.courier.x, G.courier.y, '#7dff6a', 5);
  if (G.race.active) mark(G.race.x, G.race.y, '#ff8c1a', 5);
  if (G.vigilante.active && G.vigilante.target) mark(G.vigilante.target.x, G.vigilante.target.y, '#ff3c3c', 5);
  if (G.repo.active) mark(G.repo.x, G.repo.y, '#ff8c1a', 5);
  // Cops as blue dots.
  for (const c of G.cops) mark(c.x, c.y, '#6ab8ff', 3);
  for (const car of G.cars) if (car.driver === 'cop') mark(car.x, car.y, '#6ab8ff', 3);
  if (G.heli) mark(G.heli.x, G.heli.y, '#ff3c3c', 5);
  // Player arrow.
  const ang = G.player.angle;
  ctx.save();
  ctx.translate(mx + 4 + px * scale, my + 4 + py * scale);
  ctx.rotate(ang);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.restore();
  // Viewport box.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx + 4 + G.camera.x * scale, my + 4 + G.camera.y * scale, VW * scale, VH * scale);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('VERMILION BAY', mx + 8, my + mh - 8);
}

// ---- Screens ----

function dim(ctx) {
  ctx.fillStyle = 'rgba(6, 10, 24, 0.72)';
  ctx.fillRect(0, 0, VW, VH);
}

function bigPanel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(8, 12, 20, 0.88)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 217, 74, 0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawTitle(ctx, G) {
  dim(ctx);
  ctx.textAlign = 'center';
  // Sun-soaked title.
  ctx.fillStyle = '#ff8c1a';
  ctx.font = 'bold 84px sans-serif';
  ctx.fillText('VERMILION BAY', VW / 2, 210);
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('AN OPEN-WORLD CRIME GAME', VW / 2, 252);
  ctx.fillStyle = '#ffffff';
  ctx.font = '17px sans-serif';
  ctx.fillText('Rico Vega came home broke. Vera Solano has twelve jobs for him —', VW / 2, 300);
  ctx.fillText('and Don Sal Marconi owns everything in between.', VW / 2, 324);
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('12 STORY JOBS  ·  10 DISTRICTS  ·  10 VEHICLES  ·  7 WEAPONS  ·  TAXI · COURIER · RACES · VIGILANTE · REPO', VW / 2, 366);
  ctx.fillStyle = '#ffffff';
  ctx.font = '15px sans-serif';
  ctx.fillText('WASD — drive / walk      E — enter & steal cars      Mouse — aim, click — shoot', VW / 2, 420);
  ctx.fillText('Q — start a job      T — taxi      U — courier      V — street race      X — repo work', VW / 2, 446);
  ctx.fillText('B — gun shop      G — garage      M — mute      C — radio      P — pause      1-7 — weapons', VW / 2, 472);
  ctx.fillStyle = '#7dff6a';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('PRESS ENTER TO PLAY', VW / 2, 540);
  ctx.fillStyle = '#cccccc';
  ctx.font = '13px sans-serif';
  ctx.fillText('Save with 1-3 on the pause screen, load with 4-6 · your progress lives in this browser', VW / 2, 580);
  ctx.fillText('An original game: its city, characters, vehicles, names and story are its own.', VW / 2, 604);
}

function drawPause(ctx, G) {
  dim(ctx);
  bigPanel(ctx, VW / 2 - 320, 130, 640, 520);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText('PAUSED', VW / 2, 190);
  ctx.fillStyle = '#ffffff';
  ctx.font = '17px sans-serif';
  const lines = [
    'P / Esc — resume',
    'H — help & controls',
    'Tab — stats & progress',
    'B — Iron & Oak gun shop',
    'G — Solano Garage (upgrades & stored cars)',
    'M — mute · C — change radio station',
    '',
    'SAVE — press 1, 2 or 3 to save into that slot',
    'LOAD — press 4, 5 or 6 to load that slot',
  ];
  lines.forEach((l, i) => ctx.fillText(l, VW / 2, 240 + i * 28));
  ctx.fillStyle = '#cccccc';
  ctx.font = '14px sans-serif';
  for (let s = 1; s <= 3; s++) {
    const info = slotInfo(s);
    ctx.fillText('Slot ' + s + ': ' + (info ? money(info.cash) + ' · ' + info.missions + ' jobs done · ' + info.date : 'empty'), VW / 2, 520 + s * 22);
  }
}

function drawBusted(ctx, G) {
  dim(ctx);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5a5a';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('BUSTED', VW / 2, 300);
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px sans-serif';
  ctx.fillText(G.bustedFine > 0 ? 'The Bay PD took you in. Fine: ' + money(G.bustedFine) + '.' : 'You were taken down and patched up at Bay General.', VW / 2, 350);
  ctx.fillText('The jobs are still waiting. Press ENTER to get back on the streets.', VW / 2, 380);
  ctx.fillStyle = '#7dff6a';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('PRESS ENTER', VW / 2, 450);
}

function drawComplete(ctx, G) {
  dim(ctx);
  const info = G.completeInfo || { name: 'Job', reward: 0, next: null };
  ctx.textAlign = 'center';
  ctx.fillStyle = '#7dff6a';
  ctx.font = 'bold 56px sans-serif';
  ctx.fillText('JOB COMPLETE', VW / 2, 280);
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(info.name + '  ·  +' + money(info.reward), VW / 2, 340);
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px sans-serif';
  ctx.fillText('Reputation: ' + repName(G.player.rep || 0) + '  ·  Jobs done: ' + (G.stats.missionsDone || 0) + ' / 12', VW / 2, 390);
  if (info.next) ctx.fillText('Next job: ' + info.next + ' — press Q when you are ready.', VW / 2, 420);
  else ctx.fillText('All twelve jobs done. You are the King of the Bay.', VW / 2, 420);
  ctx.fillStyle = '#7dff6a';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('PRESS ENTER TO CONTINUE', VW / 2, 490);
}

function drawShop(ctx, G) {
  dim(ctx);
  bigPanel(ctx, VW / 2 - 360, 90, 720, 620);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#6ab8ff';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText('IRON & OAK GUN SHOP', VW / 2, 140);
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px sans-serif';
  ctx.fillText('Cash: ' + money(G.player.cash) + '   ·   Rep: ' + repName(G.player.rep || 0) + '   ·   Press 1-7 to buy, 8 for ammo, 9 for armour, B to leave', VW / 2, 172);
  const keys = Object.keys(WEAPONS);
  ctx.textAlign = 'left';
  keys.forEach((k, i) => {
    const w = WEAPONS[k];
    const owned = G.player.ownedWeapons.includes(k);
    const locked = (G.player.rep || 0) < w.rep;
    const y = 210 + i * 52;
    ctx.fillStyle = owned ? '#7dff6a' : locked ? '#888888' : '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText((i + 1) + '. ' + w.name, VW / 2 - 330, y);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#cccccc';
    ctx.fillText('DMG ' + w.damage + ' · RNG ' + w.range + (w.pellets ? ' · ' + w.pellets + ' pellets' : '') + (w.fire ? ' · sets fire' : '') + (w.auto ? ' · auto' : ''), VW / 2 - 330, y + 20);
    ctx.textAlign = 'right';
    ctx.fillStyle = owned ? '#7dff6a' : '#ffd94a';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(owned ? 'OWNED' + (w.maxAmmo > 0 ? ' · ' + (G.player.ammo[k] || 0) + ' ammo' : '') : locked ? 'NEEDS ' + repName(w.rep).toUpperCase() : money(w.price), VW / 2 + 330, y);
    ctx.textAlign = 'left';
  });
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px sans-serif';
  ctx.fillText('8. Ammo for current weapon (' + money(WEAPONS[G.player.weapon].ammoPrice || 0) + ')      9. Body armour — $250 (now ' + Math.round(G.player.armor) + ')', VW / 2 - 330, 210 + keys.length * 52 + 10);
  if (G.shopMessage) {
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(G.shopMessage, VW / 2, 210 + keys.length * 52 + 44);
  }
}

function drawGarage(ctx, G) {
  dim(ctx);
  bigPanel(ctx, VW / 2 - 360, 110, 720, 560);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff8c1a';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText('SOLANO GARAGE', VW / 2, 160);
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px sans-serif';
  const car = G.player.inCar;
  ctx.fillText('Cash: ' + money(G.player.cash) + '   ·   ' + (car ? 'Working on your ' + car.type + ' (HP ' + Math.round(car.hp) + '/' + car.maxHp + ')' : 'Drive a car in to upgrade it'), VW / 2, 192);
  const keys = Object.keys(UPGRADES);
  ctx.textAlign = 'left';
  keys.forEach((k, i) => {
    const u = UPGRADES[k];
    const has = car && car.upgrades[k];
    const y = 230 + i * 48;
    ctx.fillStyle = has ? '#7dff6a' : '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText((i + 1) + '. ' + u.name, VW / 2 - 330, y);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#cccccc';
    ctx.fillText(u.desc, VW / 2 - 330, y + 20);
    ctx.textAlign = 'right';
    ctx.fillStyle = has ? '#7dff6a' : '#ffd94a';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(has ? 'FITTED' : money(u.price), VW / 2 + 330, y);
    ctx.textAlign = 'left';
  });
  const gy = 230 + keys.length * 48 + 16;
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px sans-serif';
  ctx.fillText('6. Store this car in the garage (' + (G.storedCars ? G.storedCars.length : 0) + '/5)', VW / 2 - 330, gy);
  if (G.storedCars && G.storedCars.length > 0) {
    ctx.fillText('Stored cars — press 7, 8 or 9 to take one out:', VW / 2 - 330, gy + 30);
    G.storedCars.forEach((c, i) => {
      ctx.fillStyle = '#ffd94a';
      ctx.fillText((7 + i) + '. ' + c.type + ' (' + c.color + ')', VW / 2 - 330, gy + 56 + i * 22);
    });
  }
  if (G.garageMessage) {
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(G.garageMessage, VW / 2, gy + 120);
  }
  ctx.fillStyle = '#cccccc';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Press G or Esc to leave the garage', VW / 2, 640);
}

function drawStats(ctx, G) {
  dim(ctx);
  bigPanel(ctx, VW / 2 - 320, 110, 640, 560);
  const s = G.stats;
  const p = G.player;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText('RICO VEGA — STATS', VW / 2, 160);
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px sans-serif';
  const rows = [
    'Reputation: ' + repName(p.rep || 0) + ' (' + (p.rep || 0) + ' / 5)',
    'Cash: ' + money(p.cash) + '   ·   Earned all time: ' + money(s.earned || 0),
    'Jobs finished: ' + (s.missionsDone || 0) + ' / 12' + (MISSION_DEFS[s.missionsDone] ? ' — next: ' + MISSION_DEFS[s.missionsDone].name : ' — all done!'),
    'Street races won: ' + (s.racesWon || 0),
    'Cars stolen: ' + (s.carsStolen || 0) + '   ·   Distance driven: ' + Math.round((s.distanceDriven || 0) / 100) / 10 + ' km',
    'Kills: ' + (s.kills || 0) + '   ·   Stashes found: ' + (s.stashes || 0),
    'Time in the Bay: ' + Math.floor((s.playSeconds || 0) / 60) + 'm ' + Math.floor((s.playSeconds || 0) % 60) + 's',
    'Weapons owned: ' + p.ownedWeapons.map((k) => WEAPONS[k].name).join(', '),
    'Garage: ' + (G.storedCars && G.storedCars.length ? G.storedCars.map((c) => c.type).join(', ') : 'empty'),
  ];
  rows.forEach((r, i) => ctx.fillText(r, VW / 2, 210 + i * 40));
  ctx.fillStyle = '#cccccc';
  ctx.font = '14px sans-serif';
  ctx.fillText('Press Tab or H to go back', VW / 2, 620);
}

function drawHelp(ctx, G) {
  dim(ctx);
  bigPanel(ctx, VW / 2 - 340, 90, 680, 620);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText('HOW TO PLAY', VW / 2, 140);
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px sans-serif';
  const lines = [
    'ON FOOT — WASD / arrows to walk, Shift to sprint, mouse to aim, click or Space to shoot.',
    'DRIVING — W accelerate, S brake/reverse, A/D steer, Space handbrake, N nitrous (if fitted).',
    'STEALING — walk up to any car and press E. Stealing in front of the law raises your wanted level.',
    'WANTED — stars rise when you steal, shoot or hit people. Lose the cops to cool off;',
    '  at 3 stars the Bay PD sets roadblocks, at 4 a helicopter joins the hunt.',
    'JOBS — press Q to start the next job for Vera Solano. Gold markers show where to go.',
    'SIDE WORK — T taxi fares, U courier drops, V street races, X repo jobs, Y vigilante.',
    'MONEY — jobs, fares and stashes pay cash. Spend it at the gun shop (B) and the garage (G).',
    'WEAPONS — buy at Iron & Oak, draw with keys 1-7. Better guns need more street rep.',
    'SAVE — on the pause screen, 1-3 saves, 4-6 loads. Three slots, kept in this browser.',
    'RADIO — C changes station, M mutes. The Bay never sleeps: day turns to night,',
    '  rain makes the roads slick and fog closes in from the harbour.',
    '',
    'STORY — Rico Vega owes Vera Solano. Twelve jobs stand between him and the Marconi family.',
  ];
  lines.forEach((l, i) => ctx.fillText(l, VW / 2, 180 + i * 30));
  ctx.fillStyle = '#cccccc';
  ctx.font = '14px sans-serif';
  ctx.fillText('Press H or Esc to go back', VW / 2, 660);
}
