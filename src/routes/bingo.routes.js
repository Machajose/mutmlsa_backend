import { Router } from "express";
import { formLimiter } from "../middleware/rateLimiter.js";
import { adminAuth } from "../middleware/adminAuth.js";
import { adminListCards, adminConfirmCard, adminClearCard, adminDeleteCard } from "../controllers/bingoAdmin.controller.js";
import {
  newCard,
  fetchCard,
  searchByName,
  fillSquareHandler,
  leaderboard,
  renameCardHandler,
} from "../controllers/bingo.controller.js";

const router = Router();

// Committee review (admin password needed). Must stay above the "/:id" routes.
router.get("/admin/cards", adminAuth, adminListCards);
router.post("/admin/cards/:id/confirm", adminAuth, adminConfirmCard);
router.post("/admin/cards/:id/clear", adminAuth, adminClearCard);
router.delete("/admin/cards/:id", adminAuth, adminDeleteCard);

router.post("/", formLimiter, newCard);
router.get("/leaderboard", leaderboard);
router.get("/find", searchByName);
router.get("/:id", fetchCard);
router.patch("/:id/fill", fillSquareHandler);
router.patch("/:id/name", formLimiter, renameCardHandler);

export default router;