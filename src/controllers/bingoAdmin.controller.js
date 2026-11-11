import pool from "../config/db.js";
import { confirmCard } from "../models/BingoCard.js";

const FAST_MS = 30000; // boxes filled closer together than this look rushed

const norm = (v) => String(v || "").trim().toLowerCase().replace(/\s+/g, " ");

// Turns one stored card into something the committee can review at a glance
function analyse(card) {
  const filled = card.filled_squares || {};
  const log = Array.isArray(card.fill_log) ? card.fill_log : [];
  const timeByIndex = new Map();
  for (const e of log) if (e && e.i !== undefined) timeByIndex.set(Number(e.i), e.t);

  const squares = Object.entries(filled)
    .filter(([i]) => Number(i) !== 12)
    .map(([i, v]) => ({ index: Number(i), name: String(v), at: timeByIndex.get(Number(i)) || null }))
    .sort((a, b) => (a.at || "").localeCompare(b.at || "") || a.index - b.index);

  // Time since the previous box was filled
  let fastGaps = 0;
  for (let k = 1; k < squares.length; k++) {
    if (squares[k].at && squares[k - 1].at) {
      const gap = new Date(squares[k].at) - new Date(squares[k - 1].at);
      squares[k].gapSec = Math.round(gap / 1000);
      if (gap < FAST_MS) fastGaps++;
    }
  }

  const timed = squares.filter((s) => s.at);
  const spanSec = timed.length > 1 ? Math.round((new Date(timed[timed.length - 1].at) - new Date(timed[0].at)) / 1000) : null;

  const counts = new Map();
  for (const s of squares) counts.set(norm(s.name), (counts.get(norm(s.name)) || 0) + 1);
  const duplicates = [...counts.entries()].filter(([, n]) => n > 1).map(([name]) => name);
  const usesOwnName = squares.some((s) => norm(s.name) === norm(card.name));
  const oddNames = squares.filter((s) => !/[a-zA-Z]{2,}/.test(s.name)).length;

  const flags = [];
  if (fastGaps >= 3) flags.push(`${fastGaps} boxes filled less than 30 seconds apart`);
  if (spanSec !== null && squares.length >= 8 && spanSec < 180) {
    flags.push(`${squares.length} boxes filled in ${Math.max(1, Math.round(spanSec / 60))} min`);
  }
  if (duplicates.length) flags.push(`Same name used more than once (${duplicates.join(", ")})`);
  if (usesOwnName) flags.push("Uses their own name");
  if (oddNames) flags.push(`${oddNames} name(s) that don't look real`);

  return {
    id: card.id,
    name: card.name,
    round: card.round,
    cardNo: /^card-(\d+)$/.test(card.round || "") ? Number(card.round.slice(5)) : null,
    status: card.status || "active",
    completedAt: card.completed_at,
    confirmedAt: card.confirmed_at,
    filledCount: squares.length,
    hasTiming: timed.length > 0,
    spanSec,
    fastGaps,
    flags,
    squares,
    updatedAt: card.updated_at,
  };
}

// Cards waiting for a decision come first, then cards in progress, then recently confirmed ones
export async function adminListCards(req, res) {
  try {
    const cardsRes = await pool.query(
      `SELECT * FROM bingo_cards
        WHERE round LIKE 'card-%'
          AND (status IN ('pending', 'active')
               OR (status = 'confirmed' AND confirmed_at > now() - interval '14 days'))`
    );
    const order = { pending: 0, active: 1, confirmed: 2 };
    const cards = cardsRes.rows
      .map(analyse)
      .sort(
        (a, b) =>
          order[a.status] - order[b.status] ||
          b.flags.length - a.flags.length ||
          b.filledCount - a.filledCount
      );
    res.json({ cards });
  } catch (err) {
    console.error("Error listing bingo cards for review:", err);
    res.status(500).json({ error: "Could not load the cards." });
  }
}

// Confirms a finished card, so the player can be given their next one
export async function adminConfirmCard(req, res) {
  try {
    const card = await confirmCard(req.params.id);
    if (!card) return res.status(404).json({ error: "That card is not waiting for confirmation." });
    res.json({ ok: true });
  } catch (err) {
    console.error("Error confirming bingo card:", err);
    res.status(500).json({ error: "Could not confirm the card." });
  }
}

// Empties a card so the player can start again
export async function adminClearCard(req, res) {
  try {
    const result = await pool.query(
      `UPDATE bingo_cards SET filled_squares = '{"12": "FREE"}', fill_log = '[]'::jsonb, status = 'active', completed_at = NULL, confirmed_at = NULL, updated_at = now() WHERE id = $1 RETURNING id`,
      [req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Card not found." });
    res.json({ ok: true });
  } catch (err) {
    console.error("Error clearing bingo card:", err);
    res.status(500).json({ error: "Could not clear the card." });
  }
}

// Removes the card completely, which also removes its points
export async function adminDeleteCard(req, res) {
  try {
    const result = await pool.query(`DELETE FROM bingo_cards WHERE id = $1 RETURNING id`, [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Card not found." });
    res.json({ ok: true });
  } catch (err) {
    console.error("Error deleting bingo card:", err);
    res.status(500).json({ error: "Could not delete the card." });
  }
}