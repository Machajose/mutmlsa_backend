import pool from "../config/db.js";
import { getAllSubscriptions } from "../models/PushSubscription.js";
import { broadcastToOne } from "./sendPush.js";

// Full leaderboard, unranked-limit version — getLeaderboard() in
// BingoCard.js caps at 10 for the public display; this one needs everyone
// so we can find any subscriber's true rank, not just the top 10.
async function getFullBingoRanking() {
  const result = await pool.query(`SELECT id, name, filled_squares FROM bingo_cards`);
  return result.rows
    .map((c) => ({
      id: c.id,
      name: c.name,
      score: Object.keys(c.filled_squares || {}).length,
    }))
    .sort((a, b) => b.score - a.score);
}

export async function runAutoCheck() {
  const subs = await getAllSubscriptions();
  const ranking = await getFullBingoRanking();

  let sent = 0;

  for (const sub of subs) {
    if (!sub.name) continue; // can't match without a name

    const rankIndex = ranking.findIndex(
      (r) => r.name.toLowerCase() === sub.name.toLowerCase()
    );

    if (rankIndex === -1) {
      // Subscribed but never started a Bingo card — friendly nudge.
      await broadcastToOne(sub, {
        title: "Haven't started Bingo yet?",
        body: "This week's MUTMLSA Bingo card is live — jump in and start filling squares!",
        url: "/#get-involved",
      });
      sent++;
      continue;
    }

    const currentRank = rankIndex + 1;
    const lastRank = sub.last_bingo_rank;

    if (lastRank && currentRank > lastRank) {
      await broadcastToOne(sub, {
        title: "You've been overtaken!",
        body: `Someone just passed you on the Bingo leaderboard (now #${currentRank}) — go reclaim your spot.`,
        url: "/#get-involved",
      });
      sent++;
    }

    await pool.query(
      `UPDATE push_subscriptions SET last_bingo_rank = $2 WHERE id = $1`,
      [sub.id, currentRank]
    );
  }

  return { checked: subs.length, notificationsSent: sent };
}