import { submitAttempt, getAttempt, getQuizLeaderboard } from "../models/QuizAttempt.js";
import pool from "../config/db.js";
import { formatPeriodLabel } from "../utils/periodId.js";

export async function submitQuizAttempt(req, res) {
  const { week, name, score, total } = req.body;

  if (!week || !name || !name.trim() || score === undefined || !total) {
    return res.status(400).json({ error: "week, name, score, and total are required." });
  }
  if (score < 0 || score > total) {
    return res.status(400).json({ error: "Invalid score." });
  }

  try {
    const attempt = await submitAttempt(week, name.trim(), score, total);
    res.status(201).json({ attempt });
  } catch (err) {
    console.error("Error submitting quiz attempt:", err);
    res.status(500).json({ error: "Could not save attempt." });
  }
}

export async function fetchAttempt(req, res) {
  const { week, name } = req.query;
  if (!week || !name) {
    return res.status(400).json({ error: "week and name are required." });
  }
  try {
    const attempt = await getAttempt(week, name);
    res.json({ attempt: attempt || null });
  } catch (err) {
    res.status(500).json({ error: "Could not fetch attempt." });
  }
}

export async function quizLeaderboard(req, res) {
  const { week } = req.query;
  const limit = req.query.full === "true" ? 1000 : 10;
  if (!week) return res.status(400).json({ error: "week is required." });
  try {
    const board = await getQuizLeaderboard(week, limit);
    res.json({ leaderboard: board });
  } catch (err) {
    res.status(500).json({ error: "Could not fetch leaderboard." });
  }
}

// Returns every period that has recorded attempts, newest first, each
// with its human-readable date range and its top 3 scorers — lets the
// frontend show a period picker rather than just "this week."
export async function champsByPeriod(req, res) {
  try {
    const periodsResult = await pool.query(
      `SELECT DISTINCT week FROM quiz_attempts ORDER BY week DESC`
    );
    const periods = periodsResult.rows.map((r) => r.week);

    const data = [];
    for (const period of periods) {
      const topResult = await pool.query(
        `SELECT name, score, total FROM quiz_attempts WHERE week = $1 ORDER BY score DESC LIMIT 3`,
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
    console.error("Error fetching champions by period:", err);
    res.status(500).json({ error: "Could not fetch champions." });
  }
}