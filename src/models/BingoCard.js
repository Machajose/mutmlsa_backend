import pool from "../config/db.js";
import { getCurrentWeekId, weekIdToRange } from "../utils/periodId.js";

// The 12 winning lines on a 5x5 grid: 5 rows, 5 columns, 2 diagonals.
const WINNING_LINES = [
  [0, 1, 2, 3, 4],
  [5, 6, 7, 8, 9],
  [10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19],
  [20, 21, 22, 23, 24],
  [0, 5, 10, 15, 20],
  [1, 6, 11, 16, 21],
  [2, 7, 12, 17, 22],
  [3, 8, 13, 18, 23],
  [4, 9, 14, 19, 24],
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20],
];

const PLAYABLE_SQUARES = 24; // 25 boxes minus the FREE SPACE

export function hasBingo(filledSquares) {
  const filledKeys = Object.keys(filledSquares).map(Number);
  return WINNING_LINES.some((line) => line.every((i) => filledKeys.includes(i)));
}

export function hasBlackout(filledSquares) {
  return Object.keys(filledSquares).length === 25;
}

// "card-3" -> 3. Anything else (old weekly cards) -> 0.
function cardNumber(round) {
  const m = /^card-(\d+)$/.exec(round || "");
  return m ? Number(m[1]) : 0;
}

export async function initBingoTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bingo_cards (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      filled_squares JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // Safe to run on every startup: adds the new columns only if missing.
  await pool.query(`ALTER TABLE bingo_cards ADD COLUMN IF NOT EXISTS round TEXT`);
  await pool.query(`ALTER TABLE bingo_cards ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`);
  await pool.query(`ALTER TABLE bingo_cards ADD COLUMN IF NOT EXISTS fill_log JSONB NOT NULL DEFAULT '[]'`);
  // Cards now last until they are finished and confirmed by the committee:
  //   status: 'active' (being filled) -> 'pending' (all boxes full, waiting for an admin) -> 'confirmed'
  //   board_seed: which board layout this card uses (old weekly cards keep their week's board)
  await pool.query(`ALTER TABLE bingo_cards ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'`);
  await pool.query(`ALTER TABLE bingo_cards ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE bingo_cards ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE bingo_cards ADD COLUMN IF NOT EXISTS board_seed TEXT`);
  await pool.query(`CREATE INDEX IF NOT EXISTS bingo_cards_round_idx ON bingo_cards (round)`);

  // One-time switch-over: cards from the current week carry on as ordinary cards (same board),
  // so nobody loses progress. Their box times are filled in from when the card was made.
  const current = getCurrentWeekId();
  const legacy = await pool.query(
    `SELECT id, filled_squares, fill_log, created_at FROM bingo_cards WHERE round = $1`,
    [current]
  );
  for (const c of legacy.rows) {
    const filled = c.filled_squares || {};
    const log = Array.isArray(c.fill_log) ? [...c.fill_log] : [];
    const logged = new Set(log.map((e) => Number(e.i)));
    for (const [i, n] of Object.entries(filled)) {
      if (Number(i) === 12 || logged.has(Number(i))) continue;
      log.push({ i: Number(i), n: String(n), t: new Date(c.created_at).toISOString() });
    }
    const count = Object.keys(filled).filter((i) => Number(i) !== 12).length;
    const status = count >= PLAYABLE_SQUARES ? "pending" : "active";
    await pool.query(
      `UPDATE bingo_cards
         SET board_seed = $2, round = 'card-1', fill_log = $3::jsonb, status = $4,
             completed_at = CASE WHEN $4 = 'pending' THEN now() ELSE NULL END
       WHERE id = $1`,
      [c.id, current, JSON.stringify(log), status]
    );
  }
}

// Gives a player their card:
//  - no card yet                       -> card 1
//  - card still being filled / pending -> the same card back
//  - last card confirmed by an admin   -> the next card
export async function createCard(name) {
  const latestRes = await pool.query(
    `SELECT * FROM bingo_cards WHERE LOWER(name) = LOWER($1) ORDER BY id DESC LIMIT 1`,
    [name]
  );
  const latest = latestRes.rows[0];

  let next = 1;
  if (latest) {
    const n = cardNumber(latest.round);
    if (n > 0) {
      if (latest.status !== "confirmed") return latest; // keep going with this one
      next = n + 1;
    } else if (latest.round === getCurrentWeekId()) {
      return latest; // an old-style card from this week
    }
    // an old weekly card from a past week: start at card 1
  }

  const round = `card-${next}`;
  const result = await pool.query(
    `INSERT INTO bingo_cards (name, filled_squares, round, board_seed, status)
     VALUES ($1, '{"12": "FREE"}', $2, $2, 'active') RETURNING *`,
    [name, round]
  );
  return result.rows[0];
}

export async function getCardById(id) {
  const result = await pool.query(`SELECT * FROM bingo_cards WHERE id = $1`, [id]);
  return result.rows[0];
}

// Finds a player's latest card by name (for opening the same card on another device)
export async function findCardsByName(name) {
  const result = await pool.query(
    `SELECT DISTINCT ON (LOWER(name)) *
       FROM bingo_cards
      WHERE name ILIKE $1 AND (round LIKE 'card-%' OR round = $2)
      ORDER BY LOWER(name), id DESC`,
    [`%${name}%`, getCurrentWeekId()]
  );
  return result.rows;
}

export async function fillSquare(id, squareIndex, personName) {
  const card = await getCardById(id);
  if (!card) return null;

  const updated = { ...card.filled_squares };
  if (personName) {
    updated[squareIndex] = personName;
  } else {
    delete updated[squareIndex];
  }

  // Keep a timestamp for every name entered (a cleared box drops its entries)
  const log = Array.isArray(card.fill_log) ? card.fill_log.filter((e) => e && Number(e.i) !== Number(squareIndex)) : [];
  if (personName) log.push({ i: Number(squareIndex), n: personName, t: new Date().toISOString() });

  // A full card goes to the committee to be confirmed
  const filledCount = Object.keys(updated).filter((i) => Number(i) !== 12).length;
  const status = filledCount >= PLAYABLE_SQUARES ? "pending" : "active";

  const result = await pool.query(
    `UPDATE bingo_cards
        SET filled_squares = $2, fill_log = $3::jsonb, status = $4,
            completed_at = CASE WHEN $4 = 'pending' THEN COALESCE(completed_at, now()) ELSE NULL END,
            updated_at = now()
      WHERE id = $1 RETURNING *`,
    [id, updated, JSON.stringify(log), status]
  );

  const wasBingoBefore = hasBingo(card.filled_squares);
  const isBingoNow = hasBingo(updated);
  const wasBlackoutBefore = hasBlackout(card.filled_squares);
  const isBlackoutNow = hasBlackout(updated);

  return {
    card: result.rows[0],
    justGotBingo: !wasBingoBefore && isBingoNow,
    justGotBlackout: !wasBlackoutBefore && isBlackoutNow,
  };
}

export async function renameCard(id, newName) {
  const result = await pool.query(
    `UPDATE bingo_cards SET name = $2 WHERE id = $1 RETURNING *`,
    [id, newName]
  );
  return result.rows[0];
}

// Marks a finished card as confirmed, so the player can be given the next one
export async function confirmCard(id) {
  const result = await pool.query(
    `UPDATE bingo_cards SET status = 'confirmed', confirmed_at = now()
      WHERE id = $1 AND status = 'pending' RETURNING *`,
    [id]
  );
  return result.rows[0];
}

// This week's leaderboard: boxes filled during the current week, added up across all of a
// player's cards (a player on their second card still has one line on the board).
export async function getLeaderboard(limit = 10) {
  const week = getCurrentWeekId();
  const range = weekIdToRange(week);
  const startMs = range.start.getTime();
  const endMs = range.end.getTime();

  const result = await pool.query(
    `SELECT id, name, filled_squares, fill_log, round, updated_at
       FROM bingo_cards
      WHERE round LIKE 'card-%' OR round = $1`,
    [week]
  );

  const players = new Map();
  for (const c of result.rows) {
    const filled = c.filled_squares || {};
    let squares;
    if (cardNumber(c.round) > 0) {
      const log = Array.isArray(c.fill_log) ? c.fill_log : [];
      squares = log.filter((e) => {
        const t = new Date(e.t).getTime();
        return t >= startMs && t <= endMs && filled[e.i] !== undefined;
      }).length;
    } else {
      squares = Math.max(0, Object.keys(filled).length - 1);
    }

    const key = String(c.name).trim().toLowerCase();
    const p = players.get(key) || { id: 0, name: c.name, score: 0, bingo: false, blackout: false, updatedAt: null };
    p.score += squares;
    if (c.id > p.id) {
      // The player's newest card decides the badge and the name shown
      p.id = c.id;
      p.name = c.name;
      p.bingo = hasBingo(filled);
      p.blackout = hasBlackout(filled);
    }
    if (!p.updatedAt || new Date(c.updated_at) > new Date(p.updatedAt)) p.updatedAt = c.updated_at;
    players.set(key, p);
  }

  return [...players.values()]
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}