import { EPSILON, NONE, direction, floorUnder, radians, surfaces, towerWall, unitXZ, xz } from './maps.mjs';

export const TICK_RATE = 60;
const dt = 1 / TICK_RATE;
const FALL_WAIT = 60;
export const CHARM_TICKS = 600;
export const CHARM_RESPAWN = 2700;
const ticks = (seconds) => Math.round(seconds * TICK_RATE);

export function makePlayer(night, tuning, start = {}) {
  const pos = [...(start.pos ?? [0, 0, 0])];
  const floor = floorUnder(night, ...pos);
  return {
    pos, vel: [0, 0, 0], facing: [0, 1], grounded: Math.abs(pos[1] - floor) <= EPSILON,
    carried: start.carried ?? 0, flames: start.flames ?? tuning.flames,
    successfulLights: start.successful_lights ?? 0,
    dashUntil: 0, invulnerableUntil: start.invuln_ticks ?? 0, respawnAt: 0,
    windCharmUntil: start.charm_ticks ?? 0, pulseReadyAt: start.pulse_cd_ticks ?? 0,
    dashReadyAt: start.dash_cd_ticks ?? 0, dashDirection: [0, 1],
    verticalSpeed: 0, launch: null
  };
}

function usePad(player, map, emit) {
  const pad = map.pads.find(({ pos }) =>
    Math.abs(player.pos[1] - pos[1]) <= EPSILON && xz(pos, player.pos) <= 1 + EPSILON);
  if (!pad) return false;
  player.grounded = false;
  player.verticalSpeed = pad.rise;
  player.launch = unitXZ(pad.pos, pad.target).map((axis) => axis * pad.speed);
  player.vel = [player.launch[0], pad.rise, player.launch[1]];
  emit('jump', {});
  return true;
}

function blocked(night, pos, nextX, nextZ, highest, stride, grounded) {
  if (towerWall(night, nextX, highest, nextZ)) return true;
  if (night !== 3) return false;
  const from = surfaces(night, pos[0], pos[2]);
  const to = surfaces(night, nextX, nextZ);
  const climb = grounded ? stride / 2 + EPSILON : EPSILON;
  return to.some((height, i) => i > 0 && height > highest + climb && height > from[i] + EPSILON &&
    pos[1] >= (i === 2 ? 3 : 0) - EPSILON);
}

export function updatePlayer(game, input, pressed, emit) {
  const { player, tuning, map, night, simTick: time, wind } = game;
  const [x, z] = input.move;
  const yaw = radians(input.cam_yaw_deg % 360);
  const norm = Math.max(1, Math.hypot(x, z));
  const move = [(x * Math.cos(yaw) + z * Math.sin(yaw)) / norm,
    (-x * Math.sin(yaw) + z * Math.cos(yaw)) / norm];
  if (x || z) player.facing = unitXZ([0, 0, 0], [move[0], 0, move[1]], player.facing);
  const charmed = time < player.windCharmUntil;
  if (pressed('dash') && time >= player.dashUntil && (charmed || time >= player.dashReadyAt)) {
    player.dashUntil = time + ticks(tuning.dash_duration_s);
    player.dashReadyAt = charmed ? time : time + ticks(tuning.dash_cooldown_s);
    player.dashDirection = player.facing;
    emit('dash', {});
  }
  const dashing = time < player.dashUntil;
  if (player.grounded && !usePad(player, map, emit) && pressed('jump')) {
    player.verticalSpeed = tuning.jump_speed;
    player.grounded = false;
    emit('jump', {});
  }
  const runSpeed = charmed ? 7.2 : tuning.player_speed;
  const base = dashing ? player.dashDirection.map((axis) => axis * tuning.dash_speed) :
    player.launch ?? move.map((axis) => axis * runSpeed);
  const gust = wind.active ? direction(wind.dir_deg).map((axis) => axis * 2) : [0, 0];
  const pos = player.pos;
  const airborneDash = dashing && !player.grounded;
  let y = pos[1];
  if (!player.grounded && !airborneDash) {
    y += (player.verticalSpeed + tuning.gravity * dt / 2) * dt;
    player.verticalSpeed += tuning.gravity * dt;
  }
  const dx = (base[0] + gust[0]) * dt;
  const dz = (base[1] + gust[1]) * dt;
  let nextX = pos[0] + dx;
  let nextZ = pos[2] + dz;
  const stride = Math.hypot(dx, dz);
  const highest = Math.max(pos[1], y);
  if (blocked(night, pos, nextX, nextZ, highest, stride, player.grounded)) {
    if (!blocked(night, pos, nextX, pos[2], highest, Math.abs(dx), player.grounded)) nextZ = pos[2];
    else if (!blocked(night, pos, pos[0], nextZ, highest, Math.abs(dz), player.grounded)) nextX = pos[0];
    else [nextX, nextZ] = [pos[0], pos[2]];
  }
  const slopeStep = player.grounded ? stride / 2 : 0;
  const floor = floorUnder(night, nextX, Math.max(pos[1], y) + slopeStep, nextZ);
  const followsGround = player.grounded && floor >= pos[1] - slopeStep - EPSILON;
  const lands = !player.grounded && !airborneDash && player.verticalSpeed <= 0 && floor >= y - EPSILON;
  if (followsGround || lands) {
    y = floor;
    player.grounded = true;
    player.verticalSpeed = 0;
    player.launch = null;
  } else if (player.grounded) {
    player.grounded = false;
    if (!dashing) {
      player.verticalSpeed = tuning.gravity * dt;
      y += player.verticalSpeed * dt / 2;
    }
  }
  player.vel = [(nextX - pos[0]) / dt, airborneDash ? 0 : player.verticalSpeed, (nextZ - pos[2]) / dt];
  player.pos = [nextX, y, nextZ];
  if (player.grounded) usePad(player, map, emit);
}

export function fallOrRespawn(game, emit) {
  const { player, tuning, simTick: time, night } = game;
  if (player.respawnAt) {
    if (time >= player.respawnAt) {
      const fresh = makePlayer(night, tuning);
      player.pos = fresh.pos;
      player.vel = fresh.vel;
      player.grounded = fresh.grounded;
      player.facing = fresh.facing;
      player.verticalSpeed = 0;
      player.launch = null;
      player.dashUntil = 0;
      player.respawnAt = 0;
      player.invulnerableUntil = time + ticks(tuning.invuln_s);
    }
    return true;
  }
  if (player.pos[1] >= -10) return false;
  const lost = player.carried;
  player.carried = 0;
  player.vel = [0, 0, 0];
  player.flames = Math.max(0, player.flames - 1);
  player.respawnAt = player.flames ? time + FALL_WAIT : 0;
  emit('player_hit', { by: 'fall', flames: player.flames, dropped: 0, lost });
  return true;
}

export function touches(a, b, radius, height = Infinity) {
  return Math.abs(a[1] - b[1]) <= height + EPSILON && xz(a, b) <= radius + EPSILON;
}
