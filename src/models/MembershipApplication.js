import pool from "../config/db.js";

export async function initMembershipTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS membership_applications (
      id SERIAL PRIMARY KEY,
      full_name TEXT NOT NULL,
      year_of_study TEXT,
      phone TEXT,
      email TEXT NOT NULL,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

export async function createApplication({ fullName, yearOfStudy, phone, email, message }) {
  const result = await pool.query(
    `INSERT INTO membership_applications (full_name, year_of_study, phone, email, message)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [fullName, yearOfStudy || null, phone || null, email, message || null]
  );
  return result.rows[0];
}

export async function getAllApplications() {
  const result = await pool.query(
    `SELECT * FROM membership_applications ORDER BY created_at DESC`
  );
  return result.rows;
}

export async function getPendingApplications() {
  const result = await pool.query(
    `SELECT * FROM membership_applications WHERE status = 'pending' ORDER BY created_at DESC`
  );
  return result.rows;
}

export async function markApplicationConfirmed(id) {
  const result = await pool.query(
    `UPDATE membership_applications SET status = 'confirmed' WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0];
}