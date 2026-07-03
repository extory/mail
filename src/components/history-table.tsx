"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { SendLog } from "@/lib/types";
import { useLocale } from "./locale-provider";
import { Pagination, paginate, type PageSize } from "./pagination";

export function HistoryTable() {
  const { t } = useLocale();
  const router = useRouter();
  const [logs, setLogs] = useState<SendLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(30);

  useEffect(() => {
    fetch("/api/history")
      .then((res) => res.json())
      .then((data) => { setLogs(data); setLoading(false); });
  }, []);

  const restoreAsDraft = async (log: SendLog) => {
    if (restoringId !== null) return;
    if (!confirm(t("history.restore_confirm"))) return;
    setRestoringId(log.id);
    try {
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: log.subject,
          htmlContent: log.html_content,
          prompt: log.prompt ?? "",
        }),
      });
      const draft = await res.json();
      if (draft?.id) {
        // Jump straight into the composer with the fresh draft loaded
        router.push(`/compose?draft=${draft.id}`);
      }
    } finally {
      setRestoringId(null);
    }
  };

  const previewLog = logs.find((l) => l.id === previewId);
  const pageLogs = paginate(logs, page, pageSize);

  return (
    <div className="space-y-5">
      <div className="bg-surface-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border-light bg-surface">
              <th className="text-left px-5 py-3 font-medium text-text-secondary text-[12px]">{t("history.date")}</th>
              <th className="text-left px-5 py-3 font-medium text-text-secondary text-[12px]">{t("history.subject")}</th>
              <th className="text-left px-5 py-3 font-medium text-text-secondary text-[12px]">{t("history.recipients")}</th>
              <th className="text-left px-5 py-3 font-medium text-text-secondary text-[12px]">{t("history.status")}</th>
              <th className="text-right px-5 py-3 font-medium text-text-secondary text-[12px]">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-text-muted text-[13px]">{t("loading")}</td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-text-muted text-[13px]">{t("history.no_history")}</td>
              </tr>
            ) : (
              pageLogs.map((log) => (
                <tr key={log.id} className="border-b border-border-light last:border-0 hover:bg-surface/50 transition-colors">
                  <td className="px-5 py-3 text-text-muted">
                    {new Date(log.sent_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-text-primary">{log.subject}</td>
                  <td className="px-5 py-3 text-text-secondary">{log.recipient_count}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                        log.status === "sent"
                          ? "bg-success/10 text-success"
                          : log.status === "failed"
                            ? "bg-danger/10 text-danger"
                            : "bg-warning/10 text-warning"
                      }`}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => setPreviewId(previewId === log.id ? null : log.id)}
                      className="text-brand hover:text-brand-dark text-[12px] font-medium mr-3 transition-colors"
                    >
                      {previewId === log.id ? t("close") : t("preview")}
                    </button>
                    <button
                      onClick={() => restoreAsDraft(log)}
                      disabled={restoringId !== null}
                      className="text-text-secondary hover:text-brand text-[12px] font-medium disabled:opacity-40 transition-colors inline-flex items-center gap-1"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="12" y1="18" x2="12" y2="12" />
                        <line x1="9" y1="15" x2="15" y2="15" />
                      </svg>
                      {restoringId === log.id ? "..." : t("history.restore_to_draft")}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        total={logs.length}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
      />

      {previewLog && (
        <div className="bg-surface-card border border-border rounded-xl overflow-hidden">
          <div className="flex justify-between items-center px-5 py-3 border-b border-border-light bg-surface gap-3">
            <span className="text-[13px] font-medium text-text-primary truncate">{previewLog.subject}</span>
            <div className="flex items-center gap-3 flex-shrink-0">
              <button
                onClick={() => restoreAsDraft(previewLog)}
                disabled={restoringId !== null}
                className="text-brand hover:text-brand-dark text-[12px] font-medium disabled:opacity-40 transition-colors inline-flex items-center gap-1"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="12" y1="18" x2="12" y2="12" />
                  <line x1="9" y1="15" x2="15" y2="15" />
                </svg>
                {restoringId === previewLog.id ? "..." : t("history.restore_to_draft")}
              </button>
              <button
                onClick={() => setPreviewId(null)}
                className="text-text-muted hover:text-text-primary text-[12px] font-medium transition-colors"
              >
                {t("close")}
              </button>
            </div>
          </div>
          <iframe
            srcDoc={previewLog.html_content}
            sandbox=""
            className="w-full min-h-[400px] border-0 bg-white"
            title="Email Preview"
          />
        </div>
      )}
    </div>
  );
}
