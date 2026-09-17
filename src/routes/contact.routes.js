import { Router } from "express";
import { submitContactMessage, listMessages } from "../controllers/contact.controller.js";
import { adminAuth } from "../middleware/adminAuth.js";
import { formLimiter } from "../middleware/rateLimiter.js";

const router = Router();

// Public — anyone can send a contact message
router.post("/", formLimiter, submitContactMessage);

// Admin-only — view all messages
router.get("/", adminAuth, listMessages);

export default router;
