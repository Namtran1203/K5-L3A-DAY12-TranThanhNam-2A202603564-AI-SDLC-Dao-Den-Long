import { MAPS } from './maps.mjs';

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
        interact: boolean, pulse: boolean, dash: boolean, pause: boolean });
      check(Object.hasOwn(frame, 'tick') && frame.tick > lastTick, `${path}.tick (phải tăng nghiêm ngặt)`);
      lastTick = frame.tick;
    })
  });
}

function entities(value, path, schema) {
  const ids = new Set();
  return entries(value, path, (item, at) => {
    fields(item, at, { id: identifier, pos, ...schema });
    check(Object.hasOwn(item, 'pos'), at + '.pos');
    if (Object.hasOwn(item, 'id')) {
      check(!ids.has(item.id), at + '.id');
      ids.add(item.id);
    }
  });
}

export function validateScenario(value, tuning, night = 1) {
  const lanternIds = new Set();
  return fields(value, 'scenario', {
    player: (value) => fields(value, 'scenario.player', {
      pos, carried: (n) => integer(n) && n <= tuning.carry_capacity,
      flames: (n) => integer(n) && n <= tuning.flames,
      invuln_ticks: integer, dash_cd_ticks: integer, pulse_cd_ticks: integer, charm_ticks: integer
    }),
    random_motes: boolean,
    random_shades: boolean,
    random_drifters: boolean,
    wind_enabled: boolean,
    motes: (list) => entries(list, 'scenario.motes', (item, path) => check(pos(item), path)),
    shades: (list) => entities(list, 'scenario.shades', {
      state: (s) => ['spawning', 'wander', 'chase', 'recoil', 'stunned'].includes(s), state_ticks_left: integer
    }),
    drifters: (list) => entities(list, 'scenario.drifters', {
      state: (s) => ['idle', 'chase', 'flee', 'removed'].includes(s), state_ticks_left: integer,
      stolen: (n) => integer(n) && n <= 3
    }),
    charms: (list) => entities(list, 'scenario.charms', { available: boolean, respawn_ticks: integer }),
    lanterns: (list) => entries(list, 'scenario.lanterns', (item, path) => {
      fields(item, path, { id: (id) => typeof id === 'string' && /^L[1-7]$/.test(id) &&
        Number(id.slice(1)) <= MAPS[night].lanterns.length, pos,
        deposited: (n) => integer(n) && n <= tuning.lantern_cost, lit: boolean });
      check(Object.hasOwn(item, 'id') && !lanternIds.has(item.id), `${path}.id`);
      lanternIds.add(item.id);
    }),
    time_left_s: (n) => number(n) && n >= 0
  });
}
