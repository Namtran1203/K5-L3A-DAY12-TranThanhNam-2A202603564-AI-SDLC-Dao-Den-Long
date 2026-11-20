import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { frameStats } from '../scripts/benchmark.mjs';
import { webServer } from '../scripts/serve.mjs';
import { benchmarkScene, stepBenchmark } from '../src/benchmark-scene.mjs';
import { topEntries } from '../src/leaderboard-rules.mjs';

test('benchmark dùng phân vị 95 và trung bình 1% khung chậm nhất', () => {
  assert.deepEqual(frameStats([...Array(97).fill(10), 20, 30, 50]), {
    frames: 100, avg_fps: 93.46, p1_low_fps: 20, frame_ms_p95: 10
  });
});

test('cảnh benchmark giữ số lượng, Mây, dầu và trạng thái wander', async () => {
  const { tuning } = JSON.parse(await readFile(new URL('../game.contract.json', import.meta.url), 'utf8'));
  const game = benchmarkScene(tuning, 42);
  const start = game.snapshot();
  for (let tick = 0; tick < 360; tick++) stepBenchmark(game);
  const end = game.snapshot();
  assert.equal(end.shades.length, 200);
  assert.equal(end.motes.length, 100);
  assert.equal(end.lanterns.filter(({ fuel }) => fuel === 100).length, 3);
  assert.ok(end.shades.every(({ state }) => state === 'wander'));
  assert.notDeepEqual(end.shades, start.shades);
  assert.deepEqual(end.player.pos, [0, 0, 0]);
});

test('bảng xếp hạng giữ 10 mục và ưu tiên thời điểm sớm hơn khi hòa', () => {
  const entry = (name, score, achieved_at) => ({ name, score, achieved_at, nights_won: 0, seed: 42 });
  const low = Array.from({ length: 11 }, (_, i) => entry('May' + i, i, '2026-01-01T12:00:00Z'));
  const ranked = topEntries([...low, entry('Later', 20, '2026-01-01T12:02:00+07:00'),
    entry('Earlier', 20, '2026-01-01T12:01:00+07:00')]);
  assert.equal(ranked.length, 10);
  assert.deepEqual(ranked.slice(0, 2).map(({ name }) => name), ['Earlier', 'Later']);
});

test('POST lưu xuống đĩa và CLI độc lập xuất cùng thứ tự', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dao-rank-'));
  const out = join(directory, 'export.json');
  process.env.LANTERN_LEADERBOARD = join(directory, 'leaderboard.json');
  const server = webServer().listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const url = 'http://127.0.0.1:' + server.address().port + '/api/leaderboard';
    const submit = (name, score) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, score, nights_won: 2, seed: 42 }) });
    assert.equal((await submit('x', 3000)).status, 400);
    assert.equal((await submit('May_2026', 100)).status, 200);
    assert.equal((await submit('OngDang', 300)).status, 200);
    const expected = await (await fetch(url)).json();
    assert.deepEqual(expected.entries.map(({ name }) => name), ['OngDang', 'May_2026']);
    assert.match(expected.entries[0].achieved_at, /Z$/);
    const exported = spawnSync(process.execPath, ['scripts/serve.mjs', '--export-leaderboard', out], { encoding: 'utf8' });
    assert.equal(exported.status, 0, exported.stderr);
    assert.deepEqual(JSON.parse(await readFile(out, 'utf8')), expected);
  } finally {
    server.close();
    delete process.env.LANTERN_LEADERBOARD;
    await rm(directory, { recursive: true, force: true });
  }
});
