"use client";

import { useCallback, useEffect, useState } from "react";
import type { getSendReport } from "@/lib/send-tracking";
import { useLocale } from "./locale-provider";
import type { TranslationKey } from "@/lib/i18n";

const eventLabels: Record<string, TranslationKey> = {
  sent: "send_report.event.sent", delivered: "send_report.event.delivered",
  delivery_delayed: "send_report.event.delivery_delayed", bounced: "send_report.event.bounced",
  complained: "send_report.event.complained", opened: "send_report.event.opened",
  suppressed: "send_report.event.suppressed", clicked: "send_report.event.clicked", failed: "send_report.event.failed",
};

type Report = NonNullable<ReturnType<typeof getSendReport>>;
export function SendReport({ id, onUpdated }: {id: number; onUpdated?: () => void}) {
  const { t } = useLocale();
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [originals, setOriginals] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [embedImages, setEmbedImages] = useState(false);
  const [showAccepted, setShowAccepted] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [hardOnly, setHardOnly] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const load = useCallback(async () => {
    const res = await fetch(`/api/history/${id}`,{cache:"no-store"});
    if (!res.ok) throw new Error("Could not load send report");
    setReport(await res.json());
    setError(null);
    setSelected([]);
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
  const removeSelected = async () => {
    if (busy || !selected.length || !confirm(t("send_report.delete_confirm", {count: selected.length}))) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const res = await fetch(`/api/history/${id}/hard-bounces`, {method: "DELETE", headers: {"Content-Type": "application/json"}, body: JSON.stringify({emails: selected, confirmed: true})});
      const result = await res.json();
      if (!res.ok) throw new Error(t("send_report.delete_error"));
      await load();
      setNotice(t("send_report.deleted", {count: result.deleted}));
      onUpdated?.();
    } catch { setError(t("send_report.delete_error")); }
    finally { setBusy(false); }
  };
  const details = new Map(report?.accepted.map(r => [r.resend_id, r]));
  const eligible = [...new Set(report?.accepted.filter(r => (r.hardBounce || r.suppressed) && r.subscriberExists).map(r => r.recipient_email.toLowerCase()))];
  const events = new Map(report?.accepted.map(r => [r.resend_id, r.last_event]));
  const rows = report?.tracked ? report.recipients : (report?.accepted.map(r => ({
    id: r.resend_id, email: r.recipient_email, state: "accepted" as const, error: null, resend_id: r.resend_id,
  })) ?? []);
  const visibleRows = rows.filter(r => hardOnly ? !!(r.resend_id && (details.get(r.resend_id)?.hardBounce || details.get(r.resend_id)?.suppressed)) : !report?.tracked || showAccepted || r.state !== "accepted");
  return <section className="rounded-xl border border-border bg-surface-card p-4 space-y-3">
    <div className="flex flex-wrap justify-between gap-3">
      <h3 className="text-[14px] font-semibold">{t("send_report.title")} #{id}</h3>
      <button type="button" disabled={busy} onClick={() => load().catch(() => setError(t("send_report.error")))} className="text-[12px] text-brand">{t("images.refresh")}</button>
    </div>
    {error && <p role="alert" className="text-[12px] text-danger">{error}</p>}
    {!report ? (!error && <p>{t("loading")}</p>) : report.tracked ? <>
      <p role="status" className="text-[13px]">{t("send_report.summary",{total:report.total,success:report.success,retryable:report.retryable,blocked:report.blocked,unknown:report.unknown,skipped:report.skipped})}</p>
      <p className="text-[12px] text-text-secondary">{t("send_report.hint")}</p>
      {report.retryable > 0 && <div className="space-y-2">
        <p className="text-[13px]">{t("send_report.confirm",{count:report.retryable})}</p>
        <button type="button" disabled={busy || report.busy} onClick={() => act("retry")} className="bg-brand text-white rounded-lg px-4 py-2 text-[13px] disabled:opacity-40">{busy || report.busy ? t("loading") : t("send_report.retry")}</button>
      </div>}
      <label className="flex gap-2 text-[12px]"><input type="checkbox" checked={showAccepted} onChange={e => setShowAccepted(e.target.checked)} />{t("send_report.show_accepted")}</label>

    </> : <>
      <p className="text-[13px] text-text-secondary">{t("send_report.legacy")}</p>

      {["partial","failed"].includes(report.log.status) && <div className="space-y-2">
        <label className="block text-[12px]">{t("send_report.originals")}<textarea value={originals} onChange={e => setOriginals(e.target.value)} disabled={busy} rows={5} className="mt-1 w-full border border-border rounded-lg p-2" /></label>
        <label className="flex gap-2 text-[12px]"><input type="checkbox" checked={embedImages} onChange={e => setEmbedImages(e.target.checked)} disabled={busy} />{t("send_report.embed")}</label>
        <label className="flex items-start gap-2 text-[12px]"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} disabled={busy} />{t("send_report.legacy_confirm")}</label>
        <button type="button" disabled={busy || !confirmed || !originals.trim()} onClick={() => act("recover")} className="border border-border rounded-lg px-3 py-2 text-[12px] disabled:opacity-40">{t("send_report.recover")}</button>
      </div>}
    </>}
    {notice && <p role="status" className="text-[12px]">{notice}</p>}
    {report && <div className="space-y-2">
      <p className="text-[12px] text-text-secondary">{t("send_report.hard_hint")}</p>
      <div className="flex flex-wrap gap-3 items-center text-[12px]">
        <label className="flex gap-2"><input type="checkbox" checked={hardOnly} onChange={e => {setHardOnly(e.target.checked); setSelected([]);}} />{t("send_report.hard_only")}</label>
        <button type="button" disabled={busy || !eligible.length} onClick={() => {setHardOnly(true); setSelected(eligible.slice(0, 1000));}} className="text-brand disabled:opacity-40">{t("send_report.select_hard")}</button>
        <button type="button" disabled={busy || !selected.length} onClick={removeSelected} className="border border-danger text-danger rounded-lg px-3 py-2 disabled:opacity-40">{t("send_report.delete_selected", {count: selected.length})}</button>
      </div>
    </div>}
    {report && <div className="max-h-80 overflow-auto">
      <table className="w-full text-[12px]">
        <thead><tr>
          <th className="text-left p-2">{t("send_report.select")}</th>
          <th className="text-left p-2">{t("subscribers.email")}</th>
          <th className="text-left p-2">{t("history.status")}</th>
          <th className="text-left p-2">{t("send_report.delivery")}</th>
          <th className="text-left p-2">{t("send_report.reason")}</th>
        </tr></thead>
        <tbody>{visibleRows.length ? visibleRows.map(r => <tr key={r.id} className="border-t border-border">
          <td className="p-2">{r.resend_id && (details.get(r.resend_id)?.hardBounce || details.get(r.resend_id)?.suppressed) && (details.get(r.resend_id)?.subscriberExists
            ? <input type="checkbox" aria-label={t("send_report.select_email", {email:r.email})} disabled={busy} checked={selected.includes(r.email.toLowerCase())} onChange={e => setSelected(previous => e.target.checked ? [...new Set([...previous, r.email.toLowerCase()])].slice(0, 1000) : previous.filter(email => email !== r.email.toLowerCase()))} />
            : <span>{t("send_report.already_deleted")}</span>)}</td>
          <td className="p-2">{r.email}</td>
          <td className="p-2 whitespace-nowrap">{t(`send_report.state.${r.state}`)}</td>
          <td className="p-2 whitespace-nowrap">{r.resend_id && details.get(r.resend_id)?.hardBounce ? t("send_report.hard_bounce") : r.resend_id && events.get(r.resend_id)
            ? t(eventLabels[events.get(r.resend_id)!] ?? "send_report.no_event") : t("send_report.no_event")}</td>
          <td className="p-2 break-words">{r.error || (r.resend_id && details.get(r.resend_id)?.bounceReason) || "—"}</td>
        </tr>) : <tr><td colSpan={5} className="p-4 text-text-secondary">{t(hardOnly ? "send_report.no_hard" : rows.length ? "send_report.hidden" : "send_report.empty")}</td></tr>}</tbody>
      </table>
    </div>}
  </section>;
}
