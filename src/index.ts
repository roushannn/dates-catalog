import "dotenv/config";
import { bot } from "./bot";
import { COMMAND_MENU } from "./handlers/commands";

// Registers the "/" command menu in Telegram. Failure here shouldn't stop the bot.
bot.api.setMyCommands(COMMAND_MENU).catch((err) => console.error("setMyCommands failed:", err));

bot.start({
  onStart: (info) => console.log(`Bot @${info.username} is running (long polling).`),
});
