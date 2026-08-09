import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

// Render/Railway Postgres both require SSL in production but not always
// locally — this flag lets you toggle it via .env without code changes.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.DB_SSL === "false"
      ? false
      : { rejectUnauthorized: false },
});

pool.on("error", (err) => {
  console.error("Unexpected Postgres error on idle client", err);
});

export default pool;
