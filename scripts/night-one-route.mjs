import { DEFAULT_INPUT, Game } from '../src/game.mjs';

const distance = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

// Produce ordinary contract inputs for a complete run of the same island as the web game.
export function nightOneRoute(tuning, seed) {
  const game = new Game(tuning, seed);
  const frames = [];
  let previous = DEFAULT_INPUT;
  let lantern;
  let mote;
  while (game.state === 'playing') {
    const { player, lanterns, motes, shades, tick } = game;
    if (!lantern || lantern.lit) {
      lantern = lanterns.find((candidate) => !candidate.lit);
      mote = undefined;
    }
    if (mote && !motes.includes(mote)) mote = undefined;
    const danger = shades.find((shade) => shade.state !== 'stunned' && distance(shade.pos, player.pos) < 3.4);
    const safe = lanterns.some((lamp) => lamp.lit && distance(player.pos, lamp.pos) < tuning.safe_radius);
    const needed = tuning.lantern_cost - lantern.deposited;
    const deposit = player.carried >= needed;
    if (!deposit && !mote) {
      const price = (candidate) => distance(candidate.pos, player.pos) + 0.45 * distance(candidate.pos, lantern.pos);
      mote = motes.reduce((best, candidate) => !best || price(candidate) < price(best) ? candidate : best, undefined);
    }
    const target = deposit ? lantern : mote;
    const gap = target ? distance(target.pos, player.pos) : 0;
    const interact = deposit && gap <= tuning.interact_radius && !previous.interact;
    const pulse = !safe && !interact && Boolean(danger) && player.carried >= tuning.pulse_cost &&
      tick + 1 >= player.pulseReadyAt && !previous.pulse;
    const movement = target && gap > 0 && !interact
      ? [target.pos[0] - player.pos[0], target.pos[2] - player.pos[2]]
      : [0, 0];
    const angle = Math.round(Math.atan2(movement[0], movement[1]) / (Math.PI / 4)) * (Math.PI / 4);
    const move = !movement.some(Boolean) ? [0, 0] : tick % 6 === 0 || !previous.move.some(Boolean)
      ? [Math.round(Math.sin(angle)), Math.round(Math.cos(angle))]
      : previous.move;
    const input = { ...DEFAULT_INPUT, move, interact, pulse };
    if (move[0] !== previous.move[0] || move[1] !== previous.move[1] ||
        interact !== previous.interact || pulse !== previous.pulse) {
      frames.push({ tick, move, interact, pulse });
    }
    game.step(input, previous);
    previous = input;
  }
  return { frames, result: { ticks: game.tick, state: game.state, score: game.score } };
}
