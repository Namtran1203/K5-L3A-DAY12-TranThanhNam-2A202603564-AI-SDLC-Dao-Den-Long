import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const cli = fileURLToPath(new URL('../src/headless.mjs', import.meta.url));
const { tuning } = JSON.parse(readFileSync(new URL('../game.contract.json', import.meta.url), 'utf8'));
const empty = { random_motes: false, random_shades: false, random_drifters: false };
const execute = (ticks, { scenario, frames, every = 1, seed = -12, night = 1 } = {}) => {
  const directory = mkdtempSync(join(tmpdir(), 'dao-contract-'));
  const out = join(directory, 'out.jsonl');
  const args = [cli, '--seed', String(seed), '--night', String(night), '--ticks', String(ticks), '--out', out];
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
  assert.deepEqual(execute(0).records[1], { type: 'event', tick: 0, name: 'night_start', data: { night: 1 } });
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

test('nhặt đúng bán kính và độ cao, giới hạn sức chứa, giữ E chỉ nạp một lần', () => {
  const motes = [...Array.from({ length: 14 }, () => [tuning.pickup_radius, 1.5, 0]), [0, 1.51, 0]];
  const result = execute(3, { scenario: { ...empty, motes, lanterns: [{ id: 'L1', pos: [0, 0, 0] }] },
    frames: [{ tick: 0, interact: true }] });
  assert.equal(snapshot(result, 0).score, 0);
  assert.equal(events(result, 'mote_picked').length, 14);
  assert.equal(events(result, 'deposit').length, 1);
  assert.deepEqual(events(result, 'deposit')[0].data, { lantern_id: 'L1', amount: 10, deposited: 10 });
  assert.equal(snapshot(result, 3).player.carried, 4);
  assert.equal(snapshot(result, 3).motes_active, 1);
  assert.equal(snapshot(result, 3).score, 200);
});

test('scenario ghi đè đúng id, nạp một phần, thắp đèn cuối và tính thưởng', () => {
  const result = execute(50, { scenario: {
    ...empty, time_left_s: 30, player: { carried: 8 },
    lanterns: [{ id: 'L1', pos: [0, 0, 2], deposited: 2 },
      ...[2, 3, 4, 5].map((n) => ({ id: 'L' + n, lit: true }))]
  }, frames: [{ tick: 0, interact: true }] });
  const expected = 80 + tuning.score.per_lantern + 29 * tuning.score.per_second_left + 3 * tuning.score.per_flame_left;
  assert.equal(snapshot(result, 0).score, 0);
  assert.deepEqual(events(result).map(({ name, tick }) => [name, tick]),
    [['night_start', 0], ['deposit', 1], ['lantern_lit', 1], ['game_over', 1]]);
  assert.deepEqual(events(result, 'game_over')[0].data, { result: 'won', reason: 'all_lit' });
  assert.deepEqual(result.records.at(-1), { type: 'end', ticks: 1, state: 'won', score: expected });
});

test('tỏa sáng đúng biên, đẩy lùi, thời gian choáng và hồi chiêu', () => {
  const result = execute(185, { scenario: { ...empty, player: { carried: 6 }, shades: [
    { id: 'edge', pos: [5, 0.8, 0] }, { id: 'outside', pos: [0, 6, 3] }
  ] }, frames: [{ tick: 0, pulse: true }, { tick: 1, pulse: false },
    { tick: 2, pulse: true }, { tick: 179, pulse: false }, { tick: 180, pulse: true }] });
  assert.deepEqual(events(result, 'pulse').map(({ tick }) => tick), [1, 181]);
  assert.deepEqual(events(result, 'pulse')[0].data, { stunned_ids: ['edge'] });
  assert.deepEqual(snapshot(result, 15).shades[0], { id: 'edge', pos: [9, 0.8, 0], state: 'stunned' });
  assert.equal(snapshot(result, 120).shades[0].state, 'stunned');
  assert.equal(snapshot(result, 121).shades[0].state, 'chase');
  assert.equal(snapshot(result, 181).player.carried, 0);
});

test('Bóng Mực đuổi, va chạm rơi đom đóm, bất tử tạm thời và thua khi hết lửa', () => {
  const result = execute(400, { scenario: { ...empty, player: { carried: 7 }, shades: [{ pos: [0, 0, 0] }] } });
  assert.equal(events(result, 'player_hit')[0].data.dropped, 3);
  assert.equal(snapshot(result, 1).motes_active, 3);
  assert.equal(snapshot(result, 60).shades[0].state, 'recoil');
  assert.deepEqual(events(result, 'player_hit').map(({ tick }) => tick), [1, 91, 181]);
  assert.deepEqual(events(result, 'game_over')[0].data, { result: 'lost', reason: 'no_flames' });
  assert.equal(result.records.at(-1).ticks, 181);
});

test('đèn sáng chặn Bóng Mực và bình minh kết thúc sớm', () => {
  const result = execute(1000, { scenario: {
    ...empty, time_left_s: 3, lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }],
    shades: [{ pos: [7, 0, 0] }]
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
  assert.equal(events(first, 'shade_spawned')[0].tick, 300);
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

test('lịch sinh, vị trí chuẩn, spawn không tác động trong tick sinh', () => {
  for (const [night, lamps, interval, maxPoints] of [[1, 5, 480, 24], [2, 6, 420, 24], [3, 7, 360, 30]]) {
    const firstLamp = [0, night === 3 ? 6 : 0, [25, 20, 6][night - 1]];
    const result = execute(300 + interval, { night, scenario: {
      player: { invuln_ticks: 2000 }, wind_enabled: false
    } });
    const start = snapshot(result, 0);
    assert.equal(start.night, night);
    assert.equal(start.lanterns.length, lamps);
    assert.deepEqual(start.lanterns[0].pos, firstLamp);
    assert.equal(start.motes_active, 20);
    assert.equal(new Set(start.motes.map(({ pos }) => pos.toString())).size, 20);
    assert.equal(snapshot(result, 239).motes_active, 20);
    assert.equal(snapshot(result, 240).motes_active, 21);
    assert.ok(snapshot(result, 300 + interval).motes_active <= maxPoints);
    assert.deepEqual(events(result, 'shade_spawned').map(({ tick, data }) => [tick, data.id]),
      [[300, 'S1'], [300, 'S2'], [300 + interval, 'S3']]);
    assert.deepEqual(snapshot(result, 300).shades.map(({ state }) => state), ['spawning', 'spawning']);
  }
});

test('lướt 12 tick, giữ độ cao, hồi theo tick bắt đầu và vẫn bị chạm', () => {
  const result = execute(94, { scenario: empty, frames: [
    { tick: 0, jump: true }, { tick: 4, dash: true }, { tick: 5, dash: false },
    { tick: 16, dash: true }, { tick: 17, dash: false }, { tick: 94 - 1, dash: true }
  ] });
  assert.deepEqual(events(result, 'dash').map(({ tick }) => tick), [5]);
  assert.equal(snapshot(result, 4).player.pos[1], snapshot(result, 16).player.pos[1]);
  assert.equal(snapshot(result, 16).player.pos[2], 2.8);
  assert.ok(snapshot(result, 17).player.pos[1] > snapshot(result, 16).player.pos[1]);
  const contact = execute(1, { scenario: { ...empty, shades: [{ pos: [0, 0, 0.4] }] },
    frames: [{ tick: 0, dash: true }] });
  assert.equal(snapshot(contact, 1).player.flames, 2);
});

test('pause giữ sim_tick, bộ đếm và spawn; resume tiếp tục theo cạnh lên', () => {
  const replay = execute(460, { night: 3, scenario: { ...empty, random_motes: true,
    player: { pulse_cd_ticks: 230, charm_ticks: 700 } }, frames: [
    { tick: 100, pause: true }, { tick: 189, pause: false }, { tick: 260, pause: true }
  ] });
  assert.equal(snapshot(replay, 260).state, 'paused');
  assert.equal(snapshot(replay, 260).sim_tick, 100);
  assert.deepEqual(snapshot(replay, 100).player, snapshot(replay, 260).player);
  assert.equal(snapshot(replay, 260).time_left_s, snapshot(replay, 100).time_left_s);
  assert.deepEqual(events(replay).filter(({ name }) => ['paused', 'resumed'].includes(name))
    .map(({ name, tick }) => [name, tick]), [['paused', 101], ['resumed', 261]]);
  assert.equal(snapshot(replay, 399).motes_active, 20);
  assert.equal(snapshot(replay, 400).motes_active, 21);
});

test('rơi bỏ qua bất tử, mất toàn bộ đom đóm và hồi đúng hạn', () => {
  const scenario = { ...empty, player: { pos: [41, -10.01, 0], carried: 7, invuln_ticks: 1000 },
    motes: [[0, 0, 0]] };
  const result = execute(68, { scenario });
  assert.deepEqual(events(result, 'player_hit')[0].data, { by: 'fall', flames: 2, dropped: 0, lost: 7 });
  assert.equal(events(result, 'player_hit').length, 1);
  assert.deepEqual(snapshot(result, 61).player.pos, [0, 0, 0]);
  assert.deepEqual(snapshot(result, 61).player.vel, [0, 0, 0]);
  assert.equal(snapshot(result, 61).player.invuln, true);
  assert.equal(events(result, 'mote_picked')[0].tick, 62);
  const last = execute(68, { scenario: { ...scenario, player: { ...scenario.player, flames: 1 } } });
  assert.equal(last.records.at(-1).ticks, 1);
  assert.equal(events(last, 'game_over')[0].data.reason, 'no_flames');
});

test('đèn mới thắp đưa Bóng Mực ra mép trong 30 tick; ưu tiên id khi cách đều', () => {
  const result = execute(32, { scenario: { ...empty, player: { carried: 10 },
    shades: [{ pos: [0, 0, 0] }],
    lanterns: [{ id: 'L2', pos: [-2, 0, 0] }, { id: 'L1', pos: [2, 0, 0] }] },
  frames: [{ tick: 0, interact: true }] });
  assert.equal(events(result, 'lantern_lit')[0].data.lantern_id, 'L1');
  assert.equal(events(result, 'player_hit').length, 0);
  assert.ok(Math.hypot(snapshot(result, 31).shades[0].pos[0] - 2, snapshot(result, 31).shades[0].pos[2]) >= 5.999);
});

test('chạm xét id theo thứ tự sinh và chỉ mất một Ngọn Lửa mỗi tick', () => {
  const result = execute(1, { scenario: { ...empty, shades: [
    { id: 'S10', pos: [0.5, 0, 0] },
    { id: 'S2', pos: [-0.5, 0, 0] },
    { id: 'S1', pos: [0, 1.51, 0] }
  ] } });
  assert.equal(events(result, 'player_hit').length, 1);
  assert.equal(snapshot(result, 1).player.flames, 2);
  assert.equal(snapshot(result, 1).shades.find(({ id }) => id === 'S2').state, 'recoil');
  assert.equal(snapshot(result, 1).shades.find(({ id }) => id === 'S10').state, 'chase');
});

test('Gió Lạc sinh theo lịch, cướp trước hit, hồi đom đóm và hết hạn', () => {
  const spawned = execute(3601, { night: 2, every: 1200, scenario: {
    random_motes: false, random_shades: false, player: { pos: [0, 0, 0] } } });
  assert.deepEqual(snapshot(spawned, 1200).drifters.map(({ id }) => id), ['D1']);
  assert.deepEqual(snapshot(spawned, 2400).drifters.map(({ id }) => id), ['D1', 'D2']);
  assert.equal(snapshot(spawned, 3600).drifters.length, 2);
  const steal = execute(241, { night: 2, scenario: { ...empty, player: { carried: 10 },
    drifters: [{ pos: [0, 0.8, 0] }], shades: [{ pos: [0, 0, 0] }] },
  frames: [{ tick: 1, move: [1, 0] }] });
  assert.deepEqual(events(steal).slice(1, 3).map(({ name, data }) => [name, data]), [
    ['drifter_steal', { drifter_id: 'D1', amount: 3, carried: 7 }],
    ['player_hit', { by: 'shade', flames: 2, dropped: 3 }]
  ]);
  assert.equal(snapshot(steal, 241).drifters.length, 0);
  const recover = execute(481, { night: 2, scenario: { ...empty, player: { carried: 5, invuln_ticks: 9 },
    drifters: [{ id: 'D7', pos: [3, 0.8, 0], state: 'flee', stolen: 3 }] },
  frames: [{ tick: 0, pulse: true }] });
  assert.deepEqual(events(recover, 'drifter_drop')[0].data, { drifter_id: 'D7', amount: 3 });
  assert.equal(snapshot(recover, 1).motes.length, 3);
  assert.ok(snapshot(recover, 1).motes.every(({ kind, ttl_s }) => kind === 'dropped' && ttl_s === 8));
  assert.equal(snapshot(recover, 121).drifters.length, 0);
  assert.equal(snapshot(recover, 481).motes_active, 0);
  const escape = execute(2, { night: 2, scenario: { ...empty, player: { carried: 8 },
    drifters: [{ pos: [0, 0.8, 0], state: 'chase' }] }, frames: [{ tick: 0, pulse: true }] });
  assert.equal(snapshot(escape, 1).drifters[0].state, 'flee');
  assert.equal(events(escape, 'drifter_steal').length, 0);
});

test('Bùa Gió tăng tốc, bỏ hồi lướt, hiệu lực 600 tick và hồi bùa 2700 tick', () => {
  const replay = execute(2701, { night: 2, scenario: { ...empty, charms: [{ pos: [0, 0, 0] }] },
    frames: [{ tick: 0, move: [1, 0] }, { tick: 3, dash: true }, { tick: 4, dash: false },
      { tick: 10, dash: true }, { tick: 11, dash: false }, { tick: 15, dash: true }, { tick: 16, dash: false },
      { tick: 30, move: [0, 0] }] });
  assert.deepEqual(events(replay, 'charm_picked')[0].data, { charm_id: 'C1', charm_ticks: 600 });
  assert.equal(snapshot(replay, 2).player.vel[0], 7.2);
  assert.deepEqual(events(replay, 'dash').map(({ tick }) => tick), [4, 16]);
  assert.equal(snapshot(replay, 16).player.dash_cd_s, 0);
  assert.equal(snapshot(replay, 600).player.charm_s, 1 / 60);
  assert.equal(snapshot(replay, 601).player.charm_s, 0);
  assert.equal(snapshot(replay, 2700).charms[0].available, false);
  assert.equal(snapshot(replay, 2701).charms[0].available, true);
});

test('Đảo Cau qua cầu và phóng sang đảo B, phím không ghi đè vận tốc', () => {
  const bridge = execute(600, { night: 2, scenario: empty, frames: [{ tick: 0, move: [1, 0] }] });
  assert.equal(snapshot(bridge, 350).player.grounded, true);
  assert.equal(snapshot(bridge, 350).player.pos[0], 35.2);
  assert.equal(events(bridge, 'charm_picked').length, 1);
  assert.ok(snapshot(bridge, 600).player.pos[0] > 60);
  const pad = execute(84, { night: 2, scenario: { ...empty, player: { pos: [20, 0, 18] } },
    frames: [{ tick: 0, move: [-1, 0] }] });
  assert.ok(snapshot(pad, 15).player.pos[0] > 25);
  assert.equal(snapshot(pad, 84).player.grounded, true);
  assert.ok(snapshot(pad, 84).player.pos[0] >= 42);
});

test('Đảo Chuông có vách, dốc, bục tầng 2, tháp và gió 300 tick', () => {
  const ramp = execute(91, { night: 3, scenario: { ...empty, player: {
    pos: [30.5 * Math.sqrt(3) / 2, 0, 15.25]
  } }, frames: [{ tick: 0, move: [0, 1], cam_yaw_deg: -120 }] });
  assert.equal(snapshot(ramp, 91).player.pos[1], 3);
  const wall = execute(51, { night: 3, scenario: { ...empty, player: { pos: [0, 0, 25] } },
    frames: [{ tick: 0, move: [0, -1] }] });
  assert.equal(snapshot(wall, 51).player.pos[1], 0);
  assert.ok(snapshot(wall, 51).player.pos[2] >= 24);
  const pad = execute(54, { night: 3, scenario: { ...empty, player: { pos: [0, 3, 13] } } });
  assert.equal(snapshot(pad, 54).player.pos[1], 6);
  assert.equal(snapshot(pad, 54).player.grounded, true);
  const tower = execute(120, { night: 3, scenario: { ...empty, player: { pos: [0, 6, 6] } },
    frames: [{ tick: 0, move: [0, -1] }] });
  assert.ok(snapshot(tower, 120).player.pos[2] >= 2);
  const wind = execute(2100, { night: 3, scenario: empty });
  assert.equal(snapshot(wind, 1799).wind.active, false);
  assert.equal(snapshot(wind, 1800).wind.active, true);
  assert.ok(Math.abs(Math.hypot(...snapshot(wind, 1800).player.vel) - 2) < 0.002);
  assert.equal(snapshot(wind, 2099).wind.active, true);
  assert.equal(snapshot(wind, 2100).wind.active, false);
});

test('thắng đúng tick bình minh nếu còn lửa; hết lửa luôn thua', () => {
  const lanterns = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ id: 'L' + n, lit: true }));
  for (const [night, count] of [[1, 5], [2, 6], [3, 7]]) {
    const scenario = { ...empty, time_left_s: 1 / 60, lanterns: lanterns.slice(0, count) };
    const victory = execute(4, { night, scenario });
    assert.deepEqual(victory.records.at(-1), { type: 'end', ticks: 1, state: 'won', score: 150 });
    const defeat = execute(4, { night, scenario: { ...scenario, player: { flames: 0 } } });
    assert.equal(events(defeat, 'game_over')[0].data.reason, 'no_flames');
  }
});
