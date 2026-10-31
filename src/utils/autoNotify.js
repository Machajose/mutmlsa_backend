import pool from "../config/db.js";
import { getAllSubscriptions } from "../models/PushSubscription.js";
import { broadcastToOne } from "./sendPush.js";
import { getCurrentPeriodId, getCurrentWeekId } from "./periodId.js";
import { runHallOfFameCheck } from "./hallOfFame.js";

const INACTIVITY_DAYS = 3;
const NUDGE_COOLDOWN_HOURS = 24; // "come play" nudges at most once a day per person

let columnsReady = false;
async function ensureColumns() {
  if (columnsReady) return;
  const cols = [
    "last_bingo_rank INTEGER",
    "last_quiz_rank INTEGER",
    "last_sprint_rank INTEGER",
    "last_bingo_round TEXT",
    "last_quiz_round TEXT",
    "last_sprint_round TEXT",
    "last_notified_at TIMESTAMPTZ",
  ];
  for (const c of cols) {
    await pool.query(`ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS ${c}`);
  }
  columnsReady = true;
}

async function getBingoRanking(round) {
  const result = await pool.query(
    `SELECT id, name, filled_squares, updated_at FROM bingo_cards WHERE round = $1`,
    [round]
  );
  return result.rows
    .map((c) => ({
      name: c.name,
      score: Object.keys(c.filled_squares || {}).length,
      updatedAt: c.updated_at,
    }))
    .sort((a, b) => b.score - a.score);
}

async function getAttemptRanking(table, round) {
  const result = await pool.query(
    `SELECT name, score FROM ${table} WHERE week = $1 ORDER BY score DESC, created_at ASC`,
    [round]
  );
  return result.rows;
}

function findRank(ranking, name) {
  const idx = ranking.findIndex((r) => r.name.toLowerCase() === name.toLowerCase());
  return idx === -1 ? null : { rank: idx + 1, entry: ranking[idx] };
}

const RANK_MESSAGES = {
  bingo: (rank, up) =>
    up
      ? { title: "You moved up!", body: `Nice — you're now #${rank} on the Bingo leaderboard. Keep filling squares to climb higher.`, url: "/#bingo" }
      : { title: "You've been overtaken!", body: `Someone just passed you on the Bingo leaderboard (now #${rank}) — go reclaim your spot.`, url: "/#bingo" },
  quiz: (rank, up) =>
    up
      ? { title: "Nice climb on the Quiz!", body: `You're now #${rank} on this round's quiz leaderboard.`, url: "/#quiz" }
      : { title: "Slipped on the Quiz leaderboard", body: `You've dropped to #${rank} on this round's quiz — the next round is a fresh chance.`, url: "/#quiz" },
  sprint: (rank, up) =>
    up
      ? { title: "Nice climb on the Sprint!", body: `You're now #${rank} on this round's speed round leaderboard.`, url: "/#speed-round" }
      : { title: "Slipped on the Sprint leaderboard", body: `You've dropped to #${rank} on the speed round — try for a faster round.`, url: "/#speed-round" },
};

export async function runAutoCheck() {
  await ensureColumns();

  const bingoRound = getCurrentWeekId();
  const quizRound = getCurrentPeriodId(2);
  const sprintRound = getCurrentPeriodId(2);
  const rounds = { bingo: bingoRound, quiz: quizRound, sprint: sprintRound };

  const subs = await getAllSubscriptions();
  const rankings = {
    bingo: await getBingoRanking(bingoRound),
    quiz: await getAttemptRanking("quiz_attempts", quizRound),
    sprint: await getAttemptRanking("sprint_attempts", sprintRound),
  };

  let sent = 0;

  for (const sub of subs) {
    if (!sub.name) continue;

    const matches = {
      bingo: findRank(rankings.bingo, sub.name),
      quiz: findRank(rankings.quiz, sub.name),
      sprint: findRank(rankings.sprint, sub.name),
    };

    let message = null;
    const updates = {};

    // Rank changes only count within the same round — a new round resets
    // everyone, so comparing across rounds would give false "overtaken" alerts.
    for (const game of ["bingo", "quiz", "sprint"]) {
      const match = matches[game];
      if (!match) continue;
      const prevRank = sub[`last_${game}_round`] === rounds[game] ? sub[`last_${game}_rank`] : null;
      if (!message && prevRank && match.rank !== prevRank) {
        message = RANK_MESSAGES[game](match.rank, match.rank < prevRank);
      }
      updates[`last_${game}_rank`] = match.rank;
      updates[`last_${game}_round`] = rounds[game];
    }

    const hoursSinceLast = sub.last_notified_at
      ? (Date.now() - new Date(sub.last_notified_at).getTime()) / 3600000
      : Infinity;
    const canNudge = hoursSinceLast >= NUDGE_COOLDOWN_HOURS;

    if (!message && canNudge) {
      if (!matches.bingo) {
        message = {
          title: "Haven't started this week's Bingo?",
          body: "A fresh MUTMLSA Bingo board is live — jump in and start filling squares!",
          url: "/#bingo",
        };
      } else {
        const daysSinceActive =
          (Date.now() - new Date(matches.bingo.entry.updatedAt).getTime()) / 86400000;
        if (daysSinceActive >= INACTIVITY_DAYS) {
          message = {
            title: "We miss you at Bingo!",
            body: "It's been a few days since you last played — your card is still waiting for you.",
            url: "/#bingo",
          };
        }
      }
    }

    if (message) {
      await broadcastToOne(sub, message);
      updates.last_notified_at = new Date();
      sent++;
    }

    const cols = Object.keys(updates);
    if (cols.length) {
      const sets = cols.map((c, i) => `${c} = $${i + 2}`).join(", ");
      await pool.query(`UPDATE push_subscriptions SET ${sets} WHERE id = $1`, [
        sub.id,
        ...cols.map((c) => updates[c]),
      ]);
    }
  }

  // Saves finished weeks/months/semester winners and announces new champions.
  // Wrapped so a problem here can never stop the normal notifications above.
  let hallOfFame = null;
  try {
    hallOfFame = await runHallOfFameCheck();
  } catch (err) {
    console.error("Hall of Fame check failed:", err);
  }

  return { checked: subs.length, notificationsSent: sent, hallOfFame };
}