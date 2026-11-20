import * as THREE from '/vendor/three.js';
import { DEFAULT_INPUT, Game, ISLAND_RADIUS, TICK_RATE } from '/src/game.mjs';

const find = (id) => document.getElementById(id);
const canvas = find('scene');
const start = find('start');
const overlay = find('overlay');
const prompt = find('prompt');
const notice = find('notice');
const map = find('map').getContext('2d');
const hud = Object.fromEntries(['flames', 'carried', 'lit', 'time', 'score'].map((id) => [id, find(id)]));
const keys = new Set();
const camera = new THREE.PerspectiveCamera(54, 1, 0.1, 330);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#2a223f');
scene.fog = new THREE.FogExp2('#2a223f', 0.021);
const moonlight = new THREE.HemisphereLight('#c2bcfa', '#684166', 1.28);
const rim = new THREE.DirectionalLight('#ffcaa5', 1.5);
rim.position.set(-22, 22, -18);
scene.add(moonlight, rim);
const world = new THREE.Group();
const actors = new THREE.Group();
scene.add(world, actors);

const solid = (color, emissive = '#000000') => new THREE.MeshStandardMaterial({
  color, emissive, roughness: 0.91, flatShading: true
});
const glow = (color, opacity = 1) => new THREE.MeshBasicMaterial({
  color, opacity, transparent: opacity < 1, depthWrite: opacity === 1
});
const material = {
  earth: solid('#3d4a51'), cliff: solid('#393148'), path: solid('#656063'), wood: solid('#483044'),
  leaves: solid('#342f58'), leafTip: solid('#50697a'), stone: solid('#615c78'), grass: solid('#898294'),
  cloud: glow('#837b9c', 0.43), farCloud: glow('#605671', 0.36), stars: glow('#d3c3ec'),
  moon: glow('#ffe3b6'), petal: glow('#a68fb4'),
  paperOff: solid('#946777'), paperOn: solid('#ffc98a', '#ff884c'), bronze: solid('#533547'),
  coat: solid('#da8582'), scarf: solid('#ffe19e'), skin: solid('#eab99c'),
  hat: solid('#e0a46c'), boot: solid('#4a3457'), shade: solid('#24132f', '#130b22'),
  stunned: solid('#62497d', '#231636'), shadeEye: glow('#e18dff'), mote: glow('#ffdb81')
};
const sphere = new THREE.IcosahedronGeometry(1, 1);
const point = new THREE.IcosahedronGeometry(1, 0);
const box = new THREE.BoxGeometry(1, 1, 1);
const cylinder = (top, bottom, height, sides = 8) => new THREE.CylinderGeometry(top, bottom, height, sides);

function mesh(parent, geometry, appearance, x, y, z, sx = 1, sy = sx, sz = sx) {
  const item = new THREE.Mesh(geometry, appearance);
  item.position.set(x, y, z);
  item.scale.set(sx, sy, sz);
  parent.add(item);
  return item;
}

function makeGlowTexture() {
  const image = document.createElement('canvas');
  image.width = image.height = 64;
  const context = image.getContext('2d');
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, '#fff');
  gradient.addColorStop(0.22, 'rgba(255,255,255,.7)');
  gradient.addColorStop(0.58, 'rgba(255,255,255,.15)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(image);
}

const lightTexture = makeGlowTexture();
function halo(parent, color, size, y, opacity) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: lightTexture, color, opacity, blending: THREE.AdditiveBlending, depthWrite: false
  }));
  sprite.scale.set(size, size, 1);
  sprite.position.y = y;
  parent.add(sprite);
  return sprite;
}

function scenery() {
  let spin = 126;
  const random = () => {
    spin = (Math.imul(spin, 1664525) + 1013904223) >>> 0;
    return spin / 4294967296;
  };
  const island = mesh(world, cylinder(ISLAND_RADIUS, 28, 2.6, 72), material.earth, 0, -1.3, 0);
  island.receiveShadow = true;
  mesh(world, cylinder(28, 17, 8, 27), material.cliff, 0, -6.6, 0);
  mesh(world, cylinder(17, 5, 5, 15), material.cliff, 0, -12.9, 0);
  mesh(world, sphere, material.moon, -20, 11, 53, 4.2);
  for (let i = 0; i < 75; i++) {
    const angle = random() * 2 * Math.PI;
    const radius = 65 + random() * 68;
    const size = 0.11 + random() * 0.35;
    mesh(world, point, material.stars, Math.cos(angle) * radius, 10 + random() * 60, Math.sin(angle) * radius, size);
  }
  for (let i = 0; i < 48; i++) {
    const angle = i / 48 * 2 * Math.PI;
    const radius = 39 + random() * 58;
    mesh(world, sphere, i % 2 === 0 ? material.cloud : material.farCloud,
      Math.cos(angle) * radius, -11 + random() * 7, Math.sin(angle) * radius,
      8 + random() * 21, 0.9 + random() * 2, 4 + random() * 10);
  }
  const trunk = cylinder(0.12, 0.25, 3.5, 6);
  const canopy = cylinder(0.03, 1, 2.9, 6);
  for (let i = 0; i < 25; i++) {
    const angle = i * 2.39996;
    const radius = 24 + random() * 6;
    if (angle % (2 * Math.PI) > 4.1 && angle % (2 * Math.PI) < 5.5) continue;
    const tree = new THREE.Group();
    tree.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    tree.scale.setScalar(0.75 + random() * 0.8);
    tree.rotation.y = random() * 6.28;
    mesh(tree, trunk, material.wood, 0, 1.65, 0);
    mesh(tree, canopy, material.leaves, 0, 2.6, 0, 1.65, 1, 1.65);
    mesh(tree, canopy, material.leafTip, 0, 3.7, 0, 1.14, 0.78, 1.14);
    world.add(tree);
  }
  for (let i = 0; i < 78; i++) {
    const radius = Math.sqrt(random()) * 31;
    const angle = random() * 2 * Math.PI;
    const size = 0.17 + random() * 0.4;
    mesh(world, point, i % 4 === 0 ? material.stone : material.grass,
      Math.cos(angle) * radius, 0.08, Math.sin(angle) * radius, size, size * 0.56, size);
  }
  for (const [x, z] of [[15, 11], [-15, 11], [-13, -14], [13, -14]]) {
    for (let i = 1; i <= 9; i++) {
      const stone = mesh(world, sphere, material.path, x * i / 10, 0.012, z * i / 10, 0.81, 0.045, 0.61);
      stone.rotation.y = random() * Math.PI;
    }
  }
}

function makeMay() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  mesh(body, cylinder(0.36, 0.48, 0.76), material.coat, 0, 0.81, 0);
  mesh(body, sphere, material.skin, 0, 1.37, 0, 0.33);
  mesh(body, cylinder(0.35, 0.36, 0.11), material.scarf, 0, 1.11, 0);
  mesh(body, cylinder(0.02, 0.66, 0.35, 14), material.hat, 0, 1.73, 0);
  mesh(body, cylinder(0.59, 0.66, 0.036, 14), material.bronze, 0, 1.563, 0);
  const left = mesh(body, box, material.boot, -0.2, 0.25, 0, 0.23, 0.41, 0.27);
  const right = mesh(body, box, material.boot, 0.2, 0.25, 0, 0.23, 0.41, 0.27);
  mesh(body, sphere, material.coat, -0.45, 0.87, 0, 0.17, 0.31, 0.16);
  mesh(body, sphere, material.coat, 0.45, 0.87, 0, 0.17, 0.31, 0.16);
  mesh(body, cylinder(0.017, 0.017, 0.30), material.bronze, 0.56, 1.43, 0.21);
  const hanging = new THREE.Group();
  hanging.position.set(0.56, 1.23, 0.21);
  mesh(hanging, sphere, material.paperOn, 0, 0, 0, 0.155, 0.20, 0.155);
  halo(hanging, '#ff924e', 1.65, 0, 0.66);
  body.add(hanging);
  actors.add(root);
  return { root, body, left, right };
}

function makeLantern() {
  const root = new THREE.Group();
  mesh(root, cylinder(1.35, 1.5, 0.20, 10), material.stone, 0, 0.10, 0);
  mesh(root, cylinder(0.22, 0.36, 1.7), material.wood, 0, 1.03, 0);
  mesh(root, cylinder(0.84, 0.58, 0.24), material.bronze, 0, 1.83, 0);
  const paper = mesh(root, cylinder(0.7, 0.77, 0.99), material.paperOff, 0, 2.42, 0);
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    mesh(root, box, material.bronze, Math.cos(angle) * 0.74, 2.42, Math.sin(angle) * 0.74, 0.038, 1.02, 0.038);
  }
  mesh(root, cylinder(0.05, 1.05, 0.58), material.bronze, 0, 3.14, 0);
  mesh(root, point, material.hat, 0, 3.54, 0, 0.17);
  const light = halo(root, '#ffaf61', 9, 2.6, 0.64);
  const lamp = new THREE.PointLight('#ffb369', 62, 15, 2);
  lamp.position.y = 2.45;
  root.add(lamp);
  const safety = mesh(root, new THREE.RingGeometry(0.985, 1, 72), glow('#f8ae70', 0.32), 0, 0.025, 0);
  safety.rotation.x = -Math.PI / 2;
  actors.add(root);
  return { root, paper, light, lamp, safety };
}

function makeShade() {
  const root = new THREE.Group();
  const body = mesh(root, sphere, material.shade, 0, 0.74, 0, 0.59, 0.79, 0.49);
  for (const x of [-0.19, 0.19]) {
    mesh(root, sphere, material.shadeEye, x, 0.88, 0.43, 0.067, 0.11, 0.065);
  }
  halo(root, '#9737ee', 2.65, 0.73, 0.34);
  actors.add(root);
  return { root, body };
}

function makeMote() {
  const root = new THREE.Group();
  mesh(root, point, material.mote, 0, 0, 0, 0.155, 0.23, 0.155);
  halo(root, '#ffb555', 1.55, 0, 0.86);
  actors.add(root);
  return { root };
}

function synchronize(models, list, create, update) {
  const active = new Set();
  for (const [index, item] of list.entries()) {
    active.add(item.id);
    if (!models.has(item.id)) models.set(item.id, create());
    update(models.get(item.id), item, index);
  }
  for (const [id, model] of models) {
    if (active.has(id)) continue;
    actors.remove(model.root);
    models.delete(id);
  }
}

function drawMap(game, yaw) {
  const center = 120;
  const scale = 3.18;
  map.clearRect(0, 0, 240, 240);
  map.translate(center, center);
  map.strokeStyle = '#9c7d88';
  map.lineWidth = 2;
  map.beginPath();
  map.arc(0, 0, ISLAND_RADIUS * scale, 0, 2 * Math.PI);
  map.stroke();
  for (const { pos, lit } of game.lanterns) {
    map.fillStyle = lit ? '#ffd28b' : '#635268';
    map.strokeStyle = '#e6ac78';
    map.beginPath();
    map.arc(-pos[0] * scale, -pos[2] * scale, 8, 0, 2 * Math.PI);
    map.fill();
    map.stroke();
  }
  map.translate(-game.player.pos[0] * scale, -game.player.pos[2] * scale);
  map.rotate(-yaw);
  map.fillStyle = '#fff0d3';
  map.beginPath();
  map.moveTo(0, -10);
  map.lineTo(7, 7);
  map.lineTo(0, 4);
  map.lineTo(-7, 7);
  map.closePath();
  map.fill();
  map.resetTransform();
}

async function main() {
  const response = await fetch('/game.contract.json');
  if (!response.ok) throw new Error('Không tải được thông số trò chơi.');
  const { tuning } = await response.json();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor('#2a223f');
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  scenery();
  const may = makeMay();
  const ghost = new Map();
  const fireflies = new Map();
  const lanterns = new Map();
  const pulseRing = mesh(actors, new THREE.RingGeometry(0.92, 1, 64), glow('#ffca82', 0.8), 0, 0.1, 0);
  pulseRing.rotation.x = -Math.PI / 2;
  pulseRing.visible = false;
  const follow = new THREE.Vector3();
  const look = new THREE.Vector3();
  const groundTint = new THREE.Color();
  const dim = new THREE.Color('#c2bcfa');
  const bright = new THREE.Color('#ffe2ae');
  let game = new Game(tuning, 2026);
  let yaw = 0;
  let running = false;
  let previous = DEFAULT_INPUT;
  let drag = null;
  let lastTime = performance.now();
  let accumulator = 0;
  let noticeUntil = 0;
  let pulseAt = -Infinity;
  let walking = false;

  function reset() {
    game = new Game(tuning, 2026);
    yaw = 0;
    may.body.rotation.y = 0;
    previous = DEFAULT_INPUT;
    keys.clear();
    notice.textContent = '';
    pulseAt = -Infinity;
    accumulator = 0;
    walking = false;
    running = true;
    overlay.hidden = true;
  }

  function resize() {
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
  }

  function input() {
    const down = (...codes) => codes.some((code) => keys.has(code));
    return {
      move: [Number(down('KeyA', 'ArrowLeft')) - Number(down('KeyD', 'ArrowRight')),
        Number(down('KeyW', 'ArrowUp')) - Number(down('KeyS', 'ArrowDown'))],
      cam_yaw_deg: yaw * 180 / Math.PI,
      jump: down('Space'), interact: down('KeyE'), pulse: down('KeyQ')
    };
  }

  function simulate(now) {
    const frame = input();
    walking = frame.move.some(Boolean);
    const [x, z] = frame.move;
    if (walking) may.body.rotation.y = Math.atan2(x, z) + yaw;
    const events = game.step(frame, previous);
    previous = frame;
    for (const { name } of events) {
      let message = '';
      if (name === 'pulse') {
        pulseAt = now;
        pulseRing.position.set(game.player.pos[0], 0.06, game.player.pos[2]);
        message = 'Mây tỏa sáng';
      }
      if (name === 'lantern_lit') message = 'Một Đèn Lồng Lớn đã sáng';
      if (name === 'player_hit') message = 'Bóng Mực đã chạm vào Mây';
      if (message) {
        notice.textContent = message;
        noticeUntil = now + 1800;
      }
    }
    if (game.state !== 'playing') {
      running = false;
      walking = false;
      const won = game.state === 'won';
      find('overlay-title').textContent = won ? 'Đảo Bến bừng sáng' : 'Ánh sáng đã tắt';
      const reason = won ? 'Cả năm chiếc đèn đã sáng.' : game.player.flames === 0
        ? 'Mây đã hết lửa.' : 'Bình minh đã đến.';
      find('overlay-text').textContent = reason + ' Điểm của bạn ' + game.score + '.';
      start.textContent = 'Chơi lại';
      overlay.hidden = false;
      start.focus();
    }
  }

  function draw(now) {
    const seconds = now / 1000;
    const [x, y, z] = game.player.pos;
    const lit = game.lanterns.filter((lantern) => lantern.lit).length;
    may.root.position.set(x, y, z);
    may.left.position.z = walking ? Math.sin(seconds * 16) * 0.18 : 0;
    may.right.position.z = -may.left.position.z;
    may.body.visible = game.tick >= game.player.invulnerableUntil || Math.floor(now / 100) % 3 !== 0;
    synchronize(lanterns, game.lanterns, makeLantern, (model, lantern) => {
      model.root.position.fromArray(lantern.pos);
      model.paper.material = lantern.lit ? material.paperOn : material.paperOff;
      model.light.visible = model.lamp.visible = model.safety.visible = lantern.lit;
      model.safety.scale.setScalar(tuning.safe_radius);
    });
    synchronize(fireflies, game.motes, makeMote, (model, mote, index) => {
      model.root.position.fromArray(mote.pos);
      model.root.position.y += 0.5 + 0.16 * Math.sin(seconds * 3 + index * 1.8);
      model.root.rotation.y = seconds * 1.5 + index;
    });
    synchronize(ghost, game.shades, makeShade, (model, shade, index) => {
      model.root.position.fromArray(shade.pos);
      model.root.position.y += 0.14 * Math.sin(seconds * 3.2 + index);
      model.root.rotation.y = Math.atan2(x - shade.pos[0], z - shade.pos[2]);
      model.body.material = shade.state === 'stunned' ? material.stunned : material.shade;
    });
    const wave = Math.min(1, (now - pulseAt) / 440);
    pulseRing.visible = wave < 1;
    if (pulseRing.visible) {
      pulseRing.scale.setScalar(Math.max(0.05, wave * tuning.pulse_radius));
      pulseRing.material.opacity = 0.75 * (1 - wave);
    }
    moonlight.intensity = 1.28 + lit * 0.23;
    moonlight.color.copy(groundTint.copy(dim).lerp(bright, lit / game.lanterns.length));
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    follow.set(x - sin * 8.7, y + 5.8, z - cos * 8.7);
    look.set(x + sin * 3, y + 1, z + cos * 3);
    camera.position.lerp(follow, 0.23);
    camera.lookAt(look);
    renderer.render(scene, camera);

    const remaining = Math.ceil(Math.max(0, game.timeLeft));
    const clock = Math.floor(remaining / 60) + ':' + String(remaining % 60).padStart(2, '0');
    const values = { flames: game.player.flames + '/' + tuning.flames,
      carried: game.player.carried + '/' + tuning.carry_capacity, lit: lit + '/' + game.lanterns.length,
      time: clock, score: String(game.score) };
    for (const [name, value] of Object.entries(values)) {
      if (hud[name].textContent !== value) hud[name].textContent = value;
    }
    const close = game.lanterns.filter((lamp) => !lamp.lit).map((lamp) => ({
      lamp, gap: Math.hypot(x - lamp.pos[0], z - lamp.pos[2])
    })).sort((a, b) => a.gap - b.gap)[0];
    prompt.hidden = !running || !close || close.gap > tuning.interact_radius;
    if (!prompt.hidden) {
      const { lamp } = close;
      prompt.textContent = 'E · Nạp đèn ' + lamp.id + ' (' + lamp.deposited + '/' + tuning.lantern_cost + ')';
    }
    if (notice.textContent && now > noticeUntil) notice.textContent = '';
    drawMap(game, yaw);
  }

  start.addEventListener('click', reset);
  const controls = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown',
    'ArrowRight', 'Space', 'KeyE', 'KeyQ']);
  window.addEventListener('keydown', (event) => {
    if (!running || !controls.has(event.code)) return;
    event.preventDefault();
    keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('pointerdown', (event) => {
    if (!running) return;
    drag = event.clientX;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (drag === null) return;
    yaw -= (event.clientX - drag) * 0.008;
    drag = event.clientX;
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(type, () => { drag = null; });
  }
  new ResizeObserver(resize).observe(canvas);
  resize();
  camera.position.set(0, 5.8, -8.7);
  start.disabled = false;
  renderer.setAnimationLoop((now) => {
    if (running) {
      accumulator += Math.min(250, Math.max(0, now - lastTime));
      while (running && accumulator >= 1000 / TICK_RATE) {
        simulate(now);
        accumulator -= 1000 / TICK_RATE;
      }
    }
    lastTime = now;
    draw(now);
  });
}

main().catch((error) => {
  console.error(error);
  find('overlay-text').textContent = 'Không mở được game. Kiểm tra WebGL 2 và chạy npm ci trước khi mở lại.';
});
