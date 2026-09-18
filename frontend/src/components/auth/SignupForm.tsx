"use client";

import { useState, type FormEvent } from "react";
import { User, Mail, Lock, Check } from "lucide-react";
import FormField from "./FormField";
import {
  getNameError,
  getEmailError,
  getSignupPasswordError,
  getConfirmPasswordError,
  getPasswordStrength,
} from "@/lib/validation";

type Touched = { name?: boolean; email?: boolean; password?: boolean; confirm?: boolean; agreed?: boolean };

const strengthLabels = ["Weak", "Weak", "Fair", "Good", "Strong"];
const strengthColors = ["bg-red-400", "bg-red-400", "bg-amber-400", "bg-emerald-400", "bg-emerald-600"];

export default function SignupForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [touched, setTouched] = useState<Touched>({});
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");

  const errors = {
    name: getNameError(name),
    email: getEmailError(email),
    password: getSignupPasswordError(password),
    confirm: getConfirmPasswordError(password, confirm),
    agreed: agreed ? undefined : "You must accept the Terms to continue",
  };
  const isValid = !errors.name && !errors.email && !errors.password && !errors.confirm && !errors.agreed;
  const strength = getPasswordStrength(password);

  const markTouched = (field: keyof Touched) => setTouched((t) => ({ ...t, [field]: true }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, email: true, password: true, confirm: true, agreed: true });
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
        <h2 className="text-[17px] font-semibold text-[#111827]">Account created</h2>
        <p className="mt-1.5 text-[13.5px] text-[#4B5563]">
          Welcome, {name.split(" ")[0]}! This demo is frontend-only — connect a backend to enable real accounts.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-[#111827] sm:text-[28px]">
          Create your <span className="text-emerald-700">LeadForGrow</span> account
        </h1>
        <p className="mt-2 text-[14px] text-[#6B7280]">
          Start automating WhatsApp conversations in minutes. No credit card required.
        </p>
      </div>

      <FormField
        id="name"
        label="Full name"
        value={name}
        onChange={setName}
        onBlur={() => markTouched("name")}
        error={errors.name}
        touched={touched.name}
        placeholder="Jane Cooper"
        autoComplete="name"
        icon={<User className="h-4 w-4" />}
      />

      <FormField
        id="email"
        label="Work email"
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

      <div>
        <FormField
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          onBlur={() => markTouched("password")}
          error={errors.password}
          touched={touched.password}
          placeholder="Create a password"
          autoComplete="new-password"
          icon={<Lock className="h-4 w-4" />}
          showPasswordToggle
        />
        {password.length > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex flex-1 gap-1">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${i < strength ? strengthColors[strength] : "bg-[#E5E7EB]"}`}
                />
              ))}
            </div>
            <span className="text-[11.5px] font-medium text-[#6B7280]">{strengthLabels[strength]}</span>
          </div>
        )}
      </div>

      <FormField
        id="confirm"
        label="Confirm password"
        value={confirm}
        onChange={setConfirm}
        onBlur={() => markTouched("confirm")}
        error={errors.confirm}
        touched={touched.confirm}
        placeholder="Re-enter your password"
        autoComplete="new-password"
        icon={<Lock className="h-4 w-4" />}
        showPasswordToggle
      />

      <div>
        <label className="flex items-start gap-2.5 text-[13.5px] text-[#4B5563]">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => {
              setAgreed(e.target.checked);
              markTouched("agreed");
            }}
            className="mt-0.5 h-4 w-4 rounded border-[#D1D5DB] text-emerald-700 focus:ring-emerald-600"
          />
          <span>
            I agree to the{" "}
            <a href="#" className="font-medium text-emerald-700 hover:text-emerald-800">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="#" className="font-medium text-emerald-700 hover:text-emerald-800">
              Privacy Policy
            </a>
          </span>
        </label>
        {touched.agreed && errors.agreed && <p className="mt-1.5 text-[12.5px] text-red-600">{errors.agreed}</p>}
      </div>

      <button
        type="submit"
        disabled={!isValid || status === "submitting"}
        className="flex w-full items-center justify-center rounded-xl bg-emerald-700 px-4 py-3 text-[14.5px] font-semibold text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-[#D1D5DB] disabled:text-[#9CA3AF]"
      >
        {status === "submitting" ? "Creating account..." : "Register"}
      </button>
    </form>
  );
}
