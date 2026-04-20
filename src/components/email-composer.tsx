"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { Group } from "@/lib/types";
import { useLocale } from "./locale-provider";

interface UploadedImage {
  url: string;
  filename: string;
}

export function EmailComposer() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [draftId, setDraftId] = useState<number | null>(null);
  const [prompt, setPrompt] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<string | null>(null);
  const [showHtml, setShowHtml] = useState(false);
  const [useName, setUseName] = useState(false);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  // Load draft if draftId in URL
  useEffect(() => {
    const id = searchParams.get("draft");
    if (id) {
      fetch(`/api/drafts/${id}`)
        .then((res) => res.json())
        .then((draft) => {
          if (!draft.error) {
            setDraftId(draft.id);
            setPrompt(draft.prompt || "");
            setSubject(draft.subject || "");
            setHtmlContent(draft.html_content || "");
          }
        });
    }
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/groups").then((res) => res.json()).then(setGroups);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setHtmlContent("");
    setSubject("");
    setSendResult(null);
    setSaveResult(null);

    try {
      const res = await fetch("/api/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          useName,
          imageUrls: images.length > 0 ? images.map((img) => img.url) : undefined,
        }),
      });

      if (!res.ok) throw new Error("Failed to generate");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");

      const stripCodeFences = (text: string): string => {
        // Remove leading ```html, ```, or ```anything and trailing ```
        return text
          .replace(/^\s*```[a-zA-Z]*\s*\n?/, "")
          .replace(/\n?\s*```\s*$/, "")
          .trim();
      };

      const decoder = new TextDecoder();
      let fullText = "";
      let subjectExtracted = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        fullText += chunk;

        if (!subjectExtracted && fullText.includes("\n")) {
          const firstLine = fullText.split("\n")[0];
          if (firstLine.toLowerCase().startsWith("subject:")) {
            setSubject(firstLine.replace(/^subject:\s*/i, "").trim());
            subjectExtracted = true;
            const rest = fullText.substring(fullText.indexOf("\n") + 1).replace(/^\n+/, "");
            setHtmlContent(stripCodeFences(rest));
            continue;
          }
        }

        if (subjectExtracted) {
          const rest = fullText.substring(fullText.indexOf("\n") + 1).replace(/^\n+/, "");
          setHtmlContent(stripCodeFences(rest));
        } else {
          setHtmlContent(stripCodeFences(fullText));
        }
      }
    } catch (err) {
      console.error(err);
      setSendResult(t("compose.error_generate"));
    } finally {
      setGenerating(false);
    }
  }, [prompt, useName, images, t]);

  const handleSave = async () => {
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          htmlContent,
          prompt,
          id: draftId || undefined,
        }),
      });
      const draft = await res.json();
      setDraftId(draft.id);
      setSaveResult(t("drafts.saved"));
      // Update URL without reload
      const url = new URL(window.location.href);
      url.searchParams.set("draft", String(draft.id));
      router.replace(url.pathname + url.search);
      setTimeout(() => setSaveResult(null), 2000);
    } catch {
      setSaveResult("Error saving draft");
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    if (!subject || !htmlContent) return;
    setSending(true);
    setSendResult(null);

    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          htmlContent,
          prompt,
          groupId: selectedGroupId ? Number(selectedGroupId) : undefined,
        }),
      });
      const result = await res.json();

      if (result.error) {
        setSendResult(`Error: ${result.error}`);
      } else {
        let msg = t("compose.sent_result", { success: result.success });
        if (result.failed > 0) {
          msg += t("compose.sent_failed", { failed: result.failed });
        }
        setSendResult(msg);
      }
    } catch {
      setSendResult(t("compose.error_send"));
    } finally {
      setSending(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const res = await fetch("/api/uploads", { method: "POST", body: formData });
        const data = await res.json();
        if (data.url) {
          setImages((prev) => [...prev, { url: data.url, filename: data.filename }]);
        }
      } catch {
        // ignore failed uploads
      }
    }
    setUploading(false);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const inputClass = "border border-border rounded-lg px-3 h-[38px] text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all placeholder:text-text-muted";

  return (
    <div className="space-y-5">
      {/* Prompt input */}
      <div className="bg-surface-card border border-border rounded-xl p-5">
        <label className="block text-[12px] font-medium text-text-secondary mb-2">
          {t("compose.prompt_label")}
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t("compose.prompt_placeholder")}
          className="border border-border rounded-lg px-3 py-2.5 text-[13px] bg-white w-full min-h-[120px] resize-y focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all placeholder:text-text-muted"
          disabled={generating}
        />

        {/* Image upload */}
        <div className="mt-3">
          <div className="flex items-center gap-2 mb-2">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              multiple
              onChange={handleImageUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={uploading || generating}
              className="flex items-center gap-1.5 border border-border text-text-secondary px-3 py-1.5 rounded-lg text-[12px] font-medium hover:bg-surface hover:text-text-primary disabled:opacity-40 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
              </svg>
              {uploading ? "..." : t("compose.add_image")}
            </button>
            {images.length > 0 && (
              <span className="text-[11px] text-text-muted">
                {t("compose.images_count", { count: images.length })}
              </span>
            )}
          </div>
          {images.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {images.map((img, i) => (
                <div key={i} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-border">
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1.5 text-[13px] text-text-secondary cursor-pointer select-none mr-2">
            <input
              type="checkbox"
              checked={useName}
              onChange={(e) => setUseName(e.target.checked)}
              className="w-4 h-4 rounded border-border text-brand focus:ring-brand/20"
              disabled={generating}
            />
            {t("compose.use_name")}
          </label>
          <button
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
            className="bg-gradient-to-r from-brand-light to-accent text-white px-6 py-2.5 rounded-lg text-[13px] font-medium hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {generating ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {t("compose.generating")}
              </span>
            ) : (
              t("compose.generate")
            )}
          </button>
          {/* Save draft button - always visible when there's content */}
          {(prompt || subject || htmlContent) && (
            <>
              <div className="h-5 w-px bg-border" />
              <button
                onClick={handleSave}
                disabled={saving}
                className="border border-border text-text-secondary px-4 py-2.5 rounded-lg text-[13px] font-medium hover:bg-surface hover:text-text-primary disabled:opacity-40 transition-colors flex items-center gap-1.5"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                {saving ? "..." : t("drafts.save")}
              </button>
              {saveResult && (
                <span className="text-[12px] text-success font-medium">{saveResult}</span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Subject line */}
      {(subject || htmlContent) && (
        <div className="bg-surface-card border border-border rounded-xl p-5">
          <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
            {t("compose.subject")}
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className={`${inputClass} w-full`}
            placeholder={t("compose.subject_placeholder")}
          />
        </div>
      )}

      {/* Preview */}
      {htmlContent && (
        <div className="bg-surface-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border-light bg-surface">
            <h3 className="text-[12px] font-medium text-text-secondary">{t("compose.preview")}</h3>
            <button
              onClick={() => setShowHtml(!showHtml)}
              className="text-[12px] text-text-muted hover:text-brand font-medium transition-colors"
            >
              {showHtml ? t("compose.visual_preview") : t("compose.view_html")}
            </button>
          </div>

          {showHtml ? (
            <textarea
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              className="w-full px-5 py-4 text-[12px] font-mono min-h-[400px] resize-y bg-white border-0 focus:outline-none text-text-primary"
            />
          ) : (
            <iframe
              srcDoc={htmlContent}
              sandbox=""
              className="w-full min-h-[500px] border-0 bg-white"
              title="Email Preview"
            />
          )}
        </div>
      )}

      {/* Send controls */}
      {htmlContent && !generating && (
        <div className="bg-surface-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="border border-border rounded-lg px-3 h-[38px] text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all"
            >
              <option value="">{t("compose.all_subscribers")}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.subscriber_count})
                </option>
              ))}
            </select>
            <button
              onClick={handleSend}
              disabled={sending || !subject}
              className="bg-brand text-white px-6 py-2.5 rounded-lg text-[13px] font-medium hover:bg-brand-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {sending
                ? t("compose.sending")
                : selectedGroupId
                  ? t("compose.send_group")
                  : t("compose.send_all")}
            </button>
            {sendResult && (
              <p className={`text-[13px] font-medium ${sendResult.startsWith("Error") ? "text-danger" : "text-success"}`}>
                {sendResult}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
