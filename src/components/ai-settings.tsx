"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AIProvider } from "@/lib/ai-model-types";
import { useLocale } from "./locale-provider";

type Settings = { provider: AIProvider; providers: { provider: AIProvider; configured: boolean }[] };

export function AISettings() {
  const { t } = useLocale();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selected, setSelected] = useState<AIProvider>("openai");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError(false); setSaved(false);
    try {
      const response = await fetch("/api/settings/ai", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data: Settings = await response.json();
      setSettings(data); setSelected(data.provider);
    } catch { setError(true); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true; setSaving(true); setError(false); setSaved(false);
    try {
      const response = await fetch("/api/settings/ai", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: selected }) });
      if (!response.ok) throw new Error();
      setSettings(current => current ? { ...current, provider: selected } : current); setSaved(true);
    } catch { setError(true); }
    finally { savingRef.current = false; setSaving(false); }
  };
  return <section className="mb-5 rounded-xl border border-border bg-white p-5">
    <h2 className="text-[15px] font-semibold">{t("settings.ai_title")}</h2>
    <p className="mt-2 mb-4 text-sm text-text-secondary">{t("settings.ai_hint")}</p>
    {loading ? <p role="status">{t("loading")}</p> : settings && <form onSubmit={save} className="space-y-3">
      <fieldset disabled={saving} className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">{t("settings.ai_title")}</legend>
        {settings.providers.map(entry => <label key={entry.provider} className={`flex items-start gap-2 rounded-lg border p-4 ${selected === entry.provider ? "border-brand bg-brand/5" : "border-border"} ${!entry.configured ? "opacity-60" : "cursor-pointer"}`}>
          <input type="radio" name="default-ai" value={entry.provider} checked={selected === entry.provider} disabled={!entry.configured} onChange={() => { setSelected(entry.provider); setSaved(false); }} className="mt-1" />
          <span><span className="block text-sm font-semibold">{entry.provider === "openai" ? "ChatGPT (OpenAI)" : "Gemini"}</span><span className="text-xs text-text-secondary">{entry.configured ? t("settings.ai_available") : t("compose.ai_unconfigured")}</span></span>
        </label>)}
      </fieldset>
      {settings.providers.some(entry => !entry.configured) && <p className="text-xs text-text-secondary">{t("settings.ai_keys")}</p>}
      <button type="submit" disabled={saving || !settings.providers.some(entry => entry.provider === selected && entry.configured)} className="rounded-lg bg-brand px-4 py-2 text-sm text-white disabled:opacity-50">{saving ? t("loading") : t("save")}</button>
    </form>}
    {saved && <p role="status" className="mt-3 text-sm text-brand">{t("settings.ai_saved")}</p>}
    {error && <p role="alert" className="mt-3 text-sm text-danger">{t("settings.ai_error")}</p>}
    {!loading && <button type="button" disabled={saving} onClick={load} className="mt-3 text-xs text-brand">{t("compose.ai_reload")}</button>}
  </section>;
}
