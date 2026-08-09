import { Router } from "express";
import { applyForMembership, listApplications } from "../controllers/membership.controller.js";
import { adminAuth } from "../middleware/adminAuth.js";

const router = Router();

// Public — anyone can submit a membership application
router.post("/apply", applyForMembership);

// Admin-only — view all applications
router.get("/", adminAuth, listApplications);

export default router;
