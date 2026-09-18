import pool from "../config/db.js";

export async function initBingoTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bingo_cards (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      marked_squares INTEGER[] NOT NULL DEFAULT '{12}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

export async function createCard(name) {
  const result = await pool.query(
    `INSERT INTO bingo_cards (name, marked_squares) VALUES ($1, '{12}') RETURNING *`,
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

export async function updateMarkedSquares(id, markedSquares) {
  const result = await pool.query(
    `UPDATE bingo_cards SET marked_squares = $2 WHERE id = $1 RETURNING *`,
    [id, markedSquares]
  );
  return result.rows[0];
}