import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { nightOneRoute } from '../scripts/night-one-route.mjs';

const cli = fileURLToPath(new URL('../src/headless.mjs', import.meta.url));
const { tuning } = JSON.parse(readFileSync(new URL('../game.contract.json', import.meta.url), 'utf8'));
const empty = { random_motes: false, random_shades: false };
const execute = (ticks, { scenario, frames, every = 1, seed = -12 } = {}) => {
  const directory = mkdtempSync(join(tmpdir(), 'dao-contract-'));
  const out = join(directory, 'out.jsonl');
  const args = [cli, '--seed', String(seed), '--night', '1', '--ticks', String(ticks), '--out', out];
  if (every !== null) args.push('--snapshot-every', String(every));
  for (const [name, data] of Object.entries({ scenario, inputs: frames === undefined ? undefined : { frames } })) {
    if (data === undefined) continue;
    const path = join(directory, name + '.json');
    writeFileSync(path, JSON.stringify(data));
    args.push('--' + name, path);
  }
  try {
    const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
    if (result.error) throw result.error;
    if (result.status !== 0) return { status: result.status, stderr: result.stderr };
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, '');
    const bytes = readFileSync(out, 'utf8');
    return { status: result.status, bytes, records: bytes.trimEnd().split('\n').map(JSON.parse) };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};
function recordsFor(result, type) {
  assert.equal(result.status, 0, result.stderr);
  return result.records.filter((item) => item.type === type);
}
const events = (result, name) => recordsFor(result, 'event').filter((item) => name === undefined || item.name === name);
const snapshots = (result) => recordsFor(result, 'snapshot');
const snapshot = (result, tick) => snapshots(result).find((record) => record.tick === tick);

test('tick 0, mặc định snapshot-every 10, số bước và đồng hồ', () => {
  const result = execute(23, { scenario: empty, every: null });
  assert.deepEqual(snapshots(result).map(({ tick }) => tick), [0, 10, 20]);
  assert.equal(snapshot(result, 0).lanterns.length, tuning.lantern_count_night1);
  assert.deepEqual(snapshot(result, 0).player.pos, [0, 0, 0]);
  assert.equal(snapshot(result, 20).sim_tick, 20);
  assert.equal(snapshot(result, 20).time_left_s, tuning.night1_duration_s - 20 / 60);
  assert.deepEqual(result.records.at(-1), { type: 'end', ticks: 23, state: 'playing', score: 0 });
  assert.equal(execute(0).records.length, 2);
});

test('giữ input vắng mặt, xoay yaw, chuẩn hóa và nhảy cạnh lên', () => {
  const result = execute(74, { scenario: empty, frames: [
    { tick: 0, move: [1, 1], cam_yaw_deg: 90, jump: true },
    { tick: 30, move: [0, 0] },
    { tick: 65, jump: false },
    { tick: 70, jump: true }
  ] });
  assert.deepEqual(snapshot(result, 30).player.pos.map((n, i) => i === 1 ? 0 : n), [2.121, 0, -2.121]);
  assert.ok(snapshot(result, 1).player.pos[1] > 0);
  assert.equal(snapshot(result, 65).player.pos[1], 0);
  assert.ok(snapshot(result, 71).player.pos[1] > 0);
});

test('nhặt theo XZ và bán kính bao gồm biên, giới hạn sức chứa, giữ E chỉ nạp một lần', () => {
  const motes = Array.from({ length: 14 }, () => [tuning.pickup_radius, 20, 0]);
  const result = execute(3, { scenario: { ...empty, motes }, frames: [{ tick: 0, interact: true }] });
  assert.equal(snapshot(result, 0).score, 0);
  assert.equal(events(result, 'mote_picked').length, 14);
  assert.equal(events(result, 'deposit').length, 1);
  assert.deepEqual(events(result, 'deposit')[0].data, { lantern_id: 'L1', amount: 6, deposited: 6 });
  assert.equal(snapshot(result, 3).player.carried, 8);
});

test('scenario ghi đè đúng id, nạp một phần, thắp đèn cuối và tính thưởng', () => {
  const result = execute(50, { scenario: {
    ...empty, time_left_s: 30, player: { carried: 4 },
    lanterns: [{ id: 'L1', pos: [0, 0, 2.5], deposited: 2 },
      ...[2, 3, 4, 5].map((n) => ({ id: 'L' + n, lit: true }))]
  }, frames: [{ tick: 0, interact: true }] });
  const expected = tuning.score.per_lantern + 29 * tuning.score.per_second_left + 3 * tuning.score.per_flame_left;
  assert.equal(snapshot(result, 0).score, 0);
  assert.deepEqual(events(result).map(({ name, tick }) => [name, tick]),
    [['deposit', 1], ['lantern_lit', 1], ['game_over', 1]]);
  assert.deepEqual(events(result, 'game_over')[0].data, { result: 'won', reason: 'all_lit' });
  assert.deepEqual(result.records.at(-1), { type: 'end', ticks: 1, state: 'won', score: expected });
});

test('tỏa sáng đúng biên, đẩy lùi, thời gian choáng và hồi chiêu', () => {
  const result = execute(215, { scenario: { ...empty, player: { carried: 6 }, shades: [
    { id: 'edge', pos: [6, 1, 0] }, { id: 'outside', pos: [0, 0, 9] }
  ] }, frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false },
    { tick: 2, pulse: true }, { tick: 59, pulse: false }, { tick: 60, pulse: true }] });
  assert.deepEqual(events(result, 'pulse').map(({ tick }) => tick), [1, 61]);
  assert.deepEqual(events(result, 'pulse')[0].data, { stunned_ids: ['edge'] });
  assert.deepEqual(snapshot(result, 1).shades[0], { id: 'edge', pos: [8, 1, 0], state: 'stunned' });
  assert.equal(snapshot(result, 150).shades[0].state, 'stunned');
  assert.equal(snapshot(result, 151).shades[0].state, 'chase');
  assert.equal(snapshot(result, 61).player.carried, 2);
});

test('Bóng Mực đuổi, va chạm rơi đom đóm, bất tử tạm thời và thua khi hết lửa', () => {
  const result = execute(400, { scenario: { ...empty, player: { carried: 7 }, shades: [{ pos: [0, 0, 0] }] } });
  assert.equal(events(result, 'player_hit')[0].data.dropped, 2);
  assert.equal(snapshot(result, 1).motes_active, 2);
  assert.deepEqual(events(result, 'player_hit').map(({ tick }) => tick), [1, 76, 151]);
  assert.deepEqual(events(result, 'game_over')[0].data, { result: 'lost', reason: 'no_flames' });
  assert.equal(result.records.at(-1).ticks, 151);
});

test('đèn sáng chặn Bóng Mực và bình minh kết thúc sớm', () => {
  const result = execute(1000, { scenario: {
    ...empty, time_left_s: 3, lanterns: [{ id: 'L1', lit: true }], shades: [{ pos: [5, 2, 0] }]
  }, every: 10 });
  assert.equal(snapshot(result, 180).shades[0].pos[0], tuning.safe_radius);
  assert.equal(events(result, 'player_hit').length, 0);
  assert.deepEqual(events(result, 'game_over')[0].data, { result: 'lost', reason: 'dawn' });
  assert.equal(result.records.at(-1).ticks, 180);
});

test('scenario thay danh sách, id không đụng, seed phát lại giống từng byte', () => {
  const options = { every: 250, scenario: {
    lanterns: [{ id: 'L1', lit: true }],
    motes: [], shades: [{ pos: [13, 0, 0] }, { id: 'S1', pos: [-13, 0, 0] }]
  } };
  const first = execute(2250, options);
  assert.equal(first.bytes, execute(2250, options).bytes);
  assert.deepEqual(snapshot(first, 0).shades.map(({ id }) => id), ['S2', 'S1']);
  assert.equal(snapshot(first, 0).motes_active, 0);
  assert.deepEqual(events(first, 'shade_spawned')[0].data, { id: 'S3' });
});

test('file input hoặc scenario sai trả mã 2 và giải thích trên stderr', () => {
  for (const options of [
    { frames: [{ tick: 0 }, { tick: 0 }] },
    { frames: [{ tick: 3 }, { tick: 2 }] },
    { frames: [{ tick: 0, move: [0, 1.1] }] },
    { frames: [{ tick: 0, jump: 'true' }] },
    { scenario: { shades: [{ id: 'no-position' }] } },
    { scenario: { player: { pos: [1, 2] } } },
    { scenario: { lanterns: [{ id: 'L6' }] } }
  ]) {
    const result = execute(1, options);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /không hợp lệ/);
  }
});

test('màn mặc định seed 2026 thắng từ đầu bằng input thường và thắp đủ 5 đèn', () => {
  const seed = 2026;
  const { frames } = nightOneRoute(tuning, seed);
  const replay = execute(18000, { seed, frames, every: 600 });
  assert.deepEqual(events(replay, 'lantern_lit').map(({ data }) => data.lantern_id), ['L1', 'L2', 'L3', 'L4', 'L5']);
  assert.ok(events(replay, 'mote_picked').length >= tuning.lantern_count_night1 * tuning.lantern_cost);
  assert.ok(events(replay, 'pulse').some(({ data }) => data.stunned_ids.length > 0));
  assert.equal(replay.records.at(-1).state, 'won');
});
