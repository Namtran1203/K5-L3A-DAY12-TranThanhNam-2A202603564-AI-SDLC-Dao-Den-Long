import { createEntry, topEntries, validRun } from '/src/leaderboard-rules.mjs';

const KEY = 'lantern-leaderboard';
const local = () => topEntries(JSON.parse(localStorage.getItem(KEY) ?? '[]'));

async function responseFor(method, run) {
  let response;
  try {
    response = await fetch('/api/leaderboard', {
      method, ...(run ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(run) } : {})
    });
  } catch { return null; }
  if ([404, 405, 501].includes(response.status) || !response.headers.get('content-type')?.includes('application/json')) return null;
  if (!response.ok) throw new Error('Không thể truy cập bảng xếp hạng.');
  return (await response.json()).entries;
}

export async function leaderboard() {
  return await responseFor('GET') ?? local();
}

export async function saveRun(run) {
  if (!validRun(run)) throw new TypeError('Tên cần 3–12 ký tự A–Z, a–z, 0–9 hoặc _.');
  const saved = await responseFor('POST', run);
  if (saved) return saved;
  const entries = topEntries([...local(), createEntry(run)]);
  localStorage.setItem(KEY, JSON.stringify(entries));
  return entries;
}
