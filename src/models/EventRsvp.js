import pool from "../config/db.js";

export async function initEventRsvpTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS event_rsvps (
      id SERIAL PRIMARY KEY,
      event_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (event_id, name)
    );
  `);
}

export async function addRsvp(eventId, name) {
  const result = await pool.query(
    `INSERT INTO event_rsvps (event_id, name) VALUES ($1, $2)
     ON CONFLICT (event_id, name) DO NOTHING
     RETURNING *`,
    [eventId, name]
  );
  return result.rows[0];
}

export async function removeRsvp(eventId, name) {
  await pool.query(`DELETE FROM event_rsvps WHERE event_id = $1 AND name ILIKE $2`, [eventId, name]);
}

export async function getAllRsvpCounts() {
  const result = await pool.query(
    `SELECT event_id, COUNT(*) AS count FROM event_rsvps GROUP BY event_id`
  );
  const counts = {};
  result.rows.forEach((r) => {
    counts[r.event_id] = parseInt(r.count, 10);
  });
  return counts;
}