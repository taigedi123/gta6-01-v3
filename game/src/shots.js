// Screenshot staging: ?shot=start|drive|chase|mission (with &seed=N) puts the
// real game into a staged moment — title screen, a drive through Downtown,
// a three-star police chase at golden hour, a story mission mid-action —
// then paints it and sets window.__shotReady so the screenshot tool knows
// the frame is done.
import { PLACES } from './config.js';
import { makeVehicle, enterCar } from './vehicles.js';
import { startMission } from './missions.js';
import { spawnCop } from './pedestrians.js';

function giveCar(G, x, y, type, color) {
  const car = makeVehicle(type || 'sedan', x, y, Math.PI / 2, color);
  G.cars.push(car);
  enterCar(G, car);
  return car;
}

function placePlayer(G, x, y) {
  G.player.x = x;
  G.player.y = y;
  G.player.hp = 100;
  G.player.armor = 60;
}

function chaseSetup(G) {
  placePlayer(G, 1600, 640);
  const car = giveCar(G, 1600, 640, 'sports', '#e83c3c');
  car.speed = 380;
  car.upgrades.nitrous = true;
  car.nitrous = 100;
  G.player.cash = 2480;
  G.player.wanted = 3;
  G.player.seenTimer = 8;
  G.player.rep = 2;
  G.mission.index = 4; // Heat Wave is job 5 of 12, so the HUD job line matches.
  spawnCop(G, 1500, 540);
  spawnCop(G, 1740, 740);
  spawnCop(G, 1600, 460);
  const copCar = makeVehicle('police', 1560, 900, Math.PI / 2);
  copCar.driver = 'cop';
  copCar.speed = 420;
  G.cars.push(copCar);
  G.roadblock = { x: 1600, y: 1080, life: 25 };
  const rb1 = makeVehicle('police', 1560, 1080, 0);
  rb1.driver = 'cop';
  const rb2 = makeVehicle('police', 1640, 1080, 0);
  rb2.driver = 'cop';
  G.cars.push(rb1, rb2);
  G.mission.objective = 'Heat Wave: Lose the Bay PD — 3 stars! Escape to Suburb Gardens';
  G.mission.marker = { x: PLACES.suburbs.x, y: PLACES.suburbs.y };
  G.message = 'Three stars! Lose the Bay PD — roadblock ahead!';
  G.message2 = 'Job 5/12 · Heat Wave — escape to Suburb Gardens';
  G.messageTimer = 30;
  G.dayTime = 17.6; // golden hour
}

function missionSetup(G) {
  placePlayer(G, 640, 1920);
  G.player.cash = 640;
  G.player.weapon = 'smg';
  G.player.ownedWeapons = ['fists', 'pistol', 'smg'];
  G.player.ammo.smg = 120;
  G.player.rep = 1;
  G.mission.index = 2; // Dockside Debt
  startMission(G);
  G.message = "Vera Solano: 'Clear the Marconi enforcers off the cranes. Loud is fine.'";
  G.message2 = 'Job 3/12 · Dockside Debt — deal with 3 enforcers';
  G.messageTimer = 30;
  G.dayTime = 11.5;
}

function driveSetup(G) {
  placePlayer(G, 1600, 640);
  const car = giveCar(G, 1600, 640, 'muscle', '#c83c1a');
  car.speed = 340;
  G.player.cash = 890;
  G.player.wanted = 0;
  G.player.rep = 1;
  G.message = 'Downtown, Vermilion Bay — traffic, pedestrians and the whole city to explore.';
  G.message2 = 'Press Q to start the next job for Vera Solano';
  G.messageTimer = 30;
  G.dayTime = 10.2;
}

export function stageShot(name, G) {
  G.time = 42;
  G.screen = 'play';
  if (name === 'chase') { chaseSetup(G); return; }
  if (name === 'mission') { missionSetup(G); return; }
  if (name === 'drive') { driveSetup(G); return; }
  // start: title screen over a living city backdrop.
  placePlayer(G, 960, 2880);
  G.screen = 'title';
  G.dayTime = 17.8;
}

// After the settle steps, restore the staged moment: the settle lets cops
// close in and traffic bump the car, which would otherwise leave the frame
// showing a stopped, battered car. The chase is mid-flight again.
export function finalizeShot(name, G) {
  const p = G.player;
  p.hp = 100;
  p.armor = 60;
  if (p.inCar) {
    p.inCar.hp = p.inCar.maxHp;
    if (name === 'chase') p.inCar.speed = 380;
    if (name === 'drive') p.inCar.speed = 340;
  }
  if (name === 'chase') {
    p.wanted = 3;
    p.seenTimer = 8;
    G.messageTimer = 30;
  }
  if (name === 'mission') G.messageTimer = 30;
  if (name === 'drive') G.messageTimer = 30;
}
