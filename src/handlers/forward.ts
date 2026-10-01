import { MyContext } from "../types";

export function isForwardedMessage(ctx: MyContext): boolean {
  const msg = ctx.message as any;
  if (!msg) return false;
  return Boolean(msg.forward_origin || msg.forward_date);
}

export async function onForward(ctx: MyContext) {
  await ctx.conversation.enter("addEvent");
}
