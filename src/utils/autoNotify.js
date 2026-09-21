import pool from "../config/db.js";
import { getAllSubscriptions } from "../models/PushSubscription.js";
import { broadcastToOne } from "./sendPush.js";

// IMPORTANT: keep these in sync with WEEK_ID in Quiz.jsx and
// SpeedRound.jsx — same manual-sync pattern as auditContext.js needing a
// copy in both frontend and backend.
const CURRENT_QUIZ_WEEK = "2026-W39";
const CURRENT_SPRINT_WEEK = "2026-W39";

const INACTIVITY_DAYS = 3;

async function getFullBingoRanking() {
  const result = await pool.query(`SELECT id, name, filled_squares, updated_at FROM bingo_cards`);
  return result.rows
    .map((c) => ({
      id: c.id,
      name: c.name,
      score: Object.keys(c.filled_squares || {}).length,
      updatedAt: c.updated_at,
    }))
    .sort((a, b) => b.score - a.score);
}

async function getFullRanking(table, week) {
  const result = await pool.query(
    `SELECT id, name, score FROM ${table} WHERE week = $1`,
    [week]
  );
  return result.rows.sort((a, b) => b.score - a.score);
}

function findRank(ranking, name) {
  const idx = ranking.findIndex((r) => r.name.toLowerCase() === name.toLowerCase());
  return idx === -1 ? null : { rank: idx + 1, entry: ranking[idx] };
}

export async function runAutoCheck() {
  const subs = await getAllSubscriptions();
  const bingoRanking = await getFullBingoRanking();
  const quizRanking = await getFullRanking("quiz_attempts", CURRENT_QUIZ_WEEK);
  const sprintRanking = await getFullRanking("sprint_attempts", CURRENT_SPRINT_WEEK);

  let sent = 0;

  for (const sub of subs) {
    if (!sub.name) continue;

    const bingoMatch = findRank(bingoRanking, sub.name);
    const quizMatch = findRank(quizRanking, sub.name);
    const sprintMatch = findRank(sprintRanking, sub.name);

    // Priority order: rank changes matter most, then a nudge to try
    // something they haven't, then inactivity. Only one message per
    // person per run, to avoid spamming several notifications at once.
    let notified = false;

    // --- Bingo rank change (overtaken or moved up) ---
    if (bingoMatch) {
      const { rank } = bingoMatch;
      if (sub.last_bingo_rank) {
        if (rank > sub.last_bingo_rank) {
          await broadcastToOne(sub, {
            title: "You've been overtaken!",
            body: `Someone just passed you on the Bingo leaderboard (now #${rank}) — go reclaim your spot.`,
            url: "/#get-involved",
          });
          notified = true;
        } else if (rank < sub.last_bingo_rank) {
          await broadcastToOne(sub, {
            title: "You moved up!",
            body: `Nice — you're now #${rank} on the Bingo leaderboard. Keep filling squares to climb higher.`,
            url: "/#get-involved",
          });
          notified = true;
        }
      }
      await pool.query(`UPDATE push_subscriptions SET last_bingo_rank = $2 WHERE id = $1`, [sub.id, rank]);
    }

    // --- Quiz rank change ---
    if (!notified && quizMatch) {
      const { rank } = quizMatch;
      if (sub.last_quiz_rank && rank !== sub.last_quiz_rank) {
        const improved = rank < sub.last_quiz_rank;
        await broadcastToOne(sub, {
          title: improved ? "Nice climb on the Quiz!" : "Slipped on the Quiz leaderboard",
          body: improved
            ? `You're now #${rank} on this week's quiz leaderboard.`
            : `You've dropped to #${rank} on this week's quiz — one more good round could fix that.`,
          url: "/#get-involved",
        });
        notified = true;
      }
      await pool.query(`UPDATE push_subscriptions SET last_quiz_rank = $2 WHERE id = $1`, [sub.id, rank]);
    }

    // --- Sprint rank change ---
    if (!notified && sprintMatch) {
      const { rank } = sprintMatch;
      if (sub.last_sprint_rank && rank !== sub.last_sprint_rank) {
        const improved = rank < sub.last_sprint_rank;
        await broadcastToOne(sub, {
          title: improved ? "Nice climb on the Sprint!" : "Slipped on the Sprint leaderboard",
          body: improved
            ? `You're now #${rank} on this week's speed round leaderboard.`
            : `You've dropped to #${rank} on the speed round — try for a faster round.`,
          url: "/#get-involved",
        });
        notified = true;
      }
      await pool.query(`UPDATE push_subscriptions SET last_sprint_rank = $2 WHERE id = $1`, [sub.id, rank]);
    }

    if (notified) {
      sent++;
      continue;
    }

    // --- Never started Bingo at all ---
    if (!bingoMatch) {
      await broadcastToOne(sub, {
        title: "Haven't started Bingo yet?",
        body: "This week's MUTMLSA Bingo card is live — jump in and start filling squares!",
        url: "/#get-involved",
      });
      sent++;
      continue;
    }

    // --- Has a Bingo card, but gone quiet for a few days ---
    const daysSinceActive = (Date.now() - new Date(bingoMatch.entry.updatedAt).getTime()) / 86400000;
    if (daysSinceActive >= INACTIVITY_DAYS) {
      await broadcastToOne(sub, {
        title: "We miss you at Bingo!",
        body: `It's been a few days since you last played — your card is still waiting for you.`,
        url: "/#get-involved",
      });
      sent++;
    }
  }

  return { checked: subs.length, notificationsSent: sent };
}