"use client";

import { useState, useEffect } from "react";
import type { SendLog } from "@/lib/types";
import { useLocale } from "./locale-provider";

export function HistoryTable() {
  const { t } = useLocale();
  const [logs, setLogs] = useState<SendLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewId, setPreviewId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/history")
      .then((res) => res.json())
      .then((data) => { setLogs(data); setLoading(false); });
  }, []);

  const previewLog = logs.find((l) => l.id === previewId);

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
              logs.map((log) => (
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
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => setPreviewId(previewId === log.id ? null : log.id)}
                      className="text-brand hover:text-brand-dark text-[12px] font-medium transition-colors"
                    >
                      {previewId === log.id ? t("close") : t("preview")}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {previewLog && (
        <div className="bg-surface-card border border-border rounded-xl overflow-hidden">
          <div className="flex justify-between items-center px-5 py-3 border-b border-border-light bg-surface">
            <span className="text-[13px] font-medium text-text-primary">{previewLog.subject}</span>
            <button
              onClick={() => setPreviewId(null)}
              className="text-text-muted hover:text-text-primary text-[12px] font-medium transition-colors"
            >
              {t("close")}
            </button>
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
