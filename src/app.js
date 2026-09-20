import express from "express";
import cors from "cors";
import membershipRoutes from "./routes/membership.routes.js";
import contactRoutes from "./routes/contact.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import membersRoutes from "./routes/members.routes.js";
import newsletterRoutes from "./routes/newsletter.routes.js";
import pool from "./config/db.js";
import bingoRoutes from "./routes/bingo.routes.js";
import quizRoutes from "./routes/Quiz.routes.js";
import sprintRoutes from "./routes/Sprint.routes.js";
import pushRoutes from "./routes/push.routes.js"
import notifyRoutes from "./routes/notify.routes.js";

const app = express();

const allowedOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, server-to-server, some mobile clients)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
  })
);
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "MUTMLSA backend is running." });
});

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, db: "connected" });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.use("/api/membership", membershipRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/admin/members", membersRoutes);
app.use("/api/newsletter", newsletterRoutes);
app.use("/api/bingo", bingoRoutes);
app.use("/api/quiz", quizRoutes);
app.use("/api/sprint", sprintRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/notify", notifyRoutes);

// Catch-all 404
app.use((req, res) => {
  res.status(404).json({ error: "Not found." });
});

export default app;