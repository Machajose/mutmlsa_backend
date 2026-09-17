import { Router } from "express";
import { adminAuth } from "../middleware/adminAuth.js";

import { adminLoginLimiter } from "../middleware/rateLimiter.js";

import {
  listMembers,
  listPendingApplications,
  addMember,
  updatePayment,
  updateRegistration,
} from "../controllers/members.controller.js";

const router = Router();

router.get("/", adminLoginLimiter, adminAuth, listMembers);
router.get("/pending-applications", adminLoginLimiter, adminAuth, listPendingApplications);
router.post("/", adminLoginLimiter, adminAuth, addMember);
router.patch("/:id/payment", adminLoginLimiter, adminAuth, updatePayment);
router.patch("/:id/registration", adminLoginLimiter, adminAuth, updateRegistration);

export default router;