import { EPSILON, baseGround, direction, floorUnder, surfaces, towerWall, unitXZ, xz } from './maps.mjs';
import { TICK_RATE, touches } from './player.mjs';

const FLEE_TICKS = 240;
const RECOVERED_FLEE_TICKS = 120;
const EVACUATION_TICKS = 30;
const PUSH_TICKS = 15;
const RECOIL_TICKS = 60;
const sortId = (a, b) => {
  const first = /^(.*?)(\d+)$/.exec(a.id);
  const second = /^(.*?)(\d+)$/.exec(b.id);
  if (first && second && first[1] === second[1]) return Number(first[2]) - Number(second[2]);
  return a.id < b.id ? -1 : Number(a.id > b.id);
};

function insideZone(pos, zones, radius) {
  return zones.some((zone) => xz(pos, zone.pos) < radius - EPSILON);
}

function wallFraction(pos, dx, dz, zones, radius) {
  let fraction = 1;
  const travelSquared = dx * dx + dz * dz;
  for (const zone of zones) {
    const ox = pos[0] - zone.pos[0];
    const oz = pos[2] - zone.pos[2];
    const c = ox * ox + oz * oz - radius * radius;
    const b = ox * dx + oz * dz;
    const discriminant = b * b - travelSquared * c;
    if (b < 0 && discriminant > 0 && c >= -EPSILON) {
      fraction = Math.min(fraction, Math.max(0, (-b - Math.sqrt(discriminant)) / travelSquared - EPSILON));
    }
  }
  return fraction;
}

function moveShade(game, shade, dx, dz, zones, radius) {
  const { pos } = shade;
  let fraction = wallFraction(pos, dx, dz, zones, radius);
  const startsOnLand = baseGround(game.night, pos[0], pos[2]);
  const tiers = game.night === 3 ? surfaces(game.night, pos[0], pos[2]) : null;
  const blocked = (part) => {
    const x = pos[0] + dx * part;
    const z = pos[2] + dz * part;
    if ((startsOnLand && !baseGround(game.night, x, z)) || towerWall(game.night, x, pos[1], z)) return true;
    if (!tiers) return false;
    return surfaces(game.night, x, z).some((y, i) => i > 0 && y > pos[1] + EPSILON &&
      tiers[i] <= pos[1] + EPSILON && (i === 1 || pos[1] >= 3));
  };
  if (blocked(fraction)) {
    let free = 0;
    for (let i = 0; i < 12; i++) {
      const mid = (free + fraction) / 2;
      if (blocked(mid)) fraction = mid;
      else free = mid;
    }
    fraction = free;
  }
  pos[0] += dx * fraction;
  pos[2] += dz * fraction;
  return fraction;
}

// Intersect rays with every circle so overlapping sanctuaries have one exit.
function evacuationTarget(pos, zones, radius) {
  let bestDistance = Infinity;
  let target;
  for (let i = 0; i < 64; i++) {
    const [dx, dz] = direction(i * 360 / 64);
    const intervals = [];
    for (const { pos: center } of zones) {
      const ox = pos[0] - center[0];
      const oz = pos[2] - center[2];
      const projection = ox * dx + oz * dz;
      const chord = projection ** 2 - (ox * ox + oz * oz - radius ** 2);
      if (chord >= 0) intervals.push([-projection - Math.sqrt(chord), -projection + Math.sqrt(chord)]);
    }
    intervals.sort((a, b) => a[0] - b[0]);
    let exit = 0;
    for (const [start, end] of intervals) {
      if (start > exit + EPSILON) break;
      exit = Math.max(exit, end);
    }
    if (exit < bestDistance) {
      bestDistance = exit;
      target = [pos[0] + dx * (exit + EPSILON), pos[2] + dz * (exit + EPSILON)];
    }
  }
  return target;
}

export function updateSanctuaries(game) {
  const zones = game.lanterns.filter((lamp) => game.isSafe(lamp));
  const changed = game.safeZones.length !== zones.length || zones.some((lamp, i) => game.safeZones[i] !== lamp);
  game.safeZones = zones;
  for (const shade of game.shades) {
    if (!insideZone(shade.pos, zones, game.tuning.safe_radius)) {
      shade.evacuation = null;
    } else if (changed || !shade.evacuation) {
      shade.evacuation = {
        target: evacuationTarget(shade.pos, zones, game.tuning.safe_radius),
        until: Math.min(shade.evacuation?.until ?? Infinity, game.simTick + EVACUATION_TICKS)
      };
    }
  }
}

export function applyPulse(game, emit) {
  const { player, tuning, simTick: time } = game;
  if (player.carried < tuning.pulse_cost || time < player.pulseReadyAt) return;
  player.carried -= tuning.pulse_cost;
  player.pulseReadyAt = time + Math.round(tuning.pulse_cooldown_s * TICK_RATE);
  const inRange = ({ pos }) =>
    Math.hypot(pos[0] - player.pos[0], pos[1] - player.pos[1] - 0.8, pos[2] - player.pos[2]) <= tuning.pulse_radius + EPSILON;
  const stunned = game.shades.filter(inRange).sort(sortId);
  for (const shade of stunned) {
    game.score += shade.state === 'drain' ? tuning.score.per_drain_stun : tuning.score.per_stun;
    shade.state = 'stunned';
    shade.drainTicks = 0;
    shade.stateUntil = time + Math.round(tuning.pulse_stun_s * TICK_RATE);
    shade.pushUntil = time + PUSH_TICKS;
    shade.push = unitXZ(player.pos, shade.pos).map((axis) => axis * tuning.pulse_push_m / PUSH_TICKS);
  }
  emit('pulse', { stunned_ids: stunned.map(({ id }) => id) });
  for (const drifter of game.drifters) {
    if (!inRange(drifter)) continue;
    if (drifter.state === 'chase') {
      drifter.state = 'flee';
      drifter.stateUntil = time + FLEE_TICKS;
    } else if (drifter.state === 'flee' && drifter.stolen > 0) {
      const amount = drifter.stolen;
      for (let i = 0; i < amount; i++) {
        const floor = floorUnder(game.night, ...drifter.pos);
        game.dropMote([drifter.pos[0], Number.isFinite(floor) ? floor : drifter.pos[1], drifter.pos[2]]);
      }
      drifter.stolen = 0;
      drifter.stateUntil = time + RECOVERED_FLEE_TICKS;
      emit('drifter_drop', { drifter_id: drifter.id, amount });
    }
  }
}

export function advanceEnemyTimers(game) {
  for (const shade of game.shades) {
    if (['spawning', 'recoil', 'stunned'].includes(shade.state) && shade.stateUntil <= game.simTick) {
      if (shade.state === 'stunned') shade.recoveredAt = game.simTick;
      shade.state = 'wander';
    }
  }
  game.drifters = game.drifters.filter((drifter) =>
    drifter.state !== 'removed' && (drifter.state !== 'flee' || game.simTick < drifter.stateUntil));
}

function objective(game, shade) {
  let target;
  let distance;
  let priority = 2;
  for (const lamp of game.lanterns) {
    const rank = lamp.lit ? Number(game.isSafe(lamp)) * 2 : 1;
    if (rank >= 2) continue;
    const gap = xz(shade.pos, lamp.pos);
    if (rank < priority || (rank === priority && gap < distance - EPSILON)) {
      priority = rank;
      distance = gap;
      target = lamp;
    }
  }
  return target;
}

export function moveEnemies(game, wanderOnly = false) {
  const { player, tuning, simTick: time, safeZones } = game;
  const stride = (game.night === 3 ? tuning.shade_speed_night3 : tuning.shade_speed) / TICK_RATE;
  for (const shade of game.shades) {
    const gap = xz(shade.pos, player.pos);
    if (shade.state === 'drain') {
      const lamp = shade.targetLantern;
      if (!lamp?.lit || game.isSafe(lamp) || xz(lamp.pos, shade.pos) > 2 + EPSILON) {
        shade.state = 'wander';
        shade.recoveredAt = time;
      } else if (gap <= 6 + EPSILON) shade.state = 'chase';
      else continue;
      shade.drainTicks = 0;
    }
    if (shade.evacuation) {
      const { target, until } = shade.evacuation;
      const left = Math.max(1, until - time);
      shade.pos[0] += (target[0] - shade.pos[0]) / left;
      shade.pos[2] += (target[1] - shade.pos[2]) / left;
      continue;
    }
    if (shade.state === 'spawning') continue;
    if (shade.state === 'stunned' || shade.state === 'recoil') {
      if (time < shade.pushUntil &&
          moveShade(game, shade, ...shade.push, safeZones, tuning.safe_radius) < 1 - EPSILON) {
        shade.pushUntil = time;
      }
      continue;
    }
    if (shade.state === 'chase' && gap > 18 + EPSILON) shade.state = 'wander';
    if (!wanderOnly && shade.state === 'wander' && shade.recoveredAt !== time && gap <= 12 + EPSILON) shade.state = 'chase';
    const lamp = shade.state === 'wander' ? objective(game, shade) : undefined;
    const target = lamp?.pos ?? (shade.state === 'chase' ? player.pos : undefined);
    const axis = target ? unitXZ(shade.pos, target, [0, 0]) : direction(shade.heading);
    const distance = target ? Math.min(xz(shade.pos, target), stride) : stride;
    const fraction = moveShade(game, shade, axis[0] * distance, axis[1] * distance, safeZones, tuning.safe_radius);
    if (!wanderOnly && lamp?.lit && xz(shade.pos, lamp.pos) <= 2 + EPSILON && shade.recoveredAt !== time) {
      shade.state = 'drain';
      shade.targetLantern = lamp;
      shade.drainTicks = 0;
    }
    if (shade.state === 'wander' && fraction < 0.8) shade.heading += 137.5;
  }
  for (const drifter of game.drifters) {
    if (drifter.state !== 'flee') {
      drifter.state = player.carried >= 5 && xz(drifter.pos, player.pos) <= 15 + EPSILON ? 'chase' : 'idle';
    }
    const towards = unitXZ(drifter.pos, player.pos);
    const axis = drifter.state === 'idle' ? direction(drifter.heading + time / 20) : towards;
    let speed = (drifter.state === 'idle' ? 2 : 7) / TICK_RATE;
    if (drifter.state === 'flee') speed = -speed;
    if (drifter.state === 'chase') speed = Math.min(speed, xz(drifter.pos, player.pos));
    const x = drifter.pos[0] + axis[0] * speed;
    const z = drifter.pos[2] + axis[1] * speed;
    if (drifter.state === 'idle' && !baseGround(game.night, x, z) &&
        baseGround(game.night, drifter.pos[0], drifter.pos[2])) {
      drifter.heading += 180;
    } else {
      drifter.pos[0] = x;
      drifter.pos[2] = z;
    }
  }
}

export function contactEnemies(game, emit) {
  const { player, tuning, simTick: time } = game;
  for (const drifter of game.drifters.filter(({ state }) => state === 'chase').sort(sortId)) {
    if (!touches(drifter.pos, player.pos, 1.2)) continue;
    const amount = Math.min(3, player.carried);
    if (!amount) continue;
    player.carried -= amount;
    drifter.stolen = amount;
    drifter.state = 'flee';
    drifter.stateUntil = time + FLEE_TICKS;
    emit('drifter_steal', { drifter_id: drifter.id, amount, carried: player.carried });
  }
  if (time < player.invulnerableUntil || game.safeZones.some(({ pos }) =>
    touches(pos, player.pos, tuning.safe_radius))) return;
  const shade = game.shades.filter(({ pos, state, evacuation }) =>
    !evacuation && (state === 'chase' || state === 'wander') &&
    touches(player.pos, pos, tuning.shade_hit_radius, 1.5)).sort(sortId)[0];
  if (!shade) return;
  shade.state = 'recoil';
  shade.stateUntil = time + RECOIL_TICKS + 1;
  shade.pushUntil = shade.stateUntil;
  shade.push = unitXZ(player.pos, shade.pos).map((axis) => axis * 2 / RECOIL_TICKS);
  player.flames--;
  player.invulnerableUntil = time + Math.round(tuning.invuln_s * TICK_RATE);
  const dropped = Math.floor(player.carried * tuning.hit_drop_ratio);
  player.carried -= dropped;
  for (let i = 0; i < dropped; i++) {
    const angle = game.random() * 360;
    const radius = 1.5 + game.random();
    const [dx, dz] = direction(angle);
    const x = player.pos[0] + dx * radius;
    const z = player.pos[2] + dz * radius;
    const floor = floorUnder(game.night, x, player.pos[1], z);
    game.dropMote([x, Number.isFinite(floor) ? floor : player.pos[1], z]);
  }
  emit('player_hit', { by: 'shade', flames: player.flames, dropped });
}
