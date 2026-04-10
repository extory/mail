"use client";

import { useState, useEffect, useCallback } from "react";
import type { Group } from "@/lib/types";
import { useLocale } from "./locale-provider";

export function EmailComposer() {
  const { t } = useLocale();
  const [prompt, setPrompt] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [showHtml, setShowHtml] = useState(false);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  useEffect(() => {
    fetch("/api/groups")
      .then((res) => res.json())
      .then(setGroups);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setHtmlContent("");
    setSubject("");
    setSendResult(null);

    try {
      const res = await fetch("/api/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) throw new Error("Failed to generate");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");

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
            setHtmlContent(rest);
            continue;
          }
        }

        if (subjectExtracted) {
          const rest = fullText.substring(fullText.indexOf("\n") + 1).replace(/^\n+/, "");
          setHtmlContent(rest);
        } else {
          setHtmlContent(fullText);
        }
      }
    } catch (err) {
      console.error(err);
      setSendResult(t("compose.error_generate"));
    } finally {
      setGenerating(false);
    }
  }, [prompt, t]);

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

  return (
    <div className="space-y-6">
      {/* Prompt input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t("compose.prompt_label")}
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t("compose.prompt_placeholder")}
          className="w-full border rounded-lg px-4 py-3 text-sm min-h-[120px] resize-y"
          disabled={generating}
        />
        <button
          onClick={handleGenerate}
          disabled={generating || !prompt.trim()}
          className="mt-3 bg-blue-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? t("compose.generating") : t("compose.generate")}
        </button>
      </div>

      {/* Subject line */}
      {(subject || htmlContent) && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("compose.subject")}
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder={t("compose.subject_placeholder")}
          />
        </div>
      )}

      {/* Preview */}
      {htmlContent && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700">{t("compose.preview")}</h3>
            <button
              onClick={() => setShowHtml(!showHtml)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              {showHtml ? t("compose.visual_preview") : t("compose.view_html")}
            </button>
          </div>

          {showHtml ? (
            <textarea
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              className="w-full border rounded-lg px-4 py-3 text-xs font-mono min-h-[400px] resize-y bg-gray-50"
            />
          ) : (
            <div className="border rounded-lg overflow-hidden bg-white">
              <iframe
                srcDoc={htmlContent}
                sandbox=""
                className="w-full min-h-[500px] border-0"
                title="Email Preview"
              />
            </div>
          )}
        </div>
      )}

      {/* Send controls */}
      {htmlContent && !generating && (
        <div className="flex items-center gap-4 pt-4 border-t flex-wrap">
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm"
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
            className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending
              ? t("compose.sending")
              : selectedGroupId
                ? t("compose.send_group")
                : t("compose.send_all")}
          </button>
          {sendResult && (
            <p
              className={`text-sm ${sendResult.startsWith("Error") ? "text-red-600" : "text-green-600"}`}
            >
              {sendResult}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
