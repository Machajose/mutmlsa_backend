import { submitSprintAttempt, getSprintAttempt, getSprintLeaderboard } from "../models/SprintAttempt.js";
import pool from "../config/db.js";
import { formatPeriodLabel } from "../utils/periodId.js";

export async function submitAttemptHandler(req, res) {
  const { week, name, score } = req.body;

  if (!week || !name || !name.trim() || score === undefined || score < 0) {
    return res.status(400).json({ error: "week, name, and a valid score are required." });
  }

  try {
    const attempt = await submitSprintAttempt(week, name.trim(), score);
    res.status(201).json({ attempt });
  } catch (err) {
    console.error("Error submitting sprint attempt:", err);
    res.status(500).json({ error: "Could not save attempt." });
  }
}

export async function fetchAttemptHandler(req, res) {
  const { week, name } = req.query;
  if (!week || !name) {
    return res.status(400).json({ error: "week and name are required." });
  }
  try {
    const attempt = await getSprintAttempt(week, name);
    res.json({ attempt: attempt || null });
  } catch (err) {
    res.status(500).json({ error: "Could not fetch attempt." });
  }
}

export async function sprintLeaderboardHandler(req, res) {
  const { week } = req.query;
  const limit = req.query.full === "true" ? 1000 : 10;
  if (!week) return res.status(400).json({ error: "week is required." });
  try {
    const board = await getSprintLeaderboard(week, limit);
    res.json({ leaderboard: board });
  } catch (err) {
    res.status(500).json({ error: "Could not fetch leaderboard." });
  }
}

export async function champsByPeriod(req, res) {
  try {
    const periodsResult = await pool.query(
      `SELECT DISTINCT week FROM sprint_attempts ORDER BY week DESC`
    );
    const periods = periodsResult.rows.map((r) => r.week);

    const data = [];
    for (const period of periods) {
      const topResult = await pool.query(
        `SELECT name, score FROM sprint_attempts WHERE week = $1 ORDER BY score DESC LIMIT 3`,
        [period]
      );
      data.push({
        period,
        label: formatPeriodLabel(period, 2),
        top: topResult.rows,
      });
    }

    res.json({ periods: data });
  } catch (err) {
    console.error("Error fetching sprint champions by period:", err);
    res.status(500).json({ error: "Could not fetch champions." });
  }
}