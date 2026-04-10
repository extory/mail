"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState(searchParams.get("code") || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [firstUser, setFirstUser] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((d) => setFirstUser(d.firstUser));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          inviteCode: firstUser ? undefined : inviteCode,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (firstUser === null) return null;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2B7FFF] to-[#00C950] flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </div>
            <span className="text-[16px] font-semibold tracking-tight text-[#111827]">Mail Service</span>
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-[#e5e7eb] p-6">
          <h1 className="text-[18px] font-semibold text-center mb-1">
            {firstUser ? "Create Admin Account" : "Create account"}
          </h1>
          <p className="text-[12px] text-[#9ca3af] text-center mb-6">
            {firstUser
              ? "First user becomes the administrator"
              : "Invitation required"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!firstUser && (
              <div>
                <label className="block text-[12px] font-medium text-[#6b7280] mb-1.5">Invitation Code</label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Paste your invitation code"
                  className="w-full border border-[#e5e7eb] rounded-lg px-3 h-[38px] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#155DFC]/20 focus:border-[#155DFC] transition-all placeholder:text-[#9ca3af] font-mono"
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-[12px] font-medium text-[#6b7280] mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border border-[#e5e7eb] rounded-lg px-3 h-[38px] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#155DFC]/20 focus:border-[#155DFC] transition-all placeholder:text-[#9ca3af]"
                required
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-[#6b7280] mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6 characters minimum"
                className="w-full border border-[#e5e7eb] rounded-lg px-3 h-[38px] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#155DFC]/20 focus:border-[#155DFC] transition-all placeholder:text-[#9ca3af]"
                required
                minLength={8}
              />
            </div>

            {error && (
              <p className="text-[12px] text-[#ef4444] font-medium">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#155DFC] text-white h-[38px] rounded-lg text-[13px] font-medium hover:bg-[#0f4ad4] disabled:opacity-50 transition-colors"
            >
              {loading ? "..." : firstUser ? "Create Admin Account" : "Create account"}
            </button>
          </form>
        </div>

        <p className="text-center text-[12px] text-[#9ca3af] mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-[#155DFC] hover:underline font-medium">Log in</Link>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
