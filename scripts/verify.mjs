import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { nightOneRoute } from './night-one-route.mjs';

const args = process.argv.slice(2);
if (args.length !== 0 && (args.length !== 2 || args[0] !== '--record' || !args[1])) {
  throw new Error('Dùng: npm run verify [-- --record <thư mục bằng chứng>]');
}
const repo = fileURLToPath(new URL('../', import.meta.url));
const { tuning } = JSON.parse(readFileSync(join(repo, 'game.contract.json'), 'utf8'));
const scratch = mkdtempSync(join(tmpdir(), 'dao-verify-'));
const seed = 2026;

function node(args) {
  const child = spawnSync(process.execPath, args, { cwd: repo, stdio: 'inherit' });
  if (child.error) throw child.error;
  assert.equal(child.status, 0, 'Lệnh kiểm chứng thất bại: ' + args.join(' '));
}

try {
  node(['--test', '--test-reporter=spec']);
  const { frames } = nightOneRoute(tuning, seed);
  const inputs = '{"frames":[\n' + frames.map((frame) => JSON.stringify(frame)).join(',\n') + '\n]}\n';
  const framesPath = join(scratch, 'night-one-inputs.json');
  writeFileSync(framesPath, inputs, 'utf8');
  const run = (name) => {
    const out = join(scratch, name);
    node(['src/headless.mjs', '--seed', String(seed), '--night', '1', '--ticks', '18000',
      '--inputs', framesPath, '--snapshot-every', '600', '--out', out]);
    return readFileSync(out);
  };
  const first = run('first.jsonl');
  const second = run('second.jsonl');
  assert.ok(first.equals(second), 'Hai lần chạy CLI phải giống từng byte');
  const end = JSON.parse(first.toString('utf8').trimEnd().split('\n').at(-1));
  assert.equal(end.state, 'won');
  const sha256 = createHash('sha256').update(first).digest('hex');
  const report = [
    'node --test --test-reporter=spec: tất cả kiểm thử đạt',
    'Replay Đêm 1 mặc định seed 2026, không override scenario: ' + JSON.stringify(end),
    'Hai lượt headless sinh JSONL giống từng byte',
    'SHA-256 ' + sha256
  ].join('\n') + '\n';
  process.stdout.write(report);
  if (args.length) {
    const output = resolve(args[1]);
    mkdirSync(output, { recursive: true });
    writeFileSync(join(output, 'night-one-inputs.json'), inputs, 'utf8');
    writeFileSync(join(output, 'night-one.jsonl'), first);
    writeFileSync(join(output, 'verify.txt'), report, 'utf8');
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
