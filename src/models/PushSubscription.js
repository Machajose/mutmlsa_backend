import pool from "../config/db.js";

export async function initPushTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      name TEXT,
      endpoint TEXT NOT NULL UNIQUE,
      subscription JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

export async function saveSubscription(name, subscription) {
  const result = await pool.query(
    `INSERT INTO push_subscriptions (name, endpoint, subscription)
     VALUES ($1, $2, $3)
     ON CONFLICT (endpoint) DO UPDATE SET name = EXCLUDED.name, subscription = EXCLUDED.subscription
     RETURNING *`,
    [name || null, subscription.endpoint, subscription]
  );
  return result.rows[0];
}

export async function removeSubscription(endpoint) {
  await pool.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [endpoint]);
}

export async function getAllSubscriptions() {
  const result = await pool.query(`SELECT * FROM push_subscriptions`);
  return result.rows;
}

// Used by the sender to drop dead subscriptions (browser unsubscribed,
// user cleared data, etc.) when a push fails with a 410/404.
export async function removeByEndpoint(endpoint) {
  await pool.query(`DELETE FROM push_subscriptions WHERE endpoint = $1`, [endpoint]);
}
export async function isAlreadySubscribed() {
  if (!(await isPushSupported())) return false;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return false;
  const subscription = await registration.pushManager.getSubscription();
  return !!subscription;
}