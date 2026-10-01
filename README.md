# Weekend Events Bot

A personal Telegram bot for tracking events and offers you come across during the week, so you
can pull up a list on date night or the weekend.

- Forward it any message (from a channel, group, or DM) and it will try to auto-detect the
  **title**, **date/deadline**, and **location** from the text, show you what it found, and ask
  you to confirm before saving — or let you edit any of the three first.
- Or add one manually with `/add`, which asks for title/date/location directly.
- `/week` — everything happening this calendar week (Mon–Sun)
- `/weekend` — everything happening this (or the next upcoming) Sat–Sun
- `/list` — everything saved, unfiltered
- `/done <id>` / `/delete <id>` — or just tap the buttons under a list
- `/cancel` — abort whatever prompt you're in the middle of

Dates are parsed loosely ("this Saturday 7pm", "12 Sep", "tomorrow") via `chrono-node`. If the
bot can't make sense of what you typed, it still saves the event with your raw text as the date
so nothing gets lost.

## Local setup

1. Create a bot with [@BotFather](https://t.me/BotFather) and grab the token.
2. `npm install`
3. `cp .env.example .env` and fill in `TELEGRAM_BOT_TOKEN`.
   - `ALLOWED_USER_IDS` is optional but recommended once you deploy publicly — comma-separated
     Telegram numeric user IDs (message [@userinfobot](https://t.me/userinfobot) to get yours).
     Leave it blank while testing locally.
4. `npm run dev` — runs with auto-reload via `tsx`.

The SQLite database is created automatically at `./data/events.db` (or wherever `DB_PATH` points).

## Deploying (Railway)

This repo is set up to run as a **worker** (long polling, no HTTP port needed), which is the
simplest way to run a personal Telegram bot on Railway.

1. Push this repo to GitHub, then create a new Railway project from it (or use `railway up` from
   the Railway CLI).
2. In the Railway service's **Variables** tab, set `TELEGRAM_BOT_TOKEN` (and `ALLOWED_USER_IDS`
   once you know your Telegram user ID — otherwise anyone who finds the bot can use it).
3. SQLite needs a persistent disk, or the database resets on every deploy. In Railway: service →
   **Settings → Volumes** → add a volume mounted at `/data`. Then set the variable
   `DB_PATH=/data/events.db`.
4. Railway will detect `Procfile` and run `npm run build && npm start` as a worker process. No
   public domain/port is required since the bot uses long polling.

## Project layout

```
src/
  index.ts              entry point, starts long polling
  bot.ts                bot instance, middleware, command wiring
  db.ts                 SQLite schema + queries (better-sqlite3)
  types.ts              shared types
  conversations/
    addEvent.ts          extract-and-confirm flow for forwards, prompt flow for /add
  handlers/
    commands.ts          /week, /weekend, /list, /done, /delete, callback buttons
    forward.ts           detects forwarded messages and kicks off addEvent
  utils/
    extract.ts             guesses title/date/location out of a forwarded message's text
    dateParse.ts          free-text date parsing (chrono-node)
    dateRange.ts           "this week" / "this weekend" range math
    format.ts               renders event lists as plain text
```
