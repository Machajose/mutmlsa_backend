import pool from "../config/db.js";

export async function initSubscribersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id SERIAL PRIMARY KEY,
      full_name TEXT,
      email TEXT NOT NULL UNIQUE,
      subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

export async function createSubscriber({ fullName, email }) {
  const result = await pool.query(
    `INSERT INTO newsletter_subscribers (full_name, email)
     VALUES ($1, $2)
     ON CONFLICT (email) DO NOTHING
     RETURNING *`,
    [fullName || null, email]
  );
  // If the email already existed, the insert is skipped and rows is empty —
  // treat that as success so people don't see an error for re-subscribing.
  return result.rows[0] || { email, alreadySubscribed: true };
}

export async function getAllSubscribers() {
  const result = await pool.query(
    `SELECT * FROM newsletter_subscribers ORDER BY subscribed_at DESC`
  );
  return result.rows;
}
export async function bulkAddFromMembers(members) {
  let added = 0;
  for (const m of members) {
    if (!m.email) continue;
    const result = await pool.query(
      `INSERT INTO newsletter_subscribers (full_name, email)
       VALUES ($1, $2)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [m.full_name, m.email]
    );
    if (result.rows.length > 0) added++;
  }
  return added;
}
export async function bulkAddFromApplications(applications) {
  let added = 0;
  for (const a of applications) {
    if (!a.email) continue;
    const result = await pool.query(
      `INSERT INTO newsletter_subscribers (full_name, email)
       VALUES ($1, $2)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [a.full_name, a.email]
    );
    if (result.rows.length > 0) added++;
  }
  return added;
}