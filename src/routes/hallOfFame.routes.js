import { Router } from "express";
import { formLimiter } from "../middleware/rateLimiter.js";
import { getHallOfFame, claimYear, setPlayerYear } from "../utils/hallOfFame.js";

const router = Router();

function isAdmin(req) {
  return req.header("x-admin-password") === process.env.ADMIN_PASSWORD;
}

// Public: top 10 for this week, month and semester (overall + each year), plus past winners
router.get("/", async (req, res) => {
  try {
    res.json(await getHallOfFame());
  } catch (err) {
    console.error("Error loading Hall of Fame:", err);
    res.status(500).json({ error: "Could not load the Hall of Fame." });
  }
});

// Public: a player claims their year of study (1–4). Can be done at any time.
router.post("/claim", formLimiter, async (req, res) => {
  try {
    const { name, year } = req.body || {};
    const result = await claimYear(name, year);
    const { status, ...body } = result;
    res.status(status).json(body);
  } catch (err) {
    console.error("Error claiming year:", err);
    res.status(500).json({ error: "Could not save your year." });
  }
});

// Admin only: the complete standings (everyone) and the list of claimed years
router.get("/admin", async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: "Unauthorized." });
  try {
    res.json(await getHallOfFame({ full: true }));
  } catch (err) {
    console.error("Error loading admin Hall of Fame:", err);
    res.status(500).json({ error: "Could not load the Hall of Fame." });
  }
});

// Admin only: set or change someone's year (year 0 removes it)
router.post("/admin/year", async (req, res) => {
  if (!isAdmin(req)) return res.status(401).json({ error: "Unauthorized." });
  try {
    const { name, year } = req.body || {};
    const result = await setPlayerYear(name, year);
    const { status, ...body } = result;
    res.status(status).json(body);
  } catch (err) {
    console.error("Error setting year:", err);
    res.status(500).json({ error: "Could not update the year." });
  }
});

export default router;