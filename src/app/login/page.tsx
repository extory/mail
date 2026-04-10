"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
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
          <h1 className="text-[18px] font-semibold text-center mb-6">Log in</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                placeholder="••••••••"
                className="w-full border border-[#e5e7eb] rounded-lg px-3 h-[38px] text-[13px] focus:outline-none focus:ring-2 focus:ring-[#155DFC]/20 focus:border-[#155DFC] transition-all placeholder:text-[#9ca3af]"
                required
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
              {loading ? "..." : "Log in"}
            </button>
          </form>
        </div>

        <p className="text-center text-[12px] text-[#9ca3af] mt-4">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-[#155DFC] hover:underline font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
