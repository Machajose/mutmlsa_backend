export function normalizeRegNumber(value) {
  return (value || "").trim().toUpperCase().replace(/\s+/g, "");
}

export function isValidRegNumber(value) {
  return /^[A-Z]{2,4}\d{2,4}\/\d{3,5}\/\d{4}$/.test(normalizeRegNumber(value));
}