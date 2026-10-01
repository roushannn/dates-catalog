import "dotenv/config";
import { bot } from "./bot";

bot.start({
  onStart: (info) => console.log(`Bot @${info.username} is running (long polling).`),
});
