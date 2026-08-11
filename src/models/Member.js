import pool from "../config/db.js";

export async function initMembersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS members (
      id SERIAL PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      year_of_study TEXT,
      registration_paid BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS semester_payments (
      id SERIAL PRIMARY KEY,
      member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
      academic_year TEXT NOT NULL,
      semester TEXT NOT NULL,
      paid BOOLEAN NOT NULL DEFAULT false,
      paid_date TIMESTAMPTZ,
      UNIQUE(member_id, academic_year, semester)
    );
  `);
}

export async function createMember({ fullName, email, phone, yearOfStudy }) {
  if (email) {
    const existing = await pool.query(
      `SELECT * FROM members WHERE email = $1 LIMIT 1`,
      [email]
    );
    if (existing.rows.length > 0) {
      return existing.rows[0];
    }
  }

  // registration_paid now defaults to false — confirming someone as a
  // member no longer implies they've paid; that's tracked separately.
  const result = await pool.query(
    `INSERT INTO members (full_name, email, phone, year_of_study, registration_paid)
     VALUES ($1, $2, $3, $4, false)
     RETURNING *`,
    [fullName, email || null, phone || null, yearOfStudy || null]
  );
  return result.rows[0];
}

export async function getAllMembers() {
  const result = await pool.query(`SELECT * FROM members ORDER BY full_name ASC`);
  return result.rows;
}

export async function getPaymentsForPeriod(academicYear, semester) {
  const result = await pool.query(
    `SELECT * FROM semester_payments WHERE academic_year = $1 AND semester = $2`,
    [academicYear, semester]
  );
  return result.rows;
}

export async function setPaymentStatus({ memberId, academicYear, semester, paid }) {
  const result = await pool.query(
    `INSERT INTO semester_payments (member_id, academic_year, semester, paid, paid_date)
     VALUES ($1, $2, $3, $4, CASE WHEN $4 THEN now() ELSE NULL END)
     ON CONFLICT (member_id, academic_year, semester)
     DO UPDATE SET paid = $4, paid_date = CASE WHEN $4 THEN now() ELSE NULL END
     RETURNING *`,
    [memberId, academicYear, semester, paid]
  );
  return result.rows[0];
}

export async function setRegistrationPaid(memberId, paid) {
  const result = await pool.query(
    `UPDATE members SET registration_paid = $2 WHERE id = $1 RETURNING *`,
    [memberId, paid]
  );
  return result.rows[0];
}