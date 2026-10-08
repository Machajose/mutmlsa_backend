import { Router } from "express";
import { adminAuth } from "../middleware/adminAuth.js";
import { formLimiter } from "../middleware/rateLimiter.js";

import {
  listMembers,
  listPendingApplications,
  addMember,
  updatePayment,
  updateRegistration,
  checkMemberStatus,
} from "../controllers/members.controller.js";

const router = Router();

router.get("/status", formLimiter, checkMemberStatus);

router.get("/", adminAuth, listMembers);
router.get("/pending-applications", adminAuth, listPendingApplications);
router.post("/", adminAuth, addMember);
router.patch("/:id/payment", adminAuth, updatePayment);
router.patch("/:id/registration", adminAuth, updateRegistration);

export default router;