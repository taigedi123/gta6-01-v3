// Vermilion Bay sound: all WebAudio synthesis, no audio files.
// A tiny synth for gunshots, crashes, coins and UI, an engine hum that
// follows the car, and three looping "radio stations" from oscillators and
// a step sequencer: Bay FM (synthwave), Calle 88 (latin groove) and Static
// Talk (a talk-show murmur bed under a jingle).
import { clamp } from './util.js';

let ctx = null;
let master = null;
let musicGain = null;
let sfxGain = null;
let radioTimer = null;
let radioStep = 0;
let radioStation = 0;
let engineOsc = null;
let engineOsc2 = null;
let engineGain = null;
let muted = false;
let radioOn = true;

export const RADIO_STATIONS = ['Bay FM 101.9', 'Calle 88', 'Static Talk 640'];

export function audioReady() {
  return ctx !== null;
}

export function radioName() {
  return RADIO_STATIONS[radioStation];
}

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.14;
    musicGain.connect(master);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.9;
    sfxGain.connect(master);
    // Engine hum: two detuned saws through a lowpass, gain follows speed.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'square';
    engineOsc2.frequency.value = 110;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(lp);
    engineOsc2.connect(lp);
    lp.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
    engineOsc2.start();
  } catch (e) {
    ctx = null;
  }
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

export function cycleRadio() {
  radioStation = (radioStation + 1) % RADIO_STATIONS.length;
  radioStep = 0;
  return 'Radio: ' + RADIO_STATIONS[radioStation];
}

export function engineSound(speed, top, on) {
  if (!ctx || !engineGain) return;
  const t = ctx.currentTime;
  const f = on ? 45 + (Math.abs(speed) / Math.max(1, top)) * 130 : 0;
  engineOsc.frequency.setTargetAtTime(f, t, 0.08);
  engineOsc2.frequency.setTargetAtTime(f * 2 + 3, t, 0.08);
  engineGain.gain.setTargetAtTime(on ? 0.05 + (Math.abs(speed) / Math.max(1, top)) * 0.05 : 0, t, 0.1);
}

export function engineOff() {
  if (engineGain && ctx) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
}

function tone(freq, dur, type, vol, slideTo, when) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + (when || 0);
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  g.gain.setValueAtTime(vol || 0.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g);
  g.connect(sfxGain || master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur, vol, filterFreq) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = filterFreq || 1200;
  const g = ctx.createGain();
  g.gain.value = vol || 0.3;
  src.connect(f);
  f.connect(g);
  g.connect(sfxGain || master);
  src.start(t);
}

function musicNote(freq, dur, type, vol, when) {
  if (!ctx || muted || !radioOn) return;
  const t = ctx.currentTime + (when || 0);
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type || 'triangle';
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g);
  g.connect(musicGain);
  o.start(t);
  o.stop(t + dur + 0.02);
}

// Step sequencer: 16 steps a bar, ~112 BPM. Each station has its own
// bass line, lead pattern and drum feel.
const STATIONS = [
  { // Bay FM: synthwave, minor-key arpeggio.
    bass: [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 58.3, 0, 65.4, 0],
    lead: [220, 0, 261.6, 0, 329.6, 0, 261.6, 0, 196, 0, 246.9, 0, 293.7, 0, 329.6, 0],
    drum: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1],
  },
  { // Calle 88: latin groove, syncopated.
    bass: [65.4, 0, 0, 65.4, 0, 82.4, 0, 0, 98, 0, 0, 82.4, 0, 65.4, 0, 73.4],
    lead: [329.6, 0, 392, 329.6, 0, 440, 0, 392, 0, 329.6, 0, 261.6, 0, 293.7, 329.6, 0],
    drum: [1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0],
  },
  { // Static Talk: sparse piano-ish plinks over a low bed.
    bass: [49, 0, 0, 0, 0, 0, 0, 0, 43.7, 0, 0, 0, 0, 0, 0, 0],
    lead: [440, 0, 0, 523.3, 0, 0, 659.3, 0, 0, 587.3, 0, 0, 523.3, 0, 440, 0],
    drum: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
];

export function startRadio() {
  if (!ctx || radioTimer) return;
  radioTimer = setInterval(() => {
    if (muted || !radioOn) return;
    const st = STATIONS[radioStation];
    const step = radioStep % 16;
    const b = st.bass[step];
    const l = st.lead[step];
    if (b) musicNote(b, 0.22, 'sawtooth', 0.10);
    if (l) musicNote(l, 0.18, 'triangle', 0.12);
    if (st.drum[step]) musicNote(120, 0.08, 'sine', 0.22);
    if (step === 0) musicNote(36.7, 0.5, 'sine', 0.10);
    radioStep++;
  }, 135);
}

export function stopRadio() {
  if (radioTimer) { clearInterval(radioTimer); radioTimer = null; }
}

export function sfx(name) {
  if (!ctx || muted) return;
  switch (name) {
    case 'shoot': noise(0.12, 0.5, 2800); tone(220, 0.08, 'square', 0.18, 60); break;
    case 'shotgun': noise(0.22, 0.6, 1600); tone(140, 0.14, 'square', 0.22, 40); break;
    case 'sniper': noise(0.3, 0.55, 3200); tone(320, 0.16, 'square', 0.16, 50); break;
    case 'molotov': noise(0.4, 0.4, 900); tone(400, 0.3, 'sine', 0.12, 90); break;
    case 'crash': noise(0.25, 0.55, 700); tone(90, 0.2, 'sawtooth', 0.25, 40); break;
    case 'bump': noise(0.1, 0.25, 500); break;
    case 'pickup': tone(660, 0.09, 'sine', 0.2); tone(880, 0.12, 'sine', 0.2, 0, 0.09); break;
    case 'cash': tone(990, 0.08, 'sine', 0.18); tone(1320, 0.14, 'sine', 0.18, 0, 0.08); break;
    case 'mission': tone(523, 0.12, 'triangle', 0.22); tone(659, 0.12, 'triangle', 0.22, 0, 0.12); tone(784, 0.2, 'triangle', 0.22, 0, 0.24); break;
    case 'fail': tone(392, 0.18, 'sawtooth', 0.16, 330); tone(311, 0.3, 'sawtooth', 0.16, 262, 0.18); break;
    case 'siren': tone(700, 0.35, 'sine', 0.10, 950); break;
    case 'click': tone(800, 0.04, 'square', 0.12); break;
    case 'door': tone(300, 0.1, 'square', 0.15, 180); break;
    case 'hurt': tone(180, 0.15, 'sawtooth', 0.2, 90); break;
    case 'heal': tone(440, 0.15, 'sine', 0.18, 660); break;
    case 'wanted': tone(110, 0.4, 'sawtooth', 0.2, 220); tone(110, 0.4, 'sawtooth', 0.18, 220, 0.4); break;
    case 'explosion': noise(0.7, 0.7, 500); tone(70, 0.6, 'sine', 0.35, 30); break;
    case 'horn': tone(370, 0.25, 'square', 0.15); tone(466, 0.25, 'square', 0.12, 0, 0.02); break;
    case 'levelup': tone(523, 0.1, 'triangle', 0.2); tone(659, 0.1, 'triangle', 0.2, 0, 0.1); tone(784, 0.1, 'triangle', 0.2, 0, 0.2); tone(1047, 0.25, 'triangle', 0.22, 0, 0.3); break;
    default: tone(440, 0.08, 'square', 0.12); break;
  }
}
