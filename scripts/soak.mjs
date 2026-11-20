import { writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { DEFAULT_INPUT, Game, seededRandom, TICK_RATE } from '../src/game.mjs';

try {
  const { values } = parseArgs({ options: { seed: { type: 'string' }, nights: { type: 'string' }, out: { type: 'string' } } });
  const seed = Number(values.seed);
  const nights = Number(values.nights);
  if (!Number.isSafeInteger(seed) || !Number.isSafeInteger(nights) || nights < 1 || !values.out) {
    throw new Error('Dùng --seed <int> --nights <int> --out <file.json>');
  }
  const { tuning } = JSON.parse(readFileSync(new URL('../game.contract.json', import.meta.url), 'utf8'));
  const rss = () => {
    globalThis.gc?.();
    return Number((process.memoryUsage.rss() / 1024 ** 2).toFixed(2));
  };
  const started = performance.now();
  let game = new Game(tuning, seed);
  const mem_start_mb = rss();
  const results = [];
  let crashes = 0;
  for (let i = 0; i < nights; i++) {
    const random = seededRandom(seed + i);
    let previous = DEFAULT_INPUT;
    let move = [0, 0];
    try {
      while (game.state === 'playing' && game.simTick < game.duration * TICK_RATE) {
        if (game.simTick % 30 === 0) {
          const angle = random() * Math.PI * 2;
          move = [Math.sin(angle), Math.cos(angle)];
        }
        const input = { ...DEFAULT_INPUT, move, jump: random() < 0.05, dash: random() < 0.03,
          pulse: random() < 0.02, interact: random() < 0.10 };
        game.step(input, previous);
        previous = input;
      }
      results.push(game.state);
    } catch (error) {
      crashes++;
      results.push('crashed');
      console.error(error.message);
    }
    game = new Game(tuning, seed + i + 1, {}, (i + 1) % 3 + 1);
  }
  const mem_end_mb = rss();
  const duration_s = Number(((performance.now() - started) / 1000).toFixed(3));
  const result = { nights, crashes, results, mem_start_mb, mem_end_mb, duration_s };
  writeFileSync(values.out, JSON.stringify(result, null, 2) + '\n');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
