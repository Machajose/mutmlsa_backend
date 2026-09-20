import { submitSprintAttempt, getSprintAttempt, getSprintLeaderboard } from "../models/Sprintattempt.js";

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
  if (!week) return res.status(400).json({ error: "week is required." });
  try {
    const board = await getSprintLeaderboard(week, 10);
    res.json({ leaderboard: board });
  } catch (err) {
    res.status(500).json({ error: "Could not fetch leaderboard." });
  }
}