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

  const lines = matchedRooms.map((r) => {
    const direction = describeDirection(r);
    return `- ${r.room_name} — in ${r.building}, floor ${r.floor}${
      r.category ? ` (${r.category})` : ""
    }.${direction}`;
  });

  return `\n\nRELEVANT CAMPUS LOCATIONS (from the campus room finder, use only if genuinely relevant to the question):\n${lines.join(
    "\n"
  )}\n\nFor a full interactive map with directions, point the person to: https://mut-lecture-rooms.vercel.app/`;
}

// Compass bearing from point A to point B, in degrees (0=N, 90=E, 180=S, 270=W)
function bearingBetween(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180) / Math.PI + 360 % 360;
}

function bearingToCompass(bearing) {
  const directions = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
  return directions[Math.round(bearing / 45) % 8];
}

// Rough distance in meters (haversine) — used to find the nearest landmark
function distanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Finds the closest other distinct room/building to use as a landmark
function findNearestLandmark(targetRoom) {
  let nearest = null;
  let minDist = Infinity;

  for (const room of rooms) {
    if (room.room_id === targetRoom.room_id) continue;
    if (room.building === targetRoom.building) continue; // skip same building
    if (typeof room.lat !== "number" || typeof room.lon !== "number") continue;

    const dist = distanceMeters(targetRoom.lat, targetRoom.lon, room.lat, room.lon);
    if (dist < minDist) {
      minDist = dist;
      nearest = room;
    }
  }
  return nearest;
}

export function describeDirection(room) {
  if (typeof room.lat !== "number" || typeof room.lon !== "number") return "";

  const landmark = findNearestLandmark(room);
  if (!landmark) return "";

  const bearing = bearingBetween(landmark.lat, landmark.lon, room.lat, room.lon);
  const compass = bearingToCompass(bearing);

  return ` It's ${compass} of ${landmark.building || landmark.room_name}, close to ${landmark.room_name}.`;
}