"use client"

import { Loader2Icon } from "lucide-react"
import { useFormStatus } from "react-dom"

import { Button } from "@/components/ui/button"

type SubmitButtonProps = React.ComponentProps<typeof Button> & {
  pendingLabel?: string
}

export function SubmitButton({
  children,
  pendingLabel = "در حال پردازش...",
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <Button {...props} disabled={pending || props.disabled}>
      {pending ? (
        <>
          <Loader2Icon className="size-4 animate-spin" />
          <span>{pendingLabel}</span>
        </>
      ) : (
        children
      )}
    </Button>
  )
}
