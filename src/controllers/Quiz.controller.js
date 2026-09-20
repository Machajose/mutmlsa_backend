import { submitAttempt, getAttempt, getQuizLeaderboard } from "../models/QuizAttempt.js";

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
  if (!week) return res.status(400).json({ error: "week is required." });
  try {
    const board = await getQuizLeaderboard(week, 10);
    res.json({ leaderboard: board });
  } catch (err) {
    res.status(500).json({ error: "Could not fetch leaderboard." });
  }
}