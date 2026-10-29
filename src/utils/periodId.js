// SAME FILE in both places: frontend src/utils/periodId.js AND backend utils/periodId.js.
// All rounds roll over at midnight Nairobi time (not UTC).

const TZ = "Africa/Nairobi";
const DAY_MS = 24 * 60 * 60 * 1000;
const PERIOD_REF = new Date("2026-01-01T00:00:00+03:00").getTime();
const WEEK_REF = new Date("2026-01-05T00:00:00+03:00").getTime(); // a Monday

// Set to a string (e.g. "manual-1") to force everyone onto one quiz/sprint
// round regardless of the date. Leave null for normal rotation.
const MANUAL_OVERRIDE = null;

// Quiz and Speed Round: a new round every `periodDays` days.
export function getCurrentPeriodId(periodDays = 2) {
  if (MANUAL_OVERRIDE) return MANUAL_OVERRIDE;
  const periodMs = periodDays * DAY_MS;
  return `period-${Math.floor((Date.now() - PERIOD_REF) / periodMs)}`;
}

// Bingo: a new board every Monday at midnight Nairobi time.
export function getCurrentWeekId() {
  return `week-${Math.floor((Date.now() - WEEK_REF) / (7 * DAY_MS))}`;
}

function formatDay(date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: TZ });
}

export function periodIdToRange(periodId, periodDays = 2) {
  const match = /^period-(-?\d+)$/.exec(periodId || "");
  if (!match) return null;
  const periodMs = periodDays * DAY_MS;
  const start = new Date(PERIOD_REF + Number(match[1]) * periodMs);
  const end = new Date(start.getTime() + periodMs - 1);
  return { start, end };
}

export function formatPeriodLabel(periodId, periodDays = 2) {
  const range = periodIdToRange(periodId, periodDays);
  if (!range) return String(periodId);
  return `${formatDay(range.start)} – ${formatDay(range.end)}`;
}

export function weekIdToRange(weekId) {
  const match = /^week-(-?\d+)$/.exec(weekId || "");
  if (!match) return null;
  const start = new Date(WEEK_REF + Number(match[1]) * 7 * DAY_MS);
  const end = new Date(start.getTime() + 7 * DAY_MS - 1);
  return { start, end };
}

export function getWeekLabel(weekId) {
  const range = weekIdToRange(weekId);
  if (!range) return "";
  const opts = { day: "numeric", month: "short", timeZone: TZ };
  return `${range.start.toLocaleDateString("en-GB", opts)} – ${range.end.toLocaleDateString("en-GB", opts)}`;
}

// Kept so any older import of this name keeps working.
export function getPeriodsThisWeek(periodDays = 2) {
  const periodMs = periodDays * DAY_MS;
  const weekStart = WEEK_REF + Math.floor((Date.now() - WEEK_REF) / (7 * DAY_MS)) * 7 * DAY_MS;
  const first = Math.floor((weekStart - PERIOD_REF) / periodMs);
  const last = Math.floor((Date.now() - PERIOD_REF) / periodMs);
  const out = [];
  for (let n = first; n <= last; n++) out.push(`period-${n}`);
  return out;
}