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
export async function getAllEvents() {
  const result = await pool.query(`SELECT * FROM events ORDER BY sort_order ASC, created_at ASC`);
  return result.rows;
}

export async function createEvent({ dateLabel, tag, title, description, sortOrder, eventDate }) {
  const result = await pool.query(
    `INSERT INTO events (date_label, tag, title, description, sort_order, event_date)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [dateLabel, tag || null, title, description || null, sortOrder || 0, eventDate || null]
  );
  return result.rows[0];
}

export async function updateEvent(id, { dateLabel, tag, title, description, sortOrder, eventDate }) {
  const result = await pool.query(
    `UPDATE events SET date_label = $2, tag = $3, title = $4, description = $5, sort_order = $6, event_date = $7
     WHERE id = $1 RETURNING *`,
    [id, dateLabel, tag || null, title, description || null, sortOrder || 0, eventDate || null]
  );
  return result.rows[0];
}

export async function deleteEvent(id) {
  await pool.query(`DELETE FROM events WHERE id = $1`, [id]);
}

export async function addRsvp(eventId, name, email) {
  const result = await pool.query(
    `INSERT INTO event_rsvps (event_id, name, email) VALUES ($1, $2, $3)
     ON CONFLICT (event_id, name) DO UPDATE SET email = EXCLUDED.email
     RETURNING *`,
    [eventId, name, email || null]
  );
  return result.rows[0];
}

export async function getRsvpsForEvent(eventId) {
  const result = await pool.query(
    `SELECT name, email, created_at FROM event_rsvps WHERE event_id = $1 ORDER BY created_at ASC`,
    [eventId]
  );
  return result.rows;
}