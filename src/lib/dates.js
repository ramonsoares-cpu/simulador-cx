const DAY_MS = 24 * 60 * 60 * 1000;
// Serial 0 do Sheets = 1899-12-30
const SHEETS_EPOCH_UTC = Date.UTC(1899, 11, 30);
// Dia de referência = 03:00 UTC (meia-noite de Brasília), como no Apps Script original
const DAY_ANCHOR_HOUR = 3;

const pad = (n) => String(n).padStart(2, '0');

/** Chave do dia (ms UTC às 03:00) a partir de serial do Sheets, string ISO ou outra data parseável. */
function parseDateMs(raw) {
  if (raw === null || raw === undefined || raw === '') return null;

  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0) return null;
    return SHEETS_EPOCH_UTC + Math.floor(raw) * DAY_MS + DAY_ANCHOR_HOUR * 3600 * 1000;
  }

  const s = String(raw).trim();
  const match = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), DAY_ANCHOR_HOUR, 0, 0);

  const fallback = new Date(s);
  return Number.isNaN(fallback.getTime()) ? null : fallback.getTime();
}

/** 'yyyy-MM-dd' (UTC) de serial do Sheets ou string; usado nos feriados. */
function toDateString(raw) {
  if (typeof raw === 'number') {
    const d = new Date(SHEETS_EPOCH_UTC + Math.floor(raw) * DAY_MS);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  return String(raw).trim();
}

module.exports = { parseDateMs, toDateString, pad };
