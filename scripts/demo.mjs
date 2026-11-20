import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { browserPath } from './chromium.mjs';
import { webServer } from './serve.mjs';

const output = resolve(process.argv[2] ?? 'docs/demo/demo.mp4');
const ffmpeg = process.env.FFMPEG ?? 'ffmpeg';
const scratch = mkdtempSync(join(tmpdir(), 'lantern-demo-'));
const videoRate = 12;
const code = (args) => {
  const run = spawnSync(process.execPath, args, { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  return run.stdout.trim();
};
const report = code(['scripts/verify.mjs']);
const jsonl = join(scratch, 'oil.jsonl');
const headless = ['src/headless.mjs', '--seed', '2026', '--night', '1', '--ticks', '60',
  '--scenario', 'docs/proof/phase-3/oil-scenario.json', '--inputs', 'docs/proof/phase-3/oil-inputs.json',
  '--out', jsonl];
code(headless);
const outputLines = readFileSync(jsonl, 'utf8').trimEnd().split('\n').map(JSON.parse)
  .filter(({ type }) => type === 'event' || type === 'end');

mkdirSync(dirname(output), { recursive: true });
const encoder = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate',
  String(videoRate), '-vcodec', 'png', '-i', 'pipe:0', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
  '-movflags', '+faststart', output], { stdio: ['pipe', 'ignore', 'inherit'] });
const encoded = once(encoder, 'exit');
const server = webServer().listen(0, '127.0.0.1');
let browser;

async function saveFrame(buffer, count = 1) {
  for (let i = 0; i < count; i++) {
    if (!encoder.stdin.write(buffer)) await once(encoder.stdin, 'drain');
  }
}

function terminal(page, title, content) {
  return page.setContent('<meta charset="utf-8"><style>body{background:#0e1430;color:#f5f1e6;' +
    'font:22px system-ui;margin:70px}h1{color:#f2c14e}pre{font:21px/1.45 monospace;white-space:pre-wrap}</style>' +
    '<h1></h1><pre></pre>').then(() => page.evaluate(({ title, content }) => {
    document.querySelector('h1').textContent = title;
    document.querySelector('pre').textContent = content;
  }, { title, content }));
}

try {
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port + '/';
  browser = await chromium.launch({ executablePath: browserPath(), headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await page.addInitScript(() => {
    if (location.search) return;
    let stamp;
    let next = 0;
    const pending = new Map();
    window.requestAnimationFrame = (callback) => { pending.set(++next, callback); return next; };
    window.cancelAnimationFrame = (id) => pending.delete(id);
    window.advanceVideo = (frames) => {
      for (let i = 0; i < frames; i++) {
        stamp = (stamp ?? performance.now()) + 1000 / 12;
        const callbacks = [...pending.values()];
        pending.clear();
        for (const callback of callbacks) callback(stamp);
      }
    };
  });
  await page.goto(base);
  const advance = (count) => page.evaluate((n) => window.advanceVideo(n), count);
  const button = page.locator('#start');
  await page.waitForFunction(() => !document.querySelector('#start').disabled, null, { polling: 50 });
  await advance(3);
  await saveFrame(await page.screenshot(), 24);
  // Use DOM click to avoid waiting for a real RAF while the recording drives the clock.
  await button.evaluate((item) => item.click());
  await advance(3);
  await saveFrame(await page.screenshot(), 24);
  await button.evaluate((item) => item.click());
  async function playFrames(count, held = []) {
    for (const key of held) await page.keyboard.down(key);
    for (let i = 0; i < count; i++) {
      await advance(1);
      await saveFrame(await page.screenshot());
    }
    for (const key of held) await page.keyboard.up(key);
  }
  await playFrames(25, ['w']);
  await playFrames(7, ['Space', 'w']);
  await playFrames(17, ['w']);
  await playFrames(8, ['e']);
  await playFrames(15, ['Shift', 'a']);
  await playFrames(11, ['s', 'a']);
  await playFrames(8, ['Escape']);
  await playFrames(18);

  const bench = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await bench.goto(base + '?benchmark=1&seed=42&duration=8');
  await bench.waitForTimeout(1100);
  for (let i = 0; i < 48; i++) {
    await saveFrame(await bench.screenshot());
    await bench.waitForTimeout(31);
  }
  await bench.close();

  const card = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await terminal(card, 'Kiểm thử và hồi quy', '$ npm run verify\n\n' + report.split('\n')
    .filter((line) => line.startsWith('ℹ') || line.startsWith('Đêm 3') || line.includes('byte')).join('\n'));
  await saveFrame(await card.screenshot(), 54);
  await terminal(card, 'Headless · Test Contract v1.3',
    '$ node src/headless.mjs --seed 2026 --night 1 --ticks 60 [scenario dầu]\n\n' +
    outputLines.filter(({ name }) => name !== 'night_start').map((entry) => JSON.stringify(entry)).join('\n'));
  await saveFrame(await card.screenshot(), 72);
  await terminal(card, 'Benchmark · cửa sổ 1280×720',
    '$ node scripts/benchmark.mjs --seed 42 --duration 30 --out bench.json\n\n' + readFileSync('bench.json', 'utf8'));
  await saveFrame(await card.screenshot(), 72);
  encoder.stdin.end();
  assert.equal((await encoded)[0], 0);
  console.log(output);
} finally {
  encoder.stdin.destroy();
  await browser?.close();
  server.close();
  rmSync(scratch, { recursive: true, force: true });
}
