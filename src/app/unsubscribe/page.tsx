"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function UnsubscribeForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState<"loading" | "confirm" | "done" | "error">("confirm");
  const [email, setEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

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
        setErrorMsg(data.error || "처리하지 못했습니다. 다시 시도해 주세요. / Please try again.");
        setStatus("error");
      }
    } catch {
      setErrorMsg("처리하지 못했습니다. 다시 시도해 주세요. / Please try again.");
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
          {token && status === "confirm" && (
            <>
              <h1 className="text-[20px] font-semibold mb-2">수신거부 / Unsubscribe</h1>
              <p className="text-[14px] text-[#6b7280] mb-6 leading-relaxed">
                수신거부하면 앞으로 이 서비스의 이메일을 받지 않습니다. / Confirm to stop receiving emails from this service.
              </p>
              <button
                onClick={handleUnsubscribe}
                className="w-full bg-[#111827] text-white h-[40px] rounded-lg text-[13px] font-medium hover:bg-[#374151] transition-colors"
              >
                수신거부하기 / Unsubscribe
              </button>
            </>
          )}

          {status === "loading" && (
            <p className="text-[14px] text-[#6b7280]">처리 중 / Processing...</p>
          )}

          {status === "done" && (
            <>
              <div className="w-10 h-10 rounded-full bg-[#00C950]/10 flex items-center justify-center mx-auto mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00C950" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h1 className="text-[20px] font-semibold mb-2">수신거부 완료 / Unsubscribed</h1>
              <p className="text-[14px] text-[#6b7280] leading-relaxed">
                <strong>{email}</strong> 주소가 수신거부 목록에 등록되었습니다. / You will no longer receive emails.
              </p>
            </>
          )}

          {(!token || status === "error") && (
            <>
              <h1 className="text-[20px] font-semibold mb-2">처리할 수 없습니다 / Unable to process</h1>
              <p className="text-[14px] text-[#ef4444]">{errorMsg || "유효하지 않은 수신거부 링크입니다. / Invalid unsubscribe link."}</p>
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
