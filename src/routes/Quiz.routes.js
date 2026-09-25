import { Router } from "express";
import { formLimiter } from "../middleware/rateLimiter.js";
import {
  submitQuizAttempt,
  fetchAttempt,
  quizLeaderboard,
  champsByPeriod,
} from "../controllers/Quiz.controller.js";

const router = Router();

router.post("/submit", formLimiter, submitQuizAttempt);
router.get("/attempt", fetchAttempt);
router.get("/leaderboard", quizLeaderboard);
router.get("/champions-by-period", champsByPeriod);

export default router;