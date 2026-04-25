// Skyroom doesn't use OAuth — each studio account has a single API key.
// See https://www.skyroom.online/contents/api-document . The same JSON-RPC
// endpoint serves all actions; we expose just what the booking flow needs.

const ENDPOINT = "https://www.skyroom.online/skyroom/api";

type RpcResponse<T> = {
  ok?: boolean;
  result?: T;
  error_code?: number;
  error_message?: string;
};

async function rpc<T>(
  apiKey: string,
  action: string,
  params: Record<string, unknown>,
): Promise<T> {
  const url = `${ENDPOINT}/${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, params }),
  });
  if (!res.ok) {
    throw new Error(`Skyroom HTTP ${res.status}`);
  }
  const json = (await res.json()) as RpcResponse<T>;
  if (json.ok === false || json.error_code) {
    throw new Error(
      `Skyroom error: ${json.error_message ?? "نامشخص"} (${json.error_code ?? 0})`,
    );
  }
  return json.result as T;
}

export type SkyroomCreateRoomInput = {
  apiKey: string;
  name: string; // unique slug-ish identifier
  title: string; // human-readable
  /** Maximum concurrent users in the room. */
  capacity?: number;
  /** Comma-separated list of guest emails to whitelist (optional). */
  guests?: string[];
};

export type SkyroomRoomResult = {
  id: number;
  joinUrl: string; // direct join link with embedded token
  ownerUrl: string;
};

/**
 * Create a private Skyroom room and a single-use guest token. We return the
 * tokenized join URL — that's what gets embedded in the booking confirmation
 * email so the guest can join without an account.
 */
export async function createSkyroomRoomForBooking(
  input: SkyroomCreateRoomInput,
): Promise<SkyroomRoomResult> {
  const room = await rpc<{ id: number }>(input.apiKey, "createRoom", {
    name: input.name,
    title: input.title,
    max_users: input.capacity ?? 4,
    is_public: 0,
  });
  // Generate a guest token (returns a relative URL on success).
  const tokenRes = await rpc<{ url: string }>(input.apiKey, "createLoginUrl", {
    room_id: room.id,
    nickname: input.title,
    access: 1, // viewer; bump to 2 for presenter
    ttl: 60 * 60 * 24, // 24h validity from creation
    language: "fa",
  });

  const base = tokenRes.url.startsWith("http")
    ? tokenRes.url
    : `https://www.skyroom.online${tokenRes.url}`;

  return {
    id: room.id,
    joinUrl: base,
    ownerUrl: `https://www.skyroom.online/ch/${input.name}`,
  };
}

export async function deleteSkyroomRoom(apiKey: string, roomId: number) {
  await rpc<unknown>(apiKey, "removeRoom", { id: roomId });
}
