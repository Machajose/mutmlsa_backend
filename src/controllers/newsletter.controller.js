import { createSubscriber, getAllSubscribers } from "../models/Subscriber.js";
import { getAllMembers } from "../models/Member.js";
import { bulkAddFromMembers } from "../models/Subscriber.js";


export async function backfillFromMembers(req, res) {
  try {
    const members = await getAllMembers();
    const added = await bulkAddFromMembers(members);
    res.json({ success: true, added });
  } catch (err) {
    console.error("Error backfilling subscribers:", err);
    res.status(500).json({ error: "Could not backfill subscribers." });
  }
}

export async function subscribe(req, res) {
  const { fullName, email } = req.body;

  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "A valid email is required." });
  }

  try {
    const subscriber = await createSubscriber({ fullName, email });
    res.status(201).json({ success: true, subscriber });
  } catch (err) {
    console.error("Error subscribing:", err);
    res.status(500).json({ error: "Could not subscribe. Please try again." });
  }
}

export async function listSubscribers(req, res) {
  try {
    const subscribers = await getAllSubscribers();
    res.json({ subscribers });
  } catch (err) {
    console.error("Error listing subscribers:", err);
    res.status(500).json({ error: "Could not fetch subscribers." });
  }
}