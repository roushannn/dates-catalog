import { AddEventSource } from "../conversations/addEvent";
import { MyContext } from "../types";
import { fetchInstagramPost, findInstagramUrl } from "../utils/instagram";

export function getInstagramUrl(ctx: MyContext): string | null {
  const text = ctx.message?.text ?? ctx.message?.caption;
  return text ? findInstagramUrl(text) : null;
}

export async function onInstagramLink(ctx: MyContext, url: string) {
  await ctx.replyWithChatAction("typing");
  const post = await fetchInstagramPost(url);

  // The fetch happens out here rather than inside the conversation, since conversations
  // replay their code on every update and would re-fetch the post each time.
  const source: AddEventSource = post
    ? { text: post.caption, chat: post.author ? `Instagram @${post.author}` : "Instagram", url }
    : { text: null, chat: "Instagram", url };

  if (!post) {
    await ctx.reply(
      "I couldn't read that post's caption (it may be private, or Instagram blocked me). " +
        "Let's fill in the details by hand — I'll keep the link with the event."
    );
  }
  await ctx.conversation.enter("addEvent", source);
}
