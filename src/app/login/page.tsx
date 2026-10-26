import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { login } from "./actions";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · Sales OS" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/today");
  return <LoginForm action={login} />;
}
