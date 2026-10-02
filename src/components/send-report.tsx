"use client";

import { useCallback, useEffect, useState } from "react";
import type { getSendReport } from "@/lib/send-tracking";
import { useLocale } from "./locale-provider";

type Report = NonNullable<ReturnType<typeof getSendReport>>;
export function SendReport({ id, onUpdated }: {id: number; onUpdated?: () => void}) {
  const { t } = useLocale();
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [originals, setOriginals] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [embedImages, setEmbedImages] = useState(false);
  const [showAccepted, setShowAccepted] = useState(false);
  const load = useCallback(async () => {
    const res = await fetch(`/api/history/${id}`,{cache:"no-store"});
    if (!res.ok) throw new Error("Could not load send report");
    setReport(await res.json());
  }, [id]);
  useEffect(() => { setReport(null); load().catch(() => setError(t("send_report.error"))); }, [load,t]);
  const act = async (action: "retry" | "recover") => {
    if (busy || !report) return;
    if (action === "retry" && !confirm(t("send_report.confirm",{count:report.retryable}))) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/history/${id}/${action}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(action === "retry"
        ? {confirmed:true} : {confirmed,embedImages,emails:originals.split(/[\s,;]+/).filter(Boolean)})});
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || t("send_report.error"));
      await load(); onUpdated?.();
    } catch (err) { setError(err instanceof Error ? err.message : t("send_report.error")); }
    finally { setBusy(false); }
  };
  return <section className="rounded-xl border border-border bg-surface-card p-4 space-y-3">
    <div className="flex flex-wrap justify-between gap-3">
      <h3 className="text-[14px] font-semibold">{t("send_report.title")} #{id}</h3>
      <button type="button" disabled={busy} onClick={() => load().catch(() => setError(t("send_report.error")))} className="text-[12px] text-brand">{t("images.refresh")}</button>
    </div>
    {error && <p role="alert" className="text-[12px] text-danger">{error}</p>}
    {!report ? <p>{t("loading")}</p> : report.tracked ? <>
      <p role="status" className="text-[13px]">{t("send_report.summary",{total:report.total,success:report.success,retryable:report.retryable,blocked:report.blocked,unknown:report.unknown,skipped:report.skipped})}</p>
      <p className="text-[12px] text-text-secondary">{t("send_report.hint")}</p>
      {report.retryable > 0 && <div className="space-y-2">
        <p className="text-[13px]">{t("send_report.confirm",{count:report.retryable})}</p>
        <button type="button" disabled={busy || report.busy} onClick={() => act("retry")} className="bg-brand text-white rounded-lg px-4 py-2 text-[13px] disabled:opacity-40">{busy || report.busy ? t("loading") : t("send_report.retry")}</button>
      </div>}
      <label className="flex gap-2 text-[12px]"><input type="checkbox" checked={showAccepted} onChange={e => setShowAccepted(e.target.checked)} />{t("send_report.show_accepted")}</label>
      <div className="max-h-80 overflow-auto">
        <table className="w-full text-[12px]"><thead><tr><th className="text-left p-2">{t("subscribers.email")}</th><th className="text-left p-2">{t("history.status")}</th><th className="text-left p-2">{t("send_report.reason")}</th></tr></thead>
          <tbody>{report.recipients.filter(r => showAccepted || r.state !== "accepted").map(r => <tr key={r.id} className="border-t border-border"><td className="p-2">{r.email}</td><td className="p-2 whitespace-nowrap">{t(`send_report.state.${r.state}`)}</td><td className="p-2 break-words">{r.error || "—"}</td></tr>)}</tbody>
        </table>
      </div>
    </> : <>
      <p className="text-[13px] text-text-secondary">{t("send_report.legacy")}</p>
      <details><summary className="text-[12px] cursor-pointer">{t("send_report.show_accepted")} ({report.accepted.length})</summary><pre className="text-[12px] max-h-48 overflow-auto">{report.accepted.map(r => `${r.recipient_email} (${r.resend_id})`).join("\n")}</pre></details>
      {["partial","failed"].includes(report.log.status) && <div className="space-y-2">
        <label className="block text-[12px]">{t("send_report.originals")}<textarea value={originals} onChange={e => setOriginals(e.target.value)} disabled={busy} rows={5} className="mt-1 w-full border border-border rounded-lg p-2" /></label>
        <label className="flex gap-2 text-[12px]"><input type="checkbox" checked={embedImages} onChange={e => setEmbedImages(e.target.checked)} disabled={busy} />{t("send_report.embed")}</label>
        <label className="flex items-start gap-2 text-[12px]"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} disabled={busy} />{t("send_report.legacy_confirm")}</label>
        <button type="button" disabled={busy || !confirmed || !originals.trim()} onClick={() => act("recover")} className="border border-border rounded-lg px-3 py-2 text-[12px] disabled:opacity-40">{t("send_report.recover")}</button>
      </div>}
    </>}
  </section>;
}
