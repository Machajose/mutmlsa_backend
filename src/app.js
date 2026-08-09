import express from "express";
import cors from "cors";
import membershipRoutes from "./routes/membership.routes.js";
import contactRoutes from "./routes/contact.routes.js";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
  })
);
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ status: "MUTMLSA backend is running." });
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/membership", membershipRoutes);
app.use("/api/contact", contactRoutes);

// Catch-all 404
app.use((req, res) => {
  res.status(404).json({ error: "Not found." });
});

export default app;
