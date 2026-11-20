import { once } from 'node:events';
import { writeFileSync } from 'node:fs';
import { platform, release, arch } from 'node:os';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright-core';
import { browserPath } from './chromium.mjs';
import { webServer } from './serve.mjs';

export function frameStats(samples) {
  const frames = samples.length;
  if (!frames) throw new Error('Không ghi nhận được khung hình benchmark.');
  const ordered = samples.slice().sort((a, b) => a - b);
  const slow = ordered.slice(-Math.max(1, Math.ceil(frames * 0.01)));
  const mean = (values) => values.reduce((a, b) => a + b, 0) / values.length;
  const round = (number) => Number(number.toFixed(2));
  return { avg_fps: round(1000 / mean(samples)), p1_low_fps: round(1000 / mean(slow)),
    frame_ms_p95: round(ordered[Math.ceil(frames * 0.95) - 1]), frames };
}

async function main() {
  const { values } = parseArgs({ options: { seed: { type: 'string' }, duration: { type: 'string' }, out: { type: 'string' } } });
  const seed = Number(values.seed);
  const duration = Number(values.duration);
  if (!Number.isSafeInteger(seed) || !Number.isFinite(duration) || duration <= 0 || !values.out) {
    throw new Error('Dùng --seed <int> --duration <s> --out <file.json>');
  }
  const server = webServer().listen(0, '127.0.0.1');
  let browser;
  try {
    await once(server, 'listening');
    browser = await chromium.launch({ executablePath: browserPath(), headless: false,
      args: ['--window-size=1280,720', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
    let load_ms;
    await page.exposeFunction('reportBenchFirstFrame', () => { load_ms ??= Math.round(process.uptime() * 1000); });
    await page.goto('http://127.0.0.1:' + server.address().port + '/?benchmark=1&seed=' + seed + '&duration=' + duration);
    await page.waitForFunction(() => window.benchmarkResult !== undefined, null, { timeout: (duration + 25) * 1000 });
    const { samples, renderer } = await page.evaluate(() => window.benchmarkResult);
    if (load_ms === undefined) throw new Error('Không ghi được thời điểm khung hình đầu.');
    const result = { contract_version: '1.3', ...frameStats(samples), load_ms, peak_mem_mb: null,
      vsync_off: true, renderer: renderer + ' · Chromium ' + browser.version(), os: [platform(), release(), arch()].join(' ') };
    writeFileSync(values.out, JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result));
  } finally {
    await browser?.close();
    server.close();
  }
}

if (process.argv[1] && new URL(import.meta.url).pathname.endsWith('/benchmark.mjs') &&
    process.argv[1].replaceAll('\\', '/').endsWith('/benchmark.mjs')) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
