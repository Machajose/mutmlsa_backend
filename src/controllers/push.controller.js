import { saveSubscription, removeSubscription } from "../models/PushSubscription.js";

export async function subscribe(req, res) {
  const { name, subscription } = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: "A valid subscription is required." });
  }
  try {
    await saveSubscription(name, subscription);
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("Error saving push subscription:", err);
    res.status(500).json({ error: "Could not save subscription." });
  }
}

export async function unsubscribe(req, res) {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: "endpoint is required." });
  try {
    await removeSubscription(endpoint);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Could not remove subscription." });
  }
}