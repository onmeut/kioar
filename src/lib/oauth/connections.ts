// Public, read-only "is the user connected?" view for the dashboard UI.

import { listOAuthAccounts, type OAuthProviderId } from "./store";
import { isGoogleOAuthConfigured } from "./google";
import { isZoomOAuthConfigured } from "./zoom";

export type ProviderConnectionStatus = {
  provider: OAuthProviderId;
  connected: boolean;
  email: string | null;
  /** False when the provider has no env credentials configured server-side. */
  available: boolean;
};

export async function getProviderConnections(
  userId: string,
): Promise<ProviderConnectionStatus[]> {
  const rows = await listOAuthAccounts(userId);
  const byProvider = new Map(rows.map((r) => [r.provider, r] as const));

  return [
    {
      provider: "google",
      connected: byProvider.has("google"),
      email: byProvider.get("google")?.accountEmail ?? null,
      available: isGoogleOAuthConfigured(),
    },
    {
      provider: "zoom",
      connected: byProvider.has("zoom"),
      email: byProvider.get("zoom")?.accountEmail ?? null,
      available: isZoomOAuthConfigured(),
    },
  ];
}
