import * as chrono from "chrono-node";
import { formatDisplay, pickBestDate } from "./dateParse";

export interface ExtractedEvent {
  title: string;
  location: string | null;
  description: string | null;
  dateIso: string | null;
  dateDisplay: string | null;
}

// 📍 rarely has a colon after it ("📍 Skybar, Marina Bay"); keyword labels usually do
// ("Location: Skybar"), so the separator is required for those to avoid matching prose.
const LOCATION_EMOJI_PATTERN = /^\s*📍\s*[:\-]?\s*(.+)/;
const LOCATION_KEYWORD_PATTERN = /^\s*(?:location|venue|address|where)\s*[:\-]\s*(.+)/i;

// Offers/events often mention a casual date ("this weekend only!") ahead of the actual
// deadline ("Now till 30 Aug", "Valid until 30 Aug"). Prefer a line with an explicit
// deadline keyword when present, and scan just that line rather than the whole message.
const DEADLINE_KEYWORD_PATTERN = /\b(deadline|valid|till|until|thru|through|expir(?:es|y)|ends?(?:\s*on)?|offer\s*ends)\b/i;

function findLocationLine(lines: string[]): { line: string; value: string } | null {
  for (const line of lines) {
    const m = line.match(LOCATION_EMOJI_PATTERN);
    if (m) return { line, value: m[1].trim().slice(0, 100) };
  }
  for (const line of lines) {
    const m = line.match(LOCATION_KEYWORD_PATTERN);
    if (m) return { line, value: m[1].trim().slice(0, 100) };
  }
  return null;
}

// The title line is excluded from the general scan: words like "night" or "today" in a
// title can bleed into chrono's parsing of the following line and throw off the result.
// It's only consulted as a last resort, when nothing elsewhere in the message parses.
function extractDate(
  lines: string[],
  ref: Date
): { iso: string | null; display: string | null; usedLine: string | null } {
  // A keyword match doesn't guarantee the line actually contains a date ("Valid for
  // dine-in only" matches "valid" but has no date) — try every candidate line in order
  // and use the first one chrono can actually parse, not just the first keyword hit.
  let results: chrono.ParsedResult[] = [];
  let usedLine: string | null = null;
  for (const line of lines.filter((l) => DEADLINE_KEYWORD_PATTERN.test(l))) {
    const r = chrono.parse(line, ref, { forwardDate: true });
    if (r.length > 0) {
      results = r;
      usedLine = line;
      break;
    }
  }

  if (results.length === 0) {
    const body = lines.length > 1 ? lines.slice(1).join("\n") : lines.join("\n");
    results = chrono.parse(body, ref, { forwardDate: true });
  }
  if (results.length === 0 && lines.length > 1) {
    results = chrono.parse(lines.join("\n"), ref, { forwardDate: true });
  }

  const date = pickBestDate(results);
  if (!date) return { iso: null, display: null, usedLine: null };
  return { iso: date.toISOString(), display: formatDisplay(date), usedLine };
}

export function extractEventDetails(text: string, ref = new Date()): ExtractedEvent {
  const cleaned = text.trim();
  const lines = cleaned
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const titleSource = lines[0] || cleaned;
  const title = titleSource.length > 100 ? titleSource.slice(0, 100) + "…" : titleSource;

  const locationMatch = findLocationLine(lines);
  const { iso: dateIso, display: dateDisplay, usedLine: dateLine } = extractDate(lines, ref);

  const consumed = new Set([locationMatch?.line, dateLine].filter((l): l is string => Boolean(l)));
  const remaining = lines.slice(1).filter((l) => !consumed.has(l));
  const descriptionText = remaining.join("\n").trim();
  const description = descriptionText
    ? descriptionText.length > 400
      ? descriptionText.slice(0, 400) + "…"
      : descriptionText
    : null;

  return { title, location: locationMatch?.value ?? null, description, dateIso, dateDisplay };
}
