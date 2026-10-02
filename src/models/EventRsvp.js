import pool from "../config/db.js";

export async function initEventsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (
      id SERIAL PRIMARY KEY,
      date_label TEXT NOT NULL,
      tag TEXT,
      title TEXT NOT NULL,
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

export async function getAllEvents() {
  const result = await pool.query(`SELECT * FROM events ORDER BY sort_order ASC, created_at ASC`);
  return result.rows;
}

export async function createEvent({ dateLabel, tag, title, description, sortOrder }) {
  const result = await pool.query(
    `INSERT INTO events (date_label, tag, title, description, sort_order)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [dateLabel, tag || null, title, description || null, sortOrder || 0]
  );
  return result.rows[0];
}

export async function updateEvent(id, { dateLabel, tag, title, description, sortOrder }) {
  const result = await pool.query(
    `UPDATE events SET date_label = $2, tag = $3, title = $4, description = $5, sort_order = $6
     WHERE id = $1 RETURNING *`,
    [id, dateLabel, tag || null, title, description || null, sortOrder || 0]
  );
  return result.rows[0];
}

export async function deleteEvent(id) {
  await pool.query(`DELETE FROM events WHERE id = $1`, [id]);
}