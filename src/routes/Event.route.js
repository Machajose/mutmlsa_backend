import { Router } from "express";
import { formLimiter } from "../middleware/rateLimiter.js";
import { rsvp, cancelRsvp, counts } from "../controllers/events.controller.js";

const router = Router();

router.get("/counts", counts);
router.post("/:eventId/rsvp", formLimiter, rsvp);
router.delete("/:eventId/rsvp", formLimiter, cancelRsvp);

export default router;