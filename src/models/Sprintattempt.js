import pool from "../config/db.js";

export async function initSprintTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sprint_attempts (
      id SERIAL PRIMARY KEY,
      week TEXT NOT NULL,
      name TEXT NOT NULL,
      score INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (week, name)
    );
  `);
}

// One attempt per person per week — keep the higher score on a re-submit.
export async function submitSprintAttempt(week, name, score) {
  const result = await pool.query(
    `INSERT INTO sprint_attempts (week, name, score)
     VALUES ($1, $2, $3)
     ON CONFLICT (week, name)
     DO UPDATE SET score = GREATEST(sprint_attempts.score, EXCLUDED.score)
     RETURNING *`,
    [week, name, score]
  );
  return result.rows[0];
}

export async function getSprintAttempt(week, name) {
  const result = await pool.query(
    `SELECT * FROM sprint_attempts WHERE week = $1 AND name ILIKE $2`,
    [week, name]
  );
  return result.rows[0];
}

export async function getSprintLeaderboard(week, limit = 10) {
  const result = await pool.query(
    `SELECT id, name, score FROM sprint_attempts
     WHERE week = $1
     ORDER BY score DESC, created_at ASC
     LIMIT $2`,
    [week, limit]
  );
  return result.rows;
}