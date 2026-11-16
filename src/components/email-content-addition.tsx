"use client";

import { ImageLayoutFields } from "./image-layout-fields";
import Image from "next/image";
import { useRef, useState } from "react";
import { appendEmailContent, type AdditionPosition, type AdditionImage } from "@/lib/email-content-addition";
import { ImageLibrary, ImageSavePrompt } from "./image-library";
import { useLocale } from "./locale-provider";

type PendingImage = AdditionImage & { filename: string; libraryStatus: "ask" | "saved" | "dismissed" };

export function EmailContentAddition({ html, disabled, onChange }: { html: string; disabled: boolean; onChange: (html: string) => void }) {
  const { t } = useLocale();
  const [text, setText] = useState("");
  const [position, setPosition] = useState<AdditionPosition>("end");
  const [images, setImages] = useState<PendingImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const uploadingRef = useRef(false);
  const [error, setError] = useState(false);
  const [last, setLast] = useState<{ before: string; after: string } | null>(null);
  const [libraryVersion, setLibraryVersion] = useState(0);
  const busy = disabled || uploading;
  const upload = async (files: File[]) => {
    if (disabled || uploadingRef.current || !files.length) return;
    setError(false);
    if (files.length + images.length > 10 || files.some(file => !["image/png","image/jpeg","image/gif","image/webp"].includes(file.type) || !file.size || file.size > 5*1024*1024)) { setError(true); return; }
    uploadingRef.current = true; setUploading(true);
    try {
      for (const file of files) {
        const form = new FormData(); form.append("file",file);
        const response = await fetch("/api/uploads", { method:"POST", body:form });
        if (!response.ok) throw new Error();
        const data = await response.json();
        setImages(current => [...current,{url:data.url,filename:file.name,description:"",libraryStatus:"ask"}]);
      }
    } catch { setError(true); }
    finally { uploadingRef.current = false; setUploading(false); }
  };
  const add = () => {
    if (busy || uploadingRef.current || (!text.trim() && !images.length)) return;
    setError(false);
    try {
      const after = appendEmailContent(html,text,images,position);
      setLast({before:html,after}); onChange(after); setText(""); setImages([]);
    } catch { setError(true); }
  };
  return <section className="rounded-xl border border-brand/20 bg-white p-5 space-y-3">
    <h3 className="text-sm font-semibold">{t("addition.title")}</h3>
    <p className="text-xs text-text-secondary">{t("addition.hint")}</p>
    <label className="block text-sm">{t("addition.position")}
      <select value={position} disabled={busy} onChange={event => setPosition(event.target.value as AdditionPosition)} className="mt-1 w-full rounded-lg border border-border bg-white p-2">
        <option value="end">{t("addition.end")}</option><option value="start">{t("addition.start")}</option>
      </select>
    </label>
    <label className="block text-sm">{t("addition.text")}
      <textarea value={text} disabled={busy} maxLength={20000} onChange={event => setText(event.target.value)} rows={4} className="mt-1 w-full rounded-lg border border-border p-3" />
    </label>
    <label className="block text-sm">{t("compose.add_image")}
      <input type="file" multiple accept="image/png,image/jpeg,image/gif,image/webp" disabled={busy || images.length >= 10} onChange={event => { const files=Array.from(event.target.files || []); event.target.value=""; void upload(files); }} className="mt-2 block w-full min-w-0 text-sm" />
    </label>
    <p className="text-xs text-text-secondary">{t("addition.images_hint")}</p>
    {images.map(image => <div key={image.url} className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-center gap-3">
        <Image src={image.url} alt={image.description} width={64} height={64} unoptimized className="h-16 w-16 object-contain" />
        <input aria-label={t("images.description")} placeholder={t("images.description")} value={image.description} maxLength={1000} disabled={busy} onChange={event => setImages(current => current.map(item => item.url === image.url ? {...item,description:event.target.value} : item))} className="min-w-0 flex-1 rounded-lg border border-border p-2 text-sm" />
        <button type="button" disabled={busy} onClick={() => setImages(current => current.filter(item => item.url !== image.url))} className="text-xs text-danger">{t("remove")}</button>
      </div>
      <ImageLayoutFields value={image.layout} disabled={busy} onChange={layout => setImages(current => current.map(item => item.url === image.url ? {...item,layout} : item))} />
      {image.libraryStatus === "ask" && <ImageSavePrompt url={image.url} filename={image.filename} description={image.description} disabled={busy}
        onSaved={() => { setImages(current => current.map(item => item.url === image.url ? {...item,libraryStatus:"saved"} : item)); setLibraryVersion(value => value+1); }}
        onSkip={() => setImages(current => current.map(item => item.url === image.url ? {...item,libraryStatus:"dismissed"} : item))} />}
    </div>)}
    <ImageLibrary disabled={busy || images.length >= 10} refreshKey={libraryVersion} selectedUrls={images.map(image => image.url)} onUse={image => setImages(current => current.length >= 10 || current.some(item => item.url === image.url) ? current : [...current,{url:image.url,description:image.description,filename:image.name,libraryStatus:"saved"}])} onDeleted={() => setLibraryVersion(value => value+1)} />
    <div className="flex flex-wrap gap-3 items-center">
      <button type="button" onClick={add} disabled={busy || (!text.trim() && !images.length)} className="rounded-lg bg-brand px-4 py-2 text-sm text-white disabled:opacity-50">{uploading ? t("loading") : t("addition.apply")}</button>
      {last && html === last.after && <button type="button" disabled={busy} onClick={() => { onChange(last.before); setLast(null); }} className="text-sm text-brand">{t("addition.undo")}</button>}
    </div>
    {last && html === last.after && <p role="status" className="text-sm text-brand">{t("addition.success")}</p>}
    {error && <p role="alert" className="text-sm text-danger">{t("addition.error")}</p>}
  </section>;
}
