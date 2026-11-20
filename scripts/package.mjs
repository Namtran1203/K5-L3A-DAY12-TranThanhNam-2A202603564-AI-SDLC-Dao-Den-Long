import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const destination = resolve(process.argv[2] ?? 'dist/Dao-Den-Long-v1.0.0');
const files = {
  'index.html': 'web/index.html', 'style.css': 'web/style.css', 'game.js': 'web/game.mjs',
  'audio.js': 'web/audio.mjs', 'leaderboard.js': 'web/leaderboard.mjs',
  'vendor/three.js': 'node_modules/three/build/three.module.js',
  'vendor/three.core.js': 'node_modules/three/build/three.core.js',
  'vendor/THREE-LICENSE': 'node_modules/three/LICENSE'
};
for (const file of ['game.contract.json', 'LICENSE', 'CREDITS.md', 'scripts/serve.mjs', 'scripts/leaderboard.mjs',
  'src/game.mjs', 'src/player.mjs', 'src/maps.mjs', 'src/enemies.mjs', 'src/leaderboard-rules.mjs', 'src/benchmark-scene.mjs']) {
  files[file] = file;
}
for (const [name, source] of Object.entries(files)) {
  const target = resolve(destination, name);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(new URL('../' + source, import.meta.url), target);
}
await writeFile(resolve(destination, 'README.txt'), [
  'ĐẢO ĐÈN LỒNG · v1.0.0', '',
  'Sau khi giải nén, chạy node scripts/serve.mjs trong thư mục này (Node.js 22+).',
  'Mở http://127.0.0.1:4173 trong trình duyệt WebGL 2.',
  'Bảng xếp hạng được ghi trên máy. Xuất bằng node scripts/serve.mjs --export-leaderboard scores.json.',
  'Có thể phục vụ thư mục này ở gốc máy chủ web tĩnh. Khi đó điểm được lưu trong trình duyệt.'
].join('\n') + '\n', 'utf8');
console.log(destination);
