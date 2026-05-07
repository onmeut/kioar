"use client";

import { PencilIcon } from "lucide-react";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";

/** Broadcasts a custom event that `links-page-client` listens for. */
export function PageSettingsHeaderButton() {
  const pathname = usePathname() || "";
  if (!/^\/me(\/|$)/.test(pathname)) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-9 gap-1.5"
      onClick={() =>
        window.dispatchEvent(new CustomEvent("open-page-settings"))
      }
    >
      <PencilIcon className="size-4" />
      ویرایش
    </Button>
  );
}
