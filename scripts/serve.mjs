import { createReadStream, existsSync, writeFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { addLeaderboard, readLeaderboard } from './leaderboard.mjs';

const packaged = existsSync(new URL('../index.html', import.meta.url));
const web = (name, packagedName = name) => packaged ? '../' + packagedName : '../web/' + name;
const vendor = (name) => (packaged ? '../vendor/' : '../node_modules/three/build/') + name;
const routes = new Map([
  ['/', [web('index.html'), 'text/html; charset=utf-8']],
  ['/style.css', [web('style.css'), 'text/css; charset=utf-8']],
  ['/game.js', [web('game.mjs', 'game.js'), 'text/javascript; charset=utf-8']],
  ['/src/game.mjs', ['../src/game.mjs', 'text/javascript; charset=utf-8']],
  ['/src/maps.mjs', ['../src/maps.mjs', 'text/javascript; charset=utf-8']],
  ['/src/player.mjs', ['../src/player.mjs', 'text/javascript; charset=utf-8']],
  ['/src/enemies.mjs', ['../src/enemies.mjs', 'text/javascript; charset=utf-8']],
  ['/src/leaderboard-rules.mjs', ['../src/leaderboard-rules.mjs', 'text/javascript; charset=utf-8']],
  ['/src/benchmark-scene.mjs', ['../src/benchmark-scene.mjs', 'text/javascript; charset=utf-8']],
  ['/audio.js', [web('audio.mjs', 'audio.js'), 'text/javascript; charset=utf-8']],
  ['/leaderboard.js', [web('leaderboard.mjs', 'leaderboard.js'), 'text/javascript; charset=utf-8']],
  ['/game.contract.json', ['../game.contract.json', 'application/json; charset=utf-8']],
  ['/vendor/three.js', [packaged ? '../vendor/three.js' : vendor('three.module.js'), 'text/javascript; charset=utf-8']],
  ['/vendor/three.core.js', [vendor('three.core.js'), 'text/javascript; charset=utf-8']]
]);

async function leaderboardRequest(request, response) {
  const send = (status, data) => response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'
  }).end(JSON.stringify(data));
  try {
    if (request.method === 'GET') return send(200, readLeaderboard());
    if (request.method !== 'POST') return send(405, { error: 'Phương thức không hỗ trợ' });
    if (!request.headers['content-type']?.startsWith('application/json') ||
        (request.headers.origin && request.headers.origin !== 'http://' + request.headers.host)) {
      return send(400, { error: 'Yêu cầu không hợp lệ' });
    }
    let body = '';
    for await (const chunk of request) {
      body += chunk;
      if (body.length > 4096) return send(413, { error: 'Yêu cầu quá lớn' });
    }
    return send(200, addLeaderboard(JSON.parse(body)));
  } catch (error) {
    const invalid = error instanceof SyntaxError || error instanceof TypeError;
    return send(invalid ? 400 : 500, { error: invalid ? 'Dữ liệu không hợp lệ' : 'Không lưu được điểm' });
  }
}

export function webServer() {
  return createServer(async (request, response) => {
  const path = request.url?.split('?')[0];
  if (path === '/api/leaderboard') return leaderboardRequest(request, response);
  const route = routes.get(path);
  if (!route || !['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(404).end();
    return;
  }
  const [source, contentType] = route;
  const file = new URL(source, import.meta.url);
  try {
    const { size } = await stat(file);
    response.writeHead(200, { 'Content-Type': contentType, 'Content-Length': size });
    if (request.method === 'HEAD') response.end();
    else createReadStream(file).on('error', () => response.destroy()).pipe(response);
  } catch {
    response.writeHead(404).end('Không tìm thấy tệp. Hãy chạy npm ci.');
  }
  });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  if (args.length === 2 && args[0] === '--export-leaderboard') {
    writeFileSync(args[1], JSON.stringify(readLeaderboard(), null, 2) + '\n');
  } else if (args.length) {
    console.error('Dùng: node scripts/serve.mjs [--export-leaderboard <file.json>]');
    process.exitCode = 1;
  } else {
    const port = Number(process.env.PORT ?? 4173);
    webServer().listen(port, '127.0.0.1', () => console.log(`Đảo Đèn Lồng · http://127.0.0.1:${port}`));
  }
}
