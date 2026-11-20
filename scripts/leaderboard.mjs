import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { createEntry, topEntries } from '../src/leaderboard-rules.mjs';

function file() {
  const directory = process.platform === 'win32' ? process.env.LOCALAPPDATA :
    (process.platform === 'darwin' ? join(homedir(), 'Library', 'Application Support') : process.env.XDG_DATA_HOME);
  return process.env.LANTERN_LEADERBOARD ?? join(directory ?? join(homedir(), '.local', 'share'),
    'dao-den-long', 'leaderboard.json');
}

export function readLeaderboard() {
  try {
    const { entries } = JSON.parse(readFileSync(file(), 'utf8'));
    return { entries: topEntries(entries) };
  } catch (error) {
    if (error.code === 'ENOENT') return { entries: [] };
    throw error;
  }
}

export function addLeaderboard(run) {
  const payload = { entries: topEntries([...readLeaderboard().entries, createEntry(run)]) };
  const target = file();
  mkdirSync(dirname(target), { recursive: true });
  const staged = target + '.' + randomUUID() + '.tmp';
  writeFileSync(staged, JSON.stringify(payload, null, 2) + '\n', { mode: 0o600 });
  renameSync(staged, target);
  return payload;
}
