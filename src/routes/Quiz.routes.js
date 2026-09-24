import { Router } from "express";
import { formLimiter } from "../middleware/rateLimiter.js";
import { submitQuizAttempt, fetchAttempt, quizLeaderboard, weeklyChampions } from "../controllers/Quiz.controller.js";

const router = Router();

router.post("/submit", formLimiter, submitQuizAttempt);
router.get("/attempt", fetchAttempt);
router.get("/leaderboard", quizLeaderboard);
router.get("/weekly-champions", weeklyChampions);

export default router;