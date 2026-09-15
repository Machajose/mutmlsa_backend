import { Router } from "express";
import { adminAuth } from "../middleware/adminAuth.js";
import { subscribe, listSubscribers } from "../controllers/newsletter.controller.js";

const router = Router();

router.post("/subscribe", subscribe);        // public
router.get("/", adminAuth, listSubscribers); // admin-only

export default router;