import { InlineKeyboard } from "grammy";
import { Message } from "grammy/types";
import { insertEvent } from "../db";
import { MyConversation, MyConversationContext } from "../types";
import { extractEventDetails } from "../utils/extract";
import { CollectedFields, collectEventFields } from "./fields";

function extractForwardOrigin(msg: Message | undefined): string | null {
  const origin = (msg as any)?.forward_origin;
  if (origin) {
    if (origin.type === "channel") return origin.chat?.title ?? null;
    if (origin.type === "chat") return origin.sender_chat?.title ?? null;
    if (origin.type === "user") {
      const u = origin.sender_user;
      return u ? [u.first_name, u.last_name].filter(Boolean).join(" ") : null;
    }
    if (origin.type === "hidden_user") return origin.sender_user_name ?? null;
  }
  // Fallback for older Bot API fields.
  return (msg as any)?.forward_from_chat?.title ?? (msg as any)?.forward_from?.first_name ?? null;
}

function summaryText(title: string, dateDisplay: string | null, location: string | null, description: string | null): string {
  const parts = [`Title: ${title}`, `Date: ${dateDisplay ?? "not detected"}`, `Location: ${location ?? "not detected"}`];
  if (description) parts.push(`Details: ${description}`);
  return parts.join("\n");
}

/** Pre-fetched source passed in by a handler, e.g. an Instagram post's caption. */
export interface AddEventSource {
  text: string | null;
  chat: string | null;
  url: string | null;
}

async function saveNewEvent(
  ctx: MyConversationContext,
  data: CollectedFields,
  sourceText: string | null,
  sourceChat: string | null,
  sourceUrl: string | null = null
) {
  insertEvent({
    title: data.title,
    event_date: data.dateIso,
    event_date_text: data.dateIso ? null : data.dateDisplay,
    location: data.location,
    description: data.description,
    source_text: sourceText,
    source_chat: sourceChat,
    source_url: sourceUrl,
  });

  const whenSummary = data.dateIso
    ? data.dateDisplay
    : data.dateDisplay
    ? `unclear date ("${data.dateDisplay}") — I saved it as text`
    : "no date set";

  const extra = [];
  if (data.location) extra.push(`📍 ${data.location}`);
  if (data.description) extra.push(`📝 ${data.description}`);

  await ctx.reply(
    `Saved ✅ ${data.title}\n🗓 ${whenSummary}${extra.length ? "\n" + extra.join("\n") : ""}`
  );
}

export async function addEvent(
  conversation: MyConversation,
  ctx: MyConversationContext,
  source?: AddEventSource
) {
  const triggerMsg = ctx.message;
  const sourceText = source ? source.text : triggerMsg?.text ?? triggerMsg?.caption ?? null;
  const sourceChat = source ? source.chat : extractForwardOrigin(triggerMsg);
  const sourceUrl = source?.url ?? null;
  const isForward =
    Boolean(sourceText) &&
    (Boolean(source) || Boolean((triggerMsg as any)?.forward_origin || (triggerMsg as any)?.forward_date));

  if (isForward && sourceText) {
    const preview = sourceText.length > 300 ? sourceText.slice(0, 300) + "…" : sourceText;
    const label = source ? "Got this post" : "Got a forwarded message";
    await ctx.reply(`${label}${sourceChat ? ` from ${sourceChat}` : ""}:\n\n${preview}`);

    const extracted = extractEventDetails(sourceText);
    await ctx.reply(
      `Here's what I picked up:\n\n${summaryText(
        extracted.title,
        extracted.dateDisplay,
        extracted.location,
        extracted.description
      )}\n\nLook right?`,
      {
        reply_markup: new InlineKeyboard()
          .text("✅ Save as-is", "add_confirm_save")
          .row()
          .text("✏️ Edit before saving", "add_confirm_edit"),
      }
    );

    const response = await conversation.waitForCallbackQuery(["add_confirm_save", "add_confirm_edit"]);
    await response.answerCallbackQuery();

    if (response.callbackQuery.data === "add_confirm_save") {
      await saveNewEvent(ctx, extracted, sourceText, sourceChat, sourceUrl);
      return;
    }

    const collected = await collectEventFields(conversation, ctx, extracted);
    if (!collected.title) {
      await ctx.reply("Title can't be empty. Cancelled — send /add or forward the message again to retry.");
      return;
    }
    await saveNewEvent(ctx, collected, sourceText, sourceChat, sourceUrl);
    return;
  }

  if (!sourceUrl) await ctx.reply("Let's add a new event/offer.");
  const collected = await collectEventFields(conversation, ctx, {});
  if (!collected.title) {
    await ctx.reply("Title can't be empty. Cancelled — send /add to try again.");
    return;
  }
  await saveNewEvent(ctx, collected, null, sourceChat, sourceUrl);
}
