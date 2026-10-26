import { after } from "next/server";
import { getEnv } from "@/lib/env";
import { handleMetaWebhook } from "@/lib/meta/webhook";

/** Meta's subscription handshake: echo hub.challenge when the verify token matches. */
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const expected = getEnv().META_WEBHOOK_VERIFY_TOKEN;
  if (!expected || params.get("hub.mode") !== "subscribe" || params.get("hub.verify_token") !== expected) {
    return new Response(null, { status: 403 });
  }
  return new Response(params.get("hub.challenge") ?? "", { status: 200, headers: { "content-type": "text/plain" } });
}

export async function POST(req: Request) {
  const { status } = await handleMetaWebhook(await req.text(), req.headers.get("x-hub-signature-256"), {
    schedule: (fn) => after(fn),
  });
  return new Response(null, { status });
}
