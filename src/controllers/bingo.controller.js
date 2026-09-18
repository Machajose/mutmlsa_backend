import { createCard, getCardById, findCardsByName, updateMarkedSquares } from "../models/BingoCard.js";

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

export async function toggleSquare(req, res) {
  const { id } = req.params;
  const { squareIndex } = req.body;

  try {
    const card = await getCardById(id);
    if (!card) return res.status(404).json({ error: "Card not found." });

    const current = card.marked_squares || [];
    const updated = current.includes(squareIndex)
      ? current.filter((i) => i !== squareIndex)
      : [...current, squareIndex];

    const result = await updateMarkedSquares(id, updated);
    res.json({ card: result });
  } catch (err) {
    console.error("Error toggling square:", err);
    res.status(500).json({ error: "Could not update card." });
  }
}