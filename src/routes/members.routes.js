import { Router } from "express";
import { adminAuth } from "../middleware/adminAuth.js";
import {
  listMembers,
  listPendingApplications,
  addMember,
  updatePayment,
  updateRegistration,
} from "../controllers/members.controller.js";

const router = Router();

router.get("/", adminAuth, listMembers);
router.get("/pending-applications", adminAuth, listPendingApplications);
router.post("/", adminAuth, addMember);
router.patch("/:id/payment", adminAuth, updatePayment);
router.patch("/:id/registration", adminAuth, updateRegistration);

export default router;