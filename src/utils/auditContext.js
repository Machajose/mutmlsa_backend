// Condensed, human-reviewed summary of the 2025/2026 MUTMLSA Financial
// Audit Report — NOT the raw PDF text. Kept intentionally short so it's
// cheap to append to the chat prompt and accurate rather than a garbled
// paraphrase of a long table.
//
// Set AUDIT_VISIBLE_UNTIL to control how long the bot will answer audit
// questions and how long the download banner shows on the site. After
// that date, both switch off automatically — update or remove this file
// once the audit is no longer meant to be publicly highlighted.

export const AUDIT_VISIBLE_UNTIL = new Date("2026-09-27"); // adjust to your real end date
export const AUDIT_PDF_URL = "/audit/MUTMLSA_Audit_Report_2025-2026.pdf"; // place the PDF in public/audit/

const AUDIT_TRIGGER_WORDS = [
  "audit", "financial", "finances", "budget", "funds", "fund",
  "money", "expenditure", "expenses", "treasury", "account balance",
  "kitty", "transparency", "report",
];

const AUDIT_SUMMARY = `
MUTMLSA FINANCIAL AUDIT SUMMARY (Academic Year 2025/2026 to start of 2026/2027)
Status: Fully verified, open ledger transparency. Currency: Kenyan Shillings (Ksh).

Semester 1 (2025/2026):
- Opened with Ksh 3,275.
- Key activity: labcoat sales, wristbands, t-shirts, membership fees, semester closing
  social, and KEMELSA institutional affiliation fee (Ksh 500).
- Closed with a final verified cash balance of Ksh 2,510.
- Closing physical stock: 1 labcoat, 38 wristbands, 10 t-shirts.

Semester 2 (2025/2026):
- Opened with Ksh 2,510.
- Key activity: membership renewals, remaining t-shirt stock sold, the Scientific
  Symposium & Talk (heavily subsidized by Executive members' personal funds), the
  Executive Handover Ceremony, the MUTMLSA Research Conference (31 March 2026, closed
  with a surplus), and 4th-year graduation certificate printing.
- Closed with a final verified cash balance of Ksh 1,150.
- Closing physical stock: 38 wristbands, 9 t-shirts (the last labcoat was issued on
  student loan).

Current semester opening status (2026/2027, as of this report):
- Carried forward Ksh 1,150.
- Administrative printing, a new first-year registration, and a fresh 11-unit labcoat
  order (which returned a Ksh 750 profit) bring the current actual cash in the
  association account to Ksh 1,680.

Sign-off: Reviewed and manually verified against receipts by the Independent Internal
Review Committee — Cherrily Ochieng' (Chairperson) and James Gitahi (Treasurer), who
confirm the breakdown honestly reflects MUTMLSA's cash and assets over the year.

Several events (the Scientific Symposium and others) ran at a deficit covered
out-of-pocket by Executive members — this is disclosed transparently in the full report,
not hidden.
`.trim();

export function isAuditQuestion(message) {
  if (new Date() > AUDIT_VISIBLE_UNTIL) return false;
  const lower = message.toLowerCase();
  return AUDIT_TRIGGER_WORDS.some((w) => lower.includes(w));
}

export function getAuditContext(siteUrl) {
  const fullPdfUrl = `${siteUrl}${AUDIT_PDF_URL}`;
  return `\n\n${AUDIT_SUMMARY}\n\nThe full audit PDF is available for download. When mentioning it, always format it as a markdown link like this: [Download the full audit PDF](${fullPdfUrl})`;
}