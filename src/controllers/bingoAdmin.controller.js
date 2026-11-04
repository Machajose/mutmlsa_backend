import pool from "../config/db.js";
import { getCurrentWeekId, getWeekLabel } from "../utils/periodId.js";

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
    filledCount: squares.length,
    hasTiming: timed.length > 0,
    spanSec,
    fastGaps,
    flags,
    squares,
    updatedAt: card.updated_at,
  };
}

export async function adminListCards(req, res) {
  try {
    const wanted = String(req.query.round || "");
    const round = /^week-\d+$/.test(wanted) ? wanted : getCurrentWeekId();

    const cardsRes = await pool.query(`SELECT * FROM bingo_cards WHERE round = $1`, [round]);
    const roundsRes = await pool.query(`SELECT DISTINCT round FROM bingo_cards WHERE round LIKE 'week-%'`);

    const rounds = roundsRes.rows
      .map((r) => r.round)
      .filter((r) => /^week-\d+$/.test(r))
      .sort((a, b) => Number(b.slice(5)) - Number(a.slice(5)))
      .map((r) => ({ round: r, label: getWeekLabel(r) }));
    if (!rounds.some((r) => r.round === round)) rounds.unshift({ round, label: getWeekLabel(round) });

    const cards = cardsRes.rows
      .map(analyse)
      .sort((a, b) => b.flags.length - a.flags.length || b.filledCount - a.filledCount);

    res.json({ round, label: getWeekLabel(round), rounds, cards });
  } catch (err) {
    console.error("Error listing bingo cards for review:", err);
    res.status(500).json({ error: "Could not load the cards." });
  }
}

// Empties a card so the player can start again
export async function adminClearCard(req, res) {
  try {
    const result = await pool.query(
      `UPDATE bingo_cards SET filled_squares = '{"12": "FREE"}', fill_log = '[]'::jsonb, updated_at = now() WHERE id = $1 RETURNING id`,
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