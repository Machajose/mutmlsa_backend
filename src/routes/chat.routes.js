import { Router } from "express";
import { chatWithAssistant } from "../controllers/chat.controller.js";

const router = Router();

router.post("/", chatWithAssistant);

export default router;