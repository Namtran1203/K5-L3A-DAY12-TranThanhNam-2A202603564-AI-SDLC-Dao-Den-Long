import { DEFAULT_INPUT, Game } from '../src/game.mjs';
import { direction, xz } from '../src/maps.mjs';

const headings = Array.from({ length: 24 }, (_, i) => direction(i * 15));
const progress = (point, target) => xz(point, target);

function dangerAt(point, game, time) {
  if (game.safeZones.some((lamp) => xz(point, lamp.pos) < game.tuning.safe_radius - 0.25)) return 0;
  let risk = 0;
  for (const shade of game.shades) {
    const remaining = shade.state === 'stunned' || shade.state === 'recoil' ? (shade.stateUntil - game.simTick) / 60 : 0;
    const margin = xz(shade.pos, point) - Math.max(0, time - remaining) * game.tuning.shade_speed;
    risk += Math.max(0, 3.8 - margin) ** 2;
  }
  return risk;
}

function steer(game, goal, last) {
  const pos = game.player.pos;
  const initial = progress(pos, goal);
  const options = [...headings, [0, 0]];
  let best = -Infinity;
  let heading = options[0];
  for (const [x, z] of options) {
    const step = Math.min(4.2, Math.max(0.9, initial));
    const middle = [pos[0] + x * step * 0.5, 0, pos[2] + z * step * 0.5];
    const end = [pos[0] + x * step, 0, pos[2] + z * step];
    const risk = dangerAt(middle, game, step / 12) + dangerAt(end, game, step / 6);
    const land = Math.max(0, Math.hypot(end[0], end[2]) - 39);
    const cost = initial - progress(end, goal) - 1.3 * risk - 6 * land + 0.12 * (last[0] * x + last[1] * z);
    if (cost > best) [best, heading] = [cost, [x, z]];
  }
  const [x, z] = heading;
  return { heading, yaw: Math.atan2(x, z) * 180 / Math.PI, moving: Boolean(x || z) };
}

// Generate ordinary replay inputs using only the standard controls and map.
export function nightOneRoute(tuning, seed) {
  const game = new Game(tuning, seed);
  const frames = [];
  let previous = DEFAULT_INPUT;
  let last = [0, 0];
  let plan;
  let mote;
  while (game.state === 'playing') {
    const { player, lanterns, motes, shades, tick } = game;
    const lamps = lanterns.filter(({ lit }) => !lit);
    const lamp = lamps.reduce((best, candidate) =>
      !best || xz(candidate.pos, player.pos) - candidate.deposited * 2 <
      xz(best.pos, player.pos) - best.deposited * 2 ? candidate : best, undefined);
    const ready = game.nearestLantern();
    const deposit = player.carried > 0 && Boolean(ready) && !previous.interact;
    const danger = shades.some((shade) =>
      (shade.state === 'chase' || shade.state === 'wander') && xz(shade.pos, player.pos) < 2.7);
    const inSafety = game.safeZones.some((zone) => xz(zone.pos, player.pos) < tuning.safe_radius);
    const pulse = !inSafety && !deposit && danger && player.carried >= tuning.pulse_cost &&
      tick + 1 >= player.pulseReadyAt && !previous.pulse;
    const dash = danger && !inSafety && !deposit && !pulse && tick + 1 >= player.dashReadyAt && !previous.dash;
    if (!plan || tick % 6 === 0 || Boolean(deposit) || dash) {
      if (mote && (!motes.includes(mote) || dangerAt(mote.pos, game, 0.15) > 18)) mote = undefined;
      if (!mote) {
        const price = (candidate) => xz(candidate.pos, player.pos) + 0.33 * xz(candidate.pos, lamp.pos) +
          1.8 * dangerAt(candidate.pos, game, Math.min(1, xz(candidate.pos, player.pos) / 6));
        mote = motes.reduce((best, candidate) => !best || price(candidate) < price(best) ? candidate : best, undefined);
      }
      const needs = tuning.lantern_cost - lamp.deposited;
      const goal = (player.carried >= needs || !mote) ? lamp.pos : mote.pos;
      plan = deposit ? { heading: [0, 0], yaw: previous.cam_yaw_deg, moving: false } : steer(game, goal, last);
      last = plan.heading;
    }
    const input = { ...DEFAULT_INPUT, move: [0, Number(plan.moving)], cam_yaw_deg: plan.yaw, interact: deposit, pulse, dash };
    if (input.move[1] !== previous.move[1] || input.cam_yaw_deg !== previous.cam_yaw_deg ||
        deposit !== previous.interact || pulse !== previous.pulse || dash !== previous.dash) {
      frames.push({ tick, move: input.move, cam_yaw_deg: input.cam_yaw_deg, interact: deposit, pulse, dash });
    }
    game.step(input, previous);
    previous = input;
  }
  return { frames, result: { ticks: game.tick, state: game.state, score: game.score } };
}
