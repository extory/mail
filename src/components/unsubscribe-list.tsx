"use client";

import { useRef, useState } from "react";
import { useLocale } from "./locale-provider";

type Entry = { email: string; created_at: string };

export function UnsubscribeList({ onAdded }: { onAdded: () => void }) {
  const { t } = useLocale();
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
      if (id === requestId.current) setEntries(data);
    } catch { if (id === requestId.current) setError(true); }
    finally { if (id === requestId.current) setLoading(false); }
  };
  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    if (savingRef.current) return;
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
  return (
    <details className="mb-5 rounded-xl border border-border bg-white p-5" onToggle={event => { if (event.currentTarget.open) void load(); }}>
      <summary className="cursor-pointer text-sm font-semibold">{t("unsubscribe.list")}</summary>
      <p className="my-3 text-sm text-text-secondary">{t("unsubscribe.list_hint")}</p>
      <form onSubmit={add} className="mb-5 rounded-lg border border-border bg-surface p-4 space-y-3">
        <label className="block text-sm font-medium">
          {t("unsubscribe.manual_email")}
          <input type="email" required maxLength={254} value={email} disabled={saving} onChange={event => setEmail(event.target.value)} placeholder="name@company.com" className="mt-2 block w-full min-w-0 rounded-lg border border-border bg-white px-3 py-2 text-sm" />
        </label>
        <p className="text-xs text-text-secondary">{t("unsubscribe.manual_hint")}</p>
        <button type="submit" disabled={saving || !email.trim()} className="min-h-10 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50">{saving ? t("loading") : t("unsubscribe.manual_add")}</button>
        {saveError && <p role="alert" className="text-sm text-danger">{saveError}</p>}
        {savedEmail && <p role="status" className="break-all text-sm text-brand">{t("unsubscribe.manual_success", { email: savedEmail })}</p>}
      </form>
      <div className="flex flex-wrap gap-3 items-center">
        <input type="search" aria-label={t("subscribers.search")} placeholder={t("subscribers.email")} value={search} onChange={event => setSearch(event.target.value)} className="min-w-0 rounded-lg border border-border px-3 py-2 text-sm" />
        <button type="button" onClick={load} disabled={loading} className="text-sm text-brand">{t("unsubscribe.refresh")}</button>
      </div>
      {error ? <p role="alert" className="mt-3 text-danger text-sm">{t("subscribers.load_error")}</p> : loading ? <p role="status" className="mt-3 text-sm">{t("loading")}</p> : (
        <>
          <p role="status" className="my-3 text-sm">{t("subscribers.search_count", { count: filtered.length })}</p>
          <ul className="max-h-80 overflow-y-auto divide-y divide-border text-sm">
            {filtered.map(entry => <li key={entry.email} className="flex flex-wrap justify-between gap-2 py-3"><span className="break-all">{entry.email}</span><time className="text-text-secondary">{entry.created_at}</time></li>)}
          </ul>
        </>
      )}
    </details>
  );
}
