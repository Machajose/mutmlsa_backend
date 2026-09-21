import { Router } from "express";
import { broadcastNotification } from "../utils/sendPush.js";
import { runAutoCheck } from "../utils/autoNotify.js";

const router = Router();

// Manual broadcast — used by the Admin Portal's "Send Push Notification"
// form. Protected by the same admin password as the rest of /admin.
router.post("/send", async (req, res) => {
  const password = req.header("x-admin-password");
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  const { title, body, url } = req.body;
  if (!title || !body) {
    return res.status(400).json({ error: "title and body are required." });
  }

  try {
    await broadcastNotification({ title, body, url });
    res.json({ ok: true });
  } catch (err) {
    console.error("Error broadcasting notification:", err);
    res.status(500).json({ error: "Could not send notifications." });
  }
});

// Automatic check — called by an external scheduler (cron-job.org, etc.),
// not by a human, so it's protected by a separate secret rather than the
// admin password. Set CRON_SECRET in your env vars and pass it as a
// query param when configuring the scheduled job:
//   POST https://your-backend.onrender.com/api/notify/auto-check?secret=YOUR_SECRET
router.post("/auto-check", async (req, res) => {
  const secret = req.query.secret;
  if (!secret || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  try {
    const result = await runAutoCheck();
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("Error running auto-check:", err);
    res.status(500).json({ error: "Auto-check failed." });
  }
});

export default router;