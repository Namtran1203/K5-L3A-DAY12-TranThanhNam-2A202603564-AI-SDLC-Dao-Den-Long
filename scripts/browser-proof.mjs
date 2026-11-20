import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [playwrightPath, executablePath, directory = 'docs/proof/phase-2'] = process.argv.slice(2);
if (!playwrightPath || !executablePath) {
  throw new Error('Dùng: node scripts/browser-proof.mjs <playwright-core/index.mjs> <Chromium> [thư mục bằng chứng]');
}
const base = process.env.GAME_URL ?? 'http://127.0.0.1:4173';
const { chromium } = await import(pathToFileURL(resolve(playwrightPath)));
const output = resolve(directory);
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ executablePath, headless: true,
  args: process.env.GAME_SW === '1' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
const errors = [];
const performanceSamples = [];

async function expectText(page, selector, text) {
  await page.waitForFunction(({ selector, text }) => document.querySelector(selector)?.textContent === text, { selector, text });
}
const screenshot = (page, name) => page.screenshot({ path: resolve(output, name + '.png') });
async function tap(page, key) {
  await page.keyboard.down(key);
  await page.waitForTimeout(130);
  await page.keyboard.up(key);
}

async function sampleFps(page, night) {
  const report = await page.evaluate(() => new Promise((resolve) => {
    let first;
    let frames = 0;
    function frame(now) {
      first ??= now;
      frames++;
      if (now - first >= 5000) {
        const canvas = document.querySelector('#scene');
        resolve({ fps: (frames - 1) * 1000 / (now - first), width: canvas.width, height: canvas.height });
      } else requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }));
  assert.equal(report.width, 1280);
  assert.equal(report.height, 720);
  performanceSamples.push({ night, fps: report.fps });
}

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  // Only load a real scenario on the next tick when a test requests one explicitly.
  await page.route('**/game.js', async (route) => {
    const response = await route.fetch();
    const hook = [
      "import { Game as ProofGame } from '/src/game.mjs';",
      'const originalStep = ProofGame.prototype.step;',
      'ProofGame.prototype.step = function (...args) {',
      '  if (window.proofScenario) {',
      '    const scenario = window.proofScenario;',
      '    window.proofScenario = null;',
      '    Object.assign(this, new ProofGame(this.tuning, 2026, scenario, this.night));',
      '  }',
      '  return originalStep.call(this, ...args);',
      '};'
    ].join('\n');
    await route.fulfill({ response, body: hook + '\n' + await response.text() });
  });
  await page.addInitScript(() => {
    if (!window.AudioContext) return;
    const nativeOscillator = AudioContext.prototype.createOscillator;
    window.proofNotes = 0;
    AudioContext.prototype.createOscillator = function () {
      window.proofNotes++;
      return nativeOscillator.call(this);
    };
  });
  await page.goto(base);
  const start = page.locator('#start');
  await page.locator('#settings').click();
  await page.locator('#volume').fill('0.55');
  await page.locator('#sensitivity').fill('1.35');
  await page.reload();
  await page.locator('#settings').click();
  assert.equal(await page.locator('#volume').inputValue(), '0.55');
  assert.equal(await page.locator('#sensitivity').inputValue(), '1.35');
  await screenshot(page, 'settings');
  await start.click();

  let total = 0;
  for (const [night, name, count] of [[1, 'Đảo Bến', 5], [2, 'Đảo Cau', 6], [3, 'Đảo Chuông', 7]]) {
    await start.click();
    await expectText(page, '#overlay-title', name);
    assert.match(await page.locator('#overlay-text').textContent(), /^Ông Đăng:/);
    if (night === 3) await screenshot(page, 'intro-night-three');
    await start.click();
    assert.equal(await page.locator('#hud #mote-slots i').count(), 10);
    await expectText(page, '#lit', '0/' + count);
    if (night === 1) {
      await page.locator('#guide').waitFor({ state: 'visible' });
      await tap(page, 'Space');
      await tap(page, 'Shift');
      await page.keyboard.down('w');
      await page.waitForTimeout(650);
      await page.keyboard.up('w');
      assert.ok(await page.evaluate(() => window.proofNotes) >= 7, 'Âm nền + hiệu ứng nhảy + lướt');
      await page.keyboard.press('Escape');
      await expectText(page, '#overlay-title', 'Tạm dừng');
      const frozen = await page.locator('#time').textContent();
      await page.waitForTimeout(1300);
      assert.equal(await page.locator('#time').textContent(), frozen);
      await screenshot(page, 'pause');
      await page.locator('#settings').click();
      await expectText(page, '#overlay-title', 'Cài đặt');
      await start.click();
      await expectText(page, '#overlay-title', 'Tạm dừng');
      await start.click();
      await page.locator('#overlay').waitFor({ state: 'hidden' });
      await page.keyboard.press('p');
      await expectText(page, '#overlay-title', 'Tạm dừng');
      await page.locator('#restart').click();
      await page.locator('#overlay').waitFor({ state: 'hidden' });
      await expectText(page, '#flames', '3/3');
    }

    await sampleFps(page, night);
    await screenshot(page, 'night-' + night);
    if (night === 2) {
      await page.evaluate(() => {
        window.proofScenario = { player: { pos: [19, 0, 0] },
          drifters: [{ pos: [29, 0.8, 0] }], random_shades: false };
      });
      await page.mouse.move(750, 395);
      await page.mouse.down();
      await page.mouse.move(605, 395, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(260);
      await screenshot(page, 'bamboo-bridge');
    }
    if (night === 3) {
      await page.evaluate(() => {
        window.proofScenario = { player: { pos: [0, 0, -20] }, random_shades: false };
      });
      await page.waitForTimeout(260);
      await screenshot(page, 'bell-tower');
    }
    await page.evaluate(({ night, count }) => {
      const lamps = Array.from({ length: count }, (_, i) =>
        i ? { id: 'L' + (i + 1), lit: true } : { id: 'L1', pos: [0, 0, 1] });
      window.proofScenario = { lanterns: lamps, player: { carried: 10 }, time_left_s: 20 + night,
        random_shades: false, random_drifters: false, random_motes: false };
    }, { night, count });
    await page.locator('#prompt').waitFor({ state: 'visible' });
    assert.match(await page.locator('#prompt').textContent(), /Nạp ánh sáng \(0\/10\)/);
    assert.equal(await page.locator('#time').evaluate((item) => item.classList.contains('danger')), true);
    await tap(page, 'e');
    await expectText(page, '#lit', count + '/' + count);
    total += Number(await page.locator('#score').textContent());
    await expectText(page, '#overlay-title', night === 3 ? 'Bình Minh' : 'Đèn đã bừng sáng');
  }
  assert.match(await page.locator('#overlay-text').textContent(), new RegExp('Tổng điểm ' + total));
  await screenshot(page, 'dawn');

  await start.click(); // Dawn → menu.
  await start.click();
  await start.click();
  await page.evaluate(() => {
    window.proofScenario = { time_left_s: 0.1, random_shades: false, random_motes: false };
  });
  await expectText(page, '#overlay-title', 'Ánh sáng đã tắt');
  await start.click();
  await page.locator('#overlay').waitFor({ state: 'hidden' });
  await expectText(page, '#flames', '3/3');
  assert.deepEqual(errors, []);

  const device = await page.locator('#scene').evaluate((canvas) => {
    const gl = canvas.getContext('webgl2');
    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    return extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  });
  const average = performanceSamples.reduce((sum, entry) => sum + entry.fps, 0) / 3;
  const report = [
    'Chromium ' + browser.version() + ' · ' + process.platform + ' · ' + process.version + ' · ' + cpus()[0].model.trim(),
    'Đã kiểm tra menu, lời Ông Đăng, HUD, tạm dừng/tiếp tục/chơi lại, lưu âm lượng và độ nhạy qua reload.',
    'Đã ghi nhận Web Audio tạo nốt khi chạy nền, nhảy và lướt.',
    'Đã dùng scenario ở bước chốt đêm để kiểm tra thắng, thua, chuyển ba đêm và Bình Minh (tổng ' + total + ' điểm).',
    'FPS requestAnimationFrame trong 5 giây chơi bình thường mỗi đêm, canvas 1280×720, DPR 1.',
    'WebGL renderer: ' + device,
    ...performanceSamples.map(({ night, fps }) => 'Đêm ' + night + ': ' + fps.toFixed(1) + ' FPS'),
    'Trung bình ba mẫu: ' + average.toFixed(1) + ' FPS'
  ].join('\n') + '\n';
  writeFileSync(resolve(output, 'browser.txt'), report, 'utf8');
  process.stdout.write(report);
  assert.ok(average >= 30, 'FPS trung bình dưới 30 ở 1280×720');
} finally {
  await browser.close();
}
