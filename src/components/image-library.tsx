"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SavedImage } from "@/lib/types";
import { useLocale } from "./locale-provider";

const inputClass = "w-full min-w-0 border border-border rounded-lg bg-white px-3 py-2 text-[12px] focus:outline-none focus:ring-2 focus:ring-brand/20";
const buttonClass = "rounded-lg border border-border px-3 py-1.5 text-[12px] disabled:opacity-40 hover:bg-surface";

export async function saveLibraryImage(url: string, name: string, description: string): Promise<SavedImage> {
  const res = await fetch("/api/images", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, name, description }) });
  if (!res.ok) throw new Error("save failed");
  return res.json();
}

export function ImageSavePrompt({ url, filename, description, disabled, onSaved, onSkip }: {
  url: string; filename: string; description: string; disabled: boolean;
  onSaved: () => void; onSkip: () => void;
}) {
  const { t } = useLocale();
  const [name, setName] = useState(filename);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const save = async () => {
    setSaving(true); setError(false);
    try { await saveLibraryImage(url, name.trim(), description); onSaved(); }
    catch { setError(true); }
    finally { setSaving(false); }
  };
  return <div className="mt-2 space-y-2 rounded-lg bg-brand/5 p-2">
    <p className="text-[12px] text-text-secondary">{t("images.ask_save")}</p>
    <input aria-label={t("images.name")} value={name} onChange={e => setName(e.target.value)} maxLength={120} disabled={saving || disabled} className={inputClass} />
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={save} disabled={saving || disabled || !name.trim()} className={buttonClass}>{saving ? "…" : t("images.save")}</button>
      <button type="button" onClick={onSkip} disabled={saving || disabled} className={buttonClass}>{t("images.skip")}</button>
    </div>
    {error && <p role="alert" className="text-[12px] text-red-600">{t("images.error")}</p>}
  </div>;
}

function LibraryCard({ image, disabled, selected, onUse, onChanged, onDeleted }: {
  image: SavedImage; disabled: boolean; selected: boolean;
  onUse: (image: SavedImage) => void; onChanged: () => void; onDeleted: (url: string) => void;
}) {
  const { t } = useLocale();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [name, setName] = useState(image.name);
  const [description, setDescription] = useState(image.description);
  const mutate = async (method: "PATCH" | "DELETE") => {
    setBusy(true); setError(false);
    try {
      const res = await fetch(`/api/images/${image.id}`, { method, headers: { "Content-Type": "application/json" },
        ...(method === "PATCH" ? { body: JSON.stringify({ name, description }) } : {}) });
      if (!res.ok) throw new Error("failed");
      if (method === "DELETE") onDeleted(image.url);
      setEditing(false); setDeleting(false); onChanged();
    } catch { setError(true); }
    finally { setBusy(false); }
  };
  return <article className="min-w-0 rounded-lg border border-border p-3 space-y-2">
    <div className="h-28 rounded-md bg-surface flex items-center justify-center overflow-hidden">
      <Image src={image.url} alt={image.description || image.name} width={240} height={112} unoptimized className="h-full w-full object-contain" />
    </div>
    {editing ? <>
      <input aria-label={t("images.name")} value={name} onChange={e => setName(e.target.value)} maxLength={120} disabled={busy || disabled} className={inputClass} />
      <textarea aria-label={t("images.description")} value={description} onChange={e => setDescription(e.target.value)} maxLength={1000} disabled={busy || disabled} className={inputClass} />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => mutate("PATCH")} disabled={busy || disabled || !name.trim()} className={buttonClass}>{t("save")}</button>
        <button type="button" onClick={() => setEditing(false)} disabled={busy} className={buttonClass}>{t("cancel")}</button>
      </div>
    </> : <>
      <h4 className="text-[13px] font-medium break-words">{image.name}</h4>
      <p className="text-[12px] text-text-secondary whitespace-pre-wrap break-words">{image.description || t("images.no_description")}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onUse(image)} disabled={disabled || busy || selected} className={`${buttonClass} text-brand`}>{selected ? t("images.selected") : t("images.use")}</button>
        <button type="button" onClick={() => { setName(image.name); setDescription(image.description); setEditing(true); setDeleting(false); }} disabled={disabled || busy} className={buttonClass}>{t("edit")}</button>
        <button type="button" onClick={() => setDeleting(true)} disabled={disabled || busy} className={`${buttonClass} text-red-600`}>{t("delete")}</button>
      </div>
    </>}
    {deleting && <div className="space-y-2 rounded-lg bg-surface p-2">
      <p className="text-[12px]">{t("images.delete_confirm")}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => mutate("DELETE")} disabled={disabled || busy} className={`${buttonClass} text-red-600`}>{t("delete")}</button>
        <button type="button" onClick={() => setDeleting(false)} disabled={busy} className={buttonClass}>{t("cancel")}</button>
      </div>
    </div>}
    {error && <p role="alert" className="text-[12px] text-red-600">{t("images.error")}</p>}
  </article>;
}

export function ImageLibrary({ disabled, refreshKey, selectedUrls, onUse, onDeleted }: {
  disabled: boolean; refreshKey: number; selectedUrls: string[];
  onUse: (image: SavedImage) => void; onDeleted: (url: string) => void;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [images, setImages] = useState<SavedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [register, setRegister] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const res = await fetch("/api/images", { cache: "no-store" });
      if (!res.ok) throw new Error("failed");
      setImages(await res.json());
    } catch { setError(true); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (open) void load(); }, [open, refreshKey, load]);
  const save = async () => {
    if (!file || !name.trim()) return;
    if (file.size > 5 * 1024 * 1024) { setSaveError(true); return; }
    setSaving(true); setSaveError(false);
    try {
      let url = pendingUrl;
      if (!url) {
        const form = new FormData(); form.append("file", file);
        const res = await fetch("/api/uploads", { method: "POST", body: form });
        if (!res.ok) throw new Error("upload failed");
        const data = await res.json(); url = data.url; setPendingUrl(url);
      }
      await saveLibraryImage(url!, name.trim(), description);
      setFile(null); setPendingUrl(null); setName(""); setDescription(""); setRegister(false);
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch { setSaveError(true); }
    finally { setSaving(false); }
  };
  const filtered = images.filter(image => `${image.name} ${image.description}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="mt-3 rounded-lg border border-border p-3">
    <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="text-[13px] font-medium text-brand">{t("images.library")} {open ? "▴" : "▾"}</button>
    {open && <div className="mt-3 space-y-3">
      <p className="text-[11px] text-text-muted">{t("images.shared_hint")}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setRegister(!register)} disabled={disabled || saving} className={buttonClass}>{t("images.register")}</button>
        <button type="button" onClick={load} disabled={loading || saving} className={buttonClass}>{t("images.refresh")}</button>
      </div>
      {register && <div className="rounded-lg bg-surface p-3 space-y-2">
        <label className="block text-[12px]">{t("images.file")}<input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" disabled={disabled || saving}
          onChange={e => { const next = e.target.files?.[0] || null; setFile(next); setPendingUrl(null); setName(next?.name || ""); setSaveError(false); }} className="block w-full min-w-0 mt-1 text-[12px]" /></label>
        <input aria-label={t("images.name")} placeholder={t("images.name")} value={name} onChange={e => setName(e.target.value)} maxLength={120} disabled={disabled || saving} className={inputClass} />
        <textarea aria-label={t("images.description")} placeholder={t("images.description")} value={description} onChange={e => setDescription(e.target.value)} maxLength={1000} disabled={disabled || saving} className={inputClass} />
        <p className="text-[11px] text-text-muted">{t("images.formats")}</p>
        <button type="button" onClick={save} disabled={disabled || saving || !file || !name.trim()} className={buttonClass}>{saving ? "…" : t("images.save")}</button>
        {saveError && <p role="alert" className="text-[12px] text-red-600">{t("images.upload_error")}</p>}
      </div>}
      <input aria-label={t("images.search")} placeholder={t("images.search")} value={query} onChange={e => setQuery(e.target.value)} className={inputClass} />
      {loading && <p role="status" className="text-[12px]">{t("loading")}</p>}
      {error && <p role="alert" className="text-[12px] text-red-600">{t("images.error")}</p>}
      {!loading && !error && filtered.length === 0 && <p className="text-[12px] text-text-muted">{t("images.empty")}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[32rem] overflow-y-auto">
        {filtered.map(image => <LibraryCard key={image.id} image={image} disabled={disabled || saving} selected={selectedUrls.includes(image.url)} onUse={onUse} onChanged={load} onDeleted={onDeleted} />)}
      </div>
    </div>}
  </section>;
}
