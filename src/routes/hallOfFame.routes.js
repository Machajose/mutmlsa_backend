import { Router } from "express";
import { getHallOfFame } from "../utils/hallOfFame.js";

const router = Router();

// Public: top 10 for this week, this month and the semester, plus past winners
router.get("/", async (req, res) => {
  try {
    res.json(await getHallOfFame());
  } catch (err) {
    console.error("Error loading Hall of Fame:", err);
    res.status(500).json({ error: "Could not load the Hall of Fame." });
  }
});

// Admin only: the complete standings (everyone, not just the top 10)
router.get("/admin", async (req, res) => {
  if (req.header("x-admin-password") !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized." });
  }
  try {
    res.json(await getHallOfFame({ full: true }));
  } catch (err) {
    console.error("Error loading admin Hall of Fame:", err);
    res.status(500).json({ error: "Could not load the Hall of Fame." });
  }
});

export default router;