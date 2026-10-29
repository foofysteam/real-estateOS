"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authenticate, issueSession } from "@/lib/auth/authenticate";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";
import type { LoginState } from "./login-state";

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const rawEmail = formData.get("email");
  const email = typeof rawEmail === "string" ? rawEmail : "";

  const user = await authenticate(email, formData.get("password"));
  if (!user) return { error: "Invalid credentials", email };

  const { token, exp } = issueSession(user.id);
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(exp));
  redirect("/today");
}
