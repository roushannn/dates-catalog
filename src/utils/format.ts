import { EventRecord } from "../types";
import { formatDisplay } from "./dateParse";

export function formatEventLine(e: EventRecord): string {
  const when = e.event_date
    ? formatDisplay(new Date(e.event_date))
    : e.event_date_text
    ? `(unclear date: "${e.event_date_text}")`
    : "(no date set)";
  const parts = [`#${e.id} ${e.title}`, `🗓 ${when}`];
  if (e.location) parts.push(`📍 ${e.location}`);
  if (e.description) parts.push(`📝 ${e.description}`);
  if (e.source_chat) parts.push(`↪️ from ${e.source_chat}`);
  if (e.source_url) parts.push(`🔗 ${e.source_url}`);
  return parts.join("\n");
}

export function formatEventList(events: EventRecord[], emptyMessage: string): string {
  if (events.length === 0) return emptyMessage;
  return events.map(formatEventLine).join("\n\n");
}
