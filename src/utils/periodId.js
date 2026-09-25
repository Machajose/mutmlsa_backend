// utils/periodId.js — BACKEND copy

const REFERENCE_MIDNIGHT = new Date("2026-01-01T00:00:00Z").getTime();
const MANUAL_OVERRIDE = null;

export function getCurrentPeriodId(periodDays = 2) {
  if (MANUAL_OVERRIDE) return MANUAL_OVERRIDE;
  const periodMs = periodDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const periodNumber = Math.floor((now - REFERENCE_MIDNIGHT) / periodMs);
  return `period-${periodNumber}`;
}

// Decodes a period id back into its actual start/end dates.
export function periodIdToRange(periodId, periodDays = 2) {
  const num = parseInt(periodId.replace("period-", ""), 10);
  const periodMs = periodDays * 24 * 60 * 60 * 1000;
  const start = new Date(REFERENCE_MIDNIGHT + num * periodMs);
  const end = new Date(start.getTime() + periodMs - 1);
  return { start, end };
}

// A human-readable label for a period, e.g. "Sep 25 – Sep 26".
export function formatPeriodLabel(periodId, periodDays = 2) {
  const { start, end } = periodIdToRange(periodId, periodDays);
  const opts = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString("en-US", opts)}`;
}