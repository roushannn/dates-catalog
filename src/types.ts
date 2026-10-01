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
  // SQLite stores booleans as 0/1.
  event_has_time: number;
  location: string | null;
  description: string | null;
  source_text: string | null;
  source_chat: string | null;
  source_url: string | null;
  status: "active" | "done";
  created_at: string;
}
