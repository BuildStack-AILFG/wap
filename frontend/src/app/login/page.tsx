import type { Metadata } from "next";
import AuthShell from "@/components/auth/AuthShell";
import LoginForm from "@/components/auth/LoginForm";
import RedirectIfSignedIn from "@/components/auth/RedirectIfSignedIn";

export const metadata: Metadata = {
  title: "Log in — TalkForGrow",
  description: "Log in to your TalkForGrow account to manage WhatsApp automation, broadcasts, and your team inbox.",
};

export default function LoginPage() {
  return (
    <AuthShell mode="login">
      <RedirectIfSignedIn />
      <LoginForm />
    </AuthShell>
  );
}
