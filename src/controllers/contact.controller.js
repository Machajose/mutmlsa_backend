import { createMessage, getAllMessages } from "../models/ContactMessage.js";
import { notifyCommittee } from "../config/email.js";

export async function submitContactMessage(req, res) {
  const { fullName, email, message } = req.body;

  if (!fullName || !email || !message) {
    return res.status(400).json({ error: "Name, email, and message are required." });
  }

  try {
    const saved = await createMessage({ fullName, email, message });

    await notifyCommittee(
      "New MUTMLSA contact message",
      `<h2>New contact message</h2>
       <p><strong>Name:</strong> ${fullName}</p>
       <p><strong>Email:</strong> ${email}</p>
       <p><strong>Message:</strong> ${message}</p>`
    );

    res.status(201).json({ success: true, message: saved });
  } catch (err) {
    console.error("Error saving contact message:", err);
    res.status(500).json({ error: "Something went wrong. Please try again later." });
  }
}

export async function listMessages(req, res) {
  try {
    const messages = await getAllMessages();
    res.json({ messages });
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ error: "Could not fetch messages." });
  }
}
