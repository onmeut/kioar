import type { Route } from "next";
import { redirect } from "next/navigation";

import { FormsSubmissionsClient } from "@/components/dashboard/forms-submissions-client";
import { deleteSubmissionAction } from "@/app/dashboard/forms/actions";
import { requireCompletedProfile } from "@/lib/auth/session";
import { getFormBlocksByUserId, getSubmissions } from "@/lib/form-service";

export const dynamic = "force-dynamic";

export default async function FormsSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ blockId?: string }>;
}) {
  const viewer = await requireCompletedProfile();
  const blocks = await getFormBlocksByUserId(viewer.user.id);

  if (blocks.length === 0) {
    return (
      <div className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-md text-center">
          <h1 className="text-xl font-bold">هنوز فرمی نساخته‌اید</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            از صفحه‌ی لینک‌ها یک فرم بسازید تا ارسال‌ها اینجا نمایش داده شوند.
          </p>
          <a
            href="/dashboard/links"
            className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground"
          >
            رفتن به لینک‌ها
          </a>
        </div>
      </div>
    );
  }

  const sp = await searchParams;
  const selectedId =
    sp.blockId && blocks.some((b) => b.id === sp.blockId)
      ? sp.blockId
      : blocks[0].id;

  const submissions = await getSubmissions(viewer.user.id, selectedId, {
    limit: 200,
  });

  if (!submissions) redirect("/dashboard/forms" as Route);

  const selectedBlock = blocks.find((b) => b.id === selectedId)!;

  return (
    <FormsSubmissionsClient
      blocks={blocks.map((b) => ({
        id: b.id,
        name: b.name,
        fields: b.fields.map((f) => ({
          id: f.id,
          kind: f.kind,
          label: f.label,
        })),
      }))}
      selectedBlockId={selectedId}
      selectedBlock={{
        id: selectedBlock.id,
        name: selectedBlock.name,
        fields: selectedBlock.fields.map((f) => ({
          id: f.id,
          kind: f.kind,
          label: f.label,
        })),
      }}
      submissions={submissions.rows.map((r) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        data: r.data as Record<string, string | string[]>,
      }))}
      total={submissions.total}
      deleteSubmissionAction={deleteSubmissionAction}
    />
  );
}
