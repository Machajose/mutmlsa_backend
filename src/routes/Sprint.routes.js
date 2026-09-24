import { Router } from "express";
import { formLimiter } from "../middleware/rateLimiter.js";
import {
  submitAttemptHandler,
  fetchAttemptHandler,
  sprintLeaderboardHandler,
  weeklyChampions
} from "../controllers/Sprint.controller.js";

const router = Router();

router.post("/submit", formLimiter, submitAttemptHandler);
router.get("/attempt", fetchAttemptHandler);
router.get("/leaderboard", sprintLeaderboardHandler);
router .get("/weekly-champions", weeklyChampions);

export default router;