import * as chrono from "chrono-node";

export interface ParsedDate {
  iso: string | null;
  display: string;
  hasTime: boolean;
}

export interface BestDate {
  date: Date;
  // Whether the text actually gave a time ("Sat 8pm") — chrono fills in noon when it
  // didn't ("30 Oct"), and that made-up time shouldn't be shown.
  hasTime: boolean;
}

// A phrase like "Now till 30 Aug" parses as a RANGE (start=now, end=30 Aug) — the end is the
// date that actually matters for a deadline. But "6:30pm - 9pm" is also a range, and there
// the start is what matters (when the event begins). Tell them apart by whether the range
// crosses a calendar day: same-day range -> a time span, use the start; multi-day -> a
// deadline-style span, use the end.
function resolvedDate(result: chrono.ParsedResult): BestDate {
  const toBest = (c: chrono.ParsedComponents): BestDate => ({ date: c.date(), hasTime: c.isCertain("hour") });
  if (!result.end) return toBest(result.start);
  const start = result.start.date();
  const end = result.end.date();
  return start.toDateString() === end.toDateString() ? toBest(result.start) : toBest(result.end);
}

// When a line yields multiple separate matches (e.g. a casual mention plus an explicit
// date), prefer whichever resolves latest — that's usually the more specific/binding one.
export function pickBestDate(results: chrono.ParsedResult[]): BestDate | null {
  if (results.length === 0) return null;
  let best = resolvedDate(results[0]);
  for (const r of results.slice(1)) {
    const candidate = resolvedDate(r);
    if (candidate.date > best.date) best = candidate;
  }
  return best;
}

// Interprets free text like "this Saturday 7pm", "Now till 30 Aug", "skip", "no date".
export function parseDeadline(text: string, ref = new Date()): ParsedDate {
  const trimmed = text.trim();
  if (!trimmed || /^(skip|none|no date|n\/a|na)$/i.test(trimmed)) {
    return { iso: null, display: "", hasTime: false };
  }
  const results = chrono.parse(trimmed, ref, { forwardDate: true });
  const best = pickBestDate(results);
  if (!best) {
    return { iso: null, display: trimmed, hasTime: false };
  }
  return { iso: best.date.toISOString(), display: formatDisplay(best.date, best.hasTime), hasTime: best.hasTime };
}

export function formatDisplay(d: Date, hasTime: boolean): string {
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(hasTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}
