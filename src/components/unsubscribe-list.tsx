"use client";

import { useRef, useState } from "react";
import { useLocale } from "./locale-provider";

type Entry = { email: string; created_at: string; subscriber_count: number };

export function UnsubscribeList({ onAdded }: { onAdded: () => void }) {
  const { t } = useLocale();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const [removed, setRemoved] = useState<number | null>(null);
  const deletingRef = useRef(false);
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedEmail, setSavedEmail] = useState("");
  const savingRef = useRef(false);
  const requestId = useRef(0);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const load = async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(false);
    try {
      const response = await fetch("/api/subscribers?status=unsubscribed");
      if (!response.ok) throw new Error();
      const data: Entry[] = await response.json();
      if (id === requestId.current) { setEntries(data); setSelected(new Set()); }
    } catch { if (id === requestId.current) setError(true); }
    finally { if (id === requestId.current) setLoading(false); }
  };
  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    if (savingRef.current || deletingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError("");
    setSavedEmail("");
    try {
      const response = await fetch("/api/subscribers/suppress", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!response.ok) {
        setSaveError(t(response.status === 400 ? "unsubscribe.invalid_email" : "unsubscribe.manual_error"));
        return;
      }
      const result = await response.json();
      setSavedEmail(result.email);
      setEmail("");
      setSearch("");
      onAdded();
      await load();
    } catch { setSaveError(t("unsubscribe.manual_error")); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const filtered = entries.filter(entry => entry.email.toLowerCase().includes(search.trim().toLowerCase()));
  const selectable = filtered.filter(entry => entry.subscriber_count > 0);
  const selectedEmails = selectable.filter(entry => selected.has(entry.email)).map(entry => entry.email);
  const removeSubscribers = async () => {
    if (deletingRef.current || savingRef.current || loading || error || !selectedEmails.length) return;
    if (!window.confirm(t("unsubscribe.delete_confirm", { count: selectedEmails.length }))) return;
    deletingRef.current = true;
    setDeleting(true);
    setDeleteError(false);
    setRemoved(null);
    try {
      const response = await fetch("/api/subscribers/suppress/subscribers", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: selectedEmails }),
      });
      if (!response.ok) throw new Error();
      const result = await response.json();
      setRemoved(result.removed);
      setSelected(new Set());
      onAdded();
      await load();
    } catch { setDeleteError(true); }
    finally { deletingRef.current = false; setDeleting(false); }
  };
  return (
    <details className="mb-5 rounded-xl border border-border bg-white p-5" onToggle={event => { if (event.currentTarget.open) void load(); }}>
      <summary className="cursor-pointer text-sm font-semibold">{t("unsubscribe.list")}</summary>
      <p className="my-3 text-sm text-text-secondary">{t("unsubscribe.list_hint")}</p>
      <form onSubmit={add} className="mb-5 rounded-lg border border-border bg-surface p-4 space-y-3">
        <label className="block text-sm font-medium">
          {t("unsubscribe.manual_email")}
          <input type="email" required maxLength={254} value={email} disabled={saving || deleting} onChange={event => setEmail(event.target.value)} placeholder="name@company.com" className="mt-2 block w-full min-w-0 rounded-lg border border-border bg-white px-3 py-2 text-sm" />
        </label>
        <p className="text-xs text-text-secondary">{t("unsubscribe.manual_hint")}</p>
        <button type="submit" disabled={saving || deleting || !email.trim()} className="min-h-10 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50">{saving ? t("loading") : t("unsubscribe.manual_add")}</button>
        {saveError && <p role="alert" className="text-sm text-danger">{saveError}</p>}
        {savedEmail && <p role="status" className="break-all text-sm text-brand">{t("unsubscribe.manual_success", { email: savedEmail })}</p>}
      </form>
      <div className="flex flex-wrap gap-3 items-center">
        <input type="search" aria-label={t("subscribers.search")} placeholder={t("subscribers.email")} value={search} disabled={deleting} onChange={event => { setSearch(event.target.value); setSelected(new Set()); }} className="min-w-0 rounded-lg border border-border px-3 py-2 text-sm" />
        <button type="button" onClick={load} disabled={loading || deleting || saving} className="text-sm text-brand">{t("unsubscribe.refresh")}</button>
      </div>
      <p className="mt-3 text-xs text-text-secondary">{t("unsubscribe.delete_hint")}</p>
      {deleteError && <p role="alert" className="mt-3 text-sm text-danger">{t("unsubscribe.delete_error")}</p>}
      {removed !== null && <p role="status" className="mt-3 text-sm text-brand">{t("unsubscribe.delete_success", { count: removed })}</p>}
      {error ? <p role="alert" className="mt-3 text-danger text-sm">{t("subscribers.load_error")}</p> : loading ? <p role="status" className="mt-3 text-sm">{t("loading")}</p> : (
        <>
          <p role="status" className="my-3 text-sm">{t("subscribers.search_count", { count: filtered.length })}</p>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={selectable.length > 0 && selectedEmails.length === selectable.length} disabled={deleting || saving || !selectable.length} onChange={event => setSelected(event.target.checked ? new Set(selectable.map(entry => entry.email)) : new Set())} className="h-4 w-4" />
              {t("unsubscribe.select_all")}
            </label>
            <button type="button" onClick={removeSubscribers} disabled={deleting || saving || !selectedEmails.length || selectedEmails.length > 1000} className="min-h-10 rounded-lg border border-danger/30 px-3 py-2 text-sm text-danger disabled:opacity-50">{deleting ? t("loading") : t("unsubscribe.delete_selected", { count: selectedEmails.length })}</button>
          </div>
          <ul className="max-h-80 overflow-y-auto divide-y divide-border text-sm">
            {filtered.map(entry => <li key={entry.email} className="flex flex-wrap justify-between gap-2 py-3"><label className="flex min-w-0 items-center gap-2">
              <input type="checkbox" aria-label={entry.email} checked={selected.has(entry.email) && entry.subscriber_count > 0} disabled={deleting || saving || !entry.subscriber_count} onChange={event => setSelected(previous => { const next = new Set(previous); if (event.target.checked) next.add(entry.email); else next.delete(entry.email); return next; })} className="h-4 w-4 shrink-0" />
              <span className="break-all">{entry.email}</span>
              {!entry.subscriber_count && <span className="shrink-0 text-xs text-text-secondary">{t("unsubscribe.no_subscriber")}</span>}
            </label><time className="text-text-secondary">{entry.created_at}</time></li>)}
          </ul>
        </>
      )}
    </details>
  );
}
