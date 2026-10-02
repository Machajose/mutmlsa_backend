import { Router } from "express";
import { formLimiter } from "../middleware/rateLimiter.js";
import { adminAuth } from "../middleware/adminAuth.js";
import {
  listEvents,
  rsvp,
  cancelRsvp,
  counts,
  adminCreateEvent,
  adminUpdateEvent,
  adminDeleteEvent,
} from "../controllers/events.controller.js";

const router = Router();

// Public
router.get("/", listEvents);
router.get("/counts", counts);
router.post("/:eventId/rsvp", formLimiter, rsvp);
router.delete("/:eventId/rsvp", formLimiter, cancelRsvp);

// Admin
router.post("/", adminAuth, adminCreateEvent);
router.patch("/:id", adminAuth, adminUpdateEvent);
router.delete("/:id", adminAuth, adminDeleteEvent);

export default router;