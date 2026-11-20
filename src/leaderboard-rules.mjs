export const NAME_PATTERN = /^[A-Za-z0-9_]{3,12}$/;

export function validRun(value) {
  return value !== null && typeof value === 'object' && typeof value.name === 'string' &&
    NAME_PATTERN.test(value.name) && Number.isSafeInteger(value.score) && value.score >= 0 &&
    Number.isInteger(value.nights_won) && value.nights_won >= 0 && value.nights_won <= 3 &&
    Number.isSafeInteger(value.seed);
}

export function topEntries(entries) {
  return entries.filter((entry) => validRun(entry) && typeof entry.achieved_at === 'string' &&
    Number.isFinite(Date.parse(entry.achieved_at)))
    .sort((a, b) => b.score - a.score || Date.parse(a.achieved_at) - Date.parse(b.achieved_at)).slice(0, 10);
}

export function createEntry(run) {
  if (!validRun(run)) throw new TypeError('Tên cần 3–12 ký tự A–Z, a–z, 0–9 hoặc _.');
  const { name, score, nights_won, seed } = run;
  return { name, score, nights_won, achieved_at: new Date().toISOString(), seed };
}
