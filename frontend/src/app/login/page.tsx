import type { Metadata } from "next";
import AuthShell from "@/components/auth/AuthShell";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = {
  title: "Log in — LeadForGrow",
  description: "Log in to your LeadForGrow account to manage WhatsApp automation, broadcasts, and your team inbox.",
};

export default function LoginPage() {
  return (
    <AuthShell mode="login">
      <LoginForm />
    </AuthShell>
  );
}
