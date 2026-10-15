import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { isAdminEnabled } from "@/lib/security.mjs";
import ChatStudio from "@/components/ChatStudio";
export const dynamic="force-dynamic";
export default async function ChatPage({searchParams}:{searchParams:Promise<{conversation?:string}>}){
  if(!isAdminEnabled((await headers()).get("host")||""))notFound();
  return <ChatStudio initialConversationId={(await searchParams).conversation}/>;
}
