import { getEvent, updateEvent } from "../db";
import { MyConversation, MyConversationContext } from "../types";
import { formatDisplay } from "../utils/dateParse";
import { collectEventFields } from "./fields";

export async function editEvent(conversation: MyConversation, ctx: MyConversationContext, eventId: number) {
  const existing = getEvent(eventId);
  if (!existing) {
    await ctx.reply(`Couldn't find that event. It may have already been deleted.`);
    return;
  }

  await ctx.reply(`Editing: ${existing.title}\n(reply "keep"/tap the button to leave a field as-is)`);

  const collected = await collectEventFields(conversation, ctx, {
    title: existing.title,
    dateIso: existing.event_date,
    dateDisplay: existing.event_date ? formatDisplay(new Date(existing.event_date)) : existing.event_date_text,
    location: existing.location,
    description: existing.description,
  });

  if (!collected.title) {
    await ctx.reply("Title can't be empty. Edit cancelled — nothing was changed.");
    return;
  }

  updateEvent(eventId, {
    title: collected.title,
    event_date: collected.dateIso,
    event_date_text: collected.dateIso ? null : collected.dateDisplay,
    location: collected.location,
    description: collected.description,
  });

  const whenSummary = collected.dateIso
    ? collected.dateDisplay
    : collected.dateDisplay
    ? `unclear date ("${collected.dateDisplay}") — saved as text`
    : "no date set";

  const extra = [];
  if (collected.location) extra.push(`📍 ${collected.location}`);
  if (collected.description) extra.push(`📝 ${collected.description}`);

  await ctx.reply(
    `Updated ✅ ${collected.title}\n🗓 ${whenSummary}${extra.length ? "\n" + extra.join("\n") : ""}`
  );
}
