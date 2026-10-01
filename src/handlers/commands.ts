import { InlineKeyboard } from "grammy";
import { deleteEvent, getActiveEvents, getEvent, getEventsInRange, markDone } from "../db";
import { EventRecord, MyContext } from "../types";
import { currentWeekRange, upcomingWeekendRange } from "../utils/dateRange";
import { formatEventList } from "../utils/format";

// Shown in Telegram's command menu (the "/" popup and the Menu button).
export const COMMAND_MENU = [
  { command: "add", description: "Add an event or offer manually" },
  { command: "week", description: "Everything happening this week" },
  { command: "weekend", description: "Everything happening this (or next) weekend" },
  { command: "list", description: "All saved events, nearest deadline first" },
  { command: "edit", description: "Edit an event: /edit <number>" },
  { command: "done", description: "Mark an event done: /done <number>" },
  { command: "delete", description: "Delete an event: /delete <number>" },
  { command: "cancel", description: "Abort whatever you're in the middle of" },
  { command: "help", description: "How to use this bot" },
];

export async function cmdStart(ctx: MyContext) {
  await ctx.reply(
    "Hi! I keep track of events and offers for date nights and weekends.\n\n" +
      "• Forward me a message from a channel/chat and I'll try to pick out the title, date, " +
      "and location, then ask you to confirm or edit them.\n" +
      "• Share an Instagram post to me (Share → Telegram, or paste the link) and I'll do the " +
      "same with its caption.\n" +
      "• Or use /add to log one manually.\n" +
      "• /week — everything happening this week\n" +
      "• /weekend — everything happening this (or next) weekend\n" +
      "• /list — everything saved, nearest deadline first\n" +
      "• /edit <number> — change an event's details\n" +
      "• /done <number> and /delete <number> also work as commands\n" +
      "  (the number is from the last list I showed you)\n" +
      "• /cancel — abort whatever you're in the middle of"
  );
}

export async function cmdAdd(ctx: MyContext) {
  await ctx.conversation.enter("addEvent");
}

export async function cmdCancel(ctx: MyContext) {
  await ctx.conversation.exitAll();
  await ctx.reply("Cancelled.");
}

// Lists are numbered 1, 2, 3… by position rather than by database id, so typed commands
// like "/done 2" need to know which list "2" came from. Remember the ids of the last list
// shown in each chat. In-memory is fine: after a restart we fall back to /list's order.
const lastShownIds = new Map<number, number[]>();

async function showList(ctx: MyContext, events: EventRecord[], emptyMessage: string) {
  if (ctx.chat) lastShownIds.set(ctx.chat.id, events.map((e) => e.id));
  await ctx.reply(formatEventList(events, emptyMessage));
  await sendButtonsFor(ctx, events);
}

export async function cmdWeek(ctx: MyContext) {
  const [start, end] = currentWeekRange();
  await showList(ctx, getEventsInRange(start, end), "Nothing on the calendar for this week yet.");
}

export async function cmdWeekend(ctx: MyContext) {
  const [start, end] = upcomingWeekendRange();
  await showList(ctx, getEventsInRange(start, end), "Nothing lined up for the weekend yet.");
}

export async function cmdList(ctx: MyContext) {
  await showList(ctx, getActiveEvents(), "No saved events/offers yet. Forward me something or use /add.");
}

async function sendButtonsFor(ctx: MyContext, events: EventRecord[]) {
  if (events.length === 0) return;
  const keyboard = new InlineKeyboard();
  events.forEach((e, i) => {
    const n = i + 1;
    keyboard.text(`✏️ ${n}`, `edit:${e.id}`).text(`✅ ${n} done`, `done:${e.id}`).text(`🗑 ${n}`, `del:${e.id}`).row();
  });
  await ctx.reply("Edit, mark done, or delete:", { reply_markup: keyboard });
}

/** Resolves "/done 2" to the event shown as number 2 in this chat's last list. */
function resolveEventArg(ctx: MyContext): EventRecord | "usage" | "missing" {
  const arg = ctx.match?.toString().trim();
  const n = Number(arg);
  if (!arg || !Number.isInteger(n) || n < 1) return "usage";
  const ids = (ctx.chat && lastShownIds.get(ctx.chat.id)) ?? getActiveEvents().map((e) => e.id);
  const id = ids[n - 1];
  return (id !== undefined && getEvent(id)) || "missing";
}

const USAGE_HINT = "(use the number next to the event in the last list I showed you)";

export async function cmdEdit(ctx: MyContext) {
  const event = resolveEventArg(ctx);
  if (event === "usage") {
    await ctx.reply(`Usage: /edit <number> ${USAGE_HINT}`);
    return;
  }
  if (event === "missing") {
    await ctx.reply(`There's no event with that number ${USAGE_HINT}.`);
    return;
  }
  await ctx.conversation.enter("editEvent", event.id);
}

export async function cmdDone(ctx: MyContext) {
  const event = resolveEventArg(ctx);
  if (event === "usage") {
    await ctx.reply(`Usage: /done <number> ${USAGE_HINT}`);
    return;
  }
  if (event === "missing") {
    await ctx.reply(`There's no event with that number ${USAGE_HINT}.`);
    return;
  }
  markDone(event.id);
  await ctx.reply(`✅ Marked "${event.title}" as done.`);
}

export async function cmdDelete(ctx: MyContext) {
  const event = resolveEventArg(ctx);
  if (event === "usage") {
    await ctx.reply(`Usage: /delete <number> ${USAGE_HINT}`);
    return;
  }
  if (event === "missing") {
    await ctx.reply(`There's no event with that number ${USAGE_HINT}.`);
    return;
  }
  deleteEvent(event.id);
  await ctx.reply(`🗑 Deleted "${event.title}".`);
}

export async function onCallbackQuery(ctx: MyContext) {
  const data = ctx.callbackQuery?.data;
  if (!data) return;
  const [action, idStr] = data.split(":");
  const id = Number(idStr);
  const event = getEvent(id);
  if (!event) {
    await ctx.answerCallbackQuery({ text: "That event no longer exists." });
    return;
  }
  if (action === "done") {
    markDone(id);
    await ctx.answerCallbackQuery({ text: "Marked done." });
    await ctx.reply(`✅ Marked "${event.title}" as done.`);
  } else if (action === "del") {
    deleteEvent(id);
    await ctx.answerCallbackQuery({ text: "Deleted." });
    await ctx.reply(`🗑 Deleted "${event.title}".`);
  } else if (action === "edit") {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter("editEvent", id);
  } else {
    await ctx.answerCallbackQuery();
  }
}
