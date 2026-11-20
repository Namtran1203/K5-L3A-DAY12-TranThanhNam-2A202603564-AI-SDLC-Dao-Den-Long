import { Game, seededRandom } from './game.mjs';
import { moveEnemies, updateSanctuaries } from './enemies.mjs';
import { direction } from './maps.mjs';

function points(count, radius, random) {
  // A sunflower lattice gives uniform density with a seed-specific rotation.
  const rotation = random() * 360;
  return Array.from({ length: count }, (_, i) => {
    const distance = radius * Math.sqrt((i + 0.5) / count);
    const [x, z] = direction(rotation + i * 137.507764);
    return [x * distance, 0, z * distance];
  });
}

export function benchmarkScene(tuning, seed) {
  const random = seededRandom(seed);
  const shades = points(200, 38, random).map((pos) => ({ pos, state: 'wander' }));
  const motes = points(100, 39, random);
  const lanterns = ['L1', 'L2', 'L3'].map((id) => ({ id, lit: true, fuel: tuning.fuel_max }));
  const game = new Game(tuning, seed, { shades, motes, lanterns });
  updateSanctuaries(game);
  return game;
}

export function stepBenchmark(game) {
  game.simTick++;
  updateSanctuaries(game);
  moveEnemies(game, true);
}
