import pool from "../config/db.js";
import { weekIdToRange, getWeekLabel } from "./periodId.js";

// =====================================================================
// HALL OF FAME — weekly, monthly and semester leaders
//
// Every Quiz round, Speed Round and Bingo card is turned into 0–100 points
// (a percentage of the maximum), then added up over a time window:
//   • Weekly   = Monday 00:00 to Sunday 23:59, Nairobi time (same as Bingo's week)
//   • Monthly  = the calendar month, Nairobi time
//   • Semester = SEMESTER_START to SEMESTER_END (inclusive)
// =====================================================================

// ---------------------------- SETTINGS -------------------------------
const SEMESTER_START = "2026-09-01"; // first day counted — change if your semester started on another date
const SEMESTER_END = "2026-12-05"; // last day counted (inclusive)
const MIN_ACTIVE_WEEKS = 6; // weeks a player must be active in to qualify as semester leader
const SPRINT_QUESTIONS = 15; // must match QUESTIONS_PER_ROUND in SpeedRound.jsx
const BINGO_SQUARES = 24; // playable squares on a board (the FREE SPACE is not counted)
// ---------------------------------------------------------------------

const TZ = "Africa/Nairobi";
const OFFSET_MS = 3 * 60 * 60 * 1000; // Nairobi is UTC+3 all year (no daylight saving)
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const WEEK0 = weekIdToRange("week-0").start.getTime();

const SEM_START_MS = Date.parse(`${SEMESTER_START}T00:00:00+03:00`);
const SEM_END_MS = Date.parse(`${SEMESTER_END}T00:00:00+03:00`) + DAY_MS; // exclusive

function weekIndexAt(ms) {
  return Math.floor((ms - WEEK0) / WEEK_MS);
}

function weekRange(index) {
  const start = WEEK0 + index * WEEK_MS;
  return { start, end: start + WEEK_MS };
}

function monthRangeAt(ms) {
  const shifted = new Date(ms + OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = shifted.getUTCMonth();
  return monthRange(y, m);
}

function monthRange(y, m) {
  const start = Date.UTC(y, m, 1) - OFFSET_MS;
  const end = Date.UTC(y, m + 1, 1) - OFFSET_MS;
  return {
    start,
    end,
    key: `${y}-${String(m + 1).padStart(2, "0")}`,
    label: new Date(start).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: TZ }),
  };
}

function formatDay(ms) {
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: TZ });
}

// ----------------------------- data ----------------------------------

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS hall_of_fame_winners (
      id SERIAL PRIMARY KEY,
      period_type TEXT NOT NULL,
      period_key TEXT NOT NULL,
      period_label TEXT NOT NULL,
      period_start TIMESTAMPTZ NOT NULL,
      place INTEGER NOT NULL,
      name TEXT NOT NULL,
      points NUMERIC NOT NULL,
      rounds INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (period_type, period_key, place)
    );
  `);
  tableReady = true;
}

// Turns every stored attempt into one "event": who, how many points (0–100), and when.
async function loadEvents(sinceMs) {
  const since = new Date(sinceMs);
  const events = [];

  const quiz = await pool.query(
    `SELECT name, score, total, created_at FROM quiz_attempts WHERE created_at >= $1`,
    [since]
  );
  for (const r of quiz.rows) {
    if (!r.total || r.total <= 0) continue;
    events.push({
      key: String(r.name).trim().toLowerCase(),
      name: String(r.name).trim(),
      pts: Math.min(100, (r.score / r.total) * 100),
      at: new Date(r.created_at).getTime(),
    });
  }

  const sprint = await pool.query(
    `SELECT name, score, created_at FROM sprint_attempts WHERE created_at >= $1`,
    [since]
  );
  for (const r of sprint.rows) {
    events.push({
      key: String(r.name).trim().toLowerCase(),
      name: String(r.name).trim(),
      pts: Math.min(100, (r.score / SPRINT_QUESTIONS) * 100),
      at: new Date(r.created_at).getTime(),
    });
  }

  // Bingo: one card per person per week. It counts in the week it belongs to.
  const bingo = await pool.query(`SELECT name, filled_squares, round FROM bingo_cards WHERE round LIKE 'week-%'`);
  for (const r of bingo.rows) {
    const range = weekIdToRange(r.round);
    if (!range) continue;
    const at = range.start.getTime();
    if (at < sinceMs) continue;
    const filled = Math.max(0, Object.keys(r.filled_squares || {}).length - 1); // minus FREE SPACE
    if (filled === 0) continue;
    events.push({
      key: String(r.name).trim().toLowerCase(),
      name: String(r.name).trim(),
      pts: Math.min(100, (filled / BINGO_SQUARES) * 100),
      at,
    });
  }

  return events;
}

// Adds up points inside one time window and ranks everyone.
function standings(events, startMs, endMs) {
  const map = new Map();
  for (const e of events) {
    if (e.at < startMs || e.at >= endMs) continue;
    let r = map.get(e.key);
    if (!r) {
      r = { name: e.name, nameAt: e.at, points: 0, rounds: 0, weeks: new Set(), lastAt: 0 };
      map.set(e.key, r);
    }
    r.points += e.pts;
    r.rounds += 1;
    r.weeks.add(weekIndexAt(e.at));
    if (e.at > r.nameAt) {
      r.name = e.name; // show the most recent spelling of the name
      r.nameAt = e.at;
    }
    if (e.at > r.lastAt) r.lastAt = e.at;
  }

  return [...map.values()]
    .map((r) => ({
      name: r.name,
      points: Math.round(r.points * 10) / 10,
      rounds: r.rounds,
      activeWeeks: r.weeks.size,
      lastAt: r.lastAt,
    }))
    // More points first; tie → more rounds played; tie → reached it earlier
    .sort((a, b) => b.points - a.points || b.rounds - a.rounds || a.lastAt - b.lastAt)
    .map((r, i) => ({ rank: i + 1, ...r }));
}

function publicRows(rows, limit) {
  return rows.slice(0, limit).map(({ lastAt, ...rest }) => rest);
}

function semesterRows(events) {
  const rows = standings(events, SEM_START_MS, SEM_END_MS).map((r) => ({
    ...r,
    qualified: r.activeWeeks >= MIN_ACTIVE_WEEKS,
  }));
  // Qualified players rank first; the rest follow, in points order
  const qualified = rows.filter((r) => r.qualified);
  const others = rows.filter((r) => !r.qualified);
  return [...qualified, ...others].map((r, i) => ({ ...r, rank: i + 1 }));
}

// -------------------------- public results ---------------------------

let cache = { at: 0, data: null };

export async function getHallOfFame({ full = false } = {}) {
  if (!full && cache.data && Date.now() - cache.at < 30000) return cache.data;

  await ensureTable();
  const now = Date.now();
  const wk = weekIndexAt(now);
  const thisWeek = weekRange(wk);
  const lastWeek = weekRange(wk - 1);
  const month = monthRangeAt(now);

  const events = await loadEvents(Math.min(SEM_START_MS, month.start, lastWeek.start));

  const weekRows = standings(events, thisWeek.start, thisWeek.end);
  const lastWeekRows = standings(events, lastWeek.start, lastWeek.end);
  const monthRows = standings(events, month.start, month.end);
  const semRows = semesterRows(events);
  const limit = full ? 1000 : 10;

  const winners = await pool.query(
    `SELECT period_type, period_key, period_label, period_start, place, name, points
     FROM hall_of_fame_winners
     ORDER BY period_start DESC, place ASC`
  );
  const past = { weeks: [], months: [], semesters: [] };
  const bucket = { week: past.weeks, month: past.months, semester: past.semesters };
  for (const r of winners.rows) {
    const list = bucket[r.period_type];
    if (!list) continue;
    let entry = list.find((x) => x.key === r.period_key);
    if (!entry) {
      entry = { key: r.period_key, label: r.period_label, winners: [] };
      list.push(entry);
    }
    entry.winners.push({ place: r.place, name: r.name, points: Number(r.points) });
  }
  past.weeks = past.weeks.slice(0, 8);
  past.months = past.months.slice(0, 6);

  const data = {
    week: { label: getWeekLabel(`week-${wk}`), leaders: publicRows(weekRows, limit) },
    lastWeek: {
      label: getWeekLabel(`week-${wk - 1}`),
      winner: lastWeekRows[0]
        ? { name: lastWeekRows[0].name, points: lastWeekRows[0].points }
        : null,
    },
    month: { label: month.label, leaders: publicRows(monthRows, limit) },
    semester: {
      label: `${formatDay(SEM_START_MS)} – ${formatDay(SEM_END_MS - 1)}`,
      endsAt: new Date(SEM_END_MS).toISOString(),
      finished: now >= SEM_END_MS,
      minWeeks: MIN_ACTIVE_WEEKS,
      leaders: publicRows(semRows, limit),
    },
    past,
  };

  if (!full) cache = { at: Date.now(), data };
  return data;
}

// ------------------- saving winners + announcing ---------------------

async function saveWinners(type, key, label, startMs, rows) {
  const top = rows.slice(0, 3);
  let newlySaved = false;
  for (const r of top) {
    const res = await pool.query(
      `INSERT INTO hall_of_fame_winners (period_type, period_key, period_label, period_start, place, name, points, rounds)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (period_type, period_key, place) DO NOTHING
       RETURNING id`,
      [type, key, label, new Date(startMs), r.rank, r.name, r.points, r.rounds]
    );
    if (res.rowCount > 0 && r.rank === 1) newlySaved = true;
  }
  return newlySaved ? top[0] : null;
}

async function announce(title, body) {
  try {
    const { broadcastNotification } = await import("./sendPush.js");
    await broadcastNotification({ title, body, url: "/#hall-of-fame" });
  } catch (err) {
    console.error("Hall of Fame announcement failed:", err.message);
  }
}

// Called by the cron job. Saves winners of every finished week / month / the semester
// (once each) and announces the ones that finished in the last 7 days.
export async function runHallOfFameCheck() {
  await ensureTable();
  const now = Date.now();
  const events = await loadEvents(SEM_START_MS);
  const saved = [];

  // Weeks
  const currentWeek = weekIndexAt(now);
  for (let wk = weekIndexAt(SEM_START_MS); wk < currentWeek; wk++) {
    const range = weekRange(wk);
    const rows = standings(events, Math.max(range.start, SEM_START_MS), Math.min(range.end, SEM_END_MS));
    if (rows.length === 0) continue;
    const label = getWeekLabel(`week-${wk}`);
    const winner = await saveWinners("week", `week-${wk}`, label, range.start, rows);
    if (winner) {
      saved.push(`week ${label}`);
      if (now - range.end < 7 * DAY_MS) {
        await announce("🏆 Weekly champion", `${winner.name} topped last week with ${winner.points} points. See the Hall of Fame!`);
      }
    }
  }

  // Months (only fully finished ones)
  let cursor = monthRangeAt(SEM_START_MS);
  while (cursor.end <= now) {
    const rows = standings(events, Math.max(cursor.start, SEM_START_MS), Math.min(cursor.end, SEM_END_MS));
    if (rows.length > 0) {
      const winner = await saveWinners("month", cursor.key, cursor.label, cursor.start, rows);
      if (winner) {
        saved.push(`month ${cursor.label}`);
        if (now - cursor.end < 7 * DAY_MS) {
          await announce("🏆 Monthly champion", `${winner.name} is ${cursor.label}'s champion with ${winner.points} points!`);
        }
      }
    }
    const next = new Date(cursor.end + OFFSET_MS);
    cursor = monthRange(next.getUTCFullYear(), next.getUTCMonth());
  }

  // Semester
  if (now >= SEM_END_MS) {
    const rows = semesterRows(events).filter((r) => r.qualified);
    if (rows.length > 0) {
      const label = `${formatDay(SEM_START_MS)} – ${formatDay(SEM_END_MS - 1)}`;
      const winner = await saveWinners("semester", `semester-${SEMESTER_END}`, label, SEM_START_MS, rows);
      if (winner) {
        saved.push("semester");
        if (now - SEM_END_MS < 7 * DAY_MS) {
          await announce("🏆 Semester champion", `${winner.name} is the MUTMLSA semester champion with ${winner.points} points!`);
        }
      }
    }
  }

  cache = { at: 0, data: null }; // make the next page load fresh
  return { saved };
}