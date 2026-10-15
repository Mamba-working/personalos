import { NextRequest, NextResponse } from "next/server";
import { backendUrl } from "@/lib/backend";
import { isAdminEnabled, isSameOriginMutation } from "@/lib/security.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedGet = /^(snapshot|conversations\/[a-zA-Z0-9_-]+|articles\/[a-zA-Z0-9_-]+|jobs\/[a-zA-Z0-9_-]+)$/;
const allowedPost = /^(captures|group|jobs|fixtures|conversations|conversations\/[a-zA-Z0-9_-]+\/messages|conversations\/[a-zA-Z0-9_-]+\/artifacts\/[a-zA-Z0-9_-]+\/save|jobs\/[a-zA-Z0-9_-]+\/retry|articles\/[a-zA-Z0-9_-]+\/(approve|publish|rollback|revisions))$/;
async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const host = request.headers.get("host") || "";
  if (!isAdminEnabled(host)) return NextResponse.json({error:{code:"LOCAL_STUDIO_DISABLED",message:"管理工作台仅在显式开启的本机演示环境可用"}}, {status:403});
  const { path } = await context.params;
  const target = path.join("/");
  const read = request.method === "GET";
  if (!(read ? allowedGet : allowedPost).test(target)) return NextResponse.json({error:{code:"ROUTE_NOT_ALLOWED",message:"不支持的工作台操作"}}, {status:404});
  if (!read && !isSameOriginMutation(request.headers.get("origin"), host)) return NextResponse.json({error:{code:"ORIGIN_REQUIRED",message:"写入操作需要同源工作台"}}, {status:403});
  const headers: Record<string,string> = {"Authorization":`Bearer ${process.env.CONTENT_API_TOKEN || "personalos-local-demo"}`,"Accept":"application/json"};
  if (!read) headers["Content-Type"] = "application/json";
  if (/\/(approve|publish|rollback)$/.test(target)) headers["X-PersonalOS-Review-Token"] = process.env.CONTENT_REVIEW_TOKEN || "personalos-local-review";
  try {
    const body = read ? undefined : await request.text();
    if (body && body.length > 160000) return NextResponse.json({error:{code:"TOO_LARGE",message:"材料超过演示大小限制"}}, {status:413});
    const response = await fetch(backendUrl(`admin/${target}`), {method:request.method,headers,body,cache:"no-store",signal:AbortSignal.timeout(12000)});
    return new NextResponse(await response.text(), {status:response.status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"}});
  } catch {
    return NextResponse.json({error:{code:"API_UNAVAILABLE",message:"内容 API 暂时不可用，请检查 3001 端口的后端服务"}}, {status:502});
  }
}
export { proxy as GET, proxy as POST };
