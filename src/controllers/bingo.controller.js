import { createCard, getCardById, findCardsByName, fillSquare, getLeaderboard } from "../models/BingoCard.js";

export async function newCard(req, res) {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Name is required." });
  }
  try {
    const card = await createCard(name.trim());
    res.status(201).json({ card });
  } catch (err) {
    console.error("Error creating bingo card:", err);
    res.status(500).json({ error: "Could not create card." });
  }
}

export async function fetchCard(req, res) {
  try {
    const card = await getCardById(req.params.id);
    if (!card) return res.status(404).json({ error: "Card not found." });
    res.json({ card });
  } catch (err) {
    res.status(500).json({ error: "Could not fetch card." });
  }
}

export async function searchByName(req, res) {
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: "Name is required." });
  try {
    const cards = await findCardsByName(name);
    res.json({ cards });
  } catch (err) {
    res.status(500).json({ error: "Could not search." });
  }
}

export async function fillSquareHandler(req, res) {
  const { id } = req.params;
  const { squareIndex, personName } = req.body;

  if (personName === undefined) {
    return res.status(400).json({ error: "personName is required." });
  }

  try {
    const card = await fillSquare(id, squareIndex, personName.trim());
    if (!card) return res.status(404).json({ error: "Card not found." });
    res.json({ card });
  } catch (err) {
    console.error("Error filling square:", err);
    res.status(500).json({ error: "Could not update card." });
  }
}

export async function leaderboard(req, res) {
  try {
    const board = await getLeaderboard(10);
    res.json({ leaderboard: board });
  } catch (err) {
    res.status(500).json({ error: "Could not fetch leaderboard." });
  }
}