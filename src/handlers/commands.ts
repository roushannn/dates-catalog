import { InlineKeyboard } from "grammy";
import { deleteEvent, getActiveEvents, getEvent, getEventsInRange, markDone } from "../db";
import { MyContext } from "../types";
import { currentWeekRange, upcomingWeekendRange } from "../utils/dateRange";
import { formatEventList } from "../utils/format";

// Shown in Telegram's command menu (the "/" popup and the Menu button).
export const COMMAND_MENU = [
  { command: "add", description: "Add an event or offer manually" },
  { command: "week", description: "Everything happening this week" },
  { command: "weekend", description: "Everything happening this (or next) weekend" },
  { command: "list", description: "All upcoming events, unfiltered" },
  { command: "edit", description: "Edit an event: /edit <id>" },
  { command: "done", description: "Mark an event done: /done <id>" },
  { command: "delete", description: "Delete an event: /delete <id>" },
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
      "• /list — all upcoming, unfiltered\n" +
      "• /edit <id> — change a saved event's details\n" +
      "• /done <id> and /delete <id> also work as commands\n" +
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

export async function cmdWeek(ctx: MyContext) {
  const [start, end] = currentWeekRange();
  const events = getEventsInRange(start, end);
  await ctx.reply(formatEventList(events, "Nothing on the calendar for this week yet."));
  await sendButtonsFor(ctx, events);
}

export async function cmdWeekend(ctx: MyContext) {
  const [start, end] = upcomingWeekendRange();
  const events = getEventsInRange(start, end);
  await ctx.reply(formatEventList(events, "Nothing lined up for the weekend yet."));
  await sendButtonsFor(ctx, events);
}

export async function cmdList(ctx: MyContext) {
  const events = getActiveEvents();
  await ctx.reply(formatEventList(events, "No saved events/offers yet. Forward me something or use /add."));
  await sendButtonsFor(ctx, events);
}

async function sendButtonsFor(ctx: MyContext, events: { id: number; title: string }[]) {
  if (events.length === 0) return;
  const keyboard = new InlineKeyboard();
  for (const e of events) {
    keyboard
      .text(`✏️ #${e.id}`, `edit:${e.id}`)
      .text(`✅ #${e.id} done`, `done:${e.id}`)
      .text(`🗑 #${e.id}`, `del:${e.id}`)
      .row();
  }
  await ctx.reply("Edit, mark done, or delete:", { reply_markup: keyboard });
}

export async function cmdEdit(ctx: MyContext) {
  const id = parseIdArg(ctx);
  if (id === null) {
    await ctx.reply("Usage: /edit <id> (see the # next to each event from /list)");
    return;
  }
  if (!getEvent(id)) {
    await ctx.reply(`Couldn't find event #${id}.`);
    return;
  }
  await ctx.conversation.enter("editEvent", id);
}

export async function cmdDone(ctx: MyContext) {
  const id = parseIdArg(ctx);
  if (id === null) {
    await ctx.reply("Usage: /done <id> (see the # next to each event from /list)");
    return;
  }
  const ok = markDone(id);
  await ctx.reply(ok ? `Marked #${id} as done.` : `Couldn't find event #${id}.`);
}

export async function cmdDelete(ctx: MyContext) {
  const id = parseIdArg(ctx);
  if (id === null) {
    await ctx.reply("Usage: /delete <id> (see the # next to each event from /list)");
    return;
  }
  const ok = deleteEvent(id);
  await ctx.reply(ok ? `Deleted #${id}.` : `Couldn't find event #${id}.`);
}

function parseIdArg(ctx: MyContext): number | null {
  const arg = ctx.match?.toString().trim();
  const id = Number(arg);
  return arg && Number.isInteger(id) && id > 0 ? id : null;
}

export async function onCallbackQuery(ctx: MyContext) {
  const data = ctx.callbackQuery?.data;
  if (!data) return;
  const [action, idStr] = data.split(":");
  const id = Number(idStr);
  const event = getEvent(id);
  if (!event) {
    await ctx.answerCallbackQuery({ text: `Event #${id} not found.` });
    return;
  }
  if (action === "done") {
    markDone(id);
    await ctx.answerCallbackQuery({ text: `Marked #${id} done.` });
    await ctx.reply(`✅ Marked "${event.title}" as done.`);
  } else if (action === "del") {
    deleteEvent(id);
    await ctx.answerCallbackQuery({ text: `Deleted #${id}.` });
    await ctx.reply(`🗑 Deleted "${event.title}".`);
  } else if (action === "edit") {
    await ctx.answerCallbackQuery();
    await ctx.conversation.enter("editEvent", id);
  } else {
    await ctx.answerCallbackQuery();
  }
}
