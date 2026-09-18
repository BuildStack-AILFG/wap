import type { Metadata } from "next";
import AuthShell from "@/components/auth/AuthShell";
import SignupForm from "@/components/auth/SignupForm";

export const metadata: Metadata = {
  title: "Sign up — LeadForGrow",
  description: "Create your LeadForGrow account and start automating WhatsApp conversations in minutes.",
};

export default function SignupPage() {
  return (
    <AuthShell mode="signup">
      <SignupForm />
    </AuthShell>
  );
}
