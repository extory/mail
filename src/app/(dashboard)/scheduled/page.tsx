"use client";

import { useState, useEffect, useCallback } from "react";
import { useLocale } from "@/components/locale-provider";

interface ScheduledSend {
  id: number;
  subject: string;
  scheduled_at: string;
  status: string;
  send_log_id: number | null;
  error: string | null;
  created_at: string;
  sent_at: string | null;
  group_id: number | null;
  embed_images: number;
}

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  sending: "bg-brand/10 text-brand",
  sent: "bg-success/10 text-success",
  failed: "bg-danger/10 text-danger",
  canceled: "bg-text-muted/10 text-text-muted",
};

export default function ScheduledPage() {
  const { t } = useLocale();
  const [sends, setSends] = useState<ScheduledSend[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>("");

  const fetchSends = useCallback(async () => {
    const res = await fetch("/api/scheduled");
    if (res.ok) setSends(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSends();
    // Poll while pending entries exist so the user sees the status flip.
    const interval = window.setInterval(fetchSends, 15000);
    return () => window.clearInterval(interval);
  }, [fetchSends]);

  const handleCancel = async (id: number) => {
    if (!confirm(t("scheduled.cancel_confirm"))) return;
    const res = await fetch(`/api/scheduled/${id}`, { method: "DELETE" });
    if (res.ok) fetchSends();
  };

  const openPreview = async (id: number) => {
    if (previewId === id) {
      setPreviewId(null);
      setPreviewHtml("");
      return;
    }
    const res = await fetch(`/api/scheduled/${id}`);
    if (res.ok) {
      const data = await res.json();
      setPreviewHtml(data.html_content || "");
      setPreviewId(id);
    }
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-[22px] font-semibold text-text-primary tracking-tight">
        {t("scheduled.title")}
      </h1>
      <p className="text-[14px] text-text-secondary mt-1 mb-6">
        {t("scheduled.description")}
      </p>

      <div className="bg-surface-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border-light bg-surface">
              <th className="text-left px-5 py-3 font-medium text-text-secondary text-[12px]">
                {t("scheduled.when")}
              </th>
              <th className="text-left px-5 py-3 font-medium text-text-secondary text-[12px]">
                {t("scheduled.subject")}
              </th>
              <th className="text-left px-5 py-3 font-medium text-text-secondary text-[12px]">
                {t("scheduled.status")}
              </th>
              <th className="text-right px-5 py-3 font-medium text-text-secondary text-[12px]">
                {t("actions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="text-center py-12 text-text-muted">
                  {t("loading")}
                </td>
              </tr>
            ) : sends.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-12 text-text-muted">
                  {t("scheduled.empty")}
                </td>
              </tr>
            ) : (
              sends.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-border-light last:border-0 hover:bg-surface/50 transition-colors"
                >
                  <td className="px-5 py-3 text-text-primary whitespace-nowrap">
                    {new Date(s.scheduled_at).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-text-primary truncate max-w-[300px]">
                    {s.subject}
                    {s.error && (
                      <p className="text-[11px] text-danger mt-0.5">{s.error}</p>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                        STATUS_BADGE[s.status] || "bg-text-muted/10 text-text-muted"
                      }`}
                    >
                      {t(("scheduled.status." + s.status) as Parameters<typeof t>[0])}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => openPreview(s.id)}
                      className="text-brand hover:text-brand-dark text-[12px] font-medium mr-3 transition-colors"
                    >
                      {previewId === s.id ? t("close") : t("preview")}
                    </button>
                    {s.status === "pending" && (
                      <button
                        onClick={() => handleCancel(s.id)}
                        className="text-danger hover:text-danger/80 text-[12px] font-medium transition-colors"
                      >
                        {t("scheduled.cancel")}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {previewId !== null && previewHtml && (
        <div className="mt-6 bg-surface-card border border-border rounded-xl overflow-hidden">
          <div className="flex justify-between items-center px-5 py-3 border-b border-border-light bg-surface">
            <span className="text-[13px] font-medium text-text-primary">
              {sends.find((s) => s.id === previewId)?.subject}
            </span>
            <button
              onClick={() => {
                setPreviewId(null);
                setPreviewHtml("");
              }}
              className="text-text-muted hover:text-text-primary text-[12px] font-medium transition-colors"
            >
              {t("close")}
            </button>
          </div>
          <iframe
            srcDoc={previewHtml}
            sandbox=""
            className="w-full min-h-[400px] border-0 bg-white"
            title="Scheduled email preview"
          />
        </div>
      )}
    </div>
  );
}
