import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";



const __dirname = path.dirname(fileURLToPath(import.meta.url));
const roomsPath = path.join(__dirname, "../data/campusRooms.json");

let rooms = [];
try {
  rooms = JSON.parse(readFileSync(roomsPath, "utf-8"));
} catch (err) {
  console.warn("Campus rooms data not found or invalid — location lookups will be skipped.", err.message);
}

const LOCATION_TRIGGER_WORDS = [
  "where", "room", "lab", "laboratory", "office", "building",
  "located", "location", "find", "hall", "block", "gate",
  "hostel", "library", "workshop",
];

// Very lightweight keyword search — checks if the message mentions
// location-ish words, then matches against room_name/building text.
export function findMatchingRooms(message, maxResults = 5) {
  if (!rooms.length) return [];

  const lower = message.toLowerCase();
  const looksLikeLocationQuestion = LOCATION_TRIGGER_WORDS.some((w) =>
    lower.includes(w)
  );
  if (!looksLikeLocationQuestion) return [];

  // Pull out meaningful words from the message (skip tiny/common ones)
  const words = lower
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const scored = rooms.map((room) => {
    const haystack = `${room.room_name} ${room.building} ${room.category}`.toLowerCase();
    let score = 0;
    for (const w of words) {
      if (haystack.includes(w)) score += 1;
    }
    return { room, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map((s) => s.room);
}

export function formatRoomsForPrompt(matchedRooms) {
  if (!matchedRooms.length) return "";

  const lines = matchedRooms.map(
    (r) =>
      `- ${r.room_name} — in ${r.building}, floor ${r.floor}${
        r.category ? ` (${r.category})` : ""
      }`
  );

  return `\n\nRELEVANT CAMPUS LOCATIONS (from the campus room finder, use only if genuinely relevant to the question):\n${lines.join(
    "\n"
  )}\n\nFor a full interactive map with directions, point the person to: https://mut-lecture-rooms.vercel.app/`;
}
console.log(`Loaded ${rooms.length} campus rooms from ${roomsPath}`);