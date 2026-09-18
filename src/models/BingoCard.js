import pool from "../config/db.js";

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
    `INSERT INTO bingo_cards (name, filled_squares) VALUES ($1, '{"11": "FREE"}') RETURNING *`,
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

  const updated = { ...card.filled_squares, [squareIndex]: personName };
  const result = await pool.query(
    `UPDATE bingo_cards SET filled_squares = $2 WHERE id = $1 RETURNING *`,
    [id, updated]
  );
  return result.rows[0];
}

export async function getLeaderboard(limit = 10) {
  const result = await pool.query(`SELECT id, name, filled_squares FROM bingo_cards`);
  return result.rows
    .map((c) => ({
      id: c.id,
      name: c.name,
      score: Object.keys(c.filled_squares || {}).length,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}