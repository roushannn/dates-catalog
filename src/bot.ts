import { conversations, createConversation } from "@grammyjs/conversations";
import { Bot } from "grammy";
import { addEvent } from "./conversations/addEvent";
import { editEvent } from "./conversations/editEvent";
import { isForwardedMessage, onForward } from "./handlers/forward";
import { getInstagramUrl, onInstagramLink } from "./handlers/instagram";
import {
  cmdAdd,
  cmdCancel,
  cmdDelete,
  cmdDone,
  cmdEdit,
  cmdList,
  cmdStart,
  cmdWeek,
  cmdWeekend,
  onCallbackQuery,
} from "./handlers/commands";
import { MyContext } from "./types";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN is not set. Copy .env.example to .env and fill it in.");
}

const allowedIds = (process.env.ALLOWED_USER_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map(Number);

export const bot = new Bot<MyContext>(token);

if (allowedIds.length > 0) {
  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId || !allowedIds.includes(userId)) {
      await ctx.reply("This bot is private.");
      return;
    }
    await next();
  });
}

bot.use(conversations());
bot.use(createConversation(addEvent, "addEvent"));
bot.use(createConversation(editEvent, "editEvent"));

bot.command("start", cmdStart);
bot.command("help", cmdStart);
bot.command("add", cmdAdd);
bot.command("cancel", cmdCancel);
bot.command("week", cmdWeek);
bot.command("weekend", cmdWeekend);
bot.command("list", cmdList);
bot.command("edit", cmdEdit);
bot.command("done", cmdDone);
bot.command("delete", cmdDelete);

bot.on("callback_query:data", onCallbackQuery);

// Forwarded messages and Instagram links (outside of an active conversation) kick off the
// add flow automatically. A forward's own text beats a link inside it, so forwards go first.
bot.on("message", async (ctx) => {
  if (isForwardedMessage(ctx)) {
    await onForward(ctx);
    return;
  }
  const instagramUrl = getInstagramUrl(ctx);
  if (instagramUrl) {
    await onInstagramLink(ctx, instagramUrl);
    return;
  }
  await ctx.reply(
    "Forward me something or share an Instagram post to log it, or use /add. " +
      "Send /help for the full list of commands."
  );
});

bot.catch((err) => {
  console.error("Bot error:", err.error);
});
