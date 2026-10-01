import { InlineKeyboard } from "grammy";
import { MyConversation, MyConversationContext } from "../types";
import { parseDeadline } from "../utils/dateParse";

const KEEP_DATA = "field_keep";
const CLEAR_DATA = "field_clear";

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

/**
 * Prompts for a field. When a current value exists, offers a "Keep" button so the user
 * isn't required to retype it, and a "Clear" button instead of a magic "skip" keyword.
 * Free-text replies still work as an alternative to tapping a button.
 * Returns null when the field is cleared/left blank.
 */
export async function askField(
  ctx: MyConversationContext,
  conversation: MyConversation,
  question: string,
  opts: { defaultValue?: string | null; allowClear?: boolean } = {}
): Promise<string | null> {
  const { defaultValue, allowClear = true } = opts;

  const keyboard = new InlineKeyboard();
  if (defaultValue) keyboard.text(`✅ Keep: ${truncate(defaultValue, 30)}`, KEEP_DATA).row();
  if (allowClear) keyboard.text("🗑 Clear / not applicable", CLEAR_DATA).row();
  const hasButtons = keyboard.inline_keyboard.length > 0;

  const hint = defaultValue
    ? `\nCurrent guess: "${defaultValue}"\nTap a button, or type a new value.`
    : allowClear
    ? "\nType a value, or tap Clear if this doesn't apply."
    : "";

  await ctx.reply(`${question}${hint}`, hasButtons ? { reply_markup: keyboard } : undefined);

  const update = hasButtons
    ? await conversation.waitFor(["message:text", "callback_query:data"])
    : await conversation.waitFor("message:text");

  if (update.callbackQuery?.data) {
    await update.answerCallbackQuery();
    if (update.callbackQuery.data === CLEAR_DATA) return null;
    return defaultValue ?? null;
  }

  const text = (update.message?.text ?? "").trim();
  if (/^skip$/i.test(text)) return null;
  if (/^keep$/i.test(text) && defaultValue) return defaultValue;
  return text || null;
}

// Title is required, so it never gets a "Clear" button — but can still offer "Keep".
export async function askTitle(
  ctx: MyConversationContext,
  conversation: MyConversation,
  question: string,
  defaultValue?: string | null
): Promise<string> {
  const value = await askField(ctx, conversation, question, { defaultValue, allowClear: false });
  return value ?? "";
}

export interface FieldDefaults {
  title?: string | null;
  dateIso?: string | null;
  dateDisplay?: string | null;
  location?: string | null;
  description?: string | null;
}

export interface CollectedFields {
  title: string;
  dateIso: string | null;
  dateDisplay: string | null;
  location: string | null;
  description: string | null;
}

// Runs the title/date/location/description prompts, pre-filled with whatever defaults are
// passed in (extracted guesses for a new event, or current values when editing one).
export async function collectEventFields(
  conversation: MyConversation,
  ctx: MyConversationContext,
  defaults: FieldDefaults
): Promise<CollectedFields> {
  const title = await askTitle(ctx, conversation, "What's the title?", defaults.title);

  const dateAnswer = await askField(ctx, conversation, "When is it / what's the deadline?", {
    defaultValue: defaults.dateDisplay,
  });
  let dateIso: string | null = null;
  let dateDisplay: string | null = null;
  if (dateAnswer) {
    if (defaults.dateDisplay && dateAnswer === defaults.dateDisplay) {
      dateIso = defaults.dateIso ?? null;
      dateDisplay = defaults.dateDisplay;
    } else {
      const parsed = parseDeadline(dateAnswer);
      dateIso = parsed.iso;
      dateDisplay = parsed.iso ? parsed.display : parsed.display || null;
    }
  }

  const location = await askField(ctx, conversation, "Where is it?", { defaultValue: defaults.location });

  const description = await askField(ctx, conversation, "Any other details to note down?", {
    defaultValue: defaults.description,
  });

  return { title, dateIso, dateDisplay, location, description };
}
