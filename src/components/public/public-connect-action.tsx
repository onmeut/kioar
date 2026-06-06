"use client";

import { CheckIcon, UserPlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type State = "unconnected" | "connected";

export function PublicConnectAction({
  slug,
  initialState,
  connectAction,
  disconnectAction,
}: {
  slug: string;
  initialState: State;
  connectAction: (formData: FormData) => Promise<{ redirect: string } | undefined>;
  disconnectAction: (formData: FormData) => Promise<void>;
}) {
  // Optimistic local state. We flip to "connected" immediately on tap so
  // the button doesn't blink through the connect server action's
  // round-trip; the server `revalidatePath` keeps the truth in sync on
  // the next render.
  const router = useRouter();
  const [state, setState] = useState<State>(initialState);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleConnect() {
    setState("connected");
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("slug", slug);
        const result = await connectAction(fd);
        if (result?.redirect) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          router.push(result.redirect as any);
          return;
        }
      } catch {
        setState("unconnected");
        toast.error("افزودن ممکن نشد. لطفاً دوباره تلاش کنید.");
      }
    });
  }

  function handleDisconnect() {
    setConfirmOpen(false);
    setState("unconnected");
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("slug", slug);
        await disconnectAction(fd);
        toast.success("از دایره‌ی شما حذف شد.");
      } catch {
        setState("connected");
        toast.error("حذف ممکن نشد. لطفاً دوباره تلاش کنید.");
      }
    });
  }

  const base =
    "flex flex-col gap-1 items-center justify-center py-3.5 px-2 rounded-2xl text-foreground transition-colors";

  if (state === "connected") {
    return (
      <>
        <button
          type="button"
          aria-label="در دایره شما — حذف از دایره"
          disabled={pending}
          onClick={() => setConfirmOpen(true)}
          className={cn(
            base,
            "bg-primary/12 hover:bg-primary/16 active:bg-primary/20",
          )}
        >
          <CheckIcon className="size-5 text-primary" />
          <span className="text-[11px] font-semibold text-primary">
            در دایره شما
          </span>
        </button>

        <AlertDialog
          open={confirmOpen}
          onOpenChange={(o) => {
            if (!o) setConfirmOpen(false);
          }}
        >
          <AlertDialogContent size="sm">
            <AlertDialogHeader>
              <AlertDialogTitle>حذف از دایره</AlertDialogTitle>
              <AlertDialogDescription>
                این اتصال برای هر دو طرف برداشته می‌شود.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>انصراف</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={pending}
                onClick={(e) => {
                  e.preventDefault();
                  handleDisconnect();
                }}
              >
                حذف از دایره
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return (
    <button
      type="button"
      aria-label="افزودن"
      disabled={pending}
      onClick={handleConnect}
      className={cn(base, "bg-foreground/5 hover:bg-foreground/9 active:bg-foreground/13")}
    >
      <UserPlusIcon className="size-5" />
      <span className="text-[11px] font-semibold">افزودن</span>
    </button>
  );
}
