import { Router } from "express";
import { chatWithAssistant } from "../controllers/chat.controller.js";
import { chatLimiter } from "../middleware/rateLimiter.js";

const router = Router();

router.post("/", chatLimiter, chatWithAssistant);

export default router;