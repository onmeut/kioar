export type FieldErrors = Record<string, string[] | undefined>

export type ActionState = {
  status: "idle" | "success" | "error"
  message?: string
  fieldErrors?: FieldErrors
  cooldownUntil?: number
  values?: Record<string, string>
}

export const idleState: ActionState = {
  status: "idle",
}
