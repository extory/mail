"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Draft } from "@/lib/types";
import { useLocale } from "./locale-provider";

export function DraftsList() {
  const { t } = useLocale();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewId, setPreviewId] = useState<number | null>(null);

  const fetchDrafts = async () => {
    const res = await fetch("/api/drafts");
    setDrafts(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchDrafts(); }, []);

  const handleDelete = async (id: number) => {
    if (!confirm(t("drafts.delete_confirm"))) return;
    await fetch(`/api/drafts/${id}`, { method: "DELETE" });
    if (previewId === id) setPreviewId(null);
    fetchDrafts();
  };

  const previewDraft = drafts.find((d) => d.id === previewId);

  return (
    <div className="space-y-4">
      {loading ? (
        <p className="text-text-muted text-[13px]">{t("loading")}</p>
      ) : drafts.length === 0 ? (
        <div className="bg-surface-card border border-border rounded-xl p-12 text-center">
          <p className="text-text-muted text-[13px]">{t("drafts.no_drafts")}</p>
        </div>
      ) : (
        <div className="bg-surface-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border-light bg-surface">
                <th className="text-left px-5 py-3 font-medium text-text-secondary text-[12px]">{t("compose.subject")}</th>
                <th className="text-left px-5 py-3 font-medium text-text-secondary text-[12px]">{t("drafts.updated")}</th>
                <th className="text-right px-5 py-3 font-medium text-text-secondary text-[12px]">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((draft) => (
                <tr key={draft.id} className="border-b border-border-light last:border-0 hover:bg-surface/50 transition-colors">
                  <td className="px-5 py-3">
                    <button
                      onClick={() => setPreviewId(previewId === draft.id ? null : draft.id)}
                      className="text-text-primary hover:text-brand text-left transition-colors"
                    >
                      {draft.subject || t("drafts.no_subject")}
                    </button>
                    {draft.prompt && (
                      <p className="text-[11px] text-text-muted mt-0.5 truncate max-w-md">
                        {draft.prompt}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-text-muted">
                    {new Date(draft.updated_at).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link
                        href={`/compose?draft=${draft.id}`}
                        className="text-brand hover:text-brand-dark text-[12px] font-medium transition-colors"
                      >
                        {t("edit")}
                      </Link>
                      <button
                        onClick={() => handleDelete(draft.id)}
                        className="text-danger hover:text-danger/80 text-[12px] font-medium transition-colors"
                      >
                        {t("delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Inline preview */}
      {previewDraft && (
        <div className="bg-surface-card border border-border rounded-xl overflow-hidden">
          <div className="flex justify-between items-center px-5 py-3 border-b border-border-light bg-surface">
            <span className="text-[13px] font-medium text-text-primary">
              {previewDraft.subject || t("drafts.no_subject")}
            </span>
            <div className="flex items-center gap-3">
              <Link
                href={`/compose?draft=${previewDraft.id}`}
                className="text-brand hover:text-brand-dark text-[12px] font-medium transition-colors"
              >
                {t("edit")}
              </Link>
              <button
                onClick={() => setPreviewId(null)}
                className="text-text-muted hover:text-text-primary text-[12px] font-medium transition-colors"
              >
                {t("close")}
              </button>
            </div>
          </div>
          {previewDraft.html_content ? (
            <iframe
              srcDoc={previewDraft.html_content}
              sandbox=""
              className="w-full min-h-[400px] border-0 bg-white"
              title="Draft Preview"
            />
          ) : (
            <div className="p-8 text-center text-text-muted text-[13px]">
              {t("compose.preview")} - No content
            </div>
          )}
        </div>
      )}
    </div>
  );
}
