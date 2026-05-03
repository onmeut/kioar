"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { idleState } from "@/lib/action-state";

import { toggleDiscountCodeAction } from "./actions";

type Props = {
  id: string;
  isActive: boolean;
};

export function ToggleDiscountButton({ id, isActive }: Props) {
  const [, action, isPending] = useActionState(
    toggleDiscountCodeAction,
    idleState,
  );

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        size="sm"
        variant={isActive ? "outline" : "default"}
        disabled={isPending}
      >
        {isActive ? "غیرفعال" : "فعال"}
      </Button>
    </form>
  );
}
