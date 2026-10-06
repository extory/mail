"use client";

import { useRef, useState } from "react";
import { createQrBlock, extractQrBlock, normalizeQrLink, replaceQrBlock } from "@/lib/qr-code";
import { useLocale } from "./locale-provider";

export function QrCodeOptions({ html, disabled, onChange, onBusyChange }: {
  html: string;
  disabled: boolean;
  onChange: (update: (html: string) => string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const { t } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<"link" | "upload">("link");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const inserted = Boolean(extractQrBlock(html));
  const enabled = expanded || inserted;

  const insert = async (file?: File) => {
    if (disabled || busyRef.current) return;
    setError("");
    if (file && (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024 || file.size === 0)) {
      setError(t("qr.file_error")); return;
    }
    if (!file && !normalizeQrLink(link)) { setError(t("qr.link_error")); return; }
    busyRef.current = true;
    setBusy(true);
    onBusyChange(true);
    try {
      const form = new FormData();
      if (file) form.append("file", file);
      const response = await fetch(file ? "/api/uploads" : "/api/qr-code", file
        ? { method: "POST", body: form }
        : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: link }) });
      if (!response.ok) throw new Error();
      const data = await response.json();
      const block = createQrBlock(data.url, file ? undefined : data.link);
      onChange(current => replaceQrBlock(current, block));
    } catch { setError(t("qr.error")); }
    finally { busyRef.current = false; setBusy(false); onBusyChange(false); }
  };

  return <section className="rounded-xl border border-border bg-white p-5 space-y-3">
    <label className="flex items-center gap-2 text-sm font-semibold">
      <input type="checkbox" checked={enabled} disabled={disabled || busy} onChange={event => {
        setExpanded(event.target.checked); setError("");
        if (!event.target.checked) onChange(current => replaceQrBlock(current, ""));
      }} className="h-4 w-4" />{t("qr.enable")}
    </label>
    {enabled && <>
      <p className="text-xs text-text-secondary">{t("qr.hint")}</p>
      <label className="block text-sm">{t("qr.source")}
        <select value={mode} disabled={disabled || busy} onChange={event => { setMode(event.target.value as "link" | "upload"); setError(""); }} className="mt-1 w-full rounded-lg border border-border px-3 py-2 bg-white">
          <option value="link">{t("qr.link")}</option><option value="upload">{t("qr.upload")}</option>
        </select>
      </label>
      {mode === "link" ? <>
        <label className="block text-sm">{t("qr.destination")}
          <input type="url" value={link} maxLength={1000} disabled={disabled || busy} onChange={event => setLink(event.target.value)} placeholder="https://example.com" className="mt-1 w-full min-w-0 rounded-lg border border-border px-3 py-2" />
        </label>
        <button type="button" onClick={() => insert()} disabled={disabled || busy || !link.trim()} className="rounded-lg bg-brand text-white px-4 py-2 text-sm disabled:opacity-50">{busy ? t("loading") : t("qr.insert")}</button>
      </> : <label className="block text-sm">{t("qr.upload")}
        <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" disabled={disabled || busy} onChange={event => {
          const file = event.target.files?.[0]; event.target.value = ""; if (file) void insert(file);
        }} className="mt-2 block w-full min-w-0 text-sm" />
        <span className="mt-2 block text-xs text-text-secondary">{t("qr.file_hint")}</span>
      </label>}
      {busy && mode === "upload" && <p role="status" className="text-sm">{t("loading")}</p>}
      {inserted && <p role="status" className="text-sm text-brand">{t("qr.inserted")}</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </>}
  </section>;
}
