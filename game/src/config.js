// Vermilion Bay: world constants, district palettes, vehicle and weapon tables.
// All tuning numbers for the game live here so the other modules stay readable.

export const WORLD_W = 4480;
export const WORLD_H = 3360;
export const BLOCK = 320; // road grid spacing
export const ROAD_W = 96;

// Ten districts, each with its own ground, road and building palette.
export const DISTRICTS = [
  { name: 'Marina', x: 0, y: 0, w: 1120, h: 1120, ground: '#7fae8e', road: '#5d5a52', build: '#e8dcc0', accent: '#3f8f7a', label: 'MARINA' },
  { name: 'Downtown', x: 1120, y: 0, w: 1120, h: 1120, ground: '#8a8f7d', road: '#4c4c4c', build: '#b8c4cc', accent: '#d8a03c', label: 'DOWNTOWN' },
  { name: 'Calle Verde', x: 2240, y: 0, w: 1120, h: 1120, ground: '#a89a6a', road: '#6b6257', build: '#d8b878', accent: '#c85a2a', label: 'CALLE VERDE' },
  { name: 'North Hills', x: 3360, y: 0, w: 1120, h: 1120, ground: '#7d9a6a', road: '#55524a', build: '#c8c0a0', accent: '#5a7d4a', label: 'NORTH HILLS' },
  { name: 'Docklands', x: 0, y: 1120, w: 1120, h: 1120, ground: '#7d8a94', road: '#565656', build: '#9aa4a8', accent: '#c85a2a', label: 'DOCKLANDS' },
  { name: 'Midtown', x: 1120, y: 1120, w: 1120, h: 1120, ground: '#93a06e', road: '#55524a', build: '#d0c8a8', accent: '#4a7d5a', label: 'MIDTOWN' },
  { name: 'Foundry Row', x: 2240, y: 1120, w: 1120, h: 1120, ground: '#8d8578', road: '#4a4a48', build: '#a89a8a', accent: '#b83c2a', label: 'FOUNDRY ROW' },
  { name: 'Campus Green', x: 3360, y: 1120, w: 1120, h: 1120, ground: '#86a872', road: '#5f6a55', build: '#d8c8a0', accent: '#2a7d9e', label: 'CAMPUS GREEN' },
  { name: 'Beachfront', x: 0, y: 2240, w: 2240, h: 1120, ground: '#e0c98f', road: '#7a6a52', build: '#f0e0b8', accent: '#2a7d9e', label: 'BEACHFRONT' },
  { name: 'Suburbs', x: 2240, y: 2240, w: 2240, h: 1120, ground: '#7fae72', road: '#5f6a55', build: '#d8c8a0', accent: '#5a8a4a', label: 'SUBURBS' },
];

// Vehicle types: distinct handling, size and top speed.
export const VEHICLES = {
  sedan:   { name: 'Sedan',       accel: 340, top: 430, turn: 2.6, grip: 0.92, len: 52, wid: 26, colors: ['#c84a4a', '#4a7dc8', '#c8c8c8', '#3c6a4a', '#8a5a9e'] },
  taxi:    { name: 'Taxi',        accel: 320, top: 410, turn: 2.7, grip: 0.92, len: 52, wid: 26, colors: ['#e8c832'] },
  van:     { name: 'Van',         accel: 240, top: 330, turn: 2.0, grip: 0.95, len: 62, wid: 28, colors: ['#d8d8d8', '#7a8a9a', '#a05a3c'] },
  sports:  { name: 'Sports Car',  accel: 560, top: 640, turn: 3.1, grip: 0.88, len: 54, wid: 26, colors: ['#e83c3c', '#e8a03c', '#2a9ed8', '#222222'] },
  bike:    { name: 'Motorbike',   accel: 520, top: 600, turn: 3.8, grip: 0.80, len: 44, wid: 16, colors: ['#1a1a1a', '#c83c6a', '#3c8a5a'] },
  truck:   { name: 'Truck',       accel: 190, top: 300, turn: 1.7, grip: 0.97, len: 74, wid: 30, colors: ['#8a4a2a', '#4a5a6a', '#6a6a6a'] },
  police:  { name: 'Patrol Car',  accel: 470, top: 570, turn: 3.0, grip: 0.90, len: 54, wid: 26, colors: ['#2a4a8a'] },
  limo:    { name: 'Limousine',   accel: 280, top: 380, turn: 1.9, grip: 0.94, len: 84, wid: 28, colors: ['#181818', '#e8e8e8'] },
  muscle:  { name: 'Muscle Car',  accel: 480, top: 590, turn: 2.8, grip: 0.90, len: 56, wid: 28, colors: ['#c83c1a', '#3c3c3c', '#1a5a8a'] },
  pickup:  { name: 'Pickup',      accel: 300, top: 390, turn: 2.3, grip: 0.93, len: 58, wid: 28, colors: ['#7a4a2a', '#4a6a3c', '#8a8a8a'] },
};

// Weapons the player can buy at the gun shop and carry. rep is the street
// reputation needed before the shop will sell it.
export const WEAPONS = {
  fists:   { name: 'Fists',     damage: 12, rate: 0.32, range: 46,  spread: 0,    auto: false, price: 0,    ammoPrice: 0,   maxAmmo: 0,   rep: 0 },
  pistol:  { name: 'Pistol',    damage: 22, rate: 0.28, range: 420, spread: 0.05, auto: false, price: 350,  ammoPrice: 40,  maxAmmo: 120, rep: 0 },
  shotgun: { name: 'Shotgun',   damage: 14, rate: 0.85, range: 260, spread: 0.22, auto: false, price: 900,  ammoPrice: 90,  maxAmmo: 60,  rep: 1, pellets: 6 },
  smg:     { name: 'SMG',       damage: 13, rate: 0.09, range: 380, spread: 0.11, auto: true,  price: 1600, ammoPrice: 120, maxAmmo: 240, rep: 2 },
  rifle:   { name: 'Rifle',     damage: 40, rate: 0.22, range: 560, spread: 0.03, auto: true,  price: 2800, ammoPrice: 180, maxAmmo: 180, rep: 3 },
  sniper:  { name: 'Sniper',    damage: 95, rate: 1.10, range: 760, spread: 0.005, auto: false, price: 4200, ammoPrice: 250, maxAmmo: 40,  rep: 4 },
  molotov: { name: 'Molotov',   damage: 55, rate: 0.70, range: 300, spread: 0.08, auto: false, price: 1200, ammoPrice: 150, maxAmmo: 24,  rep: 2, fire: true },
};

// Purchasable car upgrades, applied to the car the player is driving.
export const UPGRADES = {
  engine:   { name: 'Turbo Engine',     price: 1200, desc: '+35% acceleration and top speed' },
  armor:    { name: 'Plated Armor',     price: 1500, desc: 'Car takes half damage, shrugs off bumps' },
  handling: { name: 'Sport Handling',   price: 900,  desc: 'Sharper steering, less sliding' },
  nitrous:  { name: 'Nitrous Kit',      price: 2000, desc: 'Hold N for a burst of speed' },
  frame:    { name: 'Reinforced Frame', price: 1000, desc: '+60 car health, rams harder' },
};

// Street reputation ranks, earned by finishing jobs and side work.
export const REP_RANKS = ['Nobody', 'Wheelman', 'Hustler', 'Enforcer', 'Made Man', 'King of the Bay'];

// Named places the missions and the HUD point at. Every place sits on a
// road intersection, so the player can always reach its marker on foot
// and in a car — a marker inside a building would be unreachable.
export const PLACES = {
  marina:     { x: 640,  y: 640,  label: 'Marina Docks' },
  downtown:   { x: 1600, y: 640,  label: 'Downtown Plaza' },
  calle:      { x: 2880, y: 640,  label: 'Calle Verde Market' },
  hills:      { x: 3840, y: 640,  label: 'North Hills Mansion' },
  docks:      { x: 640,  y: 1600, label: 'Docklands Cranes' },
  midtown:    { x: 1600, y: 1600, label: 'Midtown Market' },
  foundry:    { x: 2880, y: 1600, label: 'Foundry Yard' },
  campus:     { x: 3840, y: 1600, label: 'Campus Quad' },
  beach:      { x: 960,  y: 2880, label: 'Beachfront Pier' },
  suburbs:    { x: 3520, y: 2880, label: 'Suburb Gardens' },
  gunshop:    { x: 1600, y: 1280, label: 'Iron & Oak Gun Shop' },
  garage:     { x: 1920, y: 1920, label: 'Solano Garage' },
  safehouse1: { x: 640,  y: 2560, label: 'Beach Safehouse' },
  safehouse2: { x: 3840, y: 2560, label: 'Suburb Safehouse' },
  diner:      { x: 1280, y: 960,  label: 'Sunset Diner' },
  casino:     { x: 3840, y: 1280, label: 'Vermilion Star Casino' },
  club:       { x: 1600, y: 320,  label: 'Club Lumen' },
  hospital:   { x: 3200, y: 2240, label: 'Bay General Hospital' },
};

// Player tuning.
export const PLAYER = {
  walkSpeed: 210,
  sprintSpeed: 335,
  hp: 100,
  armorMax: 100,
  punchRange: 52,
};

// Wanted-level tuning: how fast heat rises and cools.
export const WANTED = {
  decayPerSec: 0.045,   // stars lost per second while unseen
  copSpawnInterval: 4.0,
  maxCops: 7,
  heliAt: 4,            // helicopter appears at 4 stars
  roadblockAt: 3,       // roadblocks appear at 3 stars
};

export const SAVE_SLOTS = 3;

// Weather: clear, rain and fog roll in and out; rain cuts grip, fog cuts sight.
export const WEATHER = {
  kinds: ['clear', 'rain', 'fog', 'storm'],
  minDuration: 45,
  maxDuration: 120,
};
