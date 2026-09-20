import { Router } from "express";
import { broadcastNotification } from "../utils/sendPush.js";

const router = Router();

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

export default router;