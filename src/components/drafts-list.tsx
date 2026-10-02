"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { Draft } from "@/lib/types";
import { useLocale } from "./locale-provider";

export function DraftsList() {
  const { t } = useLocale();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewId, setPreviewId] = useState<number | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<"load" | "delete" | null>(null);
  const deletingRef = useRef(false);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const allSelected = drafts.length > 0 && selectedIds.size === drafts.length;

  useEffect(() => {
    let active = true;
    fetch("/api/drafts")
      .then(res => {
        if (!res.ok) throw new Error("Failed to load drafts");
        return res.json();
      })
      .then(data => { if (active) setDrafts(data); })
      .catch(() => { if (active) setError("load"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = selectedIds.size > 0 && !allSelected;
  }, [selectedIds, allSelected]);

  const handleDelete = async (ids: number[], bulk = false) => {
    if (deletingRef.current || ids.length === 0) return;
    if (!confirm(bulk ? t("drafts.bulk_delete_confirm", { count: ids.length }) : t("drafts.delete_confirm"))) return;
    deletingRef.current = true;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/drafts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("Failed to delete drafts");
      const removed = new Set(ids);
      setDrafts(prev => prev.filter(draft => !removed.has(draft.id)));
      setSelectedIds(prev => new Set([...prev].filter(id => !removed.has(id))));
      setPreviewId(prev => prev !== null && removed.has(prev) ? null : prev);
    } catch {
      setError("delete");
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  };

  const previewDraft = drafts.find((d) => d.id === previewId);

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-danger text-[13px]">{t(error === "load" ? "drafts.load_error" : "drafts.delete_error")}</p>}
      {loading ? (
        <p className="text-text-muted text-[13px]">{t("loading")}</p>
      ) : error === "load" ? null : drafts.length === 0 ? (
        <div className="bg-surface-card border border-border rounded-xl p-12 text-center">
          <p className="text-text-muted text-[13px]">{t("drafts.no_drafts")}</p>
        </div>
      ) : (
        <div className="bg-surface-card border border-border rounded-xl overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-border-light">
            <span role="status" className="text-[13px] text-text-secondary">{t("drafts.selected_count", { count: selectedIds.size })}</span>
            <button type="button" onClick={() => handleDelete([...selectedIds], true)} disabled={deleting || selectedIds.size === 0}
              className="rounded-lg border border-danger/30 px-3 py-2 text-[12px] text-danger disabled:opacity-40 disabled:cursor-not-allowed">
              {deleting ? t("loading") : t("drafts.delete_selected")}
            </button>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border-light bg-surface">
                <th className="w-12 px-4 py-3">
                  <input ref={selectAllRef} type="checkbox" aria-label={t("drafts.select_all")} checked={allSelected} disabled={deleting}
                    onChange={e => setSelectedIds(e.target.checked ? new Set(drafts.map(draft => draft.id)) : new Set())}
                    className="h-4 w-4 accent-brand" />
                </th>
                <th className="text-left px-5 py-3 font-medium text-text-secondary text-[12px]">{t("compose.subject")}</th>
                <th className="text-left px-5 py-3 font-medium text-text-secondary text-[12px]">{t("drafts.updated")}</th>
                <th className="text-right px-5 py-3 font-medium text-text-secondary text-[12px]">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((draft) => (
                <tr key={draft.id} className="border-b border-border-light last:border-0 hover:bg-surface/50 transition-colors">
                  <td className="px-4 py-3">
                    <input type="checkbox" aria-label={t("drafts.select_one", { subject: draft.subject || t("drafts.no_subject") })}
                      checked={selectedIds.has(draft.id)} disabled={deleting}
                      onChange={e => {
                        const checked = e.target.checked;
                        setSelectedIds(prev => { const next = new Set(prev); if (checked) next.add(draft.id); else next.delete(draft.id); return next; });
                      }} className="h-4 w-4 accent-brand" />
                  </td>
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
                        onClick={() => handleDelete([draft.id])}
                        disabled={deleting}
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
