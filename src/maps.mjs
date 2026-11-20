export const EPSILON = 1e-8;
export const NONE = -Infinity;
export const xz = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
export const unitXZ = (a, b, fallback = [1, 0]) => {
  const gap = xz(a, b);
  return gap > EPSILON ? [(b[0] - a[0]) / gap, (b[2] - a[2]) / gap] : fallback;
};
export const radians = (angle) => angle * Math.PI / 180;
export const direction = (angle) => [Math.cos(radians(angle)), Math.sin(radians(angle))];

function circlePoints(x, y, radius, count, offset = 0, spacing = 360 / count) {
  return Array.from({ length: count }, (_, index) => {
    const [dx, dz] = direction(offset + index * spacing);
    return [x + radius * dx, y, radius * dz].map((n) => Math.abs(n) < EPSILON ? 0 : n);
  });
}

export const MAPS = {
  1: {
    name: 'Đảo Bến', islands: [[0, 40]], shadeInterval: 480, shadeLimit: 6,
    lanterns: [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]],
    motes: [...circlePoints(0, 0, 12, 8), ...circlePoints(0, 0, 33, 16)],
    shades: circlePoints(0, 0, 37, 12, 15),
    pads: [], charms: []
  },
  2: {
    name: 'Đảo Cau', islands: [[0, 28], [70, 28]], shadeInterval: 420, shadeLimit: 8,
    lanterns: [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]],
    motes: [0, 70].flatMap((x) => [...circlePoints(x, 0, 10, 4), ...circlePoints(x, 0, 22, 8)]),
    shades: [0, 70].flatMap((x) => circlePoints(x, 0, 26, 8, 22.5)),
    pads: [{ pos: [20, 0, 18], target: [70, 0, 0], speed: 24, rise: 14 },
      { pos: [50, 0, -18], target: [0, 0, 0], speed: 24, rise: 14 }],
    charms: [[35, 0, 0]]
  },
  3: {
    name: 'Đảo Chuông', islands: [[0, 45]], shadeInterval: 360, shadeLimit: 10,
    lanterns: [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]],
    motes: [...circlePoints(0, 0, 34, 18), ...circlePoints(0, 3, 18, 8, 20, 20), ...circlePoints(0, 6, 5, 4, 45)],
    shades: circlePoints(0, 0, 43, 16), pads: [{ pos: [0, 3, 13], target: [0, 3, 0], speed: 8, rise: 12 }],
    charms: [[30, 0, 25], [-30, 0, 25]]
  }
};

export const RAMP_AXES = [30, 150].map(direction);

export function baseGround(night, x, z) {
  if (night === 2 && x >= 26 && x <= 44 && Math.abs(z) <= 2) return true;
  return MAPS[night].islands.some(([center, radius]) => (x - center) ** 2 + z ** 2 <= radius ** 2 + EPSILON);
}

function rampHeight(x, z) {
  for (const [dx, dz] of RAMP_AXES) {
    const along = x * dx + z * dz;
    const across = -x * dz + z * dx;
    if (along >= 24 - EPSILON && along <= 30 + EPSILON && Math.abs(across) <= 1.5 + EPSILON) {
      return Math.min(3, Math.max(0, (30 - along) / 2));
    }
  }
  return NONE;
}

export function surfaces(night, x, z) {
  const base = baseGround(night, x, z) ? 0 : NONE;
  if (night !== 3) return [base];
  const d = x * x + z * z;
  const lowerDeck = z > 0 && d >= 12 ** 2 - EPSILON && d <= 24 ** 2 + EPSILON ? 3 : NONE;
  return [base, Math.max(lowerDeck, rampHeight(x, z)), d <= 64 + EPSILON ? 6 : NONE];
}

export function floorUnder(night, x, y, z) {
  const levels = surfaces(night, x, z);
  for (let i = levels.length - 1; i >= 0; i--) {
    if (levels[i] !== NONE && levels[i] <= y + EPSILON) return levels[i];
  }
  return NONE;
}

export function towerWall(night, x, y, z) {
  return night === 3 && y >= 6 - EPSILON && y < 14 && x * x + z * z < 4 - EPSILON;
}
