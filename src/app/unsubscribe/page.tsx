"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function UnsubscribeForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState<"loading" | "confirm" | "done" | "error">("confirm");
  const [email, setEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) setStatus("error");
  }, [token]);

  const handleUnsubscribe = async () => {
    setStatus("loading");
    try {
      const res = await fetch("/api/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (data.success) {
        setEmail(data.email);
        setStatus("done");
      } else {
        setErrorMsg(data.error || "Something went wrong");
        setStatus("error");
      }
    } catch {
      setErrorMsg("Something went wrong");
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mb-8">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#2B7FFF] to-[#00C950] flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-[#e5e7eb] p-8">
          {status === "confirm" && (
            <>
              <h1 className="text-[20px] font-semibold mb-2">Unsubscribe</h1>
              <p className="text-[14px] text-[#6b7280] mb-6 leading-relaxed">
                Are you sure you want to unsubscribe? You will no longer receive emails from us.
              </p>
              <button
                onClick={handleUnsubscribe}
                className="w-full bg-[#111827] text-white h-[40px] rounded-lg text-[13px] font-medium hover:bg-[#374151] transition-colors"
              >
                Yes, unsubscribe me
              </button>
            </>
          )}

          {status === "loading" && (
            <p className="text-[14px] text-[#6b7280]">Processing...</p>
          )}

          {status === "done" && (
            <>
              <div className="w-10 h-10 rounded-full bg-[#00C950]/10 flex items-center justify-center mx-auto mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00C950" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h1 className="text-[20px] font-semibold mb-2">Unsubscribed</h1>
              <p className="text-[14px] text-[#6b7280] leading-relaxed">
                <strong>{email}</strong> has been unsubscribed. You will no longer receive emails.
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <h1 className="text-[20px] font-semibold mb-2">Oops</h1>
              <p className="text-[14px] text-[#ef4444]">{errorMsg || "Invalid or expired unsubscribe link."}</p>
            </>
          )}
        </div>

        <p className="text-[12px] text-[#9ca3af] mt-6">
          <Link href="/" className="hover:text-[#6b7280] transition-colors">Mail Service</Link>
        </p>
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense>
      <UnsubscribeForm />
    </Suspense>
  );
}
