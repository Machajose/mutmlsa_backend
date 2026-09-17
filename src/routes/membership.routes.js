import { Router } from "express";
import { applyForMembership, listApplications } from "../controllers/membership.controller.js";
import { adminAuth } from "../middleware/adminAuth.js";
import { subscribe, listSubscribers, backfillFromMembers } from "../controllers/newsletter.controller.js";
import { formLimiter } from "../middleware/rateLimiter.js";

const router = Router();

router.post("/backfill", adminAuth, backfillFromMembers);
router.post("/apply", formLimiter, applyForMembership);

// Public — anyone can submit a membership application
router.post("/apply", applyForMembership);

// Admin-only — view all applications
router.get("/", adminAuth, listApplications);

export default router;
