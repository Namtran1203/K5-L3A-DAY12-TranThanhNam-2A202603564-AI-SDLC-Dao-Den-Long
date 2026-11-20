export const TICK_RATE = 60;
export const ISLAND_RADIUS = 32;
export const DEFAULT_INPUT = Object.freeze({
  move: Object.freeze([0, 0]), cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false
});

const LANTERN_POSITIONS = [[0, 0, 0], [15, 0, 11], [-15, 0, 11], [-13, 0, -14], [13, 0, -14]];
const SPAWN_INTERVAL = 35 * TICK_RATE;
const dt = 1 / TICK_RATE;
const distance = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const roundPosition = (pos) => pos.map((value) => Math.round(value * 1000) / 1000);

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function nearestWithin(items, pos, radius) {
  let nearest;
  for (const item of items) {
    const gap = distance(item.pos, pos);
    if (gap <= radius && (!nearest || gap < radius)) {
      radius = gap;
      nearest = item;
    }
  }
  return nearest;
}

// Stop a shade at the first lit circle it would enter, including during a pulse.
function moveShade(shade, dx, dz, safeZones, radius) {
  const [x, , z] = shade.pos;
  const lengthSquared = dx * dx + dz * dz;
  let fraction = 1;
  for (const zone of safeZones) {
    const offsetX = x - zone.pos[0];
    const offsetZ = z - zone.pos[2];
    const fromBoundary = offsetX * offsetX + offsetZ * offsetZ - radius * radius;
    const approach = offsetX * dx + offsetZ * dz;
    const discriminant = approach * approach - lengthSquared * fromBoundary;
    if (approach < 0 && discriminant > 0 && fromBoundary >= -1e-8) {
      const entry = (-approach - Math.sqrt(discriminant)) / lengthSquared;
      fraction = Math.min(fraction, Math.max(0, entry - 1e-8));
    }
  }
  shade.pos[0] += dx * fraction;
  shade.pos[2] += dz * fraction;
}

export class Game {
  constructor(tuning, seed, scenario = {}) {
    this.tuning = tuning;
    this.random = seededRandom(seed);
    this.tick = 0;
    this.state = 'playing';
    this.score = 0;
    this.duration = scenario.time_left_s ?? tuning.night1_duration_s;
    this.timeLeft = this.duration;
    this.player = {
      pos: [...(scenario.player?.pos ?? [0, 0, 0])],
      carried: scenario.player?.carried ?? 0,
      flames: scenario.player?.flames ?? tuning.flames,
      verticalSpeed: 0,
      invulnerableUntil: 0,
      pulseReadyAt: 0
    };
    this.lanterns = LANTERN_POSITIONS.map((pos, i) => {
      const id = `L${i + 1}`;
      const update = scenario.lanterns?.find((lantern) => lantern.id === id);
      const deposited = update?.deposited ?? (update?.lit ? tuning.lantern_cost : 0);
      return { id, pos: [...(update?.pos ?? pos)], deposited, lit: update?.lit ?? (deposited === tuning.lantern_cost) };
    });
    this.nextMoteId = 1;
    this.nextShadeId = 1;
    this.motes = [];
    this.shades = [];
    this.shadeIds = new Set(scenario.shades?.flatMap(({ id }) => id === undefined ? [] : [id]));
    this.randomShades = scenario.random_shades ?? true;
    if (scenario.motes) {
      for (const pos of scenario.motes) this.addMote(pos);
    } else if (scenario.random_motes ?? true) {
      this.seedMotes();
    }
    if (scenario.shades) {
      for (const { pos, id } of scenario.shades) this.addShade(pos, id);
    } else if (this.randomShades) {
      for (let i = 0; i < 3; i++) this.spawnShade();
    }
  }

  addMote(pos) {
    this.motes.push({ id: `M${this.nextMoteId++}`, pos: [...pos] });
  }

  seedMotes() {
    for (let ring = 0; ring < 4; ring++) {
      const count = 10 + ring * 4;
      for (let i = 0; i < count; i++) {
        const angle = (i + this.random() * 0.8) / count * 2 * Math.PI;
        const radius = 5 + ring * 7 + this.random() * 2.5;
        this.addMote([Math.cos(angle) * radius, 0, Math.sin(angle) * radius]);
      }
    }
  }

  addShade(pos, id) {
    if (id === undefined) {
      do { id = `S${this.nextShadeId++}`; } while (this.shadeIds.has(id));
    }
    this.shadeIds.add(id);
    this.shades.push({ id, pos: [...pos], state: 'chase', stunnedUntil: 0 });
    return id;
  }

  spawnShade() {
    const start = this.random() * 2 * Math.PI;
    for (let i = 0; i < 16; i++) {
      const angle = start + i * Math.PI / 8;
      const pos = [Math.cos(angle) * 29, 0, Math.sin(angle) * 29];
      if (distance(pos, this.player.pos) > 8 &&
          !nearestWithin(this.lanterns.filter(({ lit }) => lit), pos, this.tuning.safe_radius)) {
        return this.addShade(pos);
      }
    }
  }

  updatePlayer(input, pressed) {
    const { player, tuning } = this;
    const [x, z] = input.move;
    const yaw = (input.cam_yaw_deg % 360) * Math.PI / 180;
    const stride = tuning.player_speed * dt / Math.max(1, Math.hypot(x, z));
    const nextX = player.pos[0] + (x * Math.cos(yaw) + z * Math.sin(yaw)) * stride;
    const nextZ = player.pos[2] + (-x * Math.sin(yaw) + z * Math.cos(yaw)) * stride;
    const edge = Math.max(ISLAND_RADIUS, Math.hypot(player.pos[0], player.pos[2]));
    const scale = Math.max(1, Math.hypot(nextX, nextZ) / edge);
    player.pos[0] = nextX / scale;
    player.pos[2] = nextZ / scale;
    if (pressed('jump') && player.pos[1] === 0) player.verticalSpeed = 6;
    if (player.pos[1] > 0 || player.verticalSpeed > 0) {
      player.pos[1] = Math.max(0, player.pos[1] + player.verticalSpeed * dt);
      player.verticalSpeed = player.pos[1] === 0 ? 0 : player.verticalSpeed - 18 * dt;
    }
  }

  collectMotes(emit) {
    const { player, tuning } = this;
    this.motes = this.motes.filter(({ pos }) => {
      if (player.carried >= tuning.carry_capacity || distance(player.pos, pos) > tuning.pickup_radius) return true;
      player.carried++;
      this.score += tuning.score.per_mote;
      emit('mote_picked', { carried: player.carried });
      return false;
    });
  }

  deposit(emit) {
    const { player, tuning } = this;
    const lantern = nearestWithin(this.lanterns.filter(({ lit }) => !lit), player.pos, tuning.interact_radius);
    if (!lantern || player.carried === 0) return;
    const amount = Math.min(player.carried, Math.max(0, tuning.lantern_cost - lantern.deposited));
    player.carried -= amount;
    lantern.deposited += amount;
    if (amount > 0) emit('deposit', { lantern_id: lantern.id, amount, deposited: lantern.deposited });
    if (lantern.deposited === tuning.lantern_cost) {
      lantern.lit = true;
      this.score += tuning.score.per_lantern;
      emit('lantern_lit', { lantern_id: lantern.id });
    }
  }

  pulse(safeZones, emit) {
    const { player, tuning } = this;
    if (player.carried < tuning.pulse_cost || this.tick < player.pulseReadyAt) return;
    player.carried -= tuning.pulse_cost;
    player.pulseReadyAt = this.tick + Math.round(tuning.pulse_cooldown_s * TICK_RATE);
    const stunnedIds = [];
    for (const shade of this.shades) {
      const gap = distance(player.pos, shade.pos);
      if (gap > tuning.pulse_radius) continue;
      shade.stunnedUntil = this.tick + Math.round(tuning.pulse_stun_s * TICK_RATE);
      shade.state = 'stunned';
      const dx = gap === 0 ? 1 : (shade.pos[0] - player.pos[0]) / gap;
      const dz = gap === 0 ? 0 : (shade.pos[2] - player.pos[2]) / gap;
      moveShade(shade, dx * tuning.pulse_push_m, dz * tuning.pulse_push_m, safeZones, tuning.safe_radius);
      stunnedIds.push(shade.id);
    }
    this.score += stunnedIds.length * tuning.score.per_stun;
    emit('pulse', { stunned_ids: stunnedIds });
  }

  updateShades(safeZones, emit) {
    const { tuning, player } = this;
    const playerSafe = nearestWithin(safeZones, player.pos, tuning.safe_radius);
    for (const shade of this.shades) {
      if (this.tick < shade.stunnedUntil) continue;
      const refuge = nearestWithin(safeZones, shade.pos, tuning.safe_radius - 1e-8);
      const target = refuge?.pos ?? player.pos;
      const gap = distance(shade.pos, target);
      const stride = tuning.shade_speed * dt;
      shade.state = refuge ? 'retreat' : 'chase';
      if (gap === 0 && refuge) {
        shade.pos[0] += stride;
      } else if (gap > 0) {
        const scale = refuge ? -stride / gap : Math.min(stride / gap, 1);
        moveShade(shade, (target[0] - shade.pos[0]) * scale, (target[2] - shade.pos[2]) * scale,
          safeZones, tuning.safe_radius);
      }
      if (!playerSafe && this.tick >= player.invulnerableUntil &&
          distance(shade.pos, player.pos) <= tuning.shade_hit_radius) {
        this.hitPlayer(emit);
        if (player.flames === 0) break;
      }
    }
  }

  hitPlayer(emit) {
    const { player, tuning } = this;
    const dropped = Math.floor(player.carried * tuning.hit_drop_ratio);
    player.carried -= dropped;
    player.flames--;
    player.invulnerableUntil = this.tick + Math.round(tuning.invuln_s * TICK_RATE);
    const [x, , z] = player.pos;
    for (let i = 0; i < dropped; i++) {
      const angle = i * 2 * Math.PI / dropped;
      const dropX = x + Math.cos(angle) * 1.8;
      const dropZ = z + Math.sin(angle) * 1.8;
      const scale = Math.max(1, Math.hypot(dropX, dropZ) / ISLAND_RADIUS);
      this.addMote([dropX / scale, 0, dropZ / scale]);
    }
    emit('player_hit', { by: 'shade', flames: player.flames, dropped });
  }

  step(input = DEFAULT_INPUT, previous = DEFAULT_INPUT) {
    if (this.state !== 'playing') return [];
    this.tick++;
    this.timeLeft = this.duration - this.tick / TICK_RATE;
    const events = [];
    const emit = (name, data) => events.push({ type: 'event', tick: this.tick, name, data });
    const pressed = (button) => input[button] && !previous[button];
    if (this.player.flames > 0 && !this.lanterns.every(({ lit }) => lit)) {
      this.updatePlayer(input, pressed);
      this.collectMotes(emit);
      if (pressed('interact')) this.deposit(emit);
      if (!this.lanterns.every(({ lit }) => lit)) {
        const safeZones = this.lanterns.filter(({ lit }) => lit);
        if (pressed('pulse')) this.pulse(safeZones, emit);
        if (this.randomShades && this.tick % SPAWN_INTERVAL === 0 && this.shades.length < 6) {
          const id = this.spawnShade();
          if (id !== undefined) emit('shade_spawned', { id });
        }
        this.updateShades(safeZones, emit);
      }
    }

    if (this.lanterns.every(({ lit }) => lit)) {
      this.state = 'won';
      this.score += Math.max(0, Math.floor(this.timeLeft)) * this.tuning.score.per_second_left +
        this.player.flames * this.tuning.score.per_flame_left;
      emit('game_over', { result: 'won', reason: 'all_lit' });
    } else if (this.player.flames === 0 || this.timeLeft <= 0) {
      this.state = 'lost';
      emit('game_over', { result: 'lost', reason: this.player.flames === 0 ? 'no_flames' : 'dawn' });
    }
    return events;
  }

  snapshot() {
    return {
      type: 'snapshot', tick: this.tick, sim_tick: this.tick, state: this.state,
      time_left_s: this.timeLeft, score: this.score,
      player: { pos: roundPosition(this.player.pos), flames: this.player.flames, carried: this.player.carried },
      lanterns: this.lanterns.map(({ id, pos, lit, deposited }) => ({ id, pos: roundPosition(pos), lit, deposited })),
      shades: this.shades.map(({ id, pos, state }) => ({ id, pos: roundPosition(pos), state })),
      motes_active: this.motes.length,
      motes: this.motes.map(({ id, pos }) => ({ id, pos: roundPosition(pos) }))
    };
  }
}
