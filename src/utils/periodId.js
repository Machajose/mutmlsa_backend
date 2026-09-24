// utils/periodId.js

// Reference point: any past midnight works as the anchor — periods count
// forward from here in fixed-size blocks, always starting/ending at
// midnight UTC (not an arbitrary time of day).
const REFERENCE_MIDNIGHT = new Date("2026-01-01T00:00:00Z").getTime();

// Set this to a specific string (e.g. "manual-override-1") to force
// everyone onto the same period regardless of date — leave as null for
// normal automatic rotation.
const MANUAL_OVERRIDE = null;

export function getCurrentPeriodId(periodDays = 2) {
  if (MANUAL_OVERRIDE) return MANUAL_OVERRIDE;

  const periodMs = periodDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const periodNumber = Math.floor((now - REFERENCE_MIDNIGHT) / periodMs);
  return `period-${periodNumber}`;
}

// Useful for the "champions this week" feature — returns every period
// string that has occurred so far within the current calendar week.
export function getPeriodsThisWeek(periodDays = 2) {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0 = Sunday
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  const mondayThisWeek = new Date(now);
  mondayThisWeek.setUTCDate(now.getUTCDate() - daysSinceMonday);
  mondayThisWeek.setUTCHours(0, 0, 0, 0);

  const periodMs = periodDays * 24 * 60 * 60 * 1000;
  const periods = [];
  let cursor = mondayThisWeek.getTime();
  while (cursor <= Date.now()) {
    const periodNumber = Math.floor((cursor - REFERENCE_MIDNIGHT) / periodMs);
    periods.push(`period-${periodNumber}`);
    cursor += periodMs;
  }
  return [...new Set(periods)];
}