// Vermilion Bay — main loop and wiring. Creates the game state, owns the
// screen state machine (title / play / pause / shop / garage / stats / help
// / busted / mission-complete), steps every system once a frame, and stages
// screenshot scenes from ?shot=... so the cover images are real renders.
import { WORLD_W, WORLD_H, PLACES, WEAPONS, UPGRADES } from './config.js';
import { clamp } from './util.js';
import { buildWorld } from './world.js';
import { createInput } from './input.js';
import { initAudio, startRadio, stopRadio, toggleMute, cycleRadio, sfx, engineOff } from './audio.js';
import { makeVehicle, spawnTraffic, spawnParked, driveCar, exitCar, updateTraffic } from './vehicles.js';
import { spawnPeds, updatePeds, updateCops } from './pedestrians.js';
import { makePlayer, updatePlayer, updateBullets, updatePickups, dropPickup } from './player.js';
import { makeMissionState, startMission, updateMission, startTaxi, updateTaxi, startCourier, updateCourier, startRace, updateRace, startVigilante, updateVigilante, startRepo, updateRepo } from './missions.js';
import { makeStats, buyWeapon, buyAmmo, buyArmor, buyUpgrade, storeCar, retrieveCar, saveGame, loadGame } from './economy.js';
import { makeWeather, updateWeather, updateEvents } from './events.js';
import { updateParticles } from './particles.js';
import { render, setupCanvas } from './render.js';
import { stageShot, finalizeShot } from './shots.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');

export function createGame(seed) {
  const world = buildWorld(seed || 20261118);
  const G = {
    canvas, ctx: canvas.getContext('2d'),
    world, places: PLACES,
    time: 0, dayTime: 10.0, frameDt: 0.016,
    screen: 'title',
    player: makePlayer(960, 2880),
    cars: [], peds: [], cops: [], bullets: [], particles: [], skids: [], floaters: [], pickups: [],
    mission: makeMissionState(),
    taxi: { active: false }, courier: { active: false }, race: { active: false },
    vigilante: { active: false }, repo: { active: false },
    eventTimer: 40, weather: makeWeather(),
    heli: null, roadblock: null, copTimer: 0,
    gunfireTimer: 0,
    camera: { x: 0, y: 0, shake: 0 },
    message: '', message2: '', messageTimer: 0,
    stats: makeStats(),
    storedCars: [],
    bustedFine: 0, completeInfo: null,
    shopMessage: '', garageMessage: '',
    input: null,
  };
  G.input = createInput(canvas);
  // Helper the missions and events modules use to drop a car into the world.
  G.spawnCarAt = (type, x, y) => {
    const car = makeVehicle(type, x, y, Math.PI / 2);
    car.driver = 'parked';
    G.cars.push(car);
    return car;
  };
  spawnParked(G);
  spawnTraffic(G, 34);
  spawnPeds(G, 52);
  // A few pickups near the spawn so the first minutes teach the systems.
  dropPickup(G, 'cash', 960, 2720, 100);
  dropPickup(G, 'health', 1120, 2880, 0);
  return G;
}

function setStatus(G, text) {
  if (statusEl) statusEl.textContent = text;
}

function startPlaying(G) {
  initAudio();
  startRadio();
  G.screen = 'play';
  G.message = 'Welcome to Vermilion Bay, Rico. Press Q for your first job.';
  G.message2 = 'Vera Solano is waiting — follow the gold marker.';
  G.messageTimer = 5;
  setStatus(G, 'Playing Vermilion Bay.');
  sfx('mission');
}

function respawnAfterBust(G) {
  const p = G.player;
  p.hp = 100;
  p.armor = 0;
  p.x = PLACES.safehouse1.x;
  p.y = PLACES.safehouse1.y;
  p.inCar = null;
  p.wanted = 0;
  G.cops = [];
  G.heli = null;
  G.roadblock = null;
  G.screen = 'play';
  G.message = 'Back on the streets. The jobs are still waiting.';
  G.messageTimer = 4;
}

// One frame of the screen state machine: menus first, then the live game.
function handleScreens(G) {
  const input = G.input;
  const s = G.screen;
  if (s === 'title') {
    if (input.hit('Enter') || input.mousePressed) startPlaying(G);
    return;
  }
  if (s === 'busted') {
    if (input.hit('Enter')) respawnAfterBust(G);
    return;
  }
  if (s === 'complete') {
    if (input.hit('Enter')) { G.screen = 'play'; G.message = G.mission.objective; G.messageTimer = 4; }
    return;
  }
  if (s === 'pause') {
    if (input.hit('KeyP') || input.hit('Escape')) G.screen = 'play';
    else if (input.hit('KeyH')) G.screen = 'help';
    else if (input.hit('Tab')) { G.screen = 'stats'; }
    else if (input.hit('KeyB')) G.screen = 'shop';
    else if (input.hit('KeyG')) G.screen = 'garage';
    else saveLoadKeys(G);
    return;
  }
  if (s === 'help' || s === 'stats') {
    if (input.hit('KeyH') || input.hit('Escape') || input.hit('Tab')) G.screen = 'play';
    return;
  }
  if (s === 'shop') {
    if (input.hit('KeyB') || input.hit('Escape')) { G.screen = 'play'; return; }
    const keys = Object.keys(WEAPONS);
    for (let i = 0; i < keys.length; i++) {
      if (input.hit('Digit' + (i + 1))) G.shopMessage = buyWeapon(G, keys[i]);
    }
    if (input.hit('Digit8')) G.shopMessage = buyAmmo(G, G.player.weapon);
    if (input.hit('Digit9')) G.shopMessage = buyArmor(G);
    return;
  }
  if (s === 'garage') {
    if (input.hit('KeyG') || input.hit('Escape')) { G.screen = 'play'; return; }
    const keys = Object.keys(UPGRADES);
    for (let i = 0; i < keys.length; i++) {
      if (input.hit('Digit' + (i + 1))) G.garageMessage = buyUpgrade(G, keys[i]);
    }
    if (input.hit('Digit6')) G.garageMessage = storeCar(G);
    for (let i = 0; i < 3; i++) {
      if (input.hit('Digit' + (7 + i))) G.garageMessage = retrieveCar(G, i);
    }
    return;
  }
  // screen === 'play'
  if (input.hit('KeyP') || input.hit('Escape')) { G.screen = 'pause'; sfx('click'); return; }
  if (input.hit('KeyH')) { G.screen = 'help'; return; }
  if (input.hit('Tab')) { G.screen = 'stats'; return; }
  if (input.hit('KeyB')) { G.screen = 'shop'; G.shopMessage = ''; sfx('click'); return; }
  if (input.hit('KeyG')) { G.screen = 'garage'; G.garageMessage = ''; sfx('click'); return; }
  if (input.hit('KeyM')) { const m = toggleMute(); G.message = m ? 'Sound muted.' : 'Sound on.'; G.messageTimer = 2; return; }
  if (input.hit('KeyC')) { G.message = cycleRadio(); G.messageTimer = 2; return; }
  if (input.hit('KeyQ')) { startMission(G); return; }
  if (input.hit('KeyT')) { startTaxi(G); return; }
  if (input.hit('KeyU')) { startCourier(G); return; }
  if (input.hit('KeyV')) { startRace(G); return; }
  if (input.hit('KeyX')) { startRepo(G); return; }
  if (input.hit('KeyY')) { startVigilante(G); return; }
  // Check inCar first: hit() consumes the press, so asking it while on foot
  // would swallow the E that updatePlayer needs to enter a car.
  if (G.player.inCar && input.hit('KeyE')) { exitCar(G, false); return; }}

function saveLoadKeys(G) {
  const input = G.input;
  for (let slot = 1; slot <= 3; slot++) {
    if (input.hit('Digit' + slot)) {
      G.message = saveGame(G, slot);
      G.messageTimer = 3;
      sfx('pickup');
    }
    if (input.hit('Digit' + (slot + 3))) {
      G.message = loadGame(G, slot);
      G.messageTimer = 3;
      sfx('pickup');
    }
  }
}

function stepGame(G, dt) {
  G.time += dt;
  G.dayTime = (G.dayTime + dt * 0.05) % 24;
  G.gunfireTimer = Math.max(0, G.gunfireTimer - dt);
  handleScreens(G);
  if (G.screen !== 'play') return;
  G.stats.playSeconds += dt;
  if (G.messageTimer > 0) {
    G.messageTimer -= dt;
    if (G.messageTimer <= 0) G.message2 = '';
  }
  const p = G.player;
  updatePlayer(G, dt);
  if (p.inCar) {
    driveCar(G, p.inCar, dt, G.input);
    G.stats.distanceDriven += Math.abs(p.inCar.speed) * dt;
  }
  updateTraffic(G, dt);
  updatePeds(G, dt);
  updateCops(G, dt);
  updateBullets(G, dt);
  updatePickups(G, dt);
  updateMission(G, dt);
  updateTaxi(G, dt);
  updateCourier(G, dt);
  updateRace(G, dt);
  updateVigilante(G, dt);
  updateRepo(G, dt);
  updateWeather(G, dt);
  updateEvents(G, dt);
  updateParticles(G, dt);
  // Keep the player inside the world.
  if (!p.inCar) {
    p.x = clamp(p.x, 20, WORLD_W - 20);
    p.y = clamp(p.y, 20, WORLD_H - 20);
  }
}

function main() {
  setupCanvas(canvas);
  const params = new URLSearchParams(location.search);
  const seedParam = Number(params.get('seed') || 1);
  const G = createGame(20261118 + seedParam);
  window.__game = G;
  let last = performance.now();
  const shotName = params.get('shot');
  if (shotName) {
    stageShot(shotName, G);
    // Let the staged scene settle: traffic moves, peds walk, cops close in.
    for (let i = 0; i < 40; i++) stepGame(G, 1 / 60);
    finalizeShot(shotName, G);
    G.screen = shotName === 'start' ? 'title' : 'play';
    render(G);
    render(G);
    window.__shotReady = true;
    return;
  }
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    G.frameDt = dt;
    stepGame(G, dt);
    render(G);
    G.input.endFrame();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

main();
