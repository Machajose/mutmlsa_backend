import { Resend } from "resend";
import "dotenv/config";

// Notifications are best-effort: if RESEND_API_KEY isn't set, or the
// email fails to send, we log it and move on rather than failing the
// request — the submission is already safely stored in the database.
const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export async function notifyCommittee(subject, html) {
  if (!resend) {
    console.warn("RESEND_API_KEY not set — skipping email notification.");
    return;
  }
  try {
    await resend.emails.send({
      from: process.env.NOTIFY_FROM_EMAIL || "MUTMLSA Site <onboarding@resend.dev>",
      to: process.env.NOTIFY_TO_EMAIL || "mutmedicallab@gmail.com",
      subject,
      html,
    });
  } catch (err) {
    console.error("Failed to send notification email:", err.message);
  }
}
