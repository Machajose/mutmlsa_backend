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
//
// Extras:
//   • Cohorts: players claim their year of study (1–4) and get their own boards.
//   • Defending champion: whoever received last week's prize can still top the
//     board, but the weekly prize passes to the next best player.
// =====================================================================

// ---------------------------- SETTINGS -------------------------------
const SEMESTER_START = "2026-11-01"; // everything starts fresh on this day (nothing earlier counts)
const SEMESTER_END = "2026-12-05"; // last day counted (inclusive)
const MIN_ACTIVE_WEEKS = 2;
const LEVEL_WEIGHT = { 1: 0.85, 2: 0.92, 3: 1, 4: 1, none: 0.95 }; // by claimed year // weeks a player must be active in to qualify as semester leader
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

// First full Monday-to-Sunday week that counts (a part-week at the start never gets a winner)
function firstCountedWeek() {
  const idx = weekIndexAt(SEM_START_MS);
  return weekRange(idx).start >= SEM_START_MS ? idx : idx + 1;
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // Upgrades for tables created by the first version — safe to run every time
  await pool.query(`ALTER TABLE hall_of_fame_winners ADD COLUMN IF NOT EXISTS cohort INTEGER NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE hall_of_fame_winners ADD COLUMN IF NOT EXISTS note TEXT`);
  await pool.query(
    `ALTER TABLE hall_of_fame_winners DROP CONSTRAINT IF EXISTS hall_of_fame_winners_period_type_period_key_place_key`
  );
  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS hall_of_fame_winners_unique
     ON hall_of_fame_winners (period_type, period_key, cohort, place)`
  );
  await pool.query(`
    CREATE TABLE IF NOT EXISTS hall_of_fame_players (
      name_key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      year INTEGER NOT NULL CHECK (year BETWEEN 1 AND 4),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  tableReady = true;
}

async function loadPlayers() {
  const res = await pool.query(`SELECT name_key, year FROM hall_of_fame_players`);
  const map = new Map();
  for (const r of res.rows) map.set(r.name_key, r.year);
  return map;
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

  // Bingo. Old weekly cards count in the week they belong to. Newer cards last until they are
  // finished, so their boxes are counted in the week each box was filled.
  const bingo = await pool.query(
    `SELECT name, filled_squares, fill_log, round FROM bingo_cards WHERE round LIKE 'week-%' OR round LIKE 'card-%'`
  );
  for (const r of bingo.rows) {
    const key = String(r.name).trim().toLowerCase();
    const name = String(r.name).trim();
    const filledSquares = r.filled_squares || {};

    if (/^week-/.test(r.round)) {
      const range = weekIdToRange(r.round);
      if (!range) continue;
      const at = range.start.getTime();
      if (at < sinceMs) continue;
      const filled = Math.max(0, Object.keys(filledSquares).length - 1); // minus FREE SPACE
      if (filled === 0) continue;
      events.push({ key, name, pts: Math.min(100, (filled / BINGO_SQUARES) * 100), at });
      continue;
    }

    const log = Array.isArray(r.fill_log) ? r.fill_log : [];
    const byWeek = new Map();
    for (const e of log) {
      if (!e || filledSquares[e.i] === undefined) continue; // box was cleared since
      const t = Date.parse(e.t);
      if (Number.isNaN(t)) continue;
      const wk = weekIndexAt(t);
      const g = byWeek.get(wk) || { count: 0, first: t };
      g.count += 1;
      g.first = Math.min(g.first, t);
      byWeek.set(wk, g);
    }
    for (const g of byWeek.values()) {
      events.push({ key, name, pts: Math.min(100, (g.count / BINGO_SQUARES) * 100), at: g.first });
    }
  }

  // Easier question sets earn slightly fewer points on the overall board, so a harder
  // year is never out-scored just for playing easier questions. Year boards are unaffected
  // (everyone in a year plays the same level).
  const players = await loadPlayers();
  for (const e of events) {
    const y = players.get(e.key);
    e.pts = e.pts * (LEVEL_WEIGHT[y] || LEVEL_WEIGHT.none);
  }

  // Nothing played before the official start counts
  return events.filter((e) => e.at >= SEM_START_MS);
}

// Adds up points inside one time window and ranks everyone.
function standings(events, startMs, endMs) {
  const map = new Map();
  for (const e of events) {
    if (e.at < startMs || e.at >= endMs) continue;
    let r = map.get(e.key);
    if (!r) {
      r = { key: e.key, name: e.name, nameAt: e.at, points: 0, rounds: 0, weeks: new Set(), lastAt: 0 };
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
      key: r.key,
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
  return rows.slice(0, limit).map(({ lastAt, key, ...rest }) => rest);
}

const YEARS = [1, 2, 3, 4];

function eventsForYear(events, players, year) {
  return events.filter((e) => players.get(e.key) === year);
}

function reRank(rows) {
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

// Walks through every finished week in order and decides who gets the weekly PRIZE.
// If last week's prize-winner tops the board again they are the "defending champion":
// they keep their place on the leaderboard, but the prize goes to the next best player.
function weeklyPrizeChain(events, toWeek) {
  const out = [];
  let prevPrizeKey = null;
  for (let wk = firstCountedWeek(); wk < toWeek; wk++) {
    const range = weekRange(wk);
    const rows = standings(events, Math.max(range.start, SEM_START_MS), Math.min(range.end, SEM_END_MS));
    if (rows.length === 0) {
      prevPrizeKey = null; // nobody played, so nobody is "defending"
      out.push({ wk, range, rows, prizeRows: [], defender: null });
      continue;
    }
    let prizeRows = rows;
    let defender = null;
    if (prevPrizeKey && rows[0].key === prevPrizeKey && rows.length > 1) {
      defender = rows[0];
      prizeRows = reRank(rows.slice(1));
    }
    prevPrizeKey = prizeRows[0].key;
    out.push({ wk, range, rows, prizeRows, defender });
  }
  return out;
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

function cohortBoards(events, players, startMs, endMs, limit, semester = false) {
  const out = {};
  for (const y of YEARS) {
    const evs = eventsForYear(events, players, y);
    const rows = semester ? semesterRows(evs) : standings(evs, startMs, endMs);
    out[y] = publicRows(rows, limit);
  }
  return out;
}

export async function getHallOfFame({ full = false } = {}) {
  if (!full && cache.data && Date.now() - cache.at < 30000) return cache.data;

  await ensureTable();
  const now = Date.now();
  const wk = weekIndexAt(now);
  const thisWeek = weekRange(wk);
  const month = monthRangeAt(now);

  const events = await loadEvents(Math.min(SEM_START_MS, month.start, weekRange(wk - 1).start));
  const players = await loadPlayers();
  const limit = full ? 1000 : 10;

  const weekRows = standings(events, thisWeek.start, thisWeek.end);
  const monthRows = standings(events, month.start, month.end);
  const semRows = semesterRows(events);

  // Last week's prize winner (after the defending-champion rule) and this week's defender
  const chain = weeklyPrizeChain(events, wk);
  const last = chain.find((c) => c.wk === wk - 1);
  const lastPrize = last && last.prizeRows[0] ? last.prizeRows[0] : null;
  const defending = lastPrize && weekRows[0] && weekRows[0].key === lastPrize.key ? weekRows[0].name : null;

  // Last week's leader in each year (live, so a late claim is reflected straight away)
  const lastRange = weekRange(wk - 1);
  const lastCohorts = {};
  for (const y of YEARS) {
    const rows = standings(
      eventsForYear(events, players, y),
      Math.max(lastRange.start, SEM_START_MS),
      lastRange.end
    );
    const top = publicRows(rows, 1)[0];
    lastCohorts[y] = top ? { name: top.name, points: top.points } : null;
  }

  const winners = await pool.query(
    `SELECT period_type, period_key, period_label, period_start, cohort, place, name, points, note
     FROM hall_of_fame_winners
     ORDER BY period_start DESC, cohort ASC, place ASC`
  );
  const past = { weeks: [], months: [], semesters: [] };
  const bucket = { week: past.weeks, month: past.months, semester: past.semesters };
  for (const r of winners.rows) {
    const list = bucket[r.period_type];
    if (!list) continue;
    let entry = list.find((x) => x.key === r.period_key);
    if (!entry) {
      entry = { key: r.period_key, label: r.period_label, winners: [], note: null, cohorts: {} };
      list.push(entry);
    }
    const item = { place: r.place, name: r.name, points: Number(r.points) };
    if (r.cohort === 0) {
      entry.winners.push(item);
      if (r.place === 1 && r.note) entry.note = r.note;
    } else {
      (entry.cohorts[r.cohort] = entry.cohorts[r.cohort] || []).push(item);
    }
  }
  past.weeks = past.weeks.slice(0, 8);
  past.months = past.months.slice(0, 6);

  const data = {
    week: {
      label: getWeekLabel(`week-${wk}`),
      defending,
      leaders: publicRows(weekRows, limit),
      cohorts: cohortBoards(events, players, thisWeek.start, thisWeek.end, limit),
    },
    lastWeek: {
      label: getWeekLabel(`week-${wk - 1}`),
      winner: lastPrize ? { name: lastPrize.name, points: lastPrize.points } : null,
      cohorts: wk - 1 >= firstCountedWeek() ? lastCohorts : {},
      note: last && last.defender ? `${last.defender.name} had the most points but was the defending champion, so the prize passed on.` : null,
    },
    month: {
      label: month.label,
      leaders: publicRows(monthRows, limit),
      cohorts: cohortBoards(events, players, month.start, month.end, limit),
    },
    semester: {
      label: `${formatDay(SEM_START_MS)} – ${formatDay(SEM_END_MS - 1)}`,
      endsAt: new Date(SEM_END_MS).toISOString(),
      finished: now >= SEM_END_MS,
      minWeeks: MIN_ACTIVE_WEEKS,
      leaders: publicRows(semRows, limit),
      cohorts: cohortBoards(events, players, SEM_START_MS, SEM_END_MS, limit, true),
    },
    past,
  };

  if (full) {
    const list = await pool.query(`SELECT name, year FROM hall_of_fame_players ORDER BY year, name`);
    data.players = list.rows;
  } else {
    cache = { at: Date.now(), data };
  }
  return data;
}

// ------------------------- year of study ----------------------------

export async function claimYear(rawName, rawYear) {
  await ensureTable();
  const name = String(rawName || "").trim();
  const year = Number(rawYear);
  if (!name || name.length > 60) return { status: 400, error: "Please enter your name (up to 60 characters)." };
  if (!Number.isInteger(year) || year < 1 || year > 4) return { status: 400, error: "Please pick a year from 1 to 4." };

  const key = name.toLowerCase();
  const inserted = await pool.query(
    `INSERT INTO hall_of_fame_players (name_key, name, year) VALUES ($1, $2, $3)
     ON CONFLICT (name_key) DO NOTHING RETURNING year`,
    [key, name, year]
  );

  if (inserted.rowCount === 0) {
    const existing = await pool.query(`SELECT year FROM hall_of_fame_players WHERE name_key = $1`, [key]);
    const current = existing.rows[0] ? existing.rows[0].year : null;
    if (current === year) return { status: 200, ok: true, year, already: true };
    return {
      status: 409,
      year: current,
      error: `"${name}" is already set to Year ${current}. Ask a committee member if it needs changing.`,
    };
  }

  // Has this name actually played anything? Helps people notice a spelling mismatch.
  const seen = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM quiz_attempts WHERE LOWER(TRIM(name)) = $1) +
       (SELECT COUNT(*) FROM sprint_attempts WHERE LOWER(TRIM(name)) = $1) +
       (SELECT COUNT(*) FROM bingo_cards WHERE LOWER(TRIM(name)) = $1) AS n`,
    [key]
  );
  cache = { at: 0, data: null };
  return { status: 200, ok: true, year, known: Number(seen.rows[0].n) > 0 };
}

// Committee only: set or change someone's year (year = 0 removes it)
export async function setPlayerYear(rawName, rawYear) {
  await ensureTable();
  const name = String(rawName || "").trim();
  const year = Number(rawYear);
  if (!name) return { status: 400, error: "name is required." };
  const key = name.toLowerCase();
  if (year === 0) {
    await pool.query(`DELETE FROM hall_of_fame_players WHERE name_key = $1`, [key]);
  } else if (Number.isInteger(year) && year >= 1 && year <= 4) {
    await pool.query(
      `INSERT INTO hall_of_fame_players (name_key, name, year) VALUES ($1, $2, $3)
       ON CONFLICT (name_key) DO UPDATE SET year = EXCLUDED.year, name = EXCLUDED.name`,
      [key, name, year]
    );
  } else {
    return { status: 400, error: "year must be 1–4, or 0 to remove." };
  }
  cache = { at: 0, data: null };
  return { status: 200, ok: true };
}

// ------------------- saving winners + announcing ---------------------

async function saveWinners(type, key, label, startMs, cohort, rows, note = null) {
  const top = rows.slice(0, 3);
  let newlySaved = false;
  for (const r of top) {
    const res = await pool.query(
      `INSERT INTO hall_of_fame_winners (period_type, period_key, period_label, period_start, cohort, place, name, points, rounds, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (period_type, period_key, cohort, place) DO NOTHING
       RETURNING id`,
      [type, key, label, new Date(startMs), cohort, r.rank, r.name, r.points, r.rounds, r.rank === 1 ? note : null]
    );
    if (res.rowCount > 0 && r.rank === 1) newlySaved = true;
  }
  return newlySaved ? top[0] : null;
}

// Year winners stay open for a week after a period ends, so players who claim their year a
// little late still count. After that they are locked in.
const COHORT_GRACE_MS = 7 * DAY_MS;

async function saveCohorts(type, key, label, startMs, events, players, startClip, endClip, semester = false) {
  const perYear = {};
  for (const y of YEARS) {
    const evs = eventsForYear(events, players, y);
    let rows = semester ? semesterRows(evs).filter((r) => r.qualified) : standings(evs, startClip, endClip);
    if (semester) rows = reRank(rows);
    perYear[y] = rows;
  }
  if (Date.now() - endClip < COHORT_GRACE_MS) {
    await pool.query(
      `DELETE FROM hall_of_fame_winners WHERE period_type = $1 AND period_key = $2 AND cohort > 0`,
      [type, key]
    );
  }
  for (const y of YEARS) {
    if (perYear[y].length > 0) await saveWinners(type, key, label, startMs, y, perYear[y]);
  }
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
  const players = await loadPlayers();
  const saved = [];

  // Weeks (with the defending-champion rule)
  const chain = weeklyPrizeChain(events, weekIndexAt(now));
  for (const c of chain) {
    if (c.prizeRows.length === 0) continue;
    const label = getWeekLabel(`week-${c.wk}`);
    const note = c.defender
      ? `${c.defender.name} had the most points but was the defending champion, so the prize passed on.`
      : null;
    const winner = await saveWinners("week", `week-${c.wk}`, label, c.range.start, 0, c.prizeRows, note);
    await saveCohorts(
      "week", `week-${c.wk}`, label, c.range.start, events, players,
      Math.max(c.range.start, SEM_START_MS), Math.min(c.range.end, SEM_END_MS)
    );
    if (winner) {
      saved.push(`week ${label}`);
      if (now - c.range.end < 7 * DAY_MS) {
        await announce("🏆 Weekly champion", `${winner.name} won last week with ${winner.points} points. See the Hall of Fame!`);
      }
    }
  }

  // Months (only fully finished ones)
  let cursor = monthRangeAt(SEM_START_MS);
  while (cursor.end <= now) {
    const s = Math.max(cursor.start, SEM_START_MS);
    const e = Math.min(cursor.end, SEM_END_MS);
    const rows = standings(events, s, e);
    if (rows.length > 0) {
      const winner = await saveWinners("month", cursor.key, cursor.label, cursor.start, 0, rows);
      await saveCohorts("month", cursor.key, cursor.label, cursor.start, events, players, s, e);
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
    const rows = reRank(semesterRows(events).filter((r) => r.qualified));
    if (rows.length > 0) {
      const label = `${formatDay(SEM_START_MS)} – ${formatDay(SEM_END_MS - 1)}`;
      const key = `semester-${SEMESTER_END}`;
      const winner = await saveWinners("semester", key, label, SEM_START_MS, 0, rows);
      await saveCohorts("semester", key, label, SEM_START_MS, events, players, SEM_START_MS, SEM_END_MS, true);
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