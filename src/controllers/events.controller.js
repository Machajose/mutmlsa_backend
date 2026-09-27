import { addRsvp, removeRsvp, getAllRsvpCounts } from "../models/EventRsvp.js";

export async function rsvp(req, res) {
  const { eventId } = req.params;
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Name is required." });
  }
  try {
    await addRsvp(eventId, name.trim());
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("Error adding RSVP:", err);
    res.status(500).json({ error: "Could not RSVP." });
  }
}

export async function cancelRsvp(req, res) {
  const { eventId } = req.params;
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Name is required." });
  }
  try {
    await removeRsvp(eventId, name.trim());
    res.json({ ok: true });
  } catch (err) {
    console.error("Error cancelling RSVP:", err);
    res.status(500).json({ error: "Could not cancel RSVP." });
  }
}

export async function counts(req, res) {
  try {
    const data = await getAllRsvpCounts();
    res.json({ counts: data });
  } catch (err) {
    console.error("Error fetching RSVP counts:", err);
    res.status(500).json({ error: "Could not fetch counts." });
  }
}