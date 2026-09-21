import pool from "../config/db.js";

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

export function hasBingo(filledSquares) {
  const filledKeys = Object.keys(filledSquares).map(Number);
  return WINNING_LINES.some((line) => line.every((i) => filledKeys.includes(i)));
}

export function hasBlackout(filledSquares) {
  return Object.keys(filledSquares).length === 25;
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
}

export async function createCard(name) {
  const existing = await pool.query(
    `SELECT * FROM bingo_cards WHERE name ILIKE $1 ORDER BY created_at DESC LIMIT 1`,
    [name]
  );
  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  const result = await pool.query(
    `INSERT INTO bingo_cards (name, filled_squares) VALUES ($1, '{"12": "FREE"}') RETURNING *`,
    [name]
  );
  return result.rows[0];
}

export async function getCardById(id) {
  const result = await pool.query(`SELECT * FROM bingo_cards WHERE id = $1`, [id]);
  return result.rows[0];
}

export async function findCardsByName(name) {
  const result = await pool.query(
    `SELECT * FROM bingo_cards WHERE name ILIKE $1 ORDER BY created_at DESC`,
    [`%${name}%`]
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

  const result = await pool.query(
  `UPDATE bingo_cards SET filled_squares = $2, updated_at = now() WHERE id = $1 RETURNING *`,
  [id, updated]
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

export async function getLeaderboard(limit = 10) {
  const result = await pool.query(`SELECT id, name, filled_squares FROM bingo_cards`);
  return result.rows
    .map((c) => ({
      id: c.id,
      name: c.name,
      score: Object.keys(c.filled_squares || {}).length,
      bingo: hasBingo(c.filled_squares || {}),
      blackout: hasBlackout(c.filled_squares || {}),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
export async function renameCard(id, newName) {
  const result = await pool.query(
    `UPDATE bingo_cards SET name = $2 WHERE id = $1 RETURNING *`,
    [id, newName]
  );
  return result.rows[0];
}