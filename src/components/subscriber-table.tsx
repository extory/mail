"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { filterSubscribers, selectedVisibleIds } from "@/lib/subscriber-selection";
import type { Subscriber, Group } from "@/lib/types";
import { useLocale } from "./locale-provider";
import { Pagination, paginate, type PageSize } from "./pagination";

interface SkippedRow {
  email: string;
  name?: string;
  groupNames?: string[];
  reason: string;
}

interface ImportResultDetail {
  imported: number;
  skipped: number;
  updated: number;
  created_groups: number;
  skipped_rows: SkippedRow[];
}

export function SubscriberTable({ refreshKey = 0 }: { refreshKey?: number }) {
  const { t } = useLocale();
  const [allSubscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [search, setSearch] = useState("");
  const [filterGroupId, setFilterGroupId] = useState<string>("");
  const [addError, setAddError] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newGroupIds, setNewGroupIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [importResult, setImportResult] = useState<ImportResultDetail | null>(null);
  const [showSkipped, setShowSkipped] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [openGroupPickerForId, setOpenGroupPickerForId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(30);
  const fileRef = useRef<HTMLInputElement>(null);
  const groupPickerRef = useRef<HTMLDivElement>(null);

  const subscribers = filterSubscribers(allSubscribers, search, filterGroupId);
  const visibleSelected = selectedVisibleIds(subscribers, selectedIds);
  const [listError, setListError] = useState<"load" | "delete" | null>(null);
  const bulkDeletingRef = useRef(false);
  const listRequest = useRef(0);

  const fetchGroups = async () => {
    const res = await fetch("/api/groups");
    setGroups(await res.json());
  };

  const fetchSubscribers = useCallback(async () => {
    const requestId = ++listRequest.current;
    setLoading(true);
    setListError(null);
    try {
      const res = await fetch("/api/subscribers");
      if (!res.ok) throw new Error("Failed to load subscribers");
      const data: Subscriber[] = await res.json();
      if (requestId !== listRequest.current) return;
      setSubscribers(data);
      setSelectedIds(prev => new Set(selectedVisibleIds(data, prev)));
      setPage(1);
    } catch {
      if (requestId === listRequest.current) setListError("load");
    } finally {
      if (requestId === listRequest.current) setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGroups(); }, []);
  useEffect(() => { void fetchSubscribers(); }, [fetchSubscribers, refreshKey]);

  // Close popover when clicking outside
  useEffect(() => {
    if (openGroupPickerForId === null) return;
    const handler = (e: MouseEvent) => {
      if (groupPickerRef.current && !groupPickerRef.current.contains(e.target as Node)) {
        setOpenGroupPickerForId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openGroupPickerForId]);

  const toggleNewGroupId = (id: number) => {
    setNewGroupIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;
    setAddError("");
    try {
      const response = await fetch("/api/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          name: newName || undefined,
          groupIds: newGroupIds,
        }),
      });
      if (!response.ok) {
        const result = await response.json();
        setAddError(t(result.error === "email_unsubscribed" ? "unsubscribe.blocked" : "unsubscribe.add_error"));
        return;
      }
      setNewEmail("");
      setNewName("");
      setNewGroupIds([]);
      fetchSubscribers();
      fetchGroups();
    } catch { setAddError(t("unsubscribe.add_error")); }
  };

  const handleRemove = async (id: number) => {
    await fetch(`/api/subscribers/${id}`, { method: "DELETE" });
    fetchSubscribers();
    fetchGroups();
  };

  const handleGroupToggle = async (subscriberId: number, groupId: number) => {
    const sub = subscribers.find((s) => s.id === subscriberId);
    if (!sub) return;
    const currentIds = sub.groups.map((g) => g.id);
    const nextIds = currentIds.includes(groupId)
      ? currentIds.filter((id) => id !== groupId)
      : [...currentIds, groupId];
    await fetch("/api/subscribers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: subscriberId, groupIds: nextIds }),
    });
    fetchSubscribers();
    fetchGroups();
  };

  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (importing) return;
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (newGroupIds.length > 0) formData.append("groupIds", newGroupIds.join(","));
      const res = await fetch("/api/subscribers/import", { method: "POST", body: formData });
      const result = await res.json();
      if (!res.ok) {
        const errors = {
          unsupported_format: "subscribers.import_format_error",
          file_too_large: "subscribers.import_size_error",
          invalid_file: "subscribers.import_invalid_error",
          empty_file: "subscribers.import_empty_error",
          missing_email_column: "subscribers.import_header_error",
        } as const;
        setImportError(t(errors[result.error as keyof typeof errors] || "subscribers.import_error"));
        return;
      }
      setImportResult(result as ImportResultDetail);
      setShowSkipped((result.skipped_rows?.length ?? 0) > 0);
      fetchSubscribers();
      fetchGroups();
    } catch { setImportError(t("subscribers.import_error")); }
    finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const retryRow = async (row: SkippedRow) => {
    if (row.reason === "invalid_email" || row.reason === "previously_unsubscribed") return;
    setRetrying(true);
    try {
      // Suppressed addresses must never be retried as active subscriptions.
      const groupIds = newGroupIds;
      const response = await fetch("/api/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: row.email,
          name: row.name || undefined,
          groupIds: groupIds.length > 0 ? groupIds : undefined,
        }),
      });
      if (!response.ok) return;
      // Remove from skipped list
      setImportResult((prev) =>
        prev
          ? {
              ...prev,
              skipped_rows: prev.skipped_rows.filter((r) => r.email !== row.email),
              skipped: Math.max(0, prev.skipped - 1),
              imported: prev.imported + 1,
            }
          : prev
      );
      fetchSubscribers();
      fetchGroups();
    } finally {
      setRetrying(false);
    }
  };

  const retryAllSkipped = async () => {
    if (!importResult) return;
    const retryable = importResult.skipped_rows.filter(
      (r) => r.reason !== "invalid_email" && r.reason !== "duplicate_in_csv" && r.reason !== "previously_unsubscribed"
    );
    if (retryable.length === 0) return;
    setRetrying(true);
    const succeeded = new Set<string>();
    for (const row of retryable) {
      try {
        const response = await fetch("/api/subscribers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: row.email, name: row.name || undefined, groupIds: newGroupIds }),
        });
        if (response.ok) succeeded.add(row.email);
      } catch { /* Keep failed rows visible for a later retry. */ }
    }
    setImportResult(prev => prev ? {
      ...prev, skipped_rows: prev.skipped_rows.filter(row => !succeeded.has(row.email)),
      skipped: Math.max(0, prev.skipped - succeeded.size), imported: prev.imported + succeeded.size,
    } : prev);
    setRetrying(false);
    fetchSubscribers();
    fetchGroups();
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Select all subscribers across pages (matches "Select all" expectation)
      setSelectedIds(new Set(subscribers.map((s) => s.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (loading || listError === "load" || bulkDeletingRef.current || visibleSelected.length === 0) return;
    if (!confirm(t("subscribers.bulk_delete_confirm", { count: visibleSelected.length }))) return;
    bulkDeletingRef.current = true;
    setBulkDeleting(true);
    setListError(null);
    try {
      const res = await fetch("/api/subscribers/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: visibleSelected }),
      });
      if (!res.ok) throw new Error("Failed to delete subscribers");
      setSelectedIds(new Set());
      await fetchSubscribers();
      fetchGroups();
    } catch { setListError("delete"); }
    finally {
      bulkDeletingRef.current = false;
      setBulkDeleting(false);
    }
  };

  const reasonLabel = (reason: string): string => {
    if (reason === "invalid_email") return t("subscribers.skip_invalid_email");
    if (reason === "duplicate_in_csv") return t("subscribers.skip_duplicate");
    if (reason === "previously_unsubscribed") return t("subscribers.skip_unsubscribed");
    if (reason.startsWith("db_error")) return t("subscribers.skip_db_error");
    return reason;
  };

  const handleDownloadTemplate = () => {
    const csv = "email,name,groups\n";
    // Prepend BOM so Excel opens UTF-8 CSV correctly (preserves Korean characters)
    const BOM = "﻿";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subscribers_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const inputClass = "border border-border rounded-lg px-3 h-[38px] text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all placeholder:text-text-muted";
  const selectClass = "border border-border rounded-lg px-3 h-[38px] text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all";

  return (
    <div className="space-y-4">
      {/* Add subscriber */}
      <details className="bg-surface-card border border-border rounded-xl p-5">
        <summary className="cursor-pointer text-sm font-semibold text-brand">{t("ux.register")}</summary>
        <form onSubmit={handleAdd} className="space-y-4 mt-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            <div>
              <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
                {t("subscribers.email")}
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="user@example.com"
                className={`${inputClass} w-full`}
                required
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
                {t("subscribers.name")}
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t("subscribers.name.placeholder")}
                className={`${inputClass} w-full`}
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
                {t("subscribers.groups")}
              </label>
              {groups.length === 0 ? (
                <div className={`${selectClass} w-full flex items-center text-text-muted`}>
                  {t("groups.no_groups")}
                </div>
              ) : (
                <div className="border border-border rounded-lg bg-white p-1.5 flex flex-wrap gap-1 min-h-[38px]">
                  {groups.map((g) => {
                    const checked = newGroupIds.includes(g.id);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => toggleNewGroupId(g.id)}
                        className={`text-[11px] px-2 py-1 rounded-md font-medium transition-colors ${
                          checked
                            ? "bg-brand text-white"
                            : "bg-surface text-text-secondary hover:bg-border-light"
                        }`}
                      >
                        {g.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="bg-brand text-white px-5 py-2 rounded-lg text-[13px] font-medium hover:bg-brand-dark transition-colors"
            >
              {t("add")}
            </button>
            <div className="h-5 w-px bg-border mx-1" />
            <input ref={fileRef} type="file" accept=".csv,.xlsx" disabled={importing} onChange={handleImport} className="hidden" />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="border border-border text-text-secondary px-4 py-2 rounded-lg text-[13px] font-medium hover:bg-surface hover:text-text-primary transition-colors"
            >
              {importing ? t("loading") : t("subscribers.import")}
            </button>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="text-text-muted hover:text-brand text-[12px] font-medium transition-colors flex items-center gap-1"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {t("subscribers.download_template")}
            </button>
          </div>
          {addError && <p role="alert" className="text-sm text-danger">{addError}</p>}
        </form>
        <p className="mt-3 text-[12px] text-text-secondary">{t("subscribers.import_hint")}</p>
      </details>
      {importError && <p role="alert" className="text-[13px] text-danger">{importError}</p>}
      {/* Import result */}
      {importResult && (
        <div className="bg-surface-card border border-border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-[13px] flex-wrap">
              <span className="text-success font-medium">
                {t("subscribers.import_imported", { count: importResult.imported })}
              </span>
              {importResult.updated > 0 && (
                <span className="text-text-secondary">
                  {t("subscribers.import_updated", { count: importResult.updated })}
                </span>
              )}
              {importResult.created_groups > 0 && (
                <span className="text-brand">
                  {t("subscribers.import_created_groups", { count: importResult.created_groups })}
                </span>
              )}
              {importResult.skipped > 0 && (
                <span className="text-warning font-medium">
                  {t("subscribers.import_skipped", { count: importResult.skipped })}
                </span>
              )}
            </div>
            <button
              onClick={() => { setImportResult(null); setShowSkipped(false); }}
              className="text-text-muted hover:text-text-primary text-[12px] transition-colors"
            >
              {t("close")}
            </button>
          </div>
          {importResult.skipped_rows.length > 0 && (
            <div>
              <button
                onClick={() => setShowSkipped(!showSkipped)}
                className="text-[12px] text-brand hover:text-brand-dark font-medium transition-colors flex items-center gap-1"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${showSkipped ? "rotate-90" : ""}`}>
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                {showSkipped ? t("subscribers.hide_skipped") : t("subscribers.show_skipped")}
              </button>
              {showSkipped && (
                <div className="mt-3 border border-border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2 bg-surface border-b border-border-light">
                    <span className="text-[12px] text-text-secondary">{importResult.skipped_rows.length} {t("subscribers.skipped_rows")}</span>
                    {importResult.skipped_rows.some((r) => r.reason !== "invalid_email" && r.reason !== "duplicate_in_csv" && r.reason !== "previously_unsubscribed") && (
                      <button
                        onClick={retryAllSkipped}
                        disabled={retrying}
                        className="text-[12px] text-brand hover:text-brand-dark font-medium disabled:opacity-40 transition-colors"
                      >
                        {retrying ? "..." : t("subscribers.retry_all")}
                      </button>
                    )}
                  </div>
                  <table className="min-w-[680px] w-full text-[12px]">
                    <thead>
                      <tr className="bg-surface/50 border-b border-border-light">
                        <th className="text-left px-4 py-2 font-medium text-text-secondary">{t("subscribers.email")}</th>
                        <th className="text-left px-4 py-2 font-medium text-text-secondary">{t("subscribers.name")}</th>
                        <th className="text-left px-4 py-2 font-medium text-text-secondary">{t("subscribers.skip_reason")}</th>
                        <th className="text-right px-4 py-2 font-medium text-text-secondary">{t("actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResult.skipped_rows.map((row, i) => (
                        <tr key={i} className="border-b border-border-light last:border-0">
                          <td className="px-4 py-2 text-text-primary">{row.email}</td>
                          <td className="px-4 py-2 text-text-secondary">{row.name || "-"}</td>
                          <td className="px-4 py-2">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              row.reason === "invalid_email" ? "bg-danger/10 text-danger"
                                : row.reason === "duplicate_in_csv" ? "bg-warning/10 text-warning"
                                  : "bg-brand/10 text-brand"
                            }`}>
                              {reasonLabel(row.reason)}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right">
                            {row.reason !== "invalid_email" && row.reason !== "duplicate_in_csv" && row.reason !== "previously_unsubscribed" && (
                              <button
                                onClick={() => retryRow(row)}
                                disabled={retrying}
                                className="text-brand hover:text-brand-dark text-[12px] font-medium disabled:opacity-40 transition-colors"
                              >
                                {t("subscribers.retry")}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelectedIds(new Set()); setPage(1); setOpenGroupPickerForId(null); }}
            aria-label={t("subscribers.search")}
            disabled={bulkDeleting || loading}
            placeholder={t("subscribers.search")}
            className={`${inputClass} w-full pl-9`}
          />
        </div>
        <select
          value={filterGroupId}
          onChange={(e) => { setFilterGroupId(e.target.value); setSelectedIds(new Set()); setPage(1); setOpenGroupPickerForId(null); }}
          disabled={bulkDeleting || loading}
          className={selectClass}
        >
          <option value="">{t("subscribers.all_groups")}</option>
          <option value="0">{t("subscribers.no_group")}</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>

      <p role="status" className="text-[12px] text-text-secondary">{t("subscribers.search_count", { count: subscribers.length })} · {t("subscribers.search_selection_hint")}</p>
      {listError && <p role="alert" className="text-danger text-[13px]">{t(listError === "load" ? "subscribers.load_error" : "subscribers.delete_error")}</p>}
      {/* Bulk actions bar */}
      {visibleSelected.length > 0 && (
        <div className="flex flex-wrap gap-3 items-center justify-between bg-brand/[0.06] border border-brand/20 rounded-xl px-4 py-2.5">
          <span className="text-[13px] font-medium text-text-primary">
            {t("subscribers.selected_count", { count: visibleSelected.length })}
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedIds(new Set())}
              disabled={bulkDeleting}
              className="text-[12px] text-text-secondary hover:text-text-primary font-medium transition-colors"
            >
              {t("subscribers.clear_selection")}
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={bulkDeleting || loading || listError === "load"}
              className="bg-danger text-white px-4 py-1.5 rounded-lg text-[12px] font-medium hover:bg-danger/90 disabled:opacity-40 transition-colors"
            >
              {bulkDeleting ? "..." : t("subscribers.bulk_delete")}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-surface-card border border-border rounded-xl overflow-x-auto">
        <table className="min-w-[680px] w-full text-[13px]">
          <thead>
            <tr className="border-b border-border-light bg-surface">
              <th className="px-5 py-3 w-10">
                <input
                  type="checkbox"
                  checked={subscribers.length > 0 && visibleSelected.length === subscribers.length}
                  ref={(el) => {
                    if (el) el.indeterminate = visibleSelected.length > 0 && visibleSelected.length < subscribers.length;
                  }}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  aria-label={t("subscribers.select_results")}
                  disabled={loading || bulkDeleting || listError === "load"}
                  className="w-4 h-4 rounded border-border text-brand focus:ring-brand/20"
                />
              </th>
              <th className="text-left px-5 py-3 font-medium text-text-secondary text-[12px]">{t("subscribers.email")}</th>
              <th className="text-left px-5 py-3 font-medium text-text-secondary text-[12px]">{t("subscribers.name")}</th>
              <th className="text-left px-5 py-3 font-medium text-text-secondary text-[12px]">{t("subscribers.groups")}</th>
              <th className="text-left px-5 py-3 font-medium text-text-secondary text-[12px]">{t("subscribers.added")}</th>
              <th className="text-right px-5 py-3 font-medium text-text-secondary text-[12px]">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-text-muted text-[13px]">{t("loading")}</td>
              </tr>
            ) : subscribers.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-text-muted text-[13px]">{t("subscribers.no_subscribers")}</td>
              </tr>
            ) : (
              paginate(subscribers, page, pageSize).map((sub) => (
                <tr key={sub.id} className={`border-b border-border-light last:border-0 hover:bg-surface/50 transition-colors ${selectedIds.has(sub.id) ? "bg-brand/[0.04]" : ""}`}>
                  <td className="px-5 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(sub.id)}
                      onChange={(e) => handleSelectOne(sub.id, e.target.checked)}
                      aria-label={t("groups.select_member", { email: sub.email })}
                      disabled={loading || bulkDeleting || listError === "load"}
                      className="w-4 h-4 rounded border-border text-brand focus:ring-brand/20"
                    />
                  </td>
                  <td className="px-5 py-3 text-text-primary">{sub.email}</td>
                  <td className="px-5 py-3 text-text-secondary">{sub.name || "-"}</td>
                  <td className="px-5 py-3 relative">
                    <button
                      type="button"
                      onClick={() => setOpenGroupPickerForId(openGroupPickerForId === sub.id ? null : sub.id)}
                      className="flex flex-wrap gap-1 max-w-[280px] items-center hover:bg-surface px-1 -mx-1 rounded transition-colors min-h-[24px]"
                    >
                      {sub.groups.length === 0 ? (
                        <span className="text-[11px] text-text-muted italic">{t("subscribers.click_to_assign")}</span>
                      ) : (
                        sub.groups.map((g) => (
                          <span
                            key={g.id}
                            className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-md bg-brand/10 text-brand font-medium"
                          >
                            {g.name}
                          </span>
                        ))
                      )}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted ml-0.5">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                    {openGroupPickerForId === sub.id && (
                      <div
                        ref={groupPickerRef}
                        className="absolute z-10 top-full left-5 mt-1 bg-white border border-border rounded-lg shadow-lg py-1.5 min-w-[180px] max-h-[240px] overflow-y-auto"
                      >
                        {groups.length === 0 ? (
                          <div className="px-3 py-2 text-[12px] text-text-muted">{t("groups.no_groups")}</div>
                        ) : (
                          groups.map((g) => {
                            const checked = sub.groups.some((sg) => sg.id === g.id);
                            return (
                              <button
                                key={g.id}
                                type="button"
                                onClick={() => handleGroupToggle(sub.id, g.id)}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-text-primary hover:bg-surface transition-colors text-left"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  readOnly
                                  className="w-3.5 h-3.5 rounded border-border text-brand pointer-events-none"
                                />
                                {g.name}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-text-muted">
                    {new Date(sub.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => handleRemove(sub.id)}
                      className="text-danger hover:text-danger/80 text-[12px] font-medium transition-colors"
                    >
                      {t("remove")}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        total={subscribers.length}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
      />
    </div>
  );
}
