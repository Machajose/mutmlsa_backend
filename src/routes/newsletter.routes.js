import { Router } from "express";
import { adminAuth } from "../middleware/adminAuth.js";
import { subscribe, listSubscribers, backfillFromMembers, backfillFromApplications } from "../controllers/newsletter.controller.js";

const router = Router();

router.post("/backfill", adminAuth, backfillFromMembers);
router.post("/backfill-applications", adminAuth, backfillFromApplications);
router.post("/subscribe", subscribe);        // public
router.get("/", adminAuth, listSubscribers); // admin-only

export default router;