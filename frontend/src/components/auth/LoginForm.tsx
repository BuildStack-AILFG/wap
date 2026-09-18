"use client";

import { useState, type FormEvent } from "react";
import { Mail, Lock, Check } from "lucide-react";
import FormField from "./FormField";
import { getEmailError, getPasswordError } from "@/lib/validation";

type Touched = { email?: boolean; password?: boolean };

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [touched, setTouched] = useState<Touched>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [notice, setNotice] = useState<string | null>(null);

  const errors = {
    email: getEmailError(email),
    password: getPasswordError(password),
  };
  const isValid = !errors.email && !errors.password;

  const markTouched = (field: keyof Touched) => setTouched((t) => ({ ...t, [field]: true }));

  const handleForgotPassword = () => {
    setNotice("Password reset isn't wired to a backend yet — this is a frontend-only demo.");
    window.setTimeout(() => setNotice(null), 4000);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!isValid) return;
    setStatus("submitting");
    window.setTimeout(() => setStatus("success"), 1000);
  };

  if (status === "success") {
    return (
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white">
          <Check className="h-6 w-6" />
        </div>
        <h2 className="text-[17px] font-semibold text-[#111827]">Welcome back!</h2>
        <p className="mt-1.5 text-[13.5px] text-[#4B5563]">
          You&apos;re signed in as <span className="font-medium text-[#111827]">{email}</span>. This demo is
          frontend-only — connect a backend to enable real authentication.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-[#111827] sm:text-[28px]">
          Welcome to <span className="text-emerald-700">LeadForGrow</span>
        </h1>
        <p className="mt-2 text-[14px] text-[#6B7280]">
          Automate WhatsApp conversations, broadcasts, and your team inbox — all in one place.
        </p>
      </div>

      <FormField
        id="email"
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        onBlur={() => markTouched("email")}
        error={errors.email}
        touched={touched.email}
        placeholder="you@company.com"
        autoComplete="email"
        icon={<Mail className="h-4 w-4" />}
      />

      <FormField
        id="password"
        label="Password"
        value={password}
        onChange={setPassword}
        onBlur={() => markTouched("password")}
        error={errors.password}
        touched={touched.password}
        placeholder="Enter your password"
        autoComplete="current-password"
        icon={<Lock className="h-4 w-4" />}
        showPasswordToggle
        rightSlot={
          <button
            type="button"
            onClick={handleForgotPassword}
            className="text-[12.5px] font-medium text-emerald-700 hover:text-emerald-800"
          >
            Forgot password?
          </button>
        }
      />

      {notice && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-700">{notice}</p>
      )}

      <label className="flex items-center gap-2 text-[13.5px] text-[#4B5563]">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="h-4 w-4 rounded border-[#D1D5DB] text-emerald-700 focus:ring-emerald-600"
        />
        Keep me logged in
      </label>

      <button
        type="submit"
        disabled={!isValid || status === "submitting"}
        className="flex w-full items-center justify-center rounded-xl bg-emerald-700 px-4 py-3 text-[14.5px] font-semibold text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-[#D1D5DB] disabled:text-[#9CA3AF]"
      >
        {status === "submitting" ? "Logging in..." : "Log in"}
      </button>
    </form>
  );
}
