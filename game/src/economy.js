// Money, reputation and progress: the gun shop, the garage, the safehouse
// saves, and the stats screen. Three save slots in localStorage.
import { WEAPONS, UPGRADES, REP_RANKS, SAVE_SLOTS } from './config.js';
import { money } from './util.js';
import { sfx } from './audio.js';

export function makeStats() {
  return {
    playSeconds: 0, missionsDone: 0, earned: 0, kills: 0,
    distanceDriven: 0, racesWon: 0, stashes: 0, carsStolen: 0,
  };
}

export function repName(rep) {
  return REP_RANKS[Math.max(0, Math.min(REP_RANKS.length - 1, rep || 0))];
}

export function buyWeapon(G, key) {
  const p = G.player;
  const w = WEAPONS[key];
  if (!w) return 'No such weapon.';
  if (p.ownedWeapons.includes(key)) return 'You already own the ' + w.name + '.';
  if ((p.rep || 0) < w.rep) return 'The ' + w.name + ' needs rep: ' + repName(w.rep) + '. Do more jobs.';
  if (p.cash < w.price) return 'Not enough cash — the ' + w.name + ' costs ' + money(w.price) + '.';
  p.cash -= w.price;
  p.ownedWeapons.push(key);
  p.weapon = key;
  if (w.maxAmmo > 0) p.ammo[key] = w.maxAmmo;
  sfx('pickup');
  return 'Bought the ' + w.name + ' for ' + money(w.price) + '. Press ' + (Object.keys(WEAPONS).indexOf(key) + 1) + ' to draw it.';
}

export function buyAmmo(G, key) {
  const p = G.player;
  const w = WEAPONS[key];
  if (!w || w.maxAmmo === 0) return 'Nothing to reload.';
  if (p.cash < w.ammoPrice) return 'Not enough cash for ammo.';
  p.cash -= w.ammoPrice;
  p.ammo[key] = Math.min(w.maxAmmo, (p.ammo[key] || 0) + Math.floor(w.maxAmmo / 2));
  sfx('pickup');
  return 'Ammo topped up: ' + w.name + ' now ' + p.ammo[key] + '/' + w.maxAmmo + '.';
}

export function buyArmor(G) {
  const p = G.player;
  if (p.cash < 250) return 'Body armour costs $250.';
  if (p.armor >= 100) return 'Your armour is already full.';
  p.cash -= 250;
  p.armor = 100;
  sfx('pickup');
  return 'Body armour fitted — 100 armour.';
}

export function buyUpgrade(G, key) {
  const p = G.player;
  const car = p.inCar;
  const u = UPGRADES[key];
  if (!u) return 'No such upgrade.';
  if (!car) return 'Drive a car into the garage first.';
  if (car.upgrades[key]) return 'The ' + car.type + ' already has ' + u.name + '.';
  if (p.cash < u.price) return 'Not enough cash — ' + u.name + ' costs ' + money(u.price) + '.';
  p.cash -= u.price;
  car.upgrades[key] = true;
  if (key === 'frame') { car.maxHp += 60; car.hp += 60; }
  if (key === 'nitrous') car.nitrous = 100;
  sfx('pickup');
  return u.name + ' fitted to your ' + car.type + '.';
}

export function storeCar(G) {
  const p = G.player;
  const car = p.inCar;
  if (!car) return 'Drive a car in to store it.';
  if (!G.storedCars) G.storedCars = [];
  if (G.storedCars.length >= 5) return 'The garage is full (5 cars). Sell one by driving it out? No — it stays.';
  if (G.storedCars.some((c) => c === car)) return 'This car is already stored.';
  G.storedCars.push({ type: car.type, color: car.color, upgrades: { ...car.upgrades } });
  sfx('pickup');
  return 'Stored the ' + car.type + ' in the garage (' + G.storedCars.length + '/5).';
}

export function retrieveCar(G, index) {
  const p = G.player;
  if (!G.storedCars || !G.storedCars[index]) return 'No car in that slot.';
  const saved = G.storedCars.splice(index, 1)[0];
  const car = { type: saved.type, x: p.x + 60, y: p.y, angle: 0, speed: 0, color: saved.color,
    len: 52, wid: 26, hp: 100, maxHp: 100, driver: 'parked', targetAngle: 0, steer: 0,
    upgrades: saved.upgrades || {}, nitrous: 0, smokeTimer: 0, stuckTimer: 0, honkTimer: 0 };
  // Restore the type's real size.
  const sizes = { limo: [84, 28], truck: [74, 30], van: [62, 28], bike: [44, 16] };
  if (sizes[saved.type]) { car.len = sizes[saved.type][0]; car.wid = sizes[saved.type][1]; }
  G.cars.push(car);
  sfx('door');
  return 'Your ' + saved.type + ' is parked outside.';
}

export function slotInfo(slot) {
  try {
    const raw = localStorage.getItem('vermilion-bay-save-' + slot);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return { cash: d.cash, missions: d.missionIndex, rep: d.rep, date: d.date };
  } catch (e) {
    return null;
  }
}

export function saveGame(G, slot) {
  const p = G.player;
  const data = {
    cash: p.cash, hp: p.hp, armor: p.armor, rep: p.rep || 0,
    weapon: p.weapon, ownedWeapons: p.ownedWeapons, ammo: p.ammo,
    x: p.x, y: p.y, missionIndex: G.mission.index,
    missionsDone: G.stats.missionsDone, earned: G.stats.earned,
    dayTime: G.dayTime, date: new Date().toLocaleString(),
  };
  try {
    localStorage.setItem('vermilion-bay-save-' + slot, JSON.stringify(data));
    return 'Saved to slot ' + slot + ' — ' + data.date;
  } catch (e) {
    return 'Save failed: the browser blocked storage.';
  }
}

export function loadGame(G, slot) {
  const p = G.player;
  try {
    const raw = localStorage.getItem('vermilion-bay-save-' + slot);
    if (!raw) return 'Slot ' + slot + ' is empty.';
    const d = JSON.parse(raw);
    p.cash = d.cash;
    p.hp = d.hp;
    p.armor = d.armor;
    p.rep = d.rep || 0;
    p.weapon = d.weapon;
    p.ownedWeapons = d.ownedWeapons || ['fists'];
    p.ammo = d.ammo || p.ammo;
    p.x = d.x;
    p.y = d.y;
    p.inCar = null;
    p.wanted = 0;
    G.mission.index = d.missionIndex || 0;
    G.mission.active = false;
    G.mission.marker = null;
    G.mission.objective = 'Press Q to start the next job for Vera Solano';
    G.stats.missionsDone = d.missionsDone || 0;
    G.stats.earned = d.earned || 0;
    G.dayTime = d.dayTime || 10;
    G.cops = [];
    G.heli = null;
    G.roadblock = null;
    return 'Loaded slot ' + slot + ' — welcome back, Rico.';
  } catch (e) {
    return 'Load failed: that save is unreadable.';
  }
}

export { SAVE_SLOTS };
