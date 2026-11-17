// Particles, skid marks and floating score text. Nothing here allocates
// after the game starts: dead particles are reused in place.
export function burst(G, x, y, color, n, speed) {
  for (let i = 0; i < (n || 10); i++) {
    const a = Math.random() * Math.PI * 2;
    const s = (speed || 140) * (0.4 + Math.random() * 0.8);
    G.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0.4 + Math.random() * 0.4, maxLife: 0.8, color, size: 2 + Math.random() * 3,
    });
  }
}

export function smoke(G, x, y, color) {
  G.particles.push({
    x: x + (Math.random() - 0.5) * 10, y: y + (Math.random() - 0.5) * 10,
    vx: (Math.random() - 0.5) * 20, vy: -30 - Math.random() * 30,
    life: 0.8 + Math.random() * 0.5, maxLife: 1.3, color: color || '#888888', size: 5 + Math.random() * 5,
  });
}

export function fire(G, x, y) {
  for (let i = 0; i < 6; i++) {
    G.particles.push({
      x: x + (Math.random() - 0.5) * 16, y: y + (Math.random() - 0.5) * 16,
      vx: (Math.random() - 0.5) * 40, vy: -40 - Math.random() * 60,
      life: 0.3 + Math.random() * 0.3, maxLife: 0.6, color: Math.random() < 0.5 ? '#ff8c1a' : '#ff3c1a', size: 4 + Math.random() * 5,
    });
  }
}

export function sparks(G, x, y) {
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2;
    G.particles.push({
      x, y, vx: Math.cos(a) * 220, vy: Math.sin(a) * 220,
      life: 0.2 + Math.random() * 0.2, maxLife: 0.4, color: '#ffd94a', size: 2,
    });
  }
}

export function floatText(G, x, y, text, color) {
  G.floaters.push({ x, y, text, color: color || '#ffffff', life: 1.4 });
}

export function addSkid(G, x, y, angle) {
  G.skids.push({ x, y, angle, life: 6 });
  if (G.skids.length > 400) G.skids.splice(0, G.skids.length - 400);
}

export function updateParticles(G, dt) {
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const p = G.particles[i];
    p.life -= dt;
    if (p.life <= 0) { G.particles.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
  }
  for (let i = G.floaters.length - 1; i >= 0; i--) {
    const f = G.floaters[i];
    f.life -= dt;
    f.y -= 30 * dt;
    if (f.life <= 0) G.floaters.splice(i, 1);
  }
  for (let i = G.skids.length - 1; i >= 0; i--) {
    G.skids[i].life -= dt;
    if (G.skids[i].life <= 0) G.skids.splice(i, 1);
  }
}
