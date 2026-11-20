import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

export function browserPath() {
  const apps = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA].filter(Boolean);
  const installed = process.platform === 'win32' ? apps.flatMap((base) => [
    join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
  ]) : process.platform === 'darwin' ? [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Chromium.app/Contents/MacOS/Chromium'
  ] : ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/usr/bin/microsoft-edge'];
  const result = [process.env.CHROME_BIN, ...installed, chromium.executablePath()].find((path) => path && existsSync(path));
  if (!result) throw new Error('Cần Chrome/Edge/Chromium. Đặt CHROME_BIN hoặc chạy npx playwright-core install chromium.');
  return result;
}
