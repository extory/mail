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
      .then((data) => {
        setLogs(data);
        setLoading(false);
      });
  }, []);

  const previewLog = logs.find((l) => l.id === previewId);

  return (
    <div className="space-y-6">
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">{t("history.date")}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">{t("history.subject")}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">{t("history.recipients")}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">{t("history.status")}</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-500">{t("loading")}</td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-500">{t("history.no_history")}</td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-b last:border-0">
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(log.sent_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">{log.subject}</td>
                  <td className="px-4 py-3 text-gray-600">{log.recipient_count}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        log.status === "sent"
                          ? "bg-green-100 text-green-700"
                          : log.status === "failed"
                            ? "bg-red-100 text-red-700"
                            : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setPreviewId(previewId === log.id ? null : log.id)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
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
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b flex justify-between items-center">
            <span className="text-sm font-medium">{previewLog.subject}</span>
            <button
              onClick={() => setPreviewId(null)}
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              {t("close")}
            </button>
          </div>
          <iframe
            srcDoc={previewLog.html_content}
            sandbox=""
            className="w-full min-h-[400px] border-0"
            title="Email Preview"
          />
        </div>
      )}
    </div>
  );
}
