import {
  createCard,
  getCardById,
  findCardsByName,
  fillSquare,
  getLeaderboard,
  renameCard,
} from "../models/BingoCard.js";
import { getCurrentWeekId } from "../utils/periodId.js";

export async function newCard(req, res) {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Name is required." });
  }
  try {
    // Gives the player their current card, or the next one if their last was confirmed
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
    // currentRound lets the site tell whether this card belongs to an old round.
    res.json({ card, currentRound: getCurrentWeekId() });
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

  const index = Number(squareIndex);
  if (!Number.isInteger(index) || index < 0 || index > 24 || index === 12) {
    return res.status(400).json({ error: "Invalid square." });
  }

  try {
    const existing = await getCardById(id);
    if (!existing) return res.status(404).json({ error: "Card not found." });

    // Old weekly cards from finished weeks are closed for good.
    const isOldWeekly = !/^card-\d+$/.test(existing.round || "") && existing.round !== getCurrentWeekId();
    if (isOldWeekly) {
      return res.status(409).json({
        expired: true,
        error: "That card is from an earlier week and is closed. Tap Start to get your card.",
      });
    }
    // A finished card waits for the committee, and a confirmed one is done.
    if (existing.status === "pending") {
      return res.status(409).json({
        locked: true,
        error: "This card is complete and waiting for the committee to confirm it.",
      });
    }
    if (existing.status === "confirmed") {
      return res.status(409).json({
        locked: true,
        error: "This card is confirmed. Tap \"Get my next card\" to continue.",
      });
    }

    // Rule checks: no using your own name, and no name twice on one card.
    const clean = personName.trim();
    if (clean) {
      const norm = (v) => String(v || "").trim().toLowerCase().replace(/\s+/g, " ");
      if (norm(clean) === norm(existing.name)) {
        return res.status(400).json({ error: "That's your own name. Every box needs a different person." });
      }
      const filled = existing.filled_squares || {};
      const dup = Object.entries(filled).some(
        ([i, v]) => Number(i) !== index && Number(i) !== 12 && norm(v) === norm(clean)
      );
      if (dup) {
        return res.status(400).json({ error: `You've already used "${clean}" in another box. Every box needs a different person.` });
      }
    }

    const result = await fillSquare(id, index, clean);
    if (!result) return res.status(404).json({ error: "Card not found." });

    const { card, justGotBingo, justGotBlackout } = result;
    res.json({ card, justGotBingo, justGotBlackout });
  } catch (err) {
    console.error("Error filling square:", err);
    res.status(500).json({ error: "Could not update card." });
  }
}

export async function leaderboard(req, res) {
  const limit = req.query.full === "true" ? 1000 : 10;
  const round = getCurrentWeekId();
  try {
    const board = await getLeaderboard(limit);
    res.json({ leaderboard: board, currentRound: round });
  } catch (err) {
    res.status(500).json({ error: "Could not fetch leaderboard." });
  }
}

export async function renameCardHandler(req, res) {
  const { id } = req.params;
  const { name } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Name is required." });
  }

  try {
    const card = await renameCard(id, name.trim());
    if (!card) return res.status(404).json({ error: "Card not found." });
    res.json({ card });
  } catch (err) {
    console.error("Error renaming card:", err);
    res.status(500).json({ error: "Could not rename card." });
  }
}