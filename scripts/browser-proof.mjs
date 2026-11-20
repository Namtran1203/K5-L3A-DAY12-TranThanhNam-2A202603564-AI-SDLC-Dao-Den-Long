import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { nightOneRoute } from './night-one-route.mjs';

const [playwrightPath, executablePath, outputPath = 'docs/proof/phase-1'] = process.argv.slice(2);
if (!playwrightPath || !executablePath) {
  throw new Error('Dùng: node scripts/browser-proof.mjs <playwright-core/index.mjs> <Chromium> [thư mục bằng chứng]');
}
const { chromium } = await import(pathToFileURL(resolve(playwrightPath)));
const output = resolve(outputPath);
mkdirSync(output, { recursive: true });
const { tuning } = JSON.parse(readFileSync(new URL('../game.contract.json', import.meta.url), 'utf8'));
const { frames, result } = nightOneRoute(tuning, 2026);
const browser = await chromium.launch({
  executablePath, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']
});

try {
  const page = await browser.newPage({ viewport: { width: 1120, height: 700 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => {
    const frames = new Map();
    let handle = 0;
    let clock;
    window.requestAnimationFrame = (callback) => {
      frames.set(++handle, callback);
      return handle;
    };
    window.cancelAnimationFrame = (id) => frames.delete(id);
    window.advanceGameFrames = (ticks) => {
      clock ??= performance.now();
      for (let remaining = ticks; remaining > 0;) {
        const step = Math.min(14, remaining);
        remaining -= step;
        clock += step * 1000 / 60 + 0.00001;
        const pending = [...frames.values()];
        frames.clear();
        for (const frame of pending) frame(clock);
      }
    };
  });
  const advance = (ticks) => page.evaluate((ticks) => window.advanceGameFrames(ticks), ticks);
  const button = page.locator('#start');
  await page.goto('http://127.0.0.1:4173/');
  await page.waitForFunction(() => !document.getElementById('start').disabled, undefined, { polling: 50 });
  await advance(1);
  await button.click();
  const held = new Set();
  let gameplayCaptured = false;
  let lightCaptured = false;
  for (const [index, frame] of frames.entries()) {
    const [x, z] = frame.move;
    const active = new Set();
    if (x) active.add(x > 0 ? 'a' : 'd');
    if (z) active.add(z > 0 ? 'w' : 's');
    if (frame.interact) active.add('e');
    if (frame.pulse) active.add('q');
    for (const key of held) if (!active.has(key)) await page.keyboard.up(key);
    for (const key of active) if (!held.has(key)) await page.keyboard.down(key);
    held.clear();
    for (const key of active) held.add(key);
    await advance((frames[index + 1]?.tick ?? result.ticks) - frame.tick);
    if (!lightCaptured && frame.interact && await page.locator('#lit').textContent() === '1/5') {
      await page.screenshot({ path: resolve(output, 'lit-lantern.png') });
      lightCaptured = true;
    }
    if (!gameplayCaptured && frame.tick >= 550 && await page.locator('#lit').textContent() !== '0/5') {
      await page.screenshot({ path: resolve(output, 'gameplay.png') });
      gameplayCaptured = true;
    }
  }
  for (const key of held) await page.keyboard.up(key);
  assert.ok(gameplayCaptured, 'Chụp màn hình khi đã thắp đèn trong lúc chơi');
  assert.ok(lightCaptured, 'Chụp được đèn đầu tiên khi đã thắp');
  assert.equal(await page.locator('#lit').textContent(), '5/5');
  assert.equal(await page.locator('#score').textContent(), String(result.score));
  assert.equal(await page.locator('#overlay-title').textContent(), 'Đảo Bến bừng sáng');
  await page.screenshot({ path: resolve(output, 'victory.png') });
  await button.click();
  await advance(1);
  assert.equal(await page.locator('#lit').textContent(), '0/5');
  assert.equal(await page.locator('#flames').textContent(), '3/3');
  assert.equal(await page.locator('#score').textContent(), '0');
  // Submit no keys and let the standard shades find Mây.
  await advance(900);
  assert.equal(await page.locator('#overlay-title').textContent(), 'Ánh sáng đã tắt');
  assert.equal(await page.locator('#flames').textContent(), '0/3');
  await page.screenshot({ path: resolve(output, 'defeat.png') });
  await button.click();
  await advance(1);
  assert.equal(await page.locator('#flames').textContent(), '3/3');
  assert.equal(await page.locator('#overlay').isVisible(), false);
  assert.deepEqual(errors, []);
  const report = [
    'Chromium ' + browser.version() + ' · ' + process.platform + ' · ' + process.version,
    'Replay bằng phím thật trong Edge Chromium headless, đồng hồ requestAnimationFrame điều khiển bởi bài kiểm tra.',
    'Đêm 1 mặc định seed 2026: thắp 5/5 đèn, thắng sau ' + result.ticks + ' tick, HUD ' + result.score + ' điểm.',
    'Chơi lại sau thắng đặt lại đèn, lửa và điểm. Đứng yên bị Bóng Mực chạm đến hết lửa và hiện màn thua.',
    'Chơi lại sau thua trở về màn chơi với 3/3 lửa. Không có lỗi console hoặc JavaScript.'
  ].join('\n') + '\n';
  writeFileSync(resolve(output, 'browser.txt'), report, 'utf8');
  process.stdout.write(report);
} finally {
  await browser.close();
}
