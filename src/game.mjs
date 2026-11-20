import { advanceEnemyTimers, applyPulse, contactEnemies, moveEnemies, updateSanctuaries } from './enemies.mjs';
import { EPSILON, MAPS, xz } from './maps.mjs';
import { CHARM_RESPAWN, CHARM_TICKS, TICK_RATE, fallOrRespawn, makePlayer, touches, updatePlayer } from './player.mjs';

export { TICK_RATE };
export const DEFAULT_INPUT = Object.freeze({
  move: Object.freeze([0, 0]), cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false
});

const MOTE_TTL = 480;
const MOTE_INTERVAL = 240;
const DRIFTER_INTERVAL = 1200;
const SHADE_FIRST = 300;
const WIND_INTERVAL = 1800;
const WIND_WARNING_TICKS = 120;
const WIND_ACTIVE_TICKS = 300;
const roundVector = (values) => values.map((value) => Math.round(value * 1000) / 1000);
const secondsLeft = (deadline, tick) => Math.max(0, deadline - tick) / TICK_RATE;

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function idSource(items, prefix) {
  const ids = new Set(items?.flatMap(({ id }) => id === undefined ? [] : [id]));
  let counter = 1;
  return (explicit) => {
    if (explicit !== undefined) return explicit;
    while (ids.has(prefix + counter)) counter++;
    return prefix + counter++;
  };
}

export class Game {
  constructor(tuning, seed, scenario = {}, night = 1) {
    this.tuning = tuning;
    this.random = seededRandom(seed);
    this.night = night;
    this.map = MAPS[night];
    this.tick = 0;
    this.simTick = 0;
    this.state = 'playing';
    this.score = 0;
    this.duration = scenario.time_left_s ?? tuning['night' + night + '_duration_s'];
    this.timeLeft = this.duration;
    this.player = makePlayer(night, tuning, scenario.player);
    this.lanterns = this.map.lanterns.map((pos, index) => {
      const id = 'L' + (index + 1);
      const update = scenario.lanterns?.find((item) => item.id === id);
      const deposited = update?.deposited ?? (update?.lit ? tuning.lantern_cost : 0);
      return { id, pos: [...(update?.pos ?? pos)], deposited, lit: update?.lit ?? (deposited === tuning.lantern_cost) };
    });
    this.safeZones = [];
    this.newMoteId = idSource([], 'M');
    this.newShadeId = idSource(scenario.shades, 'S');
    this.newDrifterId = idSource(scenario.drifters, 'D');
    this.randomMotes = scenario.random_motes ?? true;
    this.randomShades = scenario.random_shades ?? true;
    this.randomDrifters = scenario.random_drifters ?? true;
    this.windEnabled = night === 3 && (scenario.wind_enabled ?? true);
    this.wind = { active: false, dir_deg: 0, warning: false };
    this.motes = [];
    if (scenario.motes) {
      for (const pos of scenario.motes) this.addMote(pos);
    } else if (this.randomMotes) {
      const available = this.map.motes.slice();
      for (let i = 0; i < 20; i++) {
        const [pos] = available.splice(Math.floor(this.random() * available.length), 1);
        this.addMote(pos);
      }
    }
    this.shades = (scenario.shades ?? []).map((item) => this.makeShade(item));
    this.drifters = (scenario.drifters ?? []).map((item) => this.makeDrifter(item));
    const charms = scenario.charms ?? this.map.charms.map((pos) => ({ pos }));
    const newCharmId = idSource(charms, 'C');
    this.charms = charms.map(({ id, pos, available, respawn_ticks }) => {
      const ready = available ?? !(respawn_ticks > 0);
      return { id: newCharmId(id), pos: [...pos], available: ready, respawnAt: ready ? 0 : respawn_ticks ?? CHARM_RESPAWN };
    });
  }

  makeShade({ id, pos, state = 'chase', state_ticks_left }) {
    return {
      id: this.newShadeId(id), pos: [...pos], state,
      stateUntil: this.simTick + (state_ticks_left ?? { spawning: 1, recoil: 60, stunned: 120 }[state] ?? 0),
      heading: this.random() * 360, pushUntil: 0, push: [0, 0], evacuation: null
    };
  }

  makeDrifter({ id, pos, state = 'idle', state_ticks_left, stolen = 0 }) {
    return { id: this.newDrifterId(id), pos: [...pos], state, stolen,
      stateUntil: this.simTick + (state_ticks_left ?? 240), heading: this.random() * 360 };
  }

  addMote(pos, kind = 'random', expires = Infinity) {
    this.motes.push({ id: this.newMoteId(), pos: [...pos], kind, expires });
  }

  dropMote(pos) {
    this.addMote(pos, 'dropped', this.simTick + MOTE_TTL);
  }

  nearestLantern() {
    let best;
    let distance = Infinity;
    // Lanterns are in id order, so the first one wins a distance tie.
    for (const lantern of this.lanterns) {
      if (lantern.lit || !touches(lantern.pos, this.player.pos, this.tuning.interact_radius, 1.5)) continue;
      const gap = xz(lantern.pos, this.player.pos);
      if (gap < distance - EPSILON) {
        best = lantern;
        distance = gap;
      }
    }
    return best;
  }

  collect(emit) {
    const { player, tuning } = this;
    this.motes = this.motes.filter(({ pos }) => {
      if (player.carried >= tuning.carry_capacity || !touches(player.pos, pos, tuning.pickup_radius, tuning.pickup_height)) return true;
      emit('mote_picked', { carried: ++player.carried });
      return false;
    });
    for (const charm of this.charms) {
      if (!charm.available || !touches(player.pos, charm.pos, tuning.pickup_radius, tuning.pickup_height)) continue;
      charm.available = false;
      charm.respawnAt = this.simTick + CHARM_RESPAWN;
      player.windCharmUntil = this.simTick + CHARM_TICKS;
      emit('charm_picked', { charm_id: charm.id, charm_ticks: CHARM_TICKS });
    }
  }

  deposit(emit) {
    const { player, tuning } = this;
    const lantern = this.nearestLantern();
    if (!lantern || player.carried === 0) return;
    const amount = Math.min(player.carried, tuning.lantern_cost - lantern.deposited);
    player.carried -= amount;
    lantern.deposited += amount;
    this.score += amount * tuning.score.per_mote;
    if (amount > 0) emit('deposit', { lantern_id: lantern.id, amount, deposited: lantern.deposited });
    if (lantern.deposited === tuning.lantern_cost) {
      lantern.lit = true;
      this.score += tuning.score.per_lantern;
      emit('lantern_lit', { lantern_id: lantern.id });
    }
  }

  countDown() {
    this.timeLeft = this.duration - this.simTick / TICK_RATE;
    advanceEnemyTimers(this);
    for (const charm of this.charms) {
      if (!charm.available && this.simTick >= charm.respawnAt) charm.available = true;
    }
    if (this.motes.some(({ expires }) => expires <= this.simTick)) {
      this.motes = this.motes.filter(({ expires }) => expires > this.simTick);
    }
    if (this.windEnabled) {
      const cycle = this.simTick % WIND_INTERVAL;
      this.wind.warning = cycle >= WIND_INTERVAL - WIND_WARNING_TICKS;
      if (cycle === WIND_INTERVAL - WIND_WARNING_TICKS) this.wind.dir_deg = Math.floor(this.random() * 360);
      this.wind.active = this.simTick >= WIND_INTERVAL && cycle < WIND_ACTIVE_TICKS;
    }
  }

  pick(items) {
    return items.length ? items[Math.floor(this.random() * items.length)] : undefined;
  }

  spawn(emit) {
    const { simTick: tick, map } = this;
    if (this.randomMotes && tick % MOTE_INTERVAL === 0 && this.motes.length < 30) {
      const pos = this.pick(map.motes.filter((pos) => !this.motes.some((mote) => touches(pos, mote.pos, EPSILON, EPSILON))));
      if (pos) this.addMote(pos);
    }
    if (this.randomShades && tick >= SHADE_FIRST && (tick - SHADE_FIRST) % map.shadeInterval === 0) {
      const amount = tick === SHADE_FIRST ? 2 : 1;
      for (let i = 0; i < amount && this.shades.length < map.shadeLimit; i++) {
        const pos = this.pick(map.shades.filter((pos) =>
          xz(pos, this.player.pos) >= 15 - EPSILON &&
          !this.shades.some((shade) => xz(pos, shade.pos) <= 1) &&
          !this.safeZones.some((lamp) => xz(pos, lamp.pos) <= this.tuning.safe_radius)));
        if (!pos) break;
        const shade = this.makeShade({ pos, state: 'spawning' });
        this.shades.push(shade);
        emit('shade_spawned', { id: shade.id });
      }
    }
    if (this.randomDrifters && this.night > 1 && tick % DRIFTER_INTERVAL === 0 && this.drifters.length < 2) {
      const point = this.pick(map.shades.filter((pos) => !this.drifters.some((item) => xz(pos, item.pos) < 1)));
      if (point) this.drifters.push(this.makeDrifter({ pos: [point[0], point[1] + 0.8, point[2]] }));
    }
  }

  finish(emit) {
    let reason;
    if (this.player.flames === 0) [this.state, reason] = ['lost', 'no_flames'];
    else if (this.lanterns.every(({ lit }) => lit)) {
      [this.state, reason] = ['won', 'all_lit'];
      this.score += Math.max(0, Math.floor(this.timeLeft)) * this.tuning.score.per_second_left +
        this.player.flames * this.tuning.score.per_flame_left;
    } else if (this.timeLeft <= EPSILON) [this.state, reason] = ['lost', 'dawn'];
    if (reason) emit('game_over', { result: this.state, reason });
  }

  step(input = DEFAULT_INPUT, previous = DEFAULT_INPUT) {
    if (this.state === 'won' || this.state === 'lost') return [];
    this.tick++;
    const events = [];
    const emit = (name, data) => events.push({ type: 'event', tick: this.tick, name, data });
    const pressed = (button) => input[button] && !previous[button];
    if (pressed('pause')) {
      this.state = this.state === 'paused' ? 'playing' : 'paused';
      emit(this.state === 'paused' ? 'paused' : 'resumed', {});
    }
    if (this.state === 'paused') return events;
    this.simTick++;
    this.countDown();
    const { player } = this;
    if (!player.respawnAt && player.flames > 0) updatePlayer(this, input, pressed, emit);
    const falling = player.flames === 0 || fallOrRespawn(this, emit);
    if (!falling) {
      this.collect(emit);
      if (pressed('interact')) this.deposit(emit);
    }
    updateSanctuaries(this);
    if (!falling && pressed('pulse')) applyPulse(this, emit);
    moveEnemies(this);
    if (!falling) contactEnemies(this, emit);
    this.spawn(emit);
    this.finish(emit);
    return events;
  }

  snapshot() {
    const time = this.simTick;
    const { player } = this;
    return {
      type: 'snapshot', tick: this.tick, sim_tick: time, night: this.night,
      state: this.state, time_left_s: this.timeLeft, score: this.score,
      wind: { active: this.wind.active, dir_deg: this.wind.dir_deg },
      player: {
        pos: roundVector(player.pos), vel: roundVector(player.vel), grounded: player.grounded,
        flames: player.flames, carried: player.carried, invuln: time < player.invulnerableUntil,
        dash_cd_s: time < player.windCharmUntil ? 0 : secondsLeft(player.dashReadyAt, time),
        pulse_cd_s: secondsLeft(player.pulseReadyAt, time), charm_s: secondsLeft(player.windCharmUntil, time)
      },
      lanterns: this.lanterns.map(({ id, pos, lit, deposited }) => ({ id, pos: roundVector(pos), lit, deposited })),
      shades: this.shades.map(({ id, pos, state }) => ({ id, pos: roundVector(pos), state })),
      drifters: this.drifters.map(({ id, pos, state, stolen }) => ({ id, pos: roundVector(pos), state, stolen })),
      charms: this.charms.map(({ id, available, respawnAt }) => ({ id, available, respawn_s: secondsLeft(respawnAt, time) })),
      motes_active: this.motes.length,
      motes: this.motes.map(({ id, pos, kind, expires }) => ({
        id, pos: roundVector(pos), kind, ttl_s: kind === 'dropped' ? secondsLeft(expires, time) : null
      }))
    };
  }
}
