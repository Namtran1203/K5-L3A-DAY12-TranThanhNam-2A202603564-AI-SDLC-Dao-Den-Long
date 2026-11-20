import { closeSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { DEFAULT_INPUT, Game } from './game.mjs';
import { InputFormatError, validateInputs, validateScenario } from './validation.mjs';

const names = ['seed', 'night', 'ticks', 'out', 'scenario', 'inputs', 'snapshot-every'];

function integer(value, name, minimum = Number.MIN_SAFE_INTEGER) {
  const result = Number(value);
  if (!/^-?\d+$/.test(value ?? '') || !Number.isSafeInteger(result) || result < minimum) {
    throw new Error(`--${name} cần số nguyên hợp lệ`);
  }
  return result;
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    throw new InputFormatError(`${file}: ${error.message}`);
  }
}

function run() {
  const options = Object.fromEntries(names.map((name) => [name, { type: 'string' }]));
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length - 1; i++) {
    if (/^--(?:seed|night|ticks|snapshot-every)$/.test(args[i]) && /^-\d+$/.test(args[i + 1])) {
      args.splice(i, 2, args[i] + '=' + args[i + 1]);
    }
  }
  const { values } = parseArgs({ options, args });
  const seed = integer(values.seed, 'seed');
  const night = integer(values.night, 'night', 1);
  if (night > 3) throw new Error('--night cần là 1, 2 hoặc 3');
  const ticks = integer(values.ticks, 'ticks', 0);
  const every = integer(values['snapshot-every'] ?? '10', 'snapshot-every', 1);
  if (!values.out) throw new Error('Thiếu --out');

  const { tuning } = JSON.parse(readFileSync(new URL('../game.contract.json', import.meta.url), 'utf8'));
  const scenario = values.scenario === undefined ? {} : readJson(values.scenario);
  const inputs = values.inputs === undefined ? { frames: [] } : readJson(values.inputs);
  validateScenario(scenario, tuning, night);
  validateInputs(inputs);
  const game = new Game(tuning, seed, scenario, night);
  const output = openSync(values.out, 'w');
  let buffer = '';
  function write(record) {
    buffer += JSON.stringify(record) + '\n';
    if (buffer.length >= 65_536) {
      writeFileSync(output, buffer);
      buffer = '';
    }
  }
  try {
    let input = DEFAULT_INPUT;
    let index = 0;
    write(game.snapshot());
    write({ type: 'event', tick: 0, name: 'night_start', data: { night } });
    while (game.tick < ticks && (game.state === 'playing' || game.state === 'paused')) {
      const previous = input;
      const frame = inputs.frames[index];
      if (frame?.tick === game.tick) {
        input = { ...input, ...frame };
        index++;
      }
      for (const event of game.step(input, previous)) {
        if (event.name !== 'jump') write(event);
      }
      if (game.tick % every === 0) write(game.snapshot());
    }
    write({ type: 'end', ticks: game.tick, state: game.state, score: game.score });
    if (buffer) writeFileSync(output, buffer);
  } finally {
    closeSync(output);
  }
}

try {
  run();
} catch (error) {
  console.error(error.message);
  process.exitCode = error instanceof InputFormatError ? 2 : 1;
}
