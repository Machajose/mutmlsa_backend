import webpush from "web-push";
import { getAllSubscriptions, removeByEndpoint } from "../models/PushSubscription.js";

webpush.setVapidDetails(
  "mailto:mutmedicallab@gmail.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Sends a notification to every stored subscriber.
export async function broadcastNotification({ title, body, url = "/" }) {
  const subs = await getAllSubscriptions();
  const payload = JSON.stringify({ title, body, url });

  await Promise.all(
    subs.map(async (row) => {
      try {
        await webpush.sendNotification(row.subscription, payload);
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await removeByEndpoint(row.endpoint);
        } else {
          console.error("Push send error:", err.message);
        }
      }
    })
  );
}