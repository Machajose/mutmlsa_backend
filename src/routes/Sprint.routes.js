import { Router } from "express";
import { formLimiter } from "../middleware/rateLimiter.js";
import {
  submitAttemptHandler,
  fetchAttemptHandler,
  sprintLeaderboardHandler,
} from "../controllers/Sprint.controller.js";

const router = Router();

router.post("/submit", formLimiter, submitAttemptHandler);
router.get("/attempt", fetchAttemptHandler);
router.get("/leaderboard", sprintLeaderboardHandler);

export default router;