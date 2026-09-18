"use client";

import { useState } from "react";
import { Mail, Lock } from "lucide-react";
import FormField from "./FormField";
import { getEmailError, getPasswordError } from "@/lib/validation";

type Touched = { email?: boolean; password?: boolean };

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [touched, setTouched] = useState<Touched>({});
  const [notice, setNotice] = useState<string | null>(null);

  const errors = {
    email: getEmailError(email),
    password: getPasswordError(password),
  };

  const markTouched = (field: keyof Touched) => setTouched((t) => ({ ...t, [field]: true }));

  const handleForgotPassword = () => {
    setNotice("Password reset isn't wired to a backend yet — this is a frontend-only demo.");
    window.setTimeout(() => setNotice(null), 4000);
  };

  return (
    <form onSubmit={(e) => e.preventDefault()} noValidate className="space-y-5">
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
        disabled
        className="flex w-full items-center justify-center rounded-xl bg-emerald-700 px-4 py-3 text-[14.5px] font-semibold text-white opacity-40 transition-opacity disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-emerald-700"
      >
        Log in
      </button>
    </form>
  );
}
