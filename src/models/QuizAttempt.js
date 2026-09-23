import pool from "../config/db.js";

export async function initQuizTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id SERIAL PRIMARY KEY,
      week TEXT NOT NULL,
      name TEXT NOT NULL,
      score INTEGER NOT NULL,
      total INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (week, name)
    );
  `);
}

// One attempt per person per week. If they've already submitted for this
// week, keep whichever score is higher rather than overwriting blindly.
export async function submitAttempt(week, name, score, total) {
  const result = await pool.query(
    `INSERT INTO quiz_attempts (week, name, score, total)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (week, name)
     DO UPDATE SET score = GREATEST(quiz_attempts.score, EXCLUDED.score)
     RETURNING *`,
    [week, name, score, total]
  );
  return result.rows[0];
}

export async function getAttempt(week, name) {
  const result = await pool.query(
    `SELECT * FROM quiz_attempts WHERE week = $1 AND name ILIKE $2`,
    [week, name]
  );
  return result.rows[0];
}

export async function getQuizLeaderboard(week, limit = 10) {
  const result = await pool.query(
    `SELECT id, name, score, total FROM quiz_attempts
     WHERE week = $1
     ORDER BY score DESC, created_at ASC
     LIMIT $2`,
    [week, limit]
  );
  return result.rows;
}
export async function renameAttempt(id, newName) {
  const result = await pool.query(
    `UPDATE quiz_attempts SET name = $2 WHERE id = $1 RETURNING *`, // sprint_attempts for the other file
    [id, newName]
  );
  return result.rows[0];
}