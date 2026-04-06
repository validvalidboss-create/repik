import { AccessToken } from "livekit-server-sdk";

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "";

export function isLivekitConfigured() {
  return !!(LIVEKIT_API_KEY && LIVEKIT_API_SECRET);
}

export async function createLivekitToken(params: {
  room: string;
  identity: string;
  name?: string;
  canPublish?: boolean;
  canSubscribe?: boolean;
}) {
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: params.identity,
    name: params.name,
  });
  at.addGrant({
    roomJoin: true,
    room: params.room,
    canPublish: params.canPublish ?? true,
    canSubscribe: params.canSubscribe ?? true,
  });
  const res = (await at.toJwt()) as unknown as string | Uint8Array;
  if (typeof res === "string") return res;
  // Some versions may return Uint8Array; convert to string
  return Buffer.from(res).toString("utf-8");
}
