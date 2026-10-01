import * as chrono from "chrono-node";

export interface ParsedDate {
  iso: string | null;
  display: string;
}

// A phrase like "Now till 30 Aug" parses as a RANGE (start=now, end=30 Aug) — the end is the
// date that actually matters for a deadline. But "6:30pm - 9pm" is also a range, and there
// the start is what matters (when the event begins). Tell them apart by whether the range
// crosses a calendar day: same-day range -> a time span, use the start; multi-day -> a
// deadline-style span, use the end.
function resolvedDate(result: chrono.ParsedResult): Date {
  if (!result.end) return result.start.date();
  const start = result.start.date();
  const end = result.end.date();
  return start.toDateString() === end.toDateString() ? start : end;
}

// When a line yields multiple separate matches (e.g. a casual mention plus an explicit
// date), prefer whichever resolves latest — that's usually the more specific/binding one.
export function pickBestDate(results: chrono.ParsedResult[]): Date | null {
  if (results.length === 0) return null;
  let best = resolvedDate(results[0]);
  for (const r of results.slice(1)) {
    const d = resolvedDate(r);
    if (d > best) best = d;
  }
  return best;
}

// Interprets free text like "this Saturday 7pm", "Now till 30 Aug", "skip", "no date".
export function parseDeadline(text: string, ref = new Date()): ParsedDate {
  const trimmed = text.trim();
  if (!trimmed || /^(skip|none|no date|n\/a|na)$/i.test(trimmed)) {
    return { iso: null, display: "" };
  }
  const results = chrono.parse(trimmed, ref, { forwardDate: true });
  const date = pickBestDate(results);
  if (!date) {
    return { iso: null, display: trimmed };
  }
  return { iso: date.toISOString(), display: formatDisplay(date) };
}

export function formatDisplay(d: Date): string {
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
