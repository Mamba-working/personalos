import { headers } from "next/headers";
import { isAdminEnabled } from "@/lib/security.mjs";
import Studio from "@/components/Studio";
import PublicLibrary from "@/components/PublicLibrary";
export const dynamic = "force-dynamic";
export default async function Home({searchParams}:{searchParams:Promise<{article?:string}>}) {
  const host = (await headers()).get("host") || "";
  const {article}=await searchParams;
  return isAdminEnabled(host) ? <Studio initialArticleId={article} /> : <PublicLibrary />;
}
