import { Router } from "express";
import { formLimiter } from "../middleware/rateLimiter.js";
import {
  newCard,
  fetchCard,
  searchByName,
  fillSquareHandler,
  leaderboard,
  renameCardHandler,
} from "../controllers/bingo.controller.js";

const router = Router();

router.post("/", formLimiter, newCard);
router.get("/leaderboard", leaderboard);
router.get("/find", searchByName);
router.get("/:id", fetchCard);
router.patch("/:id/fill", fillSquareHandler);
router.patch("/:id/name", formLimiter, renameCardHandler);

export default router;