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
const STOPWORDS = new Set([
  "the", "is", "are", "was", "were", "in", "on", "at", "of", "and",
  "to", "for", "with", "this", "that", "it", "can", "you", "me",
  "please", "find", "tell", "about", "what", "which", "does",
]);

export function findMatchingRooms(message, maxResults = 5) {
  if (!rooms.length) return [];

  const lower = message.toLowerCase();
  const looksLikeLocationQuestion = LOCATION_TRIGGER_WORDS.some((w) =>
    lower.includes(w)
  );
  if (!looksLikeLocationQuestion) return [];

  const words = lower
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

  const scored = rooms.map((room) => {
    const haystackWords = `${room.room_name} ${room.building} ${room.category}`
      .toLowerCase()
      .split(/\s+/);

    let score = 0;
    for (const w of words) {
      if (haystackWords.some((hw) => hw === w || hw.startsWith(w))) {
        score += 1;
      }
      // Bonus: exact/prefix match directly in room_name counts extra —
      // makes "library" strongly favor the room actually named Library.
      if (room.room_name.toLowerCase().includes(w)) {
        score += 2;
      }
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