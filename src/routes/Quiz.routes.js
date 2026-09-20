import { Router } from "express";
import { formLimiter } from "../middleware/rateLimiter.js";
import { submitQuizAttempt, fetchAttempt, quizLeaderboard } from "../controllers/Quiz.controller.js";

const router = Router();

router.post("/submit", formLimiter, submitQuizAttempt);
router.get("/attempt", fetchAttempt);
router.get("/leaderboard", quizLeaderboard);

export default router;