"use client";

import { CalendarPlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  buildGoogleCalendarUrl,
  buildIcs,
  type CalendarEventInput,
} from "@/lib/events/calendar";

type Props = {
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: string; // ISO
  endsAt?: string | null; // ISO
  timezone: string;
  uid: string;
  url?: string | null;
  className?: string;
};

/**
 * Google / Apple(.ics) add-to-calendar menu. Shown once an attendee is
 * approved/confirmed. The `.ics` is generated client-side and downloaded as a
 * blob (no server round-trip); Google opens the template URL in a new tab.
 */
export function AddToCalendar(props: Props) {
  const input: CalendarEventInput = {
    title: props.title,
    description: props.description,
    location: props.location,
    startsAt: new Date(props.startsAt),
    endsAt: props.endsAt ? new Date(props.endsAt) : null,
    timezone: props.timezone,
    uid: props.uid,
    url: props.url,
  };

  function downloadIcs() {
    const ics = buildIcs(input);
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${props.title.replace(/[^\p{L}\p{N}]+/gu, "-")}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" className={props.className ?? "h-11 w-full"} />
        }
      >
        <CalendarPlusIcon className="size-4" />
        افزودن به تقویم
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-56">
        <DropdownMenuItem
          onClick={() =>
            window.open(
              buildGoogleCalendarUrl(input),
              "_blank",
              "noopener,noreferrer",
            )
          }
        >
          گوگل کلندر
        </DropdownMenuItem>
        <DropdownMenuItem onClick={downloadIcs}>
          اپل / دانلود فایل (ics)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
