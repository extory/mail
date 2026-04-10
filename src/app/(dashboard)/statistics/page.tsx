"use client";

import { useState, useEffect } from "react";
import { useLocale } from "@/components/locale-provider";

interface Overall {
  total_sent: number;
  total_delivered: number;
  total_opened: number;
  total_clicked: number;
  total_bounced: number;
  total_failed: number;
}

interface Campaign {
  send_log_id: number;
  subject: string;
  sent_at: string;
  recipient_count: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  failed: number;
}

function pct(n: number, total: number): string {
  if (total === 0) return "0%";
  return (n / total * 100).toFixed(1) + "%";
}

export default function StatisticsPage() {
  const { t } = useLocale();
  const [overall, setOverall] = useState<Overall | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/statistics")
      .then((r) => r.json())
      .then((d) => {
        setOverall(d.overall);
        setCampaigns(d.campaigns);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="text-text-muted text-[13px]">{t("loading")}</p>;

  const hasData = overall && overall.total_sent > 0;

  return (
    <div className="max-w-5xl">
      <h1 className="text-[22px] font-semibold text-text-primary tracking-tight">
        {t("stats.title")}
      </h1>
      <p className="text-[14px] text-text-secondary mt-1 mb-6">
        {t("stats.description")}
      </p>

      {/* Webhook setup note */}
      <div className="bg-[#155DFC]/[0.04] border border-[#155DFC]/10 rounded-xl px-4 py-3 mb-6">
        <p className="text-[12px] text-text-secondary">
          {t("stats.webhook_note", { url: "/api/webhooks/resend" })}
        </p>
      </div>

      {!hasData ? (
        <div className="bg-surface-card border border-border rounded-xl p-12 text-center">
          <p className="text-text-muted text-[13px]">{t("stats.no_data")}</p>
        </div>
      ) : (
        <>
          {/* Overall stats cards */}
          <h2 className="text-[15px] font-semibold text-text-primary mb-4">{t("stats.overall")}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
            <StatCard
              label={t("stats.total_sent")}
              value={overall.total_sent}
              color="text-text-primary"
            />
            <StatCard
              label={t("stats.delivered")}
              value={overall.total_delivered}
              sub={pct(overall.total_delivered, overall.total_sent)}
              color="text-[#00C950]"
            />
            <StatCard
              label={t("stats.opened")}
              value={overall.total_opened}
              sub={pct(overall.total_opened, overall.total_delivered)}
              color="text-[#2B7FFF]"
            />
            <StatCard
              label={t("stats.clicked")}
              value={overall.total_clicked}
              sub={pct(overall.total_clicked, overall.total_delivered)}
              color="text-[#7c3aed]"
            />
            <StatCard
              label={t("stats.bounced")}
              value={overall.total_bounced}
              sub={pct(overall.total_bounced, overall.total_sent)}
              color="text-[#f59e0b]"
            />
            <StatCard
              label={t("stats.failed")}
              value={overall.total_failed}
              sub={pct(overall.total_failed, overall.total_sent)}
              color="text-[#ef4444]"
            />
          </div>

          {/* Rate bars */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-10">
            <RateBar label={t("stats.delivery_rate")} value={overall.total_delivered} total={overall.total_sent} color="#00C950" />
            <RateBar label={t("stats.open_rate")} value={overall.total_opened} total={overall.total_delivered} color="#2B7FFF" />
            <RateBar label={t("stats.click_rate")} value={overall.total_clicked} total={overall.total_delivered} color="#7c3aed" />
            <RateBar label={t("stats.bounce_rate")} value={overall.total_bounced} total={overall.total_sent} color="#f59e0b" />
          </div>

          {/* Per-campaign table */}
          <h2 className="text-[15px] font-semibold text-text-primary mb-4">{t("stats.campaigns")}</h2>
          <div className="bg-surface-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border-light bg-surface">
                    <th className="text-left px-4 py-3 font-medium text-text-secondary text-[12px]">{t("history.subject")}</th>
                    <th className="text-left px-4 py-3 font-medium text-text-secondary text-[12px]">{t("history.date")}</th>
                    <th className="text-right px-4 py-3 font-medium text-text-secondary text-[12px]">{t("stats.total_sent")}</th>
                    <th className="text-right px-4 py-3 font-medium text-text-secondary text-[12px]">{t("stats.delivered")}</th>
                    <th className="text-right px-4 py-3 font-medium text-text-secondary text-[12px]">{t("stats.opened")}</th>
                    <th className="text-right px-4 py-3 font-medium text-text-secondary text-[12px]">{t("stats.clicked")}</th>
                    <th className="text-right px-4 py-3 font-medium text-text-secondary text-[12px]">{t("stats.bounced")}</th>
                    <th className="text-right px-4 py-3 font-medium text-text-secondary text-[12px]">{t("stats.failed")}</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.send_log_id} className="border-b border-border-light last:border-0 hover:bg-surface/50 transition-colors">
                      <td className="px-4 py-3 text-text-primary max-w-[200px] truncate">{c.subject}</td>
                      <td className="px-4 py-3 text-text-muted whitespace-nowrap">{new Date(c.sent_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-right text-text-primary">{c.sent}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[#00C950]">{c.delivered}</span>
                        <span className="text-text-muted text-[11px] ml-1">{pct(c.delivered, c.sent)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[#2B7FFF]">{c.opened}</span>
                        <span className="text-text-muted text-[11px] ml-1">{pct(c.opened, c.delivered || c.sent)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[#7c3aed]">{c.clicked}</span>
                        <span className="text-text-muted text-[11px] ml-1">{pct(c.clicked, c.delivered || c.sent)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[#f59e0b]">{c.bounced}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[#ef4444]">{c.failed}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: number; sub?: string; color: string }) {
  return (
    <div className="bg-surface-card border border-border rounded-xl p-4">
      <p className="text-[11px] text-text-muted font-medium mb-1">{label}</p>
      <p className={`text-[22px] font-bold ${color}`}>{value.toLocaleString()}</p>
      {sub && <p className="text-[11px] text-text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

function RateBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const rate = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="bg-surface-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] text-text-muted font-medium">{label}</p>
        <p className="text-[13px] font-semibold" style={{ color }}>{rate.toFixed(1)}%</p>
      </div>
      <div className="h-2 bg-[#f3f4f6] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(rate, 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
