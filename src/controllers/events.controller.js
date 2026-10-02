import {
  getAllEvents,
  createEvent,
  updateEvent,
  deleteEvent,
} from "../models/Event.js";
import { addRsvp, removeRsvp, getAllRsvpCounts } from "../models/EventRsvp.js";
import { findMemberOrApplicantByName } from "../models/Member.js";

// --- Public ---

export async function listEvents(req, res) {
  try {
    const events = await getAllEvents();
    res.json({ events });
  } catch (err) {
    console.error("Error fetching events:", err);
    res.status(500).json({ error: "Could not fetch events." });
  }
}

export async function rsvp(req, res) {
  const { eventId } = req.params;
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Name is required." });
  }
  try {
    await addRsvp(eventId, name.trim());
    const match = await findMemberOrApplicantByName(name.trim());
    res.status(201).json({ ok: true, recognized: match.found });
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

// --- Admin only (protected by adminAuth in routes) ---

export async function adminCreateEvent(req, res) {
  const { dateLabel, tag, title, description, sortOrder } = req.body;
  if (!dateLabel || !title) {
    return res.status(400).json({ error: "dateLabel and title are required." });
  }
  try {
    const event = await createEvent({ dateLabel, tag, title, description, sortOrder });
    res.status(201).json({ event });
  } catch (err) {
    console.error("Error creating event:", err);
    res.status(500).json({ error: "Could not create event." });
  }
}

export async function adminUpdateEvent(req, res) {
  const { id } = req.params;
  const { dateLabel, tag, title, description, sortOrder } = req.body;
  if (!dateLabel || !title) {
    return res.status(400).json({ error: "dateLabel and title are required." });
  }
  try {
    const event = await updateEvent(id, { dateLabel, tag, title, description, sortOrder });
    if (!event) return res.status(404).json({ error: "Event not found." });
    res.json({ event });
  } catch (err) {
    console.error("Error updating event:", err);
    res.status(500).json({ error: "Could not update event." });
  }
}

export async function adminDeleteEvent(req, res) {
  const { id } = req.params;
  try {
    await deleteEvent(id);
    res.json({ ok: true });
  } catch (err) {
    console.error("Error deleting event:", err);
    res.status(500).json({ error: "Could not delete event." });
  }
}