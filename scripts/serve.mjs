import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';

const routes = new Map([
  ['/', ['../web/index.html', 'text/html; charset=utf-8']],
  ['/style.css', ['../web/style.css', 'text/css; charset=utf-8']],
  ['/game.js', ['../web/game.mjs', 'text/javascript; charset=utf-8']],
  ['/src/game.mjs', ['../src/game.mjs', 'text/javascript; charset=utf-8']],
  ['/game.contract.json', ['../game.contract.json', 'application/json; charset=utf-8']],
  ['/vendor/three.js', ['../node_modules/three/build/three.module.js', 'text/javascript; charset=utf-8']],
  ['/vendor/three.core.js', ['../node_modules/three/build/three.core.js', 'text/javascript; charset=utf-8']]
]);

const port = Number(process.env.PORT ?? 4173);
createServer(async (request, response) => {
  const route = routes.get(request.url?.split('?')[0]);
  if (!route || !['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(404).end();
    return;
  }
  const [path, contentType] = route;
  const file = new URL(path, import.meta.url);
  try {
    const { size } = await stat(file);
    response.writeHead(200, { 'Content-Type': contentType, 'Content-Length': size });
    if (request.method === 'HEAD') response.end();
    else createReadStream(file).on('error', () => response.destroy()).pipe(response);
  } catch {
    response.writeHead(404).end('Không tìm thấy tệp. Hãy chạy npm ci.');
  }
}).listen(port, '127.0.0.1', () => console.log(`Đảo Đèn Lồng · http://127.0.0.1:${port}`));
