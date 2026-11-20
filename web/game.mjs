import * as THREE from '/vendor/three.js';
import { DEFAULT_INPUT, Game, TICK_RATE } from '/src/game.mjs';
import { direction, RAMP_AXES, xz } from '/src/maps.mjs';
import { Sounds } from '/audio.js';

const find = (id) => document.getElementById(id);
const canvas = find('scene');
const start = find('start');
const overlay = find('overlay');
const prompt = find('prompt');
const notice = find('notice');
const map = find('map').getContext('2d');
const hud = Object.fromEntries(['flames', 'carried', 'lit', 'time', 'score', 'dash', 'pulse', 'charm'].map((id) => [id, find(id)]));
const keys = new Set();
const queuedActions = new Set();
const camera = new THREE.PerspectiveCamera(54, 1, 0.1, 330);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#0E1430');
scene.fog = new THREE.FogExp2('#1B2350', 0.014);
const moonlight = new THREE.HemisphereLight('#f2edff', '#12384A', 0.15);
const rim = new THREE.DirectionalLight('#cbd8f9', 1.15);
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
  earth: solid('#2F5D50'), cliff: solid('#34464f'), path: solid('#C9B48A'), wood: solid('#6B4A2F'),
  leaves: solid('#2F5D50'), leafTip: solid('#527963'), stone: solid('#777887'),
  cloud: glow('#12384A'), stars: glow('#d3d7eb'),
  moon: glow('#ffe3b6'), petal: glow('#f0ba75'),
  paperOff: solid('#5B5F6E'), paperOn: glow('#FFB347'), core: glow('#FFE9B0'), bronze: solid('#453347'),
  coat: solid('#E8E2D0'), scarf: solid('#C8102E'), skin: solid('#eab99c'), gold: glow('#F2C14E'),
  hat: solid('#C9B48A'), boot: solid('#4a3457'), shade: glow('#120A1A'),
  stunned: glow('#3A3450'), shadeEye: glow('#7A3CFF'), drifter: solid('#8FA3B8', '#283447')
};
material.cliff.side = THREE.DoubleSide;
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

function batch(parent, geometry, appearance, transforms) {
  if (!transforms.length) return;
  const models = new THREE.InstancedMesh(geometry, appearance, transforms.length);
  const transform = new THREE.Object3D();
  transforms.forEach(([x, y, z, sx, sy = sx, sz = sx, angle = 0], index) => {
    transform.position.set(x, y, z);
    transform.rotation.y = angle;
    transform.scale.set(sx, sy, sz);
    transform.updateMatrix();
    models.setMatrixAt(index, transform.matrix);
  });
  parent.add(models);
}

function scenery(game) {
  world.traverse((item) => {
    if (item.geometry && ![sphere, point, box].includes(item.geometry)) item.geometry.dispose();
    if (item.isInstancedMesh) item.dispose();
  });
  world.clear();
  let spin = 126;
  const random = () => {
    spin = (Math.imul(spin, 1664525) + 1013904223) >>> 0;
    return spin / 4294967296;
  };
  const center = game.night === 2 ? 35 : 0;
  const treePositions = [];
  const rocks = [];
  for (const [islandX, radius] of game.map.islands) {
    mesh(world, cylinder(radius, radius * 0.88, 2.6, 96), material.earth, islandX, -1.3, 0);
    mesh(world, cylinder(radius * 0.88, radius * 0.45, 8, 32), material.cliff, islandX, -6.6, 0);
    mesh(world, cylinder(radius * 0.45, radius * 0.12, 5, 19), material.cliff, islandX, -13.1, 0);
    for (let i = 0; i < 21; i++) {
      const angle = i * 2.39996;
      const r = radius - 9 + random() * 7;
      const x = islandX + Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      if (game.night === 2 && Math.abs(z) < 6 && x > 15 && x < 55) continue;
      const scale = 0.66 + random() * 0.7;
      treePositions.push([x, z, scale, random() * 6.28]);
    }
    for (let i = 0; i < 42; i++) {
      const r = Math.sqrt(random()) * (radius - 1);
      const angle = random() * 2 * Math.PI;
      const size = 0.17 + random() * 0.5;
      rocks.push([islandX + Math.cos(angle) * r, 0.1, Math.sin(angle) * r, size, size * 0.56, size]);
    }
  }
  mesh(world, sphere, material.moon, center - 18, 12, 70, 5);
  const stars = [];
  const clouds = [];
  for (let i = 0; i < 70; i++) {
    const angle = random() * 2 * Math.PI;
    const radius = 65 + random() * 68;
    const size = 0.11 + random() * 0.35;
    stars.push([center + Math.cos(angle) * radius, 10 + random() * 60, Math.sin(angle) * radius, size]);
  }
  for (let i = 0; i < 56; i++) {
    const angle = i / 56 * 2 * Math.PI;
    const radius = 33 + random() * 65;
    clouds.push([center + Math.cos(angle) * radius, -11 + random() * 7, Math.sin(angle) * radius,
      8 + random() * 21, 0.9 + random() * 2, 4 + random() * 10]);
  }
  batch(world, point, material.stars, stars);
  batch(world, sphere, material.cloud, clouds);
  batch(world, point, material.stone, rocks);
  batch(world, cylinder(0.12, 0.25, 3.5, 6), material.wood,
    treePositions.map(([x, z, s, a]) => [x, 1.65 * s, z, s, s, s, a]));
  batch(world, cylinder(0.03, 1, 2.9, 6), material.leaves,
    treePositions.map(([x, z, s, a]) => [x, 2.6 * s, z, 1.65 * s, s, 1.65 * s, a]));
  batch(world, cylinder(0.03, 1, 2.9, 6), material.leafTip,
    treePositions.map(([x, z, s, a]) => [x, 3.7 * s, z, 1.14 * s, 0.78 * s, 1.14 * s, a]));
  const paths = [];
  for (const [x, y, z] of game.map.lanterns) {
    const from = game.night === 2 && x > 42 ? 70 : 0;
    if (y > 0) continue;
    for (let i = 2; i <= 10; i++) {
      paths.push([from + (x - from) * i / 11, 0.012, z * i / 11, 0.81, 0.045, 0.61, random() * Math.PI]);
    }
  }
  batch(world, sphere, material.path, paths);
  if (game.night === 2) {
    batch(world, box, material.wood, Array.from({ length: 36 }, (_, i) => [26.25 + i * 0.5, -0.10, 0, 0.48, 0.2, 4]));
    for (const z of [-1.85, 1.85]) mesh(world, box, material.path, 35, 0.026, z, 18, 0.05, 0.10);
  }
  if (game.night === 3) {
    const deck = mesh(world, new THREE.RingGeometry(12, 24, 64, 1, Math.PI, Math.PI), material.earth, 0, 3, 0);
    deck.rotation.x = -Math.PI / 2;
    for (const radius of [12, 24]) {
      mesh(world, new THREE.CylinderGeometry(radius, radius, 3, 60, 1, true, -Math.PI / 2, Math.PI),
        material.cliff, 0, 1.5, 0);
    }
    for (const sign of [-1, 1]) mesh(world, box, material.cliff, sign * 18, 1.5, 0, 12, 3, 0.07);
    mesh(world, cylinder(8, 7.8, 0.85, 64), material.cliff, 0, 5.575, 0);
    mesh(world, cylinder(7.99, 7.99, 0.09, 64), material.earth, 0, 5.98, 0);
    for (const angle of [45, 135, 225, 315]) {
      const [x, z] = direction(angle);
      mesh(world, cylinder(0.20, 0.36, 5.3), material.cliff, x * 6.5, 2.65, z * 6.5);
    }
    mesh(world, cylinder(1.9, 2, 7, 10), material.stone, 0, 9.5, 0);
    mesh(world, cylinder(0.05, 2, 1, 10), material.bronze, 0, 13.5, 0);
    mesh(world, cylinder(0.48, 0.64, 0.7), material.gold, 0, 11.5, 1.83);
    for (const [dx, dz] of RAMP_AXES) {
      const p = (r, side, height) => [r * dx - dz * side, height, r * dz + dx * side];
      const corners = [p(30, -1.5, 0), p(24, -1.5, 3), p(24, 1.5, 3), p(30, 1.5, 0)];
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(corners.flat(), 3));
      geometry.setIndex([0, 1, 2, 0, 2, 3]);
      geometry.computeVertexNormals();
      mesh(world, geometry, material.path, 0, 0, 0);
    }
  }
  for (const { pos: [x, y, z] } of game.map.pads) {
    mesh(world, cylinder(1, 1.1, 0.08, 18), material.wood, x, y + 0.04, z);
    const ring = mesh(world, new THREE.RingGeometry(0.72, 0.92, 24), material.gold, x, y + 0.095, z);
    ring.rotation.x = -Math.PI / 2;
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
  mesh(hanging, sphere, material.core, 0, 0, 0, 0.155, 0.20, 0.155);
  halo(hanging, '#FFB347', 1.65, 0, 0.66);
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
  const frame = [];
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    frame.push([Math.cos(angle) * 0.74, 2.42, Math.sin(angle) * 0.74, 0.038, 1.02, 0.038]);
  }
  batch(root, box, material.bronze, frame);
  mesh(root, cylinder(0.05, 1.05, 0.58), material.bronze, 0, 3.14, 0);
  mesh(root, point, material.hat, 0, 3.54, 0, 0.17);
  const light = halo(root, '#FFB347', 9, 2.6, 0.64);
  const core = mesh(root, sphere, material.core, 0, 2.48, 0.62, 0.24, 0.36, 0.24);
  const safety = mesh(root, new THREE.RingGeometry(0.985, 1, 72), glow('#FFB347', 0.32), 0, 0.025, 0);
  safety.rotation.x = -Math.PI / 2;
  const tear = mesh(root, box, material.bronze, 0.24, 2.38, 0.71, 0.12, 0.56, 0.08);
  tear.rotation.z = 0.40;
  const bar = new THREE.Group();
  bar.position.y = 3.83;
  mesh(bar, box, material.bronze, 0, 0, 0, 1.52, 0.19, 0.06);
  const oil = mesh(bar, box, glow('#FFB347'), 0, 0, 0.06, 1.42, 0.115, 0.037);
  root.add(bar);
  actors.add(root);
  return { root, paper, light, core, safety, tear, bar, oil };
}

function makeShade() {
  const root = new THREE.Group();
  const body = mesh(root, sphere, material.shade, 0, 0.74, 0, 0.59, 0.79, 0.49);
  for (const x of [-0.19, 0.19]) {
    mesh(root, sphere, material.shadeEye, x, 0.88, 0.43, 0.067, 0.11, 0.065);
  }
  const glowRing = halo(root, '#7A3CFF', 2.65, 0.73, 0.34);
  actors.add(root);
  return { root, body, glowRing };
}

function makeFireflies() {
  let geometry;
  let positions;
  const layers = [[1.65, '#FFE58A'], [0.42, '#FFF6C2']].map(([size, color]) => {
    const appearance = new THREE.PointsMaterial({
      size, color, map: lightTexture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    const points = new THREE.Points(undefined, appearance);
    points.frustumCulled = false;
    actors.add(points);
    return points;
  });
  return (motes, seconds) => {
    if (!positions || positions.count < motes.length) {
      geometry?.dispose();
      geometry = new THREE.BufferGeometry();
      positions = new THREE.BufferAttribute(new Float32Array(Math.max(64, motes.length) * 3), 3)
        .setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute('position', positions);
      for (const layer of layers) layer.geometry = geometry;
    }
    for (const [index, { pos: [x, y, z] }] of motes.entries()) {
      positions.setXYZ(index, x, y + 0.5 + 0.16 * Math.sin(seconds * 3 + index * 1.8), z);
    }
    positions.needsUpdate = true;
    geometry.setDrawRange(0, motes.length);
  };
}

function makeDrifter() {
  const root = new THREE.Group();
  const ribbon = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const strip = mesh(ribbon, sphere, material.drifter, 0, Math.sin(i) * 0.15, -i * 0.30,
      0.33 - i * 0.035, 0.15 - i * 0.018, 0.39);
    strip.rotation.z = i * 0.2;
  }
  halo(root, '#8FA3B8', 3, 0, 0.38);
  root.add(ribbon);
  actors.add(root);
  return { root, ribbon };
}

function makeCharm() {
  const root = new THREE.Group();
  const face = mesh(root, box, material.gold, 0, 0, 0, 0.7, 0.54, 0.10);
  face.rotation.z = 0.38;
  const paper = mesh(root, box, material.scarf, 0, 0, 0, 0.61, 0.45, 0.115);
  paper.rotation.z = face.rotation.z;
  halo(root, '#F2C14E', 2.4, 0, 0.42);
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
    model.root.traverse((item) => {
      if (item.isSprite) item.material.dispose();
      if (item.isInstancedMesh) item.dispose();
    });
    models.delete(id);
  }
}

function drawMap(game, yaw) {
  const center = 120;
  const axis = game.night === 2 ? 35 : 0;
  const scale = game.night === 2 ? 1.65 : 2.25;
  map.clearRect(0, 0, 240, 240);
  map.translate(center, center);
  map.strokeStyle = '#8FA3B8';
  map.lineWidth = 2;
  for (const [x, radius] of game.map.islands) {
    map.beginPath();
    map.arc((axis - x) * scale, 0, radius * scale, 0, 2 * Math.PI);
    map.stroke();
  }
  if (game.night === 2) map.strokeRect(-9 * scale, -2 * scale, 18 * scale, 4 * scale);
  if (game.night === 3) {
    for (const r of [8, 12, 24]) {
      map.beginPath();
      map.arc(0, 0, r * scale, Math.PI, r === 8 ? 3 * Math.PI : 2 * Math.PI);
      map.stroke();
    }
  }
  for (const { pos, lit } of game.lanterns) {
    map.fillStyle = lit ? '#ffd28b' : '#635268';
    map.strokeStyle = '#e6ac78';
    map.beginPath();
    map.arc((axis - pos[0]) * scale, -pos[2] * scale, 7, 0, 2 * Math.PI);
    map.fill();
    map.stroke();
  }
  map.translate((axis - game.player.pos[0]) * scale, -game.player.pos[2] * scale);
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

const coach = [
  'Ông Đăng: Gom ánh sáng trên bãi cỏ. Những chiếc đèn đã thắp sẽ che chở cho con.',
  'Ông Đăng: Giữ thăng bằng trên cầu tre. Bục vàng sẽ đưa con sang bờ bên kia.',
  'Ông Đăng: Theo dốc lên vành đá, rồi dùng bục nhảy để lên tháp chuông.'
];

function loadSettings() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem('lantern-settings')); }
  catch { return { volume: 0.4, sensitivity: 1 }; }
  return {
    volume: Number.isFinite(saved?.volume) ? Math.max(0, Math.min(1, saved.volume)) : 0.4,
    sensitivity: Number.isFinite(saved?.sensitivity) ? Math.max(0.25, Math.min(2, saved.sensitivity)) : 1,
    colorAssist: Boolean(saved?.colorAssist)
  };
}

async function main() {
  const response = await fetch('/game.contract.json');
  if (!response.ok) throw new Error('Không tải được thông số trò chơi.');
  const { tuning } = await response.json();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
  renderer.toneMapping = THREE.NoToneMapping;
  const may = makeMay();
  const ghosts = new Map();
  const updateFireflies = makeFireflies();
  const lanterns = new Map();
  const drifters = new Map();
  const charms = new Map();
  const pulseRing = mesh(actors, new THREE.RingGeometry(0.92, 1, 48), glow('#FFB347', 0.8), 0, 0.1, 0);
  pulseRing.rotation.x = -Math.PI / 2;
  pulseRing.visible = false;
  const nearestLight = new THREE.PointLight('#FFB347', 0, 16, 2);
  scene.add(nearestLight);
  const windLeaves = new THREE.InstancedMesh(point, material.petal, 22);
  windLeaves.frustumCulled = false;
  scene.add(windLeaves);
  const breeze = new THREE.Object3D();
  const follow = new THREE.Vector3();
  const look = new THREE.Vector3();
  const view = new THREE.Vector3();
  const cameraForward = new THREE.Vector3();
  const dim = new THREE.Color('#e5ecff');
  const bright = new THREE.Color('#FFE9B0');
  const restart = find('restart');
  const settingsButton = find('settings');
  const menuButton = find('to-menu');
  const settingsForm = find('settings-fields');
  const settings = loadSettings();
  const sounds = new Sounds(settings.volume);
  const pack = find('mote-slots');
  for (let i = 0; i < tuning.capacity_max; i++) pack.append(document.createElement('i'));

  let game = new Game(tuning, 2026);
  let drawnNight;
  let total = 0;
  let screen = 'menu';
  let settingsBack = 'menu';
  let yaw = 0;
  let previous = DEFAULT_INPUT;
  let drag = null;
  let lastTime = null;
  let accumulator = 0;
  let noticeUntil = 0;
  let pulseAt = -Infinity;
  let lastSecond = 0;
  let windWarning = false;
  let walking = false;
  let pauseRequested = false;

  function changeScreen(next) {
    screen = next;
    keys.clear();
    queuedActions.clear();
    drag = null;
    const won = game.state === 'won';
    const night = 'Đêm ' + game.night + ' · ' + game.map.name;
    const summary = 'Điểm đêm này ' + game.score + ' · Tổng điểm ' + total + '.';
    const usual = {
      menu: ['', 'Đảo Đèn Lồng', 'Cùng Mây giữ đủ đèn sáng trên ba hòn đảo tới bình minh.', 'Bắt đầu'],
      intro: ['Đêm ' + game.night, game.map.name, coach[game.night - 1], 'Vào đảo'],
      paused: [night, 'Tạm dừng', '', 'Tiếp tục'],
      settings: ['', 'Cài đặt', '', 'Quay lại'],
      result: [night, won ? 'Đèn đã bừng sáng' : 'Ánh sáng đã tắt', (won ? '' :
        (game.player.flames ? 'Bình minh đến khi đảo còn thiếu đèn sáng. ' : 'Mây đã hết Ngọn Lửa. ')) + summary, won ? 'Đêm kế tiếp' : 'Chơi lại Đêm'],
      dawn: ['', 'Bình Minh', 'Cả ba hòn đảo đã sáng. Tổng điểm ' + total + '.', 'Về menu']
    };
    overlay.hidden = next === 'playing';
    if (overlay.hidden) {
      start.blur();
      return;
    }
    const [label, title, message, action] = usual[next];
    find('overlay-night').textContent = label;
    find('overlay-night').hidden = !label;
    find('overlay-title').textContent = title;
    find('overlay-text').textContent = message;
    find('overlay-text').hidden = !message;
    start.textContent = action;
    settingsForm.hidden = next !== 'settings';
    restart.hidden = next !== 'paused';
    settingsButton.hidden = !['menu', 'paused'].includes(next);
    menuButton.hidden = !['paused', 'result'].includes(next);
    start.focus();
  }

  function setNight(night, next) {
    game = new Game(tuning, 2026, {}, night);
    if (drawnNight !== night) {
      scenery(game);
      drawnNight = night;
    }
    yaw = 0;
    previous = DEFAULT_INPUT;
    accumulator = 0;
    walking = false;
    pulseAt = -Infinity;
    lastSecond = Math.ceil(game.timeLeft);
    windWarning = false;
    pauseRequested = false;
    notice.textContent = '';
    may.body.rotation.y = 0;
    camera.position.set(0, night === 3 ? 3.7 : 5.8, -8.7);
    find('night-label').textContent = 'Đêm ' + night + ' · ' + game.map.name;
    changeScreen(next);
  }

  function play() {
    sounds.unlock();
    switch (screen) {
      case 'menu':
        total = 0;
        setNight(1, 'intro');
        break;
      case 'intro': changeScreen('playing'); break;
      case 'paused': pauseRequested = true; break;
      case 'settings': changeScreen(settingsBack); break;
      case 'dawn': setNight(1, 'menu'); break;
      case 'result':
        if (game.state === 'won') setNight(game.night + 1, 'intro');
        else setNight(game.night, 'playing');
        break;
    }
  }

  function updateSettings(field, input) {
    find(input).value = settings[field];
    find(input + '-text').textContent = Math.round(100 * settings[field]) + '%';
    find(input).addEventListener('input', (event) => {
      settings[field] = Number(event.target.value);
      find(input + '-text').textContent = Math.round(100 * settings[field]) + '%';
      sounds.setVolume(settings.volume);
      try { localStorage.setItem('lantern-settings', JSON.stringify(settings)); }
      catch { /* The controls remain usable if browser storage is unavailable. */ }
    });
  }

  function resize() {
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    camera.aspect = canvas.clientWidth / canvas.clientHeight;
    camera.updateProjectionMatrix();
  }

  function input() {
    const down = (...codes) => codes.some((code) => keys.has(code));
    const edge = (button) => !previous[button] && queuedActions.delete(button);
    return {
      move: [Number(down('KeyA', 'ArrowLeft')) - Number(down('KeyD', 'ArrowRight')),
        Number(down('KeyW', 'ArrowUp')) - Number(down('KeyS', 'ArrowDown'))],
      cam_yaw_deg: yaw * 180 / Math.PI,
      jump: edge('jump'), interact: edge('interact'), pulse: edge('pulse'),
      dash: edge('dash'), pause: pauseRequested && !previous.pause
    };
  }

  const messages = {
    lantern_lit: 'Một Đèn Lồng Lớn đã sáng', player_hit: 'Mây mất một Ngọn Lửa',
    pulse: 'Mây tỏa sáng', charm_picked: 'Bùa Gió đã kích hoạt',
    refuel: 'Đã châm dầu', lantern_out: 'Một Đèn Lồng Lớn đã cạn dầu',
    drifter_steal: 'Gió Lạc đã cướp đom đóm', drifter_drop: 'Gió Lạc đã thả đom đóm'
  };

  function simulate(now) {
    const frame = input();
    if (frame.pause) pauseRequested = false;
    const events = game.step(frame, previous);
    previous = frame;
    const [fx, fz] = game.player.facing;
    walking = game.player.grounded && Math.hypot(game.player.vel[0], game.player.vel[2]) > 0;
    may.body.rotation.y = Math.atan2(fx, fz);
    for (const { name } of events) {
      sounds.play(name);
      if (name === 'paused') changeScreen('paused');
      if (name === 'resumed') changeScreen('playing');
      if (name === 'pulse') {
        pulseAt = now;
        pulseRing.position.set(game.player.pos[0], game.player.pos[1] + 0.08, game.player.pos[2]);
      }
      if (messages[name]) {
        notice.textContent = messages[name];
        noticeUntil = now + 1650;
      }
    }
    if (game.state === 'paused') return;
    const second = Math.ceil(Math.max(game.timeLeft, 0));
    if (second !== lastSecond && second <= 10 && second > 0) sounds.play('countdown');
    lastSecond = second;
    if (game.wind.warning && !windWarning) sounds.play('wind');
    windWarning = game.wind.warning;
    if (game.simTick % 72 === 1) sounds.ambient(Math.floor(game.simTick / 72));
    if (game.state === 'won' || game.state === 'lost') {
      const won = game.state === 'won';
      if (won) total += game.score;
      sounds.play(game.state);
      changeScreen(won && game.night === 3 ? 'dawn' : 'result');
    }
  }

  function guideLantern() {
    const remaining = game.lanterns.filter((lamp) => !lamp.lit).sort((a, b) =>
      xz(a.pos, game.player.pos) - xz(b.pos, game.player.pos));
    const target = remaining[0];
    const badge = find('guide');
    badge.hidden = screen !== 'playing' || !target;
    if (badge.hidden) return;
    view.fromArray(target.pos);
    view.y += 2.6;
    const ahead = camera.getWorldDirection(cameraForward).dot(view.clone().sub(camera.position));
    view.project(camera);
    badge.hidden = ahead > 0 && Math.abs(view.x) <= 0.93 && Math.abs(view.y) <= 0.94;
    if (!badge.hidden) {
      const [x, , z] = game.player.pos;
      const angle = Math.atan2(target.pos[0] - x, target.pos[2] - z);
      find('guide-arrow').style.transform = 'rotate(' + (yaw - angle) + 'rad)';
      find('guide-distance').textContent = target.id + ' · ' + Math.round(xz(target.pos, game.player.pos)) + ' m';
    }
  }

  function drawWind(seconds) {
    windLeaves.visible = game.wind.active || game.wind.warning;
    if (!windLeaves.visible) return;
    const [x, y, z] = game.player.pos;
    const [dx, dz] = direction(game.wind.dir_deg);
    for (let i = 0; i < windLeaves.count; i++) {
      const offset = ((seconds * (game.wind.active ? 10 : 4) + i * 3.68) % 28) - 14;
      const cross = ((i * 7.2) % 23) - 11.5;
      breeze.position.set(x + dx * offset - dz * cross, Math.max(0, y) + 0.45 + (i % 6) * 0.35,
        z + dz * offset + dx * cross);
      breeze.rotation.set(seconds * 2 + i, i * 2, seconds + i);
      breeze.scale.set(0.28, 0.055, 0.1);
      breeze.updateMatrix();
      windLeaves.setMatrixAt(i, breeze.matrix);
    }
    windLeaves.instanceMatrix.needsUpdate = true;
  }

  function draw(now) {
    const seconds = game.simTick / TICK_RATE;
    const [x, y, z] = game.player.pos;
    const lit = game.lanterns.filter((lantern) => lantern.lit);
    may.root.visible = !game.player.respawnAt;
    may.root.position.set(x, y, z);
    may.left.position.z = walking ? Math.sin(seconds * 16) * 0.18 : 0;
    may.right.position.z = -may.left.position.z;
    may.body.visible = game.simTick >= game.player.invulnerableUntil || Math.floor(seconds * 10) % 3 !== 0;
    synchronize(lanterns, game.lanterns, makeLantern, (model, lantern) => {
      model.root.position.fromArray(lantern.pos);
      model.paper.material = lantern.lit ? material.paperOn : material.paperOff;
      const weak = lantern.lit && !game.isSafe(lantern);
      const blink = !weak || Math.floor(seconds * 2) % 2 === 0;
      model.root.scale.y = lantern.lit ? 1 : 0.8;
      model.tear.visible = !lantern.lit;
      model.light.visible = model.core.visible = lantern.lit && blink;
      if (weak && !blink) model.paper.material = material.paperOff;
      model.safety.visible = game.isSafe(lantern);
      model.safety.scale.setScalar(tuning.safe_radius);
      model.bar.visible = lantern.lit && blink;
      model.bar.quaternion.copy(camera.quaternion);
      const oil = lantern.fuel / (TICK_RATE * tuning.fuel_max);
      model.oil.scale.x = 1.42 * oil;
      model.oil.position.x = -0.71 * (1 - oil);
    });
    const light = lit.sort((a, b) => xz(a.pos, game.player.pos) - xz(b.pos, game.player.pos))[0];
    nearestLight.intensity = light ? 74 : 0;
    if (light) nearestLight.position.set(light.pos[0], light.pos[1] + 2.45, light.pos[2]);
    updateFireflies(game.motes, seconds);
    synchronize(ghosts, game.shades, makeShade, (model, shade, index) => {
      model.root.position.fromArray(shade.pos);
      model.root.position.y += 0.14 * Math.sin(seconds * 3.2 + index);
      model.root.rotation.y = Math.atan2(x - shade.pos[0], z - shade.pos[2]);
      model.body.material = shade.state === 'stunned' ? material.stunned : material.shade;
      model.glowRing.material.color.set(settings.colorAssist ? '#00B3FF' : '#7A3CFF');
      model.root.scale.setScalar(shade.state === 'spawning' ? 0.72 : 1);
    });
    synchronize(drifters, game.drifters, makeDrifter, (model, drifter) => {
      model.root.position.fromArray(drifter.pos);
      model.root.position.y += 1 + 0.2 * Math.sin(seconds * 8);
      model.root.rotation.y = Math.atan2(x - drifter.pos[0], z - drifter.pos[2]) + (drifter.state === 'flee' ? Math.PI : 0);
      model.ribbon.children.forEach((strip, i) => { strip.position.x = Math.sin(seconds * 11 - i * 0.7) * i * 0.12; });
    });
    synchronize(charms, game.charms, makeCharm, (model, charm) => {
      model.root.visible = charm.available;
      model.root.position.fromArray(charm.pos);
      model.root.position.y += 0.75 + 0.16 * Math.sin(seconds * 3);
      model.root.rotation.y = seconds * 1.2;
    });
    const wave = Math.min(1, (now - pulseAt) / 440);
    pulseRing.visible = wave < 1;
    if (pulseRing.visible) {
      pulseRing.scale.setScalar(Math.max(0.05, wave * tuning.pulse_radius));
      pulseRing.material.opacity = 0.75 * (1 - wave);
    }
    const fraction = lit.length / game.lanterns.length;
    moonlight.intensity = 0.15 + 0.55 * fraction;
    moonlight.color.copy(dim).lerp(bright, fraction);
    drawWind(seconds);
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const cameraY = Math.max(-4, y);
    const lowCeiling = game.night === 3 && cameraY < 3 && Math.hypot(x, z) < 16;
    const lookHeight = game.night === 3 && cameraY >= 0 && cameraY < 2 && !lowCeiling ? 2.9 : 1;
    follow.set(x - sin * 8.7, lowCeiling ? Math.min(4.3, cameraY + 3.7) : cameraY + 5.8, z - cos * 8.7);
    look.set(x + sin * 3, cameraY + lookHeight, z + cos * 3);
    camera.position.lerp(follow, 0.23);
    camera.lookAt(look);
    renderer.render(scene, camera);
    drawHud(lit.length, now, seconds);
    guideLantern();
    drawMap(game, yaw);
  }

  function drawHud(lit, now, seconds) {
    const remaining = Math.ceil(Math.max(0, game.timeLeft));
    const clock = String(Math.floor(remaining / 60)).padStart(2, '0') + ':' + String(remaining % 60).padStart(2, '0');
    const cooldown = (deadline) => deadline > game.simTick ? ((deadline - game.simTick) / 60).toFixed(1) + 's' : 'Sẵn sàng';
    const charmLeft = Math.max(0, game.player.windCharmUntil / 60 - seconds);
    const values = {
      flames: game.player.flames + '/' + tuning.flames, carried: game.player.carried + '/' + game.capacity(),
      lit: lit + '/' + game.lanterns.length, time: clock, score: String(game.score),
      dash: charmLeft ? 'Sẵn sàng' : cooldown(game.player.dashReadyAt),
      pulse: cooldown(game.player.pulseReadyAt), charm: 'Bùa Gió · ' + charmLeft.toFixed(1) + 's'
    };
    for (const [name, value] of Object.entries(values)) {
      if (hud[name].textContent !== value) hud[name].textContent = value;
    }
    hud.time.classList.toggle('danger', remaining <= 30);
    hud.charm.hidden = charmLeft === 0;
    for (const [i, slot] of Array.from(pack.children).entries()) {
      slot.classList.toggle('filled', i < game.player.carried);
      slot.hidden = i >= game.capacity();
    }
    const lamp = game.nearestLantern();
    prompt.hidden = screen !== 'playing' || !lamp;
    if (!prompt.hidden) prompt.textContent = lamp.lit
      ? 'E — Châm dầu (' + Math.floor(lamp.fuel / TICK_RATE) + '%)'
      : 'E — Nạp ánh sáng (' + lamp.deposited + '/' + (lamp.everLit ? tuning.relight_cost : tuning.lantern_cost) + ')';
    if (notice.textContent && now > noticeUntil) notice.textContent = '';
  }

  start.addEventListener('click', play);
  restart.addEventListener('click', () => setNight(game.night, 'playing'));
  menuButton.addEventListener('click', () => setNight(1, 'menu'));
  settingsButton.addEventListener('click', () => {
    settingsBack = screen;
    changeScreen('settings');
  });
  updateSettings('volume', 'volume');
  updateSettings('sensitivity', 'sensitivity');
  const colorAssist = find('color-assist');
  function syncPalette() {
    document.documentElement.classList.toggle('color-assist', Boolean(settings.colorAssist));
    material.shadeEye.color.set(settings.colorAssist ? '#00B3FF' : '#7A3CFF');
  }
  colorAssist.checked = Boolean(settings.colorAssist);
  syncPalette();
  colorAssist.addEventListener('change', () => {
    settings.colorAssist = colorAssist.checked;
    syncPalette();
    try { localStorage.setItem('lantern-settings', JSON.stringify(settings)); }
    catch { /* Preferences remain active for this tab. */ }
  });

  const controls = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown',
    'ArrowRight', 'Space', 'KeyE', 'KeyQ', 'ShiftLeft', 'ShiftRight']);
  const actionKeys = new Map([['Space', 'jump'], ['KeyE', 'interact'], ['KeyQ', 'pulse'],
    ['ShiftLeft', 'dash'], ['ShiftRight', 'dash']]);
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Escape' || event.code === 'KeyP') {
      if (event.repeat) return;
      if (screen === 'settings') changeScreen(settingsBack);
      else if (screen === 'playing' || screen === 'paused') pauseRequested = true;
      return;
    }
    if (screen !== 'playing' || !controls.has(event.code)) return;
    event.preventDefault();
    const action = actionKeys.get(event.code);
    if (action && !event.repeat && !Array.from(keys).some((key) => actionKeys.get(key) === action)) {
      queuedActions.add(action);
    }
    keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => { keys.clear(); queuedActions.clear(); });
  canvas.addEventListener('pointerdown', (event) => {
    if (screen !== 'playing') return;
    drag = event.clientX;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (drag === null) return;
    yaw -= (event.clientX - drag) * 0.008 * settings.sensitivity;
    drag = event.clientX;
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(type, () => { drag = null; });
  }
  new ResizeObserver(resize).observe(canvas);
  resize();
  start.disabled = false;
  setNight(1, 'menu');
  renderer.setAnimationLoop((now) => {
    if (screen === 'playing' || screen === 'paused') {
      accumulator += lastTime === null ? 0 : Math.min(250, Math.max(0, now - lastTime));
      while ((screen === 'playing' || screen === 'paused') && accumulator >= 1000 / TICK_RATE) {
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
