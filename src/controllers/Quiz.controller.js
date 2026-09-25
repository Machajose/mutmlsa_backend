import { submitAttempt, getAttempt, getQuizLeaderboard } from "../models/QuizAttempt.js";
import pool from "../config/db.js";
import { getPeriodsThisWeek } from "../utils/periodId.js";

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

export async function weeklyChampions(req, res) {
  const periods = getPeriodsThisWeek(2);
  const champions = [];

  for (const period of periods) {
    const result = await pool.query(
      `SELECT name, score, total FROM quiz_attempts WHERE week = $1 ORDER BY score DESC LIMIT 1`,
      [period]
    );
    if (result.rows[0]) {
      champions.push({ period, ...result.rows[0] });
    }
  }

  res.json({ champions });
}