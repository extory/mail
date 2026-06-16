"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { Group } from "@/lib/types";
import { useLocale } from "./locale-provider";
import { htmlToPlainLines, diffLines, diffStats, type DiffLine } from "@/lib/diff";

interface UploadedImage {
  url: string;
  filename: string;
  description: string;
}

interface Revision {
  id: number;
  draft_id: number;
  subject: string;
  html_content: string;
  prompt: string;
  label: string | null;
  note: string | null;
  created_at: string;
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
  // When true the visual iframe becomes contentEditable so the user can
  // type directly into the preview and have it sync back to htmlContent.
  const [inlineEditMode, setInlineEditMode] = useState(false);
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
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [showRevisions, setShowRevisions] = useState(false);
  const [activeRevisionId, setActiveRevisionId] = useState<number | null>(null);
  const [expandedRevId, setExpandedRevId] = useState<number | null>(null);
  const lastSnapshotRef = useRef<string>("");
  // Pending snapshot signal — consumed by an effect that fires after the
  // related state updates have flushed.
  const pendingSnapshotRef = useRef<{ label: string; note?: string } | null>(null);
  const [snapshotTick, setSnapshotTick] = useState(0);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [hasManualChanges, setHasManualChanges] = useState(false);
  const [savingRevision, setSavingRevision] = useState(false);
  const [showSendKeepPrompt, setShowSendKeepPrompt] = useState(false);
  const [postSendLoading, setPostSendLoading] = useState(false);
  // Pending send arguments cached while the keep/clear dialog is open
  const sendArgsRef = useRef<{ groupId?: number; finalHtml: string } | null>(null);

  // Load draft from URL only on first mount. After that, we don't want
  // URL changes (e.g. from ensureDraftId writing the new id) to clobber
  // the working subject/html the user is editing.
  const initialDraftLoadDone = useRef(false);
  useEffect(() => {
    if (initialDraftLoadDone.current) return;
    initialDraftLoadDone.current = true;
    const id = searchParams.get("draft");
    if (!id) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    async (label?: string, note?: string) => {
      if (draftId === null) return;
      if (!subject && !htmlContent) return;
      const fingerprint = `${subject}|${htmlContent}`;
      if (fingerprint === lastSnapshotRef.current) return;
      lastSnapshotRef.current = fingerprint;
      try {
        const res = await fetch(`/api/drafts/${draftId}/revisions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject, htmlContent, prompt, label, note }),
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
  // Accepts the latest payload directly so callers don't depend on a
  // closure capture that may be stale (e.g. when called immediately
  // after a setState).
  const ensureDraftId = useCallback(
    async (override?: { subject?: string; htmlContent?: string; prompt?: string }): Promise<number | null> => {
      if (draftId !== null) return draftId;
      try {
        const payload = {
          subject: override?.subject ?? subject,
          htmlContent: override?.htmlContent ?? htmlContent,
          prompt: override?.prompt ?? prompt,
        };
        const res = await fetch("/api/drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const draft = await res.json();
        if (draft?.id) {
          setDraftId(draft.id);
          // Update URL silently without firing the draft-loader effect.
          const url = new URL(window.location.href);
          url.searchParams.set("draft", String(draft.id));
          window.history.replaceState(window.history.state, "", url.pathname + url.search);
          return draft.id;
        }
      } catch {
        // ignore
      }
      return null;
    },
    [draftId, subject, htmlContent, prompt]
  );

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

      // Only strips fences when the text actually looks fenced. Avoids
      // accidentally trimming legitimate content.
      const stripCodeFences = (text: string): string => {
        let out = text;
        if (/^\s*```/.test(out)) {
          out = out.replace(/^\s*```[a-zA-Z]*\s*\n?/, "");
        }
        if (/```\s*$/.test(out)) {
          out = out.replace(/\n?\s*```\s*$/, "");
        }
        return out;
      };

      // Split AI output into {subject, html}. Body is always returned —
      // if a header is missing we keep the full text as html and pick a
      // subject from <title>, the first heading, or the prompt.
      const splitSubjectAndHtml = (raw: string): { subject: string; html: string } => {
        const cleaned = stripCodeFences(raw).trim();
        const headerMatch = cleaned.match(/^[ \t]*subject:\s*([^\n\r]*)(?:\r?\n)+([\s\S]*)$/i);
        if (headerMatch) {
          const subj = headerMatch[1].trim();
          const body = headerMatch[2];
          // Safety: never lose the body to an over-aggressive match.
          if (body.trim().length > 0) {
            return { subject: subj, html: body };
          }
        }
        // No usable header — keep the full payload as html and derive
        // a subject from the content.
        const titleMatch = cleaned.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch) return { subject: titleMatch[1].trim(), html: cleaned };
        const headingMatch = cleaned.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i);
        if (headingMatch) {
          const subj = headingMatch[1].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
          if (subj) return { subject: subj.slice(0, 120), html: cleaned };
        }
        const fallback = prompt.replace(/\s+/g, " ").trim().slice(0, 80);
        return { subject: fallback, html: cleaned };
      };

      const decoder = new TextDecoder();
      let fullText = "";
      let lastGoodHtml = "";
      let lastFlushAt = 0;
      const FLUSH_INTERVAL = 150; // ms — throttles preview re-renders during streaming

      const flush = (force = false) => {
        const now = Date.now();
        if (!force && now - lastFlushAt < FLUSH_INTERVAL) return;
        lastFlushAt = now;

        const headerMatch = fullText.match(/^[ \t]*subject:\s*([^\n\r]*)(?:\r?\n)+([\s\S]*)$/i);
        if (headerMatch) {
          const newSubject = headerMatch[1].trim();
          const newHtml = stripCodeFences(headerMatch[2]);
          if (newSubject) setSubject(newSubject);
          if (newHtml.length >= lastGoodHtml.length || newHtml.length > 0) {
            setHtmlContent(newHtml);
            lastGoodHtml = newHtml;
          }
        } else {
          const newHtml = stripCodeFences(fullText);
          if (newHtml.length >= lastGoodHtml.length || newHtml.length > 0) {
            setHtmlContent(newHtml);
            lastGoodHtml = newHtml;
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        fullText += chunk;
        flush();
      }
      flush(true);

      // Final reconciliation: only commit if the new split actually has
      // a body. Otherwise keep whatever the stream produced.
      const finalSplit = splitSubjectAndHtml(fullText);
      let finalSubject = finalSplit.subject;
      let finalHtmlOut = finalSplit.html;
      if (finalHtmlOut.trim().length === 0 && lastGoodHtml.length > 0) {
        finalHtmlOut = lastGoodHtml;
      }
      if (finalSubject) setSubject(finalSubject);
      else finalSubject = "";
      if (finalHtmlOut.trim().length > 0) setHtmlContent(finalHtmlOut);

      // Persist a revision so the user can revert. Pass the freshly
      // computed values so we don't depend on React having flushed
      // the setState calls above.
      try {
        const id = await ensureDraftId({
          subject: finalSubject,
          htmlContent: finalHtmlOut,
          prompt,
        });
        if (id !== null) {
          pendingSnapshotRef.current = { label: "generated", note: prompt };
          setSnapshotTick((n) => n + 1);
        }
      } catch {
        // best-effort
      }
    } catch (err) {
      console.error(err);
      setSendResult(t("compose.error_generate"));
    } finally {
      setGenerating(false);
    }
    // Ask the user whether to keep this as a draft.
    setShowSavePrompt(true);
  }, [prompt, useName, images, t, ensureDraftId]);

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
    setHasManualChanges(false);
  }, []);

  // Process any pending snapshot once state has settled
  useEffect(() => {
    if (snapshotTick === 0) return;
    const pending = pendingSnapshotRef.current;
    if (!pending) return;
    pendingSnapshotRef.current = null;
    // Run on the next microtask so React has flushed both the setSubject
    // and setHtmlContent calls that immediately preceded the tick bump.
    Promise.resolve().then(() => snapshotRevision(pending.label, pending.note));
  }, [snapshotTick, snapshotRevision]);

  // Track manual edits — whenever subject/html diverges from the last snapshot
  useEffect(() => {
    if (!subject && !htmlContent) {
      setHasManualChanges(false);
      return;
    }
    const fingerprint = `${subject}|${htmlContent}`;
    setHasManualChanges(fingerprint !== lastSnapshotRef.current);
  }, [subject, htmlContent]);

  const saveRevisionManually = useCallback(async () => {
    if (savingRevision || generating) return;
    setSavingRevision(true);
    try {
      const id = await ensureDraftId();
      if (id !== null) {
        await snapshotRevision("manual");
        setHasManualChanges(false);
      }
    } finally {
      setSavingRevision(false);
    }
  }, [ensureDraftId, snapshotRevision, savingRevision, generating]);

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
    if (!subject || !htmlContent) {
      setSendResult(`Error: ${!subject ? "subject" : "content"} is empty`);
      return;
    }
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

      const sentCount: number = Number(result?.success ?? 0);
      const failedCount: number = Number(result?.failed ?? 0);
      // Treat the request as a failure if the API returned an error message
      // OR if zero recipients actually went out.
      if (result.error || sentCount === 0) {
        const reason = result.error
          ? result.error
          : failedCount > 0
            ? t("compose.sent_failed_all", { failed: failedCount })
            : t("compose.sent_none");
        setSendResult(`Error: ${reason}`);
      } else {
        let msg = t("compose.sent_result", { success: sentCount });
        if (failedCount > 0) {
          msg += t("compose.sent_failed", { failed: failedCount });
        }
        setSendResult(msg);
        // Ask whether to keep or clear the revision history for this draft.
        if (draftId !== null) setShowSendKeepPrompt(true);
      }
    } catch {
      setSendResult(t("compose.error_send"));
    } finally {
      setSending(false);
    }
  };

  const handleClearRevisions = async () => {
    if (draftId === null) {
      setShowSendKeepPrompt(false);
      return;
    }
    setPostSendLoading(true);
    try {
      // Delete the draft entirely — revisions cascade-delete via FK
      await fetch(`/api/drafts/${draftId}`, { method: "DELETE" });
      setRevisions([]);
      setDraftId(null);
      setActiveRevisionId(null);
      // Clear the draft id from the URL so a fresh compose starts next time
      const url = new URL(window.location.href);
      url.searchParams.delete("draft");
      router.replace(url.pathname + (url.search || ""));
    } catch {
      // ignore
    } finally {
      setPostSendLoading(false);
      setShowSendKeepPrompt(false);
    }
  };

  const handleKeepRevisions = () => {
    setShowSendKeepPrompt(false);
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

  // Selection context captured from the iframe — used to resolve the
  // selection back to an exact slice of the source htmlContent.
  const [selectionContext, setSelectionContext] = useState<{
    before: string;
    after: string;
    blockHtml: string | null;
  } | null>(null);

  // Listen for messages from the iframe (selection + inline edits)
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const data = e.data as
        | {
            type?: string;
            text?: string;
            before?: string;
            after?: string;
            blockHtml?: string;
            html?: string;
          }
        | null;
      if (!data?.type) return;

      if (data.type === "preview-selection") {
        const text = typeof data.text === "string" ? data.text : "";
        const before = typeof data.before === "string" ? data.before : "";
        const after = typeof data.after === "string" ? data.after : "";
        const blockHtml = typeof data.blockHtml === "string" ? data.blockHtml : null;
        if (!text.trim()) return;
        setSelectedText(text);
        setSelectionRange(null);
        setSelectionContext({ before, after, blockHtml });
        setEditError(null);
      } else if (data.type === "preview-edited") {
        // User typed directly into the preview — sync back to htmlContent
        const html = typeof data.html === "string" ? data.html : null;
        if (html === null) return;
        // Mark that the next htmlContent update came from inside the
        // iframe so the iframe-sync effect below doesn't re-set srcDoc
        // and yank the cursor mid-typing.
        inlineEditOriginRef.current = true;
        setHtmlContent(html);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // When htmlContent updates from outside (AI generate / restore / etc.)
  // we DO want to re-render the iframe. When it updates because the user
  // typed directly into the iframe, we DON'T (would reset the cursor).
  const inlineEditOriginRef = useRef(false);
  const [iframeSrcDoc, setIframeSrcDoc] = useState<string>("");
  useEffect(() => {
    if (inlineEditOriginRef.current) {
      // Edit came from the iframe — don't bounce it back.
      inlineEditOriginRef.current = false;
      return;
    }
    setIframeSrcDoc(htmlContent);
  }, [htmlContent]);

  // Inject selection listener + visual highlight into iframe
  useEffect(() => {
    if (showHtml || !htmlContent) return;
    const iframe = previewIframeRef.current;
    if (!iframe) return;

    const INJECTED_MARK = "data-mail-svc-injected";

    // The block below runs inside the iframe — defined here as a function
    // so its source text can be stringified and re-injected on every load.
    const iframeScript = function () {
      const d: Document = document;
      const w: Window = window;
      if (d.body.getAttribute("data-mail-svc-injected") === "1") return;
      d.body.setAttribute("data-mail-svc-injected", "1");

      const style = d.createElement("style");
      style.textContent =
        ".__mailsvc-highlight { background: rgba(253, 199, 0, 0.35);" +
        " outline: 2px solid #FDC700; outline-offset: 1px;" +
        " border-radius: 2px; transition: background 0.15s ease; }";
      d.head?.appendChild(style);

      const blockTags = new Set([
        "P","DIV","LI","H1","H2","H3","H4","H5","H6","BLOCKQUOTE","TD","TR",
        "SECTION","ARTICLE","HEADER","FOOTER",
      ]);
      const nearestBlock = (node: Node | null): Element => {
        let n: Node | null = node;
        while (n && n.nodeType !== 1) n = n.parentNode;
        let el = n as Element | null;
        while (el && el !== d.body && !blockTags.has((el.tagName || "").toUpperCase())) {
          el = el.parentElement;
        }
        return el || d.body;
      };

      let highlightSpans: HTMLElement[] = [];
      const clearHighlight = () => {
        for (const s of highlightSpans) {
          const parent = s.parentNode;
          if (!parent) continue;
          while (s.firstChild) parent.insertBefore(s.firstChild, s);
          parent.removeChild(s);
          (parent as Element).normalize?.();
        }
        highlightSpans = [];
      };

      const applyHighlight = (range: Range) => {
        try {
          const root =
            range.commonAncestorContainer.nodeType === 1
              ? (range.commonAncestorContainer as Element)
              : (range.commonAncestorContainer.parentNode as Element);
          const walker = d.createTreeWalker(root, NodeFilter.SHOW_TEXT);
          const nodes: Text[] = [];
          let n = walker.nextNode() as Text | null;
          while (n) {
            if (range.intersectsNode(n)) nodes.push(n);
            n = walker.nextNode() as Text | null;
          }
          for (const tn of nodes) {
            const start = tn === range.startContainer ? range.startOffset : 0;
            const end =
              tn === range.endContainer ? range.endOffset : (tn.nodeValue?.length ?? 0);
            if (end <= start) continue;
            const value = tn.nodeValue ?? "";
            const before = value.slice(0, start);
            const middle = value.slice(start, end);
            const after = value.slice(end);
            if (!middle) continue;
            const span = d.createElement("span");
            span.className = "__mailsvc-highlight";
            span.textContent = middle;
            const parent = tn.parentNode!;
            if (before) {
              tn.nodeValue = before;
              parent.insertBefore(span, tn.nextSibling);
              if (after) parent.insertBefore(d.createTextNode(after), span.nextSibling);
            } else {
              parent.replaceChild(span, tn);
              if (after) parent.insertBefore(d.createTextNode(after), span.nextSibling);
            }
            highlightSpans.push(span);
          }
        } catch {}
      };

      // Pending selection — captured on mouseup, only reported to the
      // parent when the user actually clicks the floating "Edit" button.
      let pendingRange: Range | null = null;
      let pendingText = "";

      const reportPendingSelection = () => {
        if (!pendingRange || !pendingText.trim()) return;
        const root = d.body;
        const fullText = (root as HTMLElement).innerText || root.textContent || "";
        const startOffset = fullText.indexOf(pendingText);
        let before = "";
        let after = "";
        if (startOffset !== -1) {
          before = fullText.slice(Math.max(0, startOffset - 80), startOffset);
          after = fullText.slice(
            startOffset + pendingText.length,
            startOffset + pendingText.length + 80
          );
        }
        let blockHtml: string | null = null;
        const block = nearestBlock(pendingRange.startContainer);
        const outer = (block as HTMLElement).outerHTML;
        if (outer && outer.length < 4000) blockHtml = outer;

        w.parent.postMessage(
          { type: "preview-selection", text: pendingText, before, after, blockHtml },
          "*"
        );
      };

      // Label text the parent sets via 'preview-set-pill-label' before any
      // selection is made. Defaults to "Edit" so the pill never appears blank.
      let pillLabel = "Edit";

      // Floating "Edit" pill that appears just above the selection.
      let editPill: HTMLDivElement | null = null;
      const removeEditPill = () => {
        if (editPill && editPill.parentNode) editPill.parentNode.removeChild(editPill);
        editPill = null;
      };
      const showEditPill = (range: Range) => {
        removeEditPill();
        const rects = range.getClientRects();
        if (rects.length === 0) return;
        const rect = rects[0];
        const pill = d.createElement("div");
        pill.setAttribute("data-mailsvc-pill", "1");
        pill.setAttribute("contenteditable", "false");
        pill.style.cssText = [
          "position: fixed",
          "z-index: 2147483647",
          "left: " + Math.max(8, rect.left) + "px",
          "top: " + Math.max(8, rect.top - 40) + "px",
          "background: #111827",
          "color: #ffffff",
          "padding: 6px 12px",
          "border-radius: 999px",
          "font: 600 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          "box-shadow: 0 8px 24px rgba(0,0,0,0.18)",
          "cursor: pointer",
          "user-select: none",
          "display: inline-flex",
          "align-items: center",
          "gap: 6px",
          "white-space: nowrap",
        ].join(";");
        const icon = d.createElementNS("http://www.w3.org/2000/svg", "svg");
        icon.setAttribute("width", "13");
        icon.setAttribute("height", "13");
        icon.setAttribute("viewBox", "0 0 24 24");
        icon.setAttribute("fill", "none");
        icon.setAttribute("stroke", "currentColor");
        icon.setAttribute("stroke-width", "2.2");
        icon.setAttribute("stroke-linecap", "round");
        icon.setAttribute("stroke-linejoin", "round");
        icon.innerHTML =
          '<path d="M12 20h9"></path>' +
          '<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>';
        pill.appendChild(icon);
        const label = d.createElement("span");
        label.textContent = pillLabel;
        pill.appendChild(label);
        pill.addEventListener("mousedown", (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
        pill.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (pendingRange) {
            reportPendingSelection();
            try {
              applyHighlight(pendingRange);
            } catch {}
          }
          removeEditPill();
          try { d.getSelection()?.removeAllRanges(); } catch {}
        });
        d.body.appendChild(pill);
        editPill = pill;
      };

      let mouseDown = false;
      d.addEventListener("mousedown", (e) => {
        // Click on the pill itself shouldn't clear it; pill stops propagation
        mouseDown = true;
        if (!(e.target as HTMLElement)?.closest?.("[data-mailsvc-pill]")) {
          clearHighlight();
          removeEditPill();
          pendingRange = null;
          pendingText = "";
        }
      });
      d.addEventListener("mouseup", () => {
        mouseDown = false;
        const sel = d.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        const r = sel.getRangeAt(0);
        const text = r.toString();
        if (!text.trim()) {
          removeEditPill();
          return;
        }
        pendingRange = r.cloneRange();
        pendingText = text;
        // Show the floating pill so the user can decide to send to AI
        showEditPill(r);
      });
      d.addEventListener("keyup", (e) => {
        if (mouseDown) return;
        if ((e as KeyboardEvent).shiftKey || (e as KeyboardEvent).key === "Shift") {
          const sel = d.getSelection();
          if (!sel || sel.rangeCount === 0) return;
          const r = sel.getRangeAt(0);
          if (!r.toString().trim()) return;
          pendingRange = r.cloneRange();
          pendingText = r.toString();
          showEditPill(r);
        }
      });
      // Drop the pill on scroll so it doesn't hover detached.
      d.addEventListener("scroll", removeEditPill, true);
      w.addEventListener("scroll", removeEditPill, true);
      // ---- Inline edit support ----
      // The parent toggles {type: 'preview-set-editable', value: boolean}
      // to enable / disable in-place editing. While enabled, every input
      // event posts a 'preview-edited' message with the current body HTML,
      // throttled with a 300ms debounce.
      let inputTimer: number | null = null;
      const reportEdit = () => {
        // Strip any in-progress highlight spans so the html the parent
        // stores is clean of our editor chrome.
        clearHighlight();
        const html = d.body.innerHTML;
        w.parent.postMessage({ type: "preview-edited", html }, "*");
      };
      d.addEventListener("input", () => {
        if (!d.body.isContentEditable) return;
        if (inputTimer !== null) w.clearTimeout(inputTimer);
        inputTimer = w.setTimeout(reportEdit, 300);
      });
      // Also flush on blur so the last keystroke isn't lost
      d.addEventListener("blur", () => {
        if (!d.body.isContentEditable) return;
        if (inputTimer !== null) {
          w.clearTimeout(inputTimer);
          inputTimer = null;
        }
        reportEdit();
      }, true);

      const setEditable = (value: boolean) => {
        d.body.contentEditable = value ? "true" : "false";
        d.body.style.outline = value ? "2px dashed rgba(21, 93, 252, 0.35)" : "";
        d.body.style.outlineOffset = value ? "-4px" : "";
        d.body.style.minHeight = value ? "200px" : "";
        if (value) {
          clearHighlight();
          // Make body focusable but don't immediately steal focus
          d.body.setAttribute("tabindex", "-1");
        }
      };

      w.addEventListener("message", (ev: MessageEvent) => {
        const data = ev.data as { type?: string; value?: boolean; label?: string } | null;
        if (!data?.type) return;
        if (data.type === "preview-clear-highlight") {
          clearHighlight();
          removeEditPill();
          pendingRange = null;
          pendingText = "";
        } else if (data.type === "preview-set-editable") {
          setEditable(Boolean(data.value));
          // Inline-edit and the floating edit-pill don't coexist — clear
          // anything pending when switching into edit mode.
          if (data.value) {
            clearHighlight();
            removeEditPill();
            pendingRange = null;
            pendingText = "";
          }
        } else if (data.type === "preview-set-pill-label" && typeof data.label === "string") {
          pillLabel = data.label;
        }
      });
    };

    const pillLabel = t("compose.edit_pill_label");

    const tryInject = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc?.body) return;
        if (doc.body.getAttribute(INJECTED_MARK) !== "1") {
          const script = doc.createElement("script");
          script.textContent = "(" + iframeScript.toString() + ")();";
          doc.body.appendChild(script);
        }
        // Send the localized pill label so newly-mounted iframes show
        // the correct text the first time the user drags.
        iframe.contentWindow?.postMessage(
          { type: "preview-set-pill-label", label: pillLabel },
          "*"
        );
        if (inlineEditMode) {
          iframe.contentWindow?.postMessage(
            { type: "preview-set-editable", value: true },
            "*"
          );
        }
      } catch {
        // sandboxed iframes block this — that's fine, user can switch to HTML view
      }
    };

    iframe.addEventListener("load", tryInject);
    tryInject();
    return () => iframe.removeEventListener("load", tryInject);
  }, [htmlContent, showHtml, inlineEditMode, t]);

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

      // Defensive: preserve any <img> tags from the original selection that
      // the AI dropped. Match them by src so we don't double-insert when the
      // model legitimately kept them.
      let replacement: string = data.result;
      const originalImgTags = Array.from(
        selectedText.matchAll(/<img\b[^>]*>/gi)
      ).map((m) => m[0]);
      if (originalImgTags.length > 0) {
        const replacementSrcs = new Set(
          Array.from(replacement.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)).map((m) => m[1])
        );
        const missing = originalImgTags.filter((tag) => {
          const srcMatch = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i);
          if (!srcMatch) return true;
          return !replacementSrcs.has(srcMatch[1]);
        });
        if (missing.length > 0) {
          // Append missing images at the end of the replacement so they are
          // not lost. Wrap each in a div so they render predictably.
          replacement = replacement + "\n" + missing.join("\n");
        }
      }

      // Replace selected text in htmlContent
      if (selectionRange) {
        // textarea-based: exact replacement by index
        const newContent =
          htmlContent.substring(0, selectionRange.start) +
          replacement +
          htmlContent.substring(selectionRange.end);
        setHtmlContent(newContent);
      } else {
        // iframe-based or pasted text — resolve the selection back to a
        // span of the source html. Try several strategies in order of
        // preference, all of which work even when the user typed/pasted
        // a slightly different version of the selected text.
        const found = locateSelectionInHtml(
          htmlContent,
          selectedText,
          selectionContext
        );
        if (!found) {
          setEditError(t("compose.edit_not_found"));
          return;
        }
        const newContent =
          htmlContent.substring(0, found.start) +
          replacement +
          htmlContent.substring(found.end);
        setHtmlContent(newContent);
      }
      const usedInstruction = editInstruction;
      setSelectedText("");
      setSelectionRange(null);
      setSelectionContext(null);
      setEditInstruction("");
      clearIframeHighlight();
      // Queue snapshot after the htmlContent update flushes.
      pendingSnapshotRef.current = { label: "edited", note: usedInstruction };
      setSnapshotTick((n) => n + 1);
    } catch {
      setEditError(t("compose.edit_failed"));
    } finally {
      setEditing(false);
    }
  };

  const clearIframeHighlight = () => {
    const iframe = previewIframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage({ type: "preview-clear-highlight" }, "*");
  };

  const cancelEdit = () => {
    setSelectedText("");
    setSelectionRange(null);
    setSelectionContext(null);
    setEditInstruction("");
    setEditError(null);
    clearIframeHighlight();
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
            <ul className="max-h-[480px] overflow-y-auto divide-y divide-border-light">
              {revisions.map((rev, i) => (
                <RevisionItem
                  key={rev.id}
                  rev={rev}
                  // Compare against the previous (older) revision so the
                  // diff shows what this revision introduced
                  previous={revisions[i + 1] || null}
                  active={activeRevisionId === rev.id}
                  expanded={expandedRevId === rev.id}
                  onToggle={() => setExpandedRevId(expandedRevId === rev.id ? null : rev.id)}
                  onRestore={() => restoreRevision(rev)}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Preview */}
      {htmlContent && (
        <div className="bg-surface-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border-light bg-surface gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="text-[12px] font-medium text-text-secondary flex-shrink-0">{t("compose.preview")}</h3>
              {hasManualChanges && (
                <span className="inline-flex items-center gap-1 text-[11px] text-warning font-medium flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                  {t("compose.unsaved_changes")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <button
                onClick={saveRevisionManually}
                disabled={!hasManualChanges || savingRevision}
                className={`text-[12px] font-medium transition-colors flex items-center gap-1 ${
                  hasManualChanges
                    ? "text-brand hover:text-brand-dark"
                    : "text-text-muted/50 cursor-not-allowed"
                }`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                {savingRevision ? "..." : t("compose.save_as_revision")}
              </button>
              {!showHtml && (
                <button
                  onClick={() => {
                    const next = !inlineEditMode;
                    setInlineEditMode(next);
                    const iframe = previewIframeRef.current;
                    if (iframe?.contentWindow) {
                      iframe.contentWindow.postMessage(
                        { type: "preview-set-editable", value: next },
                        "*"
                      );
                    }
                    // Drop any pending selection edit panel when entering inline mode
                    if (next) cancelEdit();
                  }}
                  className={`text-[12px] font-medium transition-colors flex items-center gap-1 ${
                    inlineEditMode ? "text-brand" : "text-text-muted hover:text-brand"
                  }`}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                  {inlineEditMode ? t("compose.edit_preview_on") : t("compose.edit_preview")}
                </button>
              )}
              <button
                onClick={() => {
                  // Leaving visual preview also disables inline-edit so the
                  // next time the user comes back the iframe isn't unexpectedly
                  // still editable.
                  if (!showHtml && inlineEditMode) setInlineEditMode(false);
                  setShowHtml(!showHtml);
                }}
                className="text-[12px] text-text-muted hover:text-brand font-medium transition-colors"
              >
                {showHtml ? t("compose.visual_preview") : t("compose.view_html")}
              </button>
            </div>
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
              srcDoc={iframeSrcDoc}
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
          <div className="mb-3">
            <p className="text-[11px] text-text-muted mb-1.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-[#FDC700]" />
              {t("compose.selected_block")}
              {selectionRange ? null : (
                <span className="text-[10px] text-text-muted">
                  · {t("compose.selection_editable_hint")}
                </span>
              )}
            </p>
            <textarea
              value={selectedText}
              onChange={(e) => {
                setSelectedText(e.target.value);
                // User started editing — invalidate the exact range
                if (selectionRange) setSelectionRange(null);
              }}
              rows={Math.min(6, Math.max(2, Math.ceil(selectedText.length / 80)))}
              className="w-full bg-surface border border-border rounded-lg p-2.5 text-[12px] text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all whitespace-pre-wrap break-words resize-y"
              placeholder={t("compose.selection_editable_hint")}
            />
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

      {/* Post-send: keep or clear the revision history */}
      {showSendKeepPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
          onClick={() => !postSendLoading && handleKeepRevisions()}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center mb-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00C950" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 className="text-[16px] font-semibold text-text-primary mb-1">
              {t("compose.post_send_title")}
            </h3>
            <p className="text-[13px] text-text-secondary leading-relaxed mb-5">
              {t("compose.post_send_desc", { count: revisions.length })}
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleClearRevisions}
                disabled={postSendLoading}
                className="flex-1 border border-border text-text-secondary px-4 h-10 rounded-lg text-[13px] font-medium hover:bg-danger/[0.06] hover:text-danger hover:border-danger/30 disabled:opacity-40 transition-colors"
              >
                {postSendLoading ? "..." : t("compose.post_send_clear")}
              </button>
              <button
                onClick={handleKeepRevisions}
                disabled={postSendLoading}
                className="flex-1 bg-brand text-white px-4 h-10 rounded-lg text-[13px] font-semibold hover:bg-brand-dark disabled:opacity-40 transition-colors"
              >
                {t("compose.post_send_keep")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RevisionItem({
  rev,
  previous,
  active,
  expanded,
  onToggle,
  onRestore,
}: {
  rev: Revision;
  previous: Revision | null;
  active: boolean;
  expanded: boolean;
  onToggle: () => void;
  onRestore: () => void;
}) {
  const { t } = useLocale();

  const kind = (() => {
    switch (rev.label) {
      case "generated":
        return { text: t("compose.rev_kind_generated"), color: "bg-brand/10 text-brand" };
      case "edited":
        return { text: t("compose.rev_kind_edited"), color: "bg-[#a78bfa]/15 text-[#7c3aed]" };
      case "manual":
        return { text: t("compose.rev_kind_manual"), color: "bg-warning/15 text-warning" };
      default:
        return { text: t("compose.rev_kind_other"), color: "bg-surface text-text-secondary" };
    }
  })();

  const diff: DiffLine[] = useMemo(() => {
    const oldLines = previous ? htmlToPlainLines(previous.html_content) : [];
    const newLines = htmlToPlainLines(rev.html_content);
    return diffLines(oldLines, newLines);
  }, [rev.html_content, previous]);

  const stats = useMemo(() => diffStats(diff), [diff]);
  const subjectChanged = previous ? previous.subject !== rev.subject : Boolean(rev.subject);

  return (
    <li className={`transition-colors ${active ? "bg-brand/[0.04]" : ""}`}>
      {/* Header row — always visible */}
      <div className="px-5 py-3 hover:bg-surface/40 cursor-pointer" onClick={onToggle}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full ${kind.color}`}>
                {kind.text}
              </span>
              <p className="text-[13px] text-text-primary truncate min-w-0">
                {rev.subject || t("drafts.no_subject")}
              </p>
            </div>
            {rev.note && (
              <p className="text-[12px] text-text-secondary mt-1 line-clamp-2 leading-snug">
                <span className="text-text-muted">{t("compose.rev_note")}: </span>
                {rev.note}
              </p>
            )}
            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-text-muted">
              <span>{new Date(rev.created_at).toLocaleString()}</span>
              {(stats.added > 0 || stats.removed > 0) && (
                <span className="flex items-center gap-2">
                  {stats.added > 0 && (
                    <span className="text-[#00C950] font-medium">+{stats.added}</span>
                  )}
                  {stats.removed > 0 && (
                    <span className="text-danger font-medium">−{stats.removed}</span>
                  )}
                </span>
              )}
              {subjectChanged && (
                <span className="text-warning">{t("compose.rev_subject_changed")}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onRestore(); }}
              className="text-brand hover:text-brand-dark text-[12px] font-medium transition-colors"
            >
              {t("compose.restore")}
            </button>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={`text-text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded diff */}
      {expanded && (
        <div className="border-t border-border-light bg-white">
          {/* Subject change */}
          {subjectChanged && (
            <div className="px-5 py-2.5 border-b border-border-light bg-surface/40">
              <p className="text-[11px] font-medium text-text-muted mb-1">
                {t("compose.rev_subject_label")}
              </p>
              {previous && (
                <p className="text-[12px] text-danger line-through truncate">
                  {previous.subject || <em className="text-text-muted">{t("drafts.no_subject")}</em>}
                </p>
              )}
              <p className="text-[12px] text-[#00C950] font-medium truncate">
                {rev.subject || <em className="text-text-muted">{t("drafts.no_subject")}</em>}
              </p>
            </div>
          )}
          {/* HTML diff */}
          <div className="max-h-[280px] overflow-y-auto px-5 py-3 text-[12px] font-mono leading-relaxed">
            {diff.length === 0 ? (
              <p className="text-text-muted italic">{t("compose.rev_no_changes")}</p>
            ) : (
              <pre className="whitespace-pre-wrap break-words">
                {diff.map((line, idx) => (
                  <div
                    key={idx}
                    className={
                      line.kind === "added"
                        ? "bg-[#00C950]/[0.08] text-[#0a7a36] px-2 -mx-2"
                        : line.kind === "removed"
                          ? "bg-danger/[0.08] text-danger px-2 -mx-2"
                          : "text-text-muted px-2 -mx-2"
                    }
                  >
                    <span className="select-none w-4 inline-block">
                      {line.kind === "added" ? "+" : line.kind === "removed" ? "−" : " "}
                    </span>
                    {line.text}
                  </div>
                ))}
              </pre>
            )}
          </div>
          {/* Prompt for this revision */}
          {rev.prompt && (
            <div className="px-5 py-2.5 border-t border-border-light bg-surface/40">
              <p className="text-[11px] font-medium text-text-muted mb-0.5">
                {t("compose.rev_prompt_label")}
              </p>
              <p className="text-[12px] text-text-secondary leading-snug">{rev.prompt}</p>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

// ---------- Selection resolution helpers ----------

interface SelectionContext {
  before: string;
  after: string;
  blockHtml: string | null;
}

/**
 * Find a span of html that, when rendered, corresponds to `selection`.
 * Returns the absolute {start, end} indices in `html`, or null when no
 * reasonable match exists. The matcher is tolerant of:
 *   - whitespace / newline differences
 *   - HTML entities (&nbsp; etc.) vs the rendered character
 *   - <span>, <strong>, <em> etc. interleaved with the visible text
 * and uses the surrounding `before` / `after` context (also rendered
 * text) to disambiguate when the same phrase appears more than once.
 */
function locateSelectionInHtml(
  html: string,
  selection: string,
  ctx: SelectionContext | null
): { start: number; end: number } | null {
  if (!selection) return null;

  // 1. Try an exact substring match first — works when the user actually
  // dragged across a single text node.
  const exactIdx = html.indexOf(selection);
  if (exactIdx !== -1) {
    return { start: exactIdx, end: exactIdx + selection.length };
  }

  // 2. Build a normalised projection of the html where every character of
  // the html maps to either a rendered character or to "" (for markup).
  // Then we can search the rendered string and translate the match back
  // into html offsets.
  const { rendered, mapping } = renderWithMapping(html);

  const norm = (s: string) =>
    s
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/ /g, " ")
      .replace(/[ \t\r\n]+/g, " ")
      .trim();

  const renderedNorm = norm(rendered);
  const selNorm = norm(selection);
  if (!selNorm) return null;

  // Build a function that, given an index into renderedNorm, returns the
  // corresponding index into rendered (and then html via mapping).
  const renderedToNormIdx: number[] = [];
  {
    let j = 0;
    let prevSpace = true;
    for (let i = 0; i < rendered.length; i++) {
      const ch = rendered[i];
      const isWs = ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === " ";
      if (isWs) {
        if (prevSpace) {
          renderedToNormIdx.push(j);
        } else {
          renderedToNormIdx.push(j);
          j++;
          prevSpace = true;
        }
      } else {
        renderedToNormIdx.push(j);
        j++;
        prevSpace = false;
      }
    }
  }

  // Helper: locate selNorm inside renderedNorm using surrounding context
  // to disambiguate. Returns the *normalised* start/end indices.
  const beforeNorm = ctx ? norm(ctx.before) : "";
  const afterNorm = ctx ? norm(ctx.after) : "";

  let normStart = -1;
  if (beforeNorm) {
    // Try anchored on "before + selection"
    const anchor = (beforeNorm + " " + selNorm).trim();
    const altAnchor = beforeNorm + selNorm;
    const ai = renderedNorm.indexOf(anchor);
    if (ai !== -1) normStart = ai + anchor.length - selNorm.length;
    else {
      const ai2 = renderedNorm.indexOf(altAnchor);
      if (ai2 !== -1) normStart = ai2 + altAnchor.length - selNorm.length;
    }
  }
  if (normStart === -1) {
    normStart = renderedNorm.indexOf(selNorm);
  }
  if (normStart === -1) {
    // Last-resort: trim more aggressively (drop punctuation)
    const stripPunct = (s: string) => s.replace(/[\p{P}\p{S}]+/gu, " ").replace(/\s+/g, " ").trim();
    const selStrip = stripPunct(selNorm);
    const renderedStrip = stripPunct(renderedNorm);
    if (selStrip && renderedStrip.includes(selStrip)) {
      // The stripped match doesn't give us precise offsets, so we still
      // need to find a position. Use the prefix of selStrip to seed an
      // approximate search inside renderedNorm.
      const seed = selStrip.split(" ").slice(0, Math.min(4, selStrip.split(" ").length)).join(" ");
      if (seed) {
        const seedIdx = renderedNorm.toLowerCase().indexOf(seed.toLowerCase());
        if (seedIdx !== -1) normStart = seedIdx;
      }
    }
    if (normStart === -1) return null;
  }
  const normEnd = normStart + selNorm.length;

  // Translate normalised offsets back to indices in `rendered`.
  let renderedStart = -1;
  let renderedEnd = -1;
  for (let i = 0; i < renderedToNormIdx.length; i++) {
    if (renderedStart === -1 && renderedToNormIdx[i] >= normStart) renderedStart = i;
    if (renderedToNormIdx[i] >= normEnd) {
      renderedEnd = i;
      break;
    }
  }
  if (renderedStart === -1) return null;
  if (renderedEnd === -1) renderedEnd = rendered.length;

  // Translate rendered offsets back to html offsets via the mapping
  let htmlStart = mapping[renderedStart];
  let htmlEnd = renderedEnd > 0 ? mapping[renderedEnd - 1] + 1 : htmlStart;
  if (typeof htmlStart !== "number") return null;
  // Expand to cover any whitespace right after the match in the source
  while (htmlEnd < html.length && /\s/.test(html[htmlEnd])) htmlEnd++;
  // Make sure we didn't slice in the middle of an HTML tag
  htmlStart = backOutOfTag(html, htmlStart);
  htmlEnd = forwardOutOfTag(html, htmlEnd);
  if (htmlEnd <= htmlStart) return null;
  return { start: htmlStart, end: htmlEnd };
}

/** Produces a plain-text "rendered" version of html alongside a map from
 *  each character of the rendered output back to its source index in html. */
function renderWithMapping(html: string): { rendered: string; mapping: number[] } {
  const out: string[] = [];
  const mapping: number[] = [];
  const len = html.length;
  let i = 0;
  while (i < len) {
    const ch = html[i];
    if (ch === "<") {
      // Skip to matching ">" — for tags / comments
      const close = html.indexOf(">", i);
      if (close === -1) break;
      // Treat block-level closes as a space boundary so words don't merge
      const blockClose = /^<\/(p|div|li|h[1-6]|tr|td|br\s*\/?|section|article|header|footer)\b/i.test(
        html.slice(i)
      );
      if (blockClose) {
        out.push(" ");
        mapping.push(i);
      }
      i = close + 1;
    } else if (ch === "&") {
      const semi = html.indexOf(";", i);
      if (semi !== -1 && semi - i <= 8) {
        const ent = html.slice(i, semi + 1);
        let decoded = ent;
        switch (ent) {
          case "&nbsp;": decoded = " "; break;
          case "&amp;": decoded = "&"; break;
          case "&lt;": decoded = "<"; break;
          case "&gt;": decoded = ">"; break;
          case "&quot;": decoded = '"'; break;
          case "&#39;": case "&apos;": decoded = "'"; break;
        }
        for (let k = 0; k < decoded.length; k++) {
          out.push(decoded[k]);
          mapping.push(i);
        }
        i = semi + 1;
      } else {
        out.push(ch);
        mapping.push(i);
        i++;
      }
    } else {
      out.push(ch);
      mapping.push(i);
      i++;
    }
  }
  return { rendered: out.join(""), mapping };
}

function backOutOfTag(html: string, idx: number): number {
  // If idx is inside `<...>`, move left until we're outside the tag
  let depth = 0;
  for (let i = idx; i >= 0; i--) {
    if (html[i] === ">") {
      if (depth > 0) depth--;
      else return idx;
    }
    if (html[i] === "<") return i; // we hit the opening of a tag — split here
  }
  return idx;
}

function forwardOutOfTag(html: string, idx: number): number {
  for (let i = idx; i < html.length; i++) {
    if (html[i] === ">") return i + 1;
    if (html[i] === "<") return idx;
  }
  return idx;
}
