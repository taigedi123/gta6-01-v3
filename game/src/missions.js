// Story and side work: twelve jobs for the fixer Vera Solano, plus the taxi,
// courier, street-race, vigilante and repo side activities that pay between
// jobs. Missions are data — a list of steps — driven by one state machine.
// Rico Vega arrives in Vermilion Bay broke, runs jobs for Vera, crosses the
// Marconi family, and ends by taking their convoy and the Bay Crown.
import { PLACES, VEHICLES } from './config.js';
import { dist, money } from './util.js';
import { addWanted, spawnEnforcer, spawnCop } from './pedestrians.js';
import { makeVehicle } from './vehicles.js';
import { sfx } from './audio.js';
import { floatText, burst } from './particles.js';

export const STORY = {
  fixer: 'Vera Solano',
  hero: 'Rico Vega',
  city: 'Vermilion Bay',
  villain: 'Don Sal Marconi',
};

export const MISSION_DEFS = [
  { name: 'New in Town', giver: 'Vera Solano', reward: 300, brief: 'Vera needs a driver she can trust. Meet her at the Marina Docks, then run a parcel to the Sunset Diner.', steps: [
    { kind: 'goto', x: PLACES.marina.x, y: PLACES.marina.y, label: 'Meet Vera Solano at the Marina Docks' },
    { kind: 'goto', x: PLACES.diner.x, y: PLACES.diner.y, label: 'Deliver the parcel to the Sunset Diner' },
  ]},
  { name: 'Hot Property', giver: 'Vera Solano', reward: 500, brief: 'A client needs wheels, fast. Steal a sports car from Downtown Plaza and park it at Solano Garage.', steps: [
    { kind: 'steal', x: PLACES.downtown.x, y: PLACES.downtown.y, label: 'Steal a sports car in Downtown Plaza', carType: 'sports' },
    { kind: 'park', x: PLACES.garage.x, y: PLACES.garage.y, label: 'Park the sports car at Solano Garage' },
  ]},
  { name: 'Dockside Debt', giver: 'Vera Solano', reward: 700, brief: 'The Marconi crew is shaking down the docks. Clear out three of their enforcers at the Docklands Cranes.', steps: [
    { kind: 'eliminate', x: PLACES.docks.x, y: PLACES.docks.y, label: 'Deal with 3 Marconi enforcers at the cranes', count: 3 },
  ]},
  { name: 'Three Drops', giver: 'Vera Solano', reward: 900, brief: 'Three drops, one night, no questions. Hit Midtown Market, Calle Verde and the Beachfront Pier before the clock runs out.', steps: [
    { kind: 'timed', x: PLACES.midtown.x, y: PLACES.midtown.y, label: 'Drop 1 of 3: Midtown Market', time: 75 },
    { kind: 'timed', x: PLACES.calle.x, y: PLACES.calle.y, label: 'Drop 2 of 3: Calle Verde Market', time: 75 },
    { kind: 'timed', x: PLACES.beach.x, y: PLACES.beach.y, label: 'Drop 3 of 3: Beachfront Pier', time: 75 },
  ]},
  { name: 'Heat Wave', giver: 'Vera Solano', reward: 1100, brief: 'The Bay PD raided the garage. Lose a three-star wanted level, then meet Vera at the Suburb Gardens.', steps: [
    { kind: 'wanted', label: 'Lose the heat — escape the Bay PD', stars: 3 },
    { kind: 'goto', x: PLACES.suburbs.x, y: PLACES.suburbs.y, label: 'Meet Vera at Suburb Gardens' },
  ]},
  { name: 'Foundry Fire', giver: 'Vera Solano', reward: 1300, brief: 'The Marconis store their take in the Foundry Yard. Wreck four of their vans, then get clear.', steps: [
    { kind: 'wreck', x: PLACES.foundry.x, y: PLACES.foundry.y, label: 'Wreck 4 Marconi vans in the Foundry Yard', count: 4 },
  ]},
  { name: 'The Tail Job', giver: 'Vera Solano', reward: 1500, brief: 'An informant is driving to the Marconi meet. Tail his sedan without being spotted, then take him down at Campus Quad.', steps: [
    { kind: 'follow', x: PLACES.campus.x, y: PLACES.campus.y, label: 'Tail the informant to Campus Quad — stay close, stay unseen' },
    { kind: 'eliminate', x: PLACES.campus.x, y: PLACES.campus.y, label: 'Take down the informant', count: 1 },
  ]},
  { name: 'Repo Run', giver: 'Vera Solano', reward: 1700, brief: 'A North Hills collector stopped paying. Take his limousine and bring it to Solano Garage — quietly, if you can.', steps: [
    { kind: 'steal', x: PLACES.hills.x, y: PLACES.hills.y, label: 'Take the limousine in North Hills', carType: 'limo' },
    { kind: 'park', x: PLACES.garage.x, y: PLACES.garage.y, label: 'Deliver the limousine to Solano Garage' },
  ]},
  { name: 'Bay Crown', giver: 'Vera Solano', reward: 2200, brief: 'The underground Bay Crown race: five checkpoints across the city, fastest line wins. Beat the clock.', steps: [
    { kind: 'race', x: PLACES.downtown.x, y: PLACES.downtown.y, label: 'Checkpoint 1: Downtown Plaza', time: 60 },
    { kind: 'race', x: PLACES.docks.x, y: PLACES.docks.y, label: 'Checkpoint 2: Docklands Cranes', time: 60 },
    { kind: 'race', x: PLACES.beach.x, y: PLACES.beach.y, label: 'Checkpoint 3: Beachfront Pier', time: 60 },
    { kind: 'race', x: PLACES.calle.x, y: PLACES.calle.y, label: 'Checkpoint 4: Calle Verde Market', time: 60 },
    { kind: 'race', x: PLACES.marina.x, y: PLACES.marina.y, label: 'Finish: Marina Docks', time: 60 },
  ]},
  { name: 'Vigilante Nights', giver: 'Vera Solano', reward: 2400, brief: 'Three Marconi getaway cars are running product tonight. Wreck all three before they reach the docks.', steps: [
    { kind: 'convoy', x: PLACES.midtown.x, y: PLACES.midtown.y, label: 'Wreck 3 Marconi getaway cars', count: 3 },
  ]},
  { name: 'The Vault', giver: 'Vera Solano', reward: 3200, brief: 'One last big score: lift the Marconi strongbox from the Vermilion Star Casino and bring it home. The whole city will be watching.', steps: [
    { kind: 'goto', x: PLACES.casino.x, y: PLACES.casino.y, label: 'Grab the strongbox at the Vermilion Star Casino' },
    { kind: 'escape', x: PLACES.safehouse1.x, y: PLACES.safehouse1.y, label: 'Bring the strongbox to the Beach Safehouse — 4 stars!', stars: 4 },
  ]},
  { name: 'King of the Bay', giver: 'Vera Solano', reward: 5000, brief: 'Don Sal Marconi is leaving town in a convoy. Destroy his escorts, wreck his limousine, and Vermilion Bay is yours.', steps: [
    { kind: 'convoy', x: PLACES.hills.x, y: PLACES.hills.y, label: 'Destroy the Marconi escort cars', count: 2 },
    { kind: 'convoy', x: PLACES.marina.x, y: PLACES.marina.y, label: 'Wreck Don Marconi\'s limousine', count: 1, carType: 'limo' },
    { kind: 'goto', x: PLACES.marina.x, y: PLACES.marina.y, label: 'Meet Vera at the Marina — the Bay is yours' },
  ]},
];

export function makeMissionState() {
  return {
    active: false, index: 0, step: 0, timer: 0,
    objective: 'Press Q to start the next job for Vera Solano',
    marker: null, targets: [], done: 0, need: 0, failed: false,
  };
}

export function nextMissionName(G) {
  const m = G.mission;
  if (m.index >= MISSION_DEFS.length) return null;
  return MISSION_DEFS[m.index].name;
}

function playerPos(G) {
  const p = G.player;
  return { x: p.inCar ? p.inCar.x : p.x, y: p.inCar ? p.inCar.y : p.y };
}

function spawnStepTargets(G, step) {
  const m = G.mission;
  m.targets = [];
  m.done = 0;
  m.need = step.count || 0;
  if (step.kind === 'eliminate') {
    for (let i = 0; i < step.count; i++) {
      const e = spawnEnforcer(G, step.x + (i - 1) * 90, step.y + ((i % 2) * 70 - 35));
      m.targets.push(e);
    }
  } else if (step.kind === 'wreck' || step.kind === 'convoy') {
    const type = step.carType || (step.kind === 'wreck' ? 'van' : 'sedan');
    for (let i = 0; i < step.count; i++) {
      const car = makeVehicle(type, step.x + (i - 1) * 140, step.y + (i % 2) * 90 - 45, Math.PI / 2, step.kind === 'convoy' ? '#1a1a1a' : undefined);
      car.driver = 'target';
      car.speed = 0;
      G.cars.push(car);
      m.targets.push(car);
    }
    if (step.kind === 'convoy') {
      // Getaway cars try to run.
      for (const car of m.targets) { car.driver = 'traffic'; car.speed = 260; }
    }
  } else if (step.kind === 'follow') {
    const car = makeVehicle('sedan', step.x - 600, step.y - 200, 0, '#3c6a4a');
    car.driver = 'target';
    car.speed = 130;
    G.cars.push(car);
    m.targets.push(car);
  }
  if (step.time) m.timer = step.time;
  if (step.kind === 'follow') m.timer = 25;
  if (step.stars) addWanted(G, step.stars);
  m.marker = step.x !== undefined ? { x: step.x, y: step.y } : null;
  m.objective = step.label;
}

function advanceStep(G) {
  const m = G.mission;
  const def = MISSION_DEFS[m.index];
  m.step++;
  if (m.step >= def.steps.length) {
    completeMission(G);
    return;
  }
  spawnStepTargets(G, def.steps[m.step]);
  sfx('mission');
}

export function startMission(G) {
  const m = G.mission;
  if (m.active || m.index >= MISSION_DEFS.length) return false;
  if (G.taxi.active || G.courier.active || G.race.active || G.vigilante.active || G.repo.active) {
    G.message = 'Finish your side job first.';
    G.messageTimer = 2;
    return false;
  }
  const def = MISSION_DEFS[m.index];
  m.active = true;
  m.step = 0;
  m.done = 0;
  m.targets = [];
  m.failed = false;
  spawnStepTargets(G, def.steps[0]);
  G.message = 'Job ' + (m.index + 1) + '/12 · ' + def.name;
  G.message2 = def.brief;
  G.messageTimer = 6;
  sfx('mission');
  return true;
}

function completeMission(G) {
  const m = G.mission;
  const def = MISSION_DEFS[m.index];
  G.player.cash += def.reward;
  G.player.rep = Math.min(5, G.player.rep + 1);
  G.stats.missionsDone = (G.stats.missionsDone || 0) + 1;
  G.stats.earned = (G.stats.earned || 0) + def.reward;
  floatText(G, G.player.x, G.player.y, '+' + money(def.reward), '#7dff6a');
  sfx('levelup');
  m.active = false;
  m.index++;
  m.marker = null;
  m.objective = m.index >= MISSION_DEFS.length
    ? 'All twelve jobs done — you are the King of the Bay.'
    : 'Press Q to start the next job: ' + MISSION_DEFS[m.index].name;
  G.completeInfo = { name: def.name, reward: def.reward, next: m.index < MISSION_DEFS.length ? MISSION_DEFS[m.index].name : null };
  G.screen = 'complete';
}

function failMission(G, reason) {
  const m = G.mission;
  m.active = false;
  m.failed = true;
  m.marker = null;
  m.objective = 'Job failed — press Q to try again.';
  G.message = reason;
  G.message2 = 'Press Q to retry the job.';
  G.messageTimer = 5;
  sfx('fail');
}

export function updateMission(G, dt) {
  const m = G.mission;
  if (!m.active) return;
  const def = MISSION_DEFS[m.index];
  const step = def.steps[m.step];
  const pos = playerPos(G);
  if (step.time) {
    m.timer -= dt;
    if (m.timer <= 0) { failMission(G, 'Out of time — the job fell through.'); return; }
  }
  switch (step.kind) {
    case 'goto':
    case 'timed':
    case 'race':
      if (dist(pos.x, pos.y, step.x, step.y) < 90) advanceStep(G);
      break;
    case 'steal': {
      const car = G.player.inCar;
      if (car && car.type === step.carType) advanceStep(G);
      break;
    }
    case 'park': {
      const car = G.player.inCar;
      if (car && dist(car.x, car.y, step.x, step.y) < 110 && Math.abs(car.speed) < 40) advanceStep(G);
      break;
    }
    case 'eliminate': {
      m.done = m.targets.filter((t) => t.hp <= 0).length;
      if (m.done >= step.count) advanceStep(G);
      break;
    }
    case 'wreck': {
      m.done = m.targets.filter((t) => t.driver === 'wreck').length;
      if (m.done >= step.count) advanceStep(G);
      break;
    }
    case 'convoy': {
      m.done = m.targets.filter((t) => t.driver === 'wreck').length;
      // Fleeing getaway cars that escape the area fail the step.
      if (m.done >= step.count) advanceStep(G);
      break;
    }
    case 'wanted':
      if ((G.player.wanted || 0) === 0) advanceStep(G);
      break;
    case 'escape': {
      if (dist(pos.x, pos.y, step.x, step.y) < 110 && (G.player.wanted || 0) <= 1) advanceStep(G);
      break;
    }
    case 'follow': {
      const car = m.targets[0];
      if (!car || car.driver === 'wreck') { failMission(G, 'The informant got away — or got wrecked.'); return; }
      const d = dist(pos.x, pos.y, car.x, car.y);
      if (d < 500) {
        // The target drives toward the meeting point.
        const a = Math.atan2(step.y - car.y, step.x - car.x);
        car.angle = a;
        car.speed = 150;
        car.x += Math.cos(a) * car.speed * dt;
        car.y += Math.sin(a) * car.speed * dt;
        if (dist(car.x, car.y, step.x, step.y) < 90) advanceStep(G);
      } else {
        m.timer = (m.timer || 20) - dt;
        if (m.timer <= 0) { failMission(G, 'You lost the tail.'); return; }
      }
      break;
    }
    default:
      break;
  }
  // Keep the objective line honest about progress.
  if (step.kind === 'eliminate' || step.kind === 'wreck' || step.kind === 'convoy') {
    m.objective = step.label + ' (' + m.done + '/' + step.count + ')';
  } else if (step.time) {
    m.objective = step.label + ' — ' + Math.ceil(m.timer) + 's';
  } else {
    m.objective = step.label;
  }
}

// ---- Side jobs ----

export function startTaxi(G) {
  if (G.mission.active || G.taxi.active) return;
  const p = G.player;
  if (!p.inCar) { G.message = 'You need a car to drive a taxi.'; G.messageTimer = 2; return; }
  G.taxi = { active: true, phase: 'pickup', fare: 0, timer: 90, x: 0, y: 0 };
  const spots = [PLACES.downtown, PLACES.calle, PLACES.beach, PLACES.suburbs, PLACES.campus, PLACES.marina];
  const s = spots[Math.floor(Math.random() * spots.length)];
  G.taxi.x = s.x;
  G.taxi.y = s.y;
  G.message = 'Taxi: pick up the fare at ' + s.label;
  G.message2 = 'Drive a taxi (T) — drop fares off for cash.';
  G.messageTimer = 4;
  sfx('mission');
}

export function updateTaxi(G, dt) {
  const t = G.taxi;
  if (!t.active) return;
  const pos = playerPos(G);
  t.timer -= dt;
  if (t.timer <= 0) {
    G.taxi = { active: false };
    G.message = 'The fare gave up waiting.';
    G.messageTimer = 3;
    return;
  }
  if (dist(pos.x, pos.y, t.x, t.y) < 90) {
    if (t.phase === 'pickup') {
      t.phase = 'drop';
      t.timer = 90;
      const spots = [PLACES.diner, PLACES.casino, PLACES.club, PLACES.hospital, PLACES.hills, PLACES.docks];
      const s = spots[Math.floor(Math.random() * spots.length)];
      t.x = s.x;
      t.y = s.y;
      t.fare = 120 + Math.floor(Math.random() * 120);
      G.message = 'Fare picked up — drop them at ' + s.label + ' ($' + t.fare + ')';
      G.messageTimer = 3;
    } else {
      G.player.cash += t.fare;
      G.stats.earned = (G.stats.earned || 0) + t.fare;
      floatText(G, pos.x, pos.y, '+$' + t.fare, '#7dff6a');
      sfx('cash');
      G.taxi = { active: false };
      G.message = 'Fare paid. Press T for another.';
      G.messageTimer = 2;
    }
  }
}

export function startCourier(G) {
  if (G.mission.active || G.courier.active) return;
  G.courier = { active: true, drops: 0, need: 3, timer: 150, x: 0, y: 0 };
  const spots = [PLACES.midtown, PLACES.foundry, PLACES.campus];
  const s = spots[0];
  G.courier.x = s.x;
  G.courier.y = s.y;
  G.message = 'Courier: 3 drops in 150s — first at ' + s.label;
  G.messageTimer = 4;
  sfx('mission');
}

export function updateCourier(G, dt) {
  const c = G.courier;
  if (!c.active) return;
  const pos = playerPos(G);
  c.timer -= dt;
  if (c.timer <= 0) {
    G.courier = { active: false };
    G.message = 'Courier run failed — too slow.';
    G.messageTimer = 3;
    sfx('fail');
    return;
  }
  if (dist(pos.x, pos.y, c.x, c.y) < 90) {
    c.drops++;
    if (c.drops >= c.need) {
      const pay = 450;
      G.player.cash += pay;
      G.stats.earned = (G.stats.earned || 0) + pay;
      floatText(G, pos.x, pos.y, '+$' + pay, '#7dff6a');
      sfx('cash');
      G.courier = { active: false };
      G.message = 'Courier run complete — $450.';
      G.messageTimer = 3;
      return;
    }
    const spots = [PLACES.midtown, PLACES.foundry, PLACES.campus, PLACES.beach, PLACES.calle];
    const s = spots[c.drops % spots.length];
    c.x = s.x;
    c.y = s.y;
    G.message = 'Drop ' + (c.drops + 1) + ' of 3: ' + s.label;
    G.messageTimer = 3;
    sfx('pickup');
  }
}

export function startRace(G) {
  if (G.mission.active || G.race.active) return;
  const p = G.player;
  if (!p.inCar) { G.message = 'You need a car to race.'; G.messageTimer = 2; return; }
  G.race = { active: true, cp: 0, timer: 240, total: 4, x: 0, y: 0 };
  const cps = [PLACES.downtown, PLACES.docks, PLACES.beach, PLACES.marina];
  G.race.x = cps[0].x;
  G.race.y = cps[0].y;
  G.message = 'Street race: 4 checkpoints, 240s. Go!';
  G.messageTimer = 4;
  sfx('mission');
}

export function updateRace(G, dt) {
  const r = G.race;
  if (!r.active) return;
  const pos = playerPos(G);
  r.timer -= dt;
  if (r.timer <= 0) {
    G.race = { active: false };
    G.message = 'Race lost — too slow.';
    G.messageTimer = 3;
    sfx('fail');
    return;
  }
  if (dist(pos.x, pos.y, r.x, r.y) < 100) {
    r.cp++;
    if (r.cp >= r.total) {
      const pay = 800 + Math.floor(r.timer) * 2;
      G.player.cash += pay;
      G.stats.earned = (G.stats.earned || 0) + pay;
      G.stats.racesWon = (G.stats.racesWon || 0) + 1;
      floatText(G, pos.x, pos.y, '+$' + pay, '#7dff6a');
      sfx('levelup');
      G.race = { active: false };
      G.message = 'Race won! $' + pay + '. Press V to race again.';
      G.messageTimer = 4;
      return;
    }
    const cps = [PLACES.downtown, PLACES.docks, PLACES.beach, PLACES.marina];
    G.race.x = cps[r.cp].x;
    G.race.y = cps[r.cp].y;
    G.message = 'Checkpoint ' + (r.cp + 1) + ' of 4';
    G.messageTimer = 2;
    sfx('pickup');
  }
}

export function startVigilante(G) {
  if (G.mission.active || G.vigilante.active) return;
  const p = G.player;
  if (!p.inCar) { G.message = 'You need a car for vigilante work.'; G.messageTimer = 2; return; }
  const car = makeVehicle('sedan', p.x + 500, p.y - 300, Math.PI / 2, '#1a1a1a');
  car.driver = 'target';
  car.speed = 280;
  G.cars.push(car);
  G.vigilante = { active: true, target: car, timer: 90 };
  G.message = 'Vigilante: wreck the black getaway car!';
  G.messageTimer = 4;
  sfx('mission');
}

export function updateVigilante(G, dt) {
  const v = G.vigilante;
  if (!v.active) return;
  v.timer -= dt;
  if (!v.target || v.target.driver === 'wreck') {
    const pay = 600;
    G.player.cash += pay;
    G.stats.earned = (G.stats.earned || 0) + pay;
    floatText(G, G.player.x, G.player.y, '+$' + pay, '#7dff6a');
    sfx('cash');
    G.vigilante = { active: false };
    G.message = 'Getaway car wrecked — $600. The streets notice.';
    G.messageTimer = 3;
    return;
  }
  if (v.timer <= 0 || dist(v.target.x, v.target.y, G.player.x, G.player.y) > 2200) {
    G.vigilante = { active: false };
    G.message = 'The getaway car escaped.';
    G.messageTimer = 3;
    return;
  }
  // The target flees along the roads.
  const t = v.target;
  const away = Math.atan2(t.y - G.player.y, t.x - G.player.x);
  t.angle += (away - t.angle) * Math.min(1, dt * 1.5);
  t.speed = Math.min(t.speed + 100 * dt, 420);
  t.x += Math.cos(t.angle) * t.speed * dt;
  t.y += Math.sin(t.angle) * t.speed * dt;
}

export function startRepo(G) {
  if (G.mission.active || G.repo.active) return;
  const types = ['sports', 'muscle', 'limo', 'pickup'];
  const type = types[Math.floor(Math.random() * types.length)];
  const spots = [PLACES.hills, PLACES.campus, PLACES.downtown, PLACES.suburbs];
  const s = spots[Math.floor(Math.random() * spots.length)];
  const car = makeVehicle(type, s.x, s.y, Math.PI / 2);
  car.driver = 'parked';
  G.cars.push(car);
  G.repo = { active: true, type, x: s.x, y: s.y, pay: 700 + Math.floor(Math.random() * 500) };
  G.message = 'Repo: steal the ' + VEHICLES[type].name + ' at ' + s.label + ' and bring it to Solano Garage.';
  G.message2 = 'Press X for repo work — $' + G.repo.pay + ' if it arrives in one piece.';
  G.messageTimer = 5;
  sfx('mission');
}

export function updateRepo(G, dt) {
  const r = G.repo;
  if (!r.active) return;
  const car = G.player.inCar;
  if (car && car.type === r.type && dist(car.x, car.y, PLACES.garage.x, PLACES.garage.y) < 110 && Math.abs(car.speed) < 40) {
    const bonus = car.hp > car.maxHp * 0.8 ? 200 : 0;
    G.player.cash += r.pay + bonus;
    G.stats.earned = (G.stats.earned || 0) + r.pay + bonus;
    floatText(G, car.x, car.y, '+$' + (r.pay + bonus), '#7dff6a');
    sfx('cash');
    G.repo = { active: false };
    G.message = 'Repo delivered — $' + (r.pay + bonus) + '.';
    G.messageTimer = 3;
  }
}
