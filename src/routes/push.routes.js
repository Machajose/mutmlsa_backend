import { Router } from "express";
import { formLimiter } from "../middleware/rateLimiter.js";
import { subscribe, unsubscribe } from "../controllers/push.controller.js";

const router = Router();

router.post("/subscribe", formLimiter, subscribe);
router.post("/unsubscribe", formLimiter, unsubscribe);

export default router;