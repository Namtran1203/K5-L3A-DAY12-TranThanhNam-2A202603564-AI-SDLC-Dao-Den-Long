import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { cpus, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
if (args.length !== 0 && (args.length !== 2 || args[0] !== '--record' || !args[1])) {
  throw new Error('Dùng: npm run verify [-- --record <thư mục bằng chứng>]');
}
const repo = fileURLToPath(new URL('../', import.meta.url));
const { tuning } = JSON.parse(readFileSync(join(repo, 'game.contract.json'), 'utf8'));
const scratch = mkdtempSync(join(tmpdir(), 'dao-verify-'));
const saved = args.length ? resolve(args[1]) : null;
const seed = 2026;

function node(args) {
  const child = spawnSync(process.execPath, args, { cwd: repo, stdio: 'inherit' });
  if (child.error) throw child.error;
  assert.equal(child.status, 0, 'Lệnh kiểm chứng thất bại: ' + args.join(' '));
}

function sample(name, bytes) {
  const path = join(scratch, name);
  writeFileSync(path, bytes);
  if (saved) writeFileSync(join(saved, name), bytes);
  return path;
}

function run(night, ticks, every, args = []) {
  const out = join(scratch, 'output.jsonl');
  const started = performance.now();
  node(['src/headless.mjs', '--seed', String(seed), '--night', String(night), '--ticks', String(ticks),
    '--snapshot-every', String(every), '--out', out, ...args]);
  const duration = performance.now() - started;
  return { output: readFileSync(out), duration };
}

function records(output) {
  return output.toString('utf8').trimEnd().split('\n').map(JSON.parse);
}

try {
  if (saved) mkdirSync(saved, { recursive: true });
  node(['--test', '--test-reporter=spec']);

  const scenario = sample('oil-scenario.json', JSON.stringify({
    random_motes: false, random_shades: false, time_left_s: 1,
    player: { carried: 6 },
    lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true, fuel: 1 / 60 },
      { id: 'L2', lit: true }, { id: 'L3', lit: true },
      { id: 'L4', lit: true, fuel: 28 }],
    shades: [{ pos: [-14.7, 0, -20.2], state: 'drain', target_lantern_id: 'L4' }]
  }, null, 2) + '\n');
  const replay = sample('oil-inputs.json', JSON.stringify({ frames: [
    { tick: 0, interact: true }, { tick: 1, interact: false }, { tick: 2, interact: true }
  ] }, null, 2) + '\n');
  const options = ['--scenario', scenario, '--inputs', replay];
  const first = run(1, 60, 15, options);
  const second = run(1, 60, 15, options);
  assert.ok(first.output.equals(second.output), 'Hai lần chạy CLI phải giống từng byte');
  const nightOne = records(first.output);
  assert.equal(nightOne.at(-1).state, 'won');
  for (const name of ['lantern_out', 'lantern_lit', 'refuel', 'fuel_drain']) {
    assert.ok(nightOne.some((event) => event.name === name));
  }
  sample('oil-dawn.jsonl', first.output);

  const nightTwoScenario = sample('night-two-scenario.json', JSON.stringify({
    random_motes: false, random_shades: false, random_drifters: false,
    player: { pos: [35, 0, 0], carried: 9 },
    drifters: [{ pos: [35, 0.8, 0] }], shades: [{ pos: [35, 0, 0] }]
  }, null, 2) + '\n');
  const nightTwoInputs = sample('night-two-inputs.json', JSON.stringify({ frames: [
    { tick: 1, pulse: true }, { tick: 2, dash: true }, { tick: 3, dash: false },
    { tick: 7, pause: true }, { tick: 8, pause: false }, { tick: 14, pause: true }
  ] }, null, 2) + '\n');
  const nightTwo = run(2, 30, 5, ['--scenario', nightTwoScenario, '--inputs', nightTwoInputs]);
  const names = records(nightTwo.output).filter(({ type, name }) => type === 'event' && name !== 'mote_picked')
    .map(({ name }) => name);
  assert.deepEqual(names.slice(0, 9), ['night_start', 'charm_picked', 'drifter_steal', 'player_hit',
    'pulse', 'drifter_drop', 'dash', 'paused', 'resumed']);
  sample('night-two.jsonl', nightTwo.output);

  const endurance = sample('night-three-scenario.json', JSON.stringify({
    wind_enabled: false, player: { invuln_ticks: 18001 },
    lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }]
  }, null, 2) + '\n');
  const full = run(3, 18000, 10, ['--scenario', endurance]);
  const end = JSON.parse(full.output.toString('utf8').trimEnd().split('\n').at(-1));
  assert.equal(end.ticks, 18000);
  assert.ok(full.duration <= 30_000, 'Benchmark headless vượt 30 giây');
  const sha256 = createHash('sha256').update(first.output).digest('hex');
  const report = [
    'node --test --test-reporter=spec: tất cả kiểm thử đạt',
    'Scenario dầu và bình minh seed ' + seed + ': ' + JSON.stringify(nightOne.at(-1)),
    'Hai lượt headless sinh JSONL giống từng byte, SHA-256 ' + sha256,
    'Kịch bản Đêm 2: ' + names.slice(0, 9).join(', '),
    'Đêm 3 ' + end.ticks + ' tick, snapshot mỗi 10 tick: ' + full.duration.toFixed(1) + ' ms',
    process.platform + '/' + process.arch + ' · Node ' + process.version + ' · ' + cpus()[0].model.trim()
  ].join('\n') + '\n';
  process.stdout.write(report);
  if (saved) writeFileSync(join(saved, 'verify.txt'), report, 'utf8');
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
