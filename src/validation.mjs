const number = Number.isFinite;
const integer = (value) => Number.isSafeInteger(value) && value >= 0;
const boolean = (value) => typeof value === 'boolean';
const identifier = (value) => typeof value === 'string' && value.length > 0;
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const pos = (value) => Array.isArray(value) && value.length === 3 && value.every(number);
const move = (value) => Array.isArray(value) && value.length === 2 &&
  value.every((axis) => number(axis) && Math.abs(axis) <= 1);

export class InputFormatError extends Error {}

function check(condition, field) {
  if (!condition) throw new InputFormatError(`Trường không hợp lệ: ${field}`);
}

function fields(value, path, schema) {
  check(object(value), path);
  for (const [key, item] of Object.entries(value)) {
    check(Object.hasOwn(schema, key) && schema[key](item), `${path}.${key}`);
  }
  return true;
}

function entries(value, path, validate) {
  check(Array.isArray(value), path);
  value.forEach((item, index) => validate(item, `${path}[${index}]`));
  return true;
}

export function validateInputs(value) {
  let lastTick = -1;
  check(object(value) && Object.hasOwn(value, 'frames'), 'inputs.frames');
  return fields(value, 'inputs', {
    frames: (frames) => entries(frames, 'inputs.frames', (frame, path) => {
      fields(frame, path, { tick: integer, move, cam_yaw_deg: number, jump: boolean,
        interact: boolean, pulse: boolean, dash: boolean });
      check(Object.hasOwn(frame, 'tick') && frame.tick > lastTick, `${path}.tick (phải tăng nghiêm ngặt)`);
      lastTick = frame.tick;
    })
  });
}

export function validateScenario(value, tuning) {
  const shadeIds = new Set();
  const lanternIds = new Set();
  return fields(value, 'scenario', {
    player: (value) => fields(value, 'scenario.player', {
      pos, carried: (n) => integer(n) && n <= tuning.carry_capacity,
      flames: (n) => integer(n) && n <= tuning.flames
    }),
    random_motes: boolean,
    random_shades: boolean,
    motes: (list) => entries(list, 'scenario.motes', (item, path) => check(pos(item), path)),
    shades: (list) => entries(list, 'scenario.shades', (item, path) => {
      fields(item, path, { pos, id: identifier });
      check(Object.hasOwn(item, 'pos'), `${path}.pos`);
      if (Object.hasOwn(item, 'id')) {
        check(!shadeIds.has(item.id), `${path}.id`);
        shadeIds.add(item.id);
      }
    }),
    lanterns: (list) => entries(list, 'scenario.lanterns', (item, path) => {
      fields(item, path, { id: (id) => typeof id === 'string' && /^L[1-5]$/.test(id), pos,
        deposited: (n) => integer(n) && n <= tuning.lantern_cost, lit: boolean });
      check(Object.hasOwn(item, 'id') && !lanternIds.has(item.id), `${path}.id`);
      lanternIds.add(item.id);
    }),
    time_left_s: (n) => number(n) && n >= 0
  });
}
