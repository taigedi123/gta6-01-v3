// Keyboard and mouse input. Held keys are read every frame; one-shot presses
// (hit) are consumed once, so a press between two frames is never lost and
// never counted twice. The mouse aims on foot and clicks menu buttons.
export function createInput(canvas) {
  const held = {};
  const pressed = {};
  const input = {
    held, pressed,
    mouseX: 0, mouseY: 0, mouseDown: false, mousePressed: false,
    aimX: 0, aimY: 0,
    down(code) { return !!held[code]; },
    hit(code) {
      if (pressed[code]) { pressed[code] = false; return true; }
      return false;
    },
    axis() {
      // WASD / arrows: returns {x, y} in -1..1.
      let x = 0;
      let y = 0;
      if (held.KeyA || held.ArrowLeft) x -= 1;
      if (held.KeyD || held.ArrowRight) x += 1;
      if (held.KeyW || held.ArrowUp) y -= 1;
      if (held.KeyS || held.ArrowDown) y += 1;
      return { x, y };
    },
    endFrame() {
      for (const k in pressed) pressed[k] = false;
      input.mousePressed = false;
    },
  };
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Tab') e.preventDefault();
    if (!e.repeat) pressed[e.code] = true;
    held[e.code] = true;
  });
  window.addEventListener('keyup', (e) => { held[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in held) held[k] = false; });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - r.left;
    input.mouseY = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - r.left;
    input.mouseY = e.clientY - r.top;
    input.mouseDown = true;
    input.mousePressed = true;
    if (e.button === 0) pressed.Mouse0 = true;
  });
  window.addEventListener('mouseup', () => { input.mouseDown = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  return input;
}
