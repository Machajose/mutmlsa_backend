import { Router } from "express";
import { formLimiter } from "../middleware/rateLimiter.js";
import { newCard, fetchCard, searchByName, toggleSquare } from "../controllers/bingo.controller.js";

const router = Router();

router.post("/", formLimiter, newCard);
router.get("/find", searchByName);
router.get("/:id", fetchCard);
router.patch("/:id/toggle", toggleSquare);

export default router;