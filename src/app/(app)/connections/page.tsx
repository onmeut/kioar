import { NetworkListClient } from "@/components/dashboard/network-list-client";
import { removeFromNetworkAction } from "@/app/(app)/connections/actions";
import { requireCompletedProfile } from "@/lib/auth/session";
import { listConnectionsForPage } from "@/lib/connections";

export const dynamic = "force-dynamic";

export default async function NetworkPage() {
  const viewer = await requireCompletedProfile();

  const connections = await listConnectionsForPage(viewer.profile.id);

  return (
    <NetworkListClient
      items={connections.map((c) => ({
        pageId: c.pageId,
        slug: c.slug,
        fullName: c.fullName,
        avatarUrl: c.avatarUrl,
        avatarSeed: c.avatarSeed,
        connectedAt: c.connectedAt.toISOString(),
      }))}
      removeAction={removeFromNetworkAction}
    />
  );
}
