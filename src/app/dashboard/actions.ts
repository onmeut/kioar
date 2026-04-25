"use server"

import { redirect } from "next/navigation"

import { signOutCurrentUser } from "@/lib/auth/session"

export async function signOutAction() {
  await signOutCurrentUser()
  redirect("/")
}
