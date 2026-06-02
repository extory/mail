"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { Group } from "@/lib/types";
import { useLocale } from "./locale-provider";

interface UploadedImage {
  url: string;
  filename: string;
  description: string;
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
  const [selectedText, setSelectedText] = useState("");
  const [editInstruction, setEditInstruction] = useState("");
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const htmlTextareaRef = useRef<HTMLTextAreaElement>(null);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const [sendAsImage, setSendAsImage] = useState(false);
  const [imageLink, setImageLink] = useState("");
  const [embedMode, setEmbedMode] = useState<"url" | "cid">("url");

  // Revisions
  interface Revision {
    id: number;
    draft_id: number;
    subject: string;
    html_content: string;
    prompt: string;
    label: string | null;
    created_at: string;
  }
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [showRevisions, setShowRevisions] = useState(false);
  const [activeRevisionId, setActiveRevisionId] = useState<number | null>(null);
  const lastSnapshotRef = useRef<string>("");
  const [showSavePrompt, setShowSavePrompt] = useState(false);

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

  // Load revisions whenever draftId changes
  const loadRevisions = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/drafts/${id}/revisions`);
      if (res.ok) setRevisions(await res.json());
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (draftId !== null) loadRevisions(draftId);
  }, [draftId, loadRevisions]);

  // Snapshot the current draft state into the revisions table
  const snapshotRevision = useCallback(
    async (label?: string) => {
      if (draftId === null) return;
      if (!subject && !htmlContent) return;
      const fingerprint = `${subject}|${htmlContent}`;
      if (fingerprint === lastSnapshotRef.current) return;
      lastSnapshotRef.current = fingerprint;
      try {
        const res = await fetch(`/api/drafts/${draftId}/revisions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject, htmlContent, prompt, label }),
        });
        if (res.ok) {
          const rev = await res.json();
          setRevisions((prev) => [rev, ...prev]);
        }
      } catch {
        // best-effort
      }
    },
    [draftId, subject, htmlContent, prompt]
  );

  // Auto-save draft so revisions have something to attach to
  const ensureDraftId = useCallback(async (): Promise<number | null> => {
    if (draftId !== null) return draftId;
    try {
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, htmlContent, prompt }),
      });
      const draft = await res.json();
      if (draft?.id) {
        setDraftId(draft.id);
        const url = new URL(window.location.href);
        url.searchParams.set("draft", String(draft.id));
        router.replace(url.pathname + url.search);
        return draft.id;
      }
    } catch {
      // ignore
    }
    return null;
  }, [draftId, subject, htmlContent, prompt, router]);

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
          images: images.length > 0
            ? images.map((img) => ({ url: img.url, description: img.description || undefined }))
            : undefined,
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
    // After generation completes, persist a revision so the user can revert.
    try {
      const id = await ensureDraftId();
      if (id !== null) {
        // Re-read latest state via a microtask delay since setHtmlContent above
        // may not have flushed yet — snapshot uses current closure values.
        setTimeout(() => snapshotRevision("generated"), 100);
      }
    } catch {
      // best-effort
    }
    // Ask the user whether to keep this as a draft.
    setShowSavePrompt(true);
  }, [prompt, useName, images, t, ensureDraftId, snapshotRevision]);

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

  const renderHtmlToImage = async (): Promise<string | null> => {
    const iframe = previewIframeRef.current;
    if (!iframe || !iframe.contentDocument) return null;

    const html2canvas = (await import("html2canvas")).default;
    const target = iframe.contentDocument.body;
    const canvas = await html2canvas(target, {
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
      scale: 2, // higher resolution for retina
      width: target.scrollWidth,
      height: target.scrollHeight,
      windowWidth: target.scrollWidth,
      windowHeight: target.scrollHeight,
    });

    return new Promise<string | null>((resolve) => {
      canvas.toBlob(async (blob) => {
        if (!blob) return resolve(null);
        const formData = new FormData();
        formData.append("file", blob, `email-${Date.now()}.png`);
        try {
          const res = await fetch("/api/uploads", { method: "POST", body: formData });
          const data = await res.json();
          resolve(data.url || null);
        } catch {
          resolve(null);
        }
      }, "image/png", 0.95);
    });
  };

  const restoreRevision = useCallback((rev: Revision) => {
    setSubject(rev.subject);
    setHtmlContent(rev.html_content);
    if (rev.prompt) setPrompt(rev.prompt);
    setActiveRevisionId(rev.id);
    // Reset the fingerprint so the next change can snapshot again.
    lastSnapshotRef.current = `${rev.subject}|${rev.html_content}`;
  }, []);

  const normalizeLink = (url: string): string | null => {
    const trimmed = url.trim();
    if (!trimmed) return null;
    // Add https:// if no protocol
    if (!/^https?:\/\//i.test(trimmed) && !/^mailto:/i.test(trimmed)) {
      return `https://${trimmed}`;
    }
    return trimmed;
  };

  const buildImageOnlyHtml = (imageUrl: string, originalSubject: string, linkUrl?: string | null): string => {
    const absoluteUrl = imageUrl.startsWith("/") ? `${window.location.origin}${imageUrl}` : imageUrl;
    const altText = originalSubject.replace(/"/g, "&quot;");
    const imgTag = `<img src="${absoluteUrl}" alt="${altText}" style="max-width:100%;height:auto;display:block;margin:0 auto;border-radius:8px;border:0;" />`;
    const content = linkUrl
      ? `<a href="${linkUrl.replace(/"/g, "&quot;")}" target="_blank" style="text-decoration:none;display:inline-block;">${imgTag}</a>`
      : imgTag;
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:20px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;max-width:640px;width:100%;">
    <tr>
      <td style="text-align:center;">
        ${content}
      </td>
    </tr>
  </table>
</body></html>`;
  };

  const handleSend = async () => {
    if (!subject || !htmlContent) return;
    setSending(true);
    setSendResult(null);

    try {
      let finalHtml = htmlContent;

      if (sendAsImage) {
        if (showHtml) {
          setSendResult(t("compose.image_mode_needs_preview"));
          setSending(false);
          return;
        }
        const imageUrl = await renderHtmlToImage();
        if (!imageUrl) {
          setSendResult(t("compose.image_render_failed"));
          setSending(false);
          return;
        }
        finalHtml = buildImageOnlyHtml(imageUrl, subject, normalizeLink(imageLink));
      }

      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          htmlContent: finalHtml,
          prompt,
          groupId: selectedGroupId ? Number(selectedGroupId) : undefined,
          embedImages: embedMode === "cid",
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

  const MAX_UPLOAD_SIZE = 4.5 * 1024 * 1024; // 4.5MB to be safe under 5MB limit
  const MAX_DIMENSION = 1920; // Max width/height in pixels

  const resizeImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Failed to read file"));

      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        // Scale down if larger than MAX_DIMENSION
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported"));
        ctx.drawImage(img, 0, 0, width, height);

        // Use JPEG for resized output (better compression), PNG if original was PNG and small
        const type = file.type === "image/png" || file.type === "image/webp" ? file.type : "image/jpeg";
        let quality = 0.85;

        const tryExport = () => {
          canvas.toBlob(
            (blob) => {
              if (!blob) return reject(new Error("Canvas export failed"));
              if (blob.size > MAX_UPLOAD_SIZE && quality > 0.4) {
                quality -= 0.1;
                tryExport();
              } else {
                resolve(blob);
              }
            },
            type,
            quality
          );
        };
        tryExport();
      };
      img.onerror = () => reject(new Error("Failed to load image"));

      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        let uploadBlob: Blob = file;
        let uploadName = file.name;

        // Resize if too large
        if (file.size > MAX_UPLOAD_SIZE) {
          uploadBlob = await resizeImage(file);
          // Change extension to jpg if we re-encoded to jpeg
          if (uploadBlob.type === "image/jpeg" && !file.name.toLowerCase().match(/\.jpe?g$/)) {
            uploadName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
          }
        }

        const formData = new FormData();
        formData.append("file", uploadBlob, uploadName);
        const res = await fetch("/api/uploads", { method: "POST", body: formData });
        const data = await res.json();
        if (data.url) {
          setImages((prev) => [...prev, { url: data.url, filename: data.filename, description: "" }]);
        }
      } catch (err) {
        console.error("Upload failed:", err);
      }
    }
    setUploading(false);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const updateImageDescription = (index: number, description: string) => {
    setImages((prev) => prev.map((img, i) => (i === index ? { ...img, description } : img)));
  };

  // Selection handling for inline editing
  const handleTextareaSelect = () => {
    const ta = htmlTextareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    if (start === end) {
      setSelectedText("");
      setSelectionRange(null);
      return;
    }
    setSelectedText(htmlContent.substring(start, end));
    setSelectionRange({ start, end });
    setEditError(null);
  };

  // Listen for selection from iframe via postMessage
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "preview-selection" && typeof e.data.text === "string") {
        setSelectedText(e.data.text);
        setSelectionRange(null); // No exact range from visual preview
        setEditError(null);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // Inject selection listener into iframe
  useEffect(() => {
    if (showHtml || !htmlContent) return;
    const iframe = previewIframeRef.current;
    if (!iframe) return;

    const tryInject = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc) return;
        const script = doc.createElement("script");
        script.textContent = `
          document.addEventListener('mouseup', function() {
            const sel = window.getSelection();
            const text = sel ? sel.toString() : '';
            if (text.trim().length > 0) {
              parent.postMessage({ type: 'preview-selection', text: text }, '*');
            }
          });
        `;
        doc.body?.appendChild(script);
      } catch {
        // sandboxed iframes block this — that's fine, user can switch to HTML view
      }
    };

    iframe.addEventListener("load", tryInject);
    // Try immediately too in case already loaded
    tryInject();
    return () => iframe.removeEventListener("load", tryInject);
  }, [htmlContent, showHtml]);

  const applyEdit = async () => {
    if (!selectedText || !editInstruction.trim()) return;
    setEditing(true);
    setEditError(null);
    try {
      const res = await fetch("/api/compose/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selection: selectedText, instruction: editInstruction.trim() }),
      });
      const data = await res.json();
      if (data.error) {
        setEditError(data.error);
        return;
      }
      // Replace selected text in htmlContent
      if (selectionRange) {
        // textarea-based: exact replacement by index
        const newContent =
          htmlContent.substring(0, selectionRange.start) +
          data.result +
          htmlContent.substring(selectionRange.end);
        setHtmlContent(newContent);
      } else {
        // iframe-based: first occurrence replacement
        const idx = htmlContent.indexOf(selectedText);
        if (idx === -1) {
          setEditError(t("compose.edit_not_found"));
          return;
        }
        const newContent =
          htmlContent.substring(0, idx) +
          data.result +
          htmlContent.substring(idx + selectedText.length);
        setHtmlContent(newContent);
      }
      setSelectedText("");
      setSelectionRange(null);
      setEditInstruction("");
      // Snapshot after partial edit so the user can roll back this change.
      setTimeout(() => snapshotRevision("edited"), 100);
    } catch {
      setEditError(t("compose.edit_failed"));
    } finally {
      setEditing(false);
    }
  };

  const cancelEdit = () => {
    setSelectedText("");
    setSelectionRange(null);
    setEditInstruction("");
    setEditError(null);
  };

  const inputClass = "border border-border rounded-lg px-3 h-[38px] text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all placeholder:text-text-muted";

  const hasOutput = Boolean(subject || htmlContent);

  return (
    <div className={`grid gap-5 ${hasOutput ? "lg:grid-cols-[minmax(360px,520px)_1fr]" : "lg:grid-cols-1"}`}>
      {/* LEFT: Prompt + options */}
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
          className="border border-border rounded-lg px-3 py-2.5 text-[13px] bg-white w-full min-h-[240px] resize-y focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all placeholder:text-text-muted"
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
            <div className="space-y-2 mt-2">
              {images.map((img, i) => (
                <div key={i} className="flex items-start gap-3 p-2 border border-border rounded-lg bg-surface/50">
                  <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-border flex-shrink-0 bg-white">
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={img.description}
                      onChange={(e) => updateImageDescription(i, e.target.value)}
                      placeholder={t("compose.image_desc_placeholder")}
                      disabled={generating}
                      className="w-full border border-border rounded-md px-2.5 h-[32px] text-[12px] bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all placeholder:text-text-muted"
                    />
                    <p className="text-[10px] text-text-muted mt-1 truncate">{img.filename}</p>
                  </div>
                  <button
                    onClick={() => removeImage(i)}
                    disabled={generating}
                    className="text-text-muted hover:text-danger p-1 transition-colors flex-shrink-0"
                    title={t("remove")}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      </div>

      {/* RIGHT: Subject + Preview + Send + Revisions */}
      {hasOutput && (
      <div className="space-y-5">

      {/* Subject line */}
      {(subject || htmlContent) && (
        <div className="bg-surface-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[12px] font-medium text-text-secondary">
              {t("compose.subject")}
            </label>
            <button
              type="button"
              onClick={() => setShowRevisions(!showRevisions)}
              className={`text-[12px] font-medium transition-colors flex items-center gap-1 ${
                showRevisions ? "text-brand" : "text-text-muted hover:text-brand"
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
              {t("compose.revisions")}{revisions.length > 0 ? ` (${revisions.length})` : ""}
            </button>
          </div>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className={`${inputClass} w-full`}
            placeholder={t("compose.subject_placeholder")}
          />
        </div>
      )}

      {/* Revisions panel */}
      {showRevisions && hasOutput && (
        <div className="bg-surface-card border border-brand/30 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border-light bg-surface">
            <h3 className="text-[12px] font-medium text-text-secondary">{t("compose.revisions_title")}</h3>
            <button
              onClick={() => setShowRevisions(false)}
              className="text-[12px] text-text-muted hover:text-text-primary font-medium transition-colors"
            >
              {t("close")}
            </button>
          </div>
          {revisions.length === 0 ? (
            <p className="text-[12px] text-text-muted p-5">{t("compose.revisions_empty")}</p>
          ) : (
            <ul className="max-h-[300px] overflow-y-auto divide-y divide-border-light">
              {revisions.map((rev) => (
                <li
                  key={rev.id}
                  className={`px-5 py-3 hover:bg-surface/50 transition-colors cursor-pointer ${
                    activeRevisionId === rev.id ? "bg-brand/[0.04]" : ""
                  }`}
                  onClick={() => restoreRevision(rev)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-text-primary truncate">
                        {rev.subject || t("drafts.no_subject")}
                      </p>
                      <p className="text-[11px] text-text-muted mt-0.5">
                        {new Date(rev.created_at).toLocaleString()}
                        {rev.label ? ` · ${rev.label}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); restoreRevision(rev); }}
                      className="text-brand hover:text-brand-dark text-[12px] font-medium flex-shrink-0 transition-colors"
                    >
                      {t("compose.restore")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
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
              ref={htmlTextareaRef}
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              onSelect={handleTextareaSelect}
              onMouseUp={handleTextareaSelect}
              onKeyUp={handleTextareaSelect}
              className="w-full px-5 py-4 text-[12px] font-mono min-h-[400px] resize-y bg-white border-0 focus:outline-none text-text-primary"
            />
          ) : (
            <iframe
              ref={previewIframeRef}
              srcDoc={htmlContent}
              sandbox="allow-same-origin allow-scripts"
              className="w-full min-h-[500px] border-0 bg-white"
              title="Email Preview"
            />
          )}
        </div>
      )}

      {/* Selection edit panel */}
      {htmlContent && selectedText && (
        <div className="bg-surface-card border border-brand/30 rounded-xl p-5 shadow-[0_4px_24px_rgba(21,93,252,0.08)]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[13px] font-semibold text-text-primary flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              {t("compose.edit_selection")}
            </h3>
            <button
              onClick={cancelEdit}
              className="text-text-muted hover:text-text-primary text-[12px] transition-colors"
            >
              {t("cancel")}
            </button>
          </div>
          <div className="bg-surface rounded-lg p-3 mb-3 text-[12px] text-text-secondary max-h-24 overflow-y-auto whitespace-pre-wrap break-words">
            {selectedText.length > 300 ? selectedText.slice(0, 300) + "..." : selectedText}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={editInstruction}
              onChange={(e) => setEditInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && editInstruction.trim() && !editing) applyEdit();
              }}
              placeholder={t("compose.edit_placeholder")}
              className="flex-1 border border-border rounded-lg px-3 h-[38px] text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all placeholder:text-text-muted"
              autoFocus
              disabled={editing}
            />
            <button
              onClick={applyEdit}
              disabled={editing || !editInstruction.trim()}
              className="bg-brand text-white px-5 h-[38px] rounded-lg text-[13px] font-medium hover:bg-brand-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
            >
              {editing ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : t("compose.apply_edit")}
            </button>
          </div>
          {editError && (
            <p className="mt-2 text-[12px] text-danger font-medium">{editError}</p>
          )}
        </div>
      )}

      {/* Send controls */}
      {htmlContent && !generating && (
        <div className="bg-surface-card border border-border rounded-xl p-5 space-y-3">
          <label className="flex items-start gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={sendAsImage}
              onChange={(e) => setSendAsImage(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded border-border text-brand focus:ring-brand/20"
              disabled={sending}
            />
            <div>
              <span className="text-[13px] text-text-primary font-medium">{t("compose.send_as_image")}</span>
              <p className="text-[11px] text-text-muted mt-0.5">{t("compose.send_as_image_desc")}</p>
            </div>
          </label>
          {sendAsImage && (
            <div className="ml-6 pl-1">
              <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
                {t("compose.image_link")}
              </label>
              <input
                type="text"
                value={imageLink}
                onChange={(e) => setImageLink(e.target.value)}
                placeholder={t("compose.image_link_placeholder")}
                className="w-full max-w-md border border-border rounded-lg px-3 h-[38px] text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all placeholder:text-text-muted"
                disabled={sending}
              />
              <p className="text-[11px] text-text-muted mt-1">{t("compose.image_link_hint")}</p>
            </div>
          )}

          {/* Image embed mode */}
          <div className="pt-3 border-t border-border-light">
            <p className="text-[12px] font-medium text-text-secondary mb-2">
              {t("compose.embed_mode")}
            </p>
            <div className="space-y-2">
              <label className="flex items-start gap-2 cursor-pointer select-none">
                <input
                  type="radio"
                  name="embed-mode"
                  value="url"
                  checked={embedMode === "url"}
                  onChange={() => setEmbedMode("url")}
                  className="w-4 h-4 mt-0.5 border-border text-brand focus:ring-brand/20"
                  disabled={sending}
                />
                <div>
                  <span className="text-[13px] text-text-primary font-medium">{t("compose.embed_url")}</span>
                  <p className="text-[11px] text-text-muted mt-0.5">{t("compose.embed_url_desc")}</p>
                </div>
              </label>
              <label className="flex items-start gap-2 cursor-pointer select-none">
                <input
                  type="radio"
                  name="embed-mode"
                  value="cid"
                  checked={embedMode === "cid"}
                  onChange={() => setEmbedMode("cid")}
                  className="w-4 h-4 mt-0.5 border-border text-brand focus:ring-brand/20"
                  disabled={sending}
                />
                <div>
                  <span className="text-[13px] text-text-primary font-medium">{t("compose.embed_cid")}</span>
                  <p className="text-[11px] text-text-muted mt-0.5">{t("compose.embed_cid_desc")}</p>
                </div>
              </label>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap pt-2 border-t border-border-light">
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
              className="bg-brand text-white px-6 py-2.5 rounded-lg text-[13px] font-medium hover:bg-brand-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {sending && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
              {sending
                ? (sendAsImage ? t("compose.rendering_image") : t("compose.sending"))
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
      )}

      {/* Save draft prompt — appears once after each successful generation */}
      {showSavePrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
          onClick={() => setShowSavePrompt(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-light to-accent flex items-center justify-center mb-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
            </div>
            <h3 className="text-[16px] font-semibold text-text-primary mb-1">
              {t("compose.save_prompt_title")}
            </h3>
            <p className="text-[13px] text-text-secondary leading-relaxed mb-5">
              {t("compose.save_prompt_desc")}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSavePrompt(false)}
                disabled={saving}
                className="flex-1 border border-border text-text-secondary px-4 h-10 rounded-lg text-[13px] font-medium hover:bg-surface hover:text-text-primary disabled:opacity-40 transition-colors"
              >
                {t("compose.save_prompt_dismiss")}
              </button>
              <button
                onClick={async () => {
                  await handleSave();
                  setShowSavePrompt(false);
                }}
                disabled={saving}
                className="flex-1 bg-brand text-white px-4 h-10 rounded-lg text-[13px] font-semibold hover:bg-brand-dark disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5"
              >
                {saving ? "..." : t("compose.save_prompt_save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
