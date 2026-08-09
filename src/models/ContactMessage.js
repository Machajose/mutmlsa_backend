import pool from "../config/db.js";

export async function initContactTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contact_messages (
      id SERIAL PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

export async function createMessage({ fullName, email, message }) {
  const result = await pool.query(
    `INSERT INTO contact_messages (full_name, email, message)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [fullName, email, message]
  );
  return result.rows[0];
}

export async function getAllMessages() {
  const result = await pool.query(
    `SELECT * FROM contact_messages ORDER BY created_at DESC`
  );
  return result.rows;
}
