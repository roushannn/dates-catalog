import { Conversation, ConversationFlavor } from "@grammyjs/conversations";
import { Context } from "grammy";

export type MyContext = ConversationFlavor<Context>;
export type MyConversationContext = Context;
export type MyConversation = Conversation<MyContext, MyConversationContext>;

export interface EventRecord {
  id: number;
  title: string;
  event_date: string | null;
  event_date_text: string | null;
  location: string | null;
  description: string | null;
  source_text: string | null;
  source_chat: string | null;
  status: "active" | "done";
  created_at: string;
}
