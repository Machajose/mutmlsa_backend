import "dotenv/config";
import app from "./app.js";
import { initMembershipTable } from "./models/MembershipApplication.js";
import { initContactTable } from "./models/ContactMessage.js";
import { initMembersTable } from "./models/Member.js";
import { initSubscribersTable } from "./models/Subscriber.js";
import { initBingoTable } from "./models/BingoCard.js";
import { initQuizTable } from "./models/QuizAttempt.js";
import { initSprintTable } from "./models/Sprintattempt.js";
import { initPushTable } from "./models/PushSubscription.js";

const PORT = process.env.PORT || 4000;

async function start() {
  try {
    await initMembershipTable();
    await initContactTable();
    await initMembersTable();
    await initSubscribersTable();
    await initBingoTable();
    await initQuizTable();
    await initSprintTable();
    await initPushTable();
    console.log("Database tables ready.");

    app.listen(PORT, () => {
      console.log(`MUTMLSA backend listening on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

start();