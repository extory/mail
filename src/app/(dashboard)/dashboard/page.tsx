"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLocale } from "@/components/locale-provider";

interface DashboardData {
  subscriberCount: number;
  unsubscribedCount: number;
  groupCount: number;
  draftCount: number;
  campaignCount: number;
  groups: { name: string; count: number }[];
  emailStats: {
    total_sent: number;
    total_delivered: number;
    total_opened: number;
    total_clicked: number;
    total_bounced: number;
    total_failed: number;
  };
  recentCampaigns: { subject: string; sent_at: string; recipient_count: number; status: string }[];
}

export default function DashboardPage() {
  const { t } = useLocale();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch("/api/dashboard").then((r) => r.json()).then(setData);
  }, []);

  if (!data) return <p className="text-text-muted text-[13px]">{t("loading")}</p>;

  const s = data.emailStats;
  const deliveryRate = s.total_sent > 0 ? (s.total_delivered / s.total_sent * 100) : 0;
  const openRate = s.total_delivered > 0 ? (s.total_opened / s.total_delivered * 100) : 0;
  const clickRate = s.total_delivered > 0 ? (s.total_clicked / s.total_delivered * 100) : 0;
  const maxGroupCount = Math.max(...data.groups.map((g) => g.count), 1);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold text-text-primary tracking-tight">{t("nav.dashboard")}</h1>
        <p className="text-[14px] text-text-secondary mt-1">{t("app.description")}</p>
      </div>

      <section className="rounded-xl border border-brand/15 bg-white p-5 sm:p-6">
        <h2 className="font-semibold mb-4">{t("ux.start")}</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <Link href="/compose" className="rounded-lg bg-brand p-4 text-white font-semibold hover:bg-brand-dark">+ {t("compose.new")}</Link>
          <Link href="/drafts" className="rounded-lg border border-border p-4 hover:bg-surface"><span className="block text-sm font-semibold">{t("nav.drafts")} · {data.draftCount}</span><span className="text-xs text-text-secondary">{t("ux.continue")}</span></Link>
          <Link href="/history" className="rounded-lg border border-border p-4 hover:bg-surface"><span className="block text-sm font-semibold">{t("nav.history")}</span><span className="text-xs text-text-secondary">{t("ux.results")}</span></Link>
        </div>
      </section>
      {/* Top stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard href="/subscribers" label={t("dashboard.active_subscribers")} value={data.subscriberCount} color="#2B7FFF" />
        <StatCard label={t("dashboard.unsubscribed")} value={data.unsubscribedCount} color="#9ca3af" />
        <StatCard href="/groups" label={t("dashboard.groups_count")} value={data.groupCount} color="#22c55e" />
        <StatCard href="/drafts" label={t("dashboard.drafts_count")} value={data.draftCount} color="#f472b6" />
        <StatCard href="/history" label={t("dashboard.campaigns_sent")} value={data.campaignCount} color="#a78bfa" />
        <StatCard href="/statistics" label={t("dashboard.emails_sent")} value={s.total_sent} color="#FDC700" />
      </div>

      {/* Rate cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <RateCard label={t("dashboard.avg_delivery")} rate={deliveryRate} color="#00C950" />
        <RateCard label={t("dashboard.avg_open")} rate={openRate} color="#2B7FFF" />
        <RateCard label={t("dashboard.avg_click")} rate={clickRate} color="#7c3aed" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Group breakdown */}
        <div className="bg-surface-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[14px] font-semibold text-text-primary">{t("dashboard.group_breakdown")}</h2>
            <Link href="/groups" className="text-[12px] text-brand hover:text-brand-dark font-medium transition-colors">
              {t("nav.groups")} &rarr;
            </Link>
          </div>
          {data.groups.length === 0 ? (
            <p className="text-[13px] text-text-muted py-4">{t("groups.no_groups")}</p>
          ) : (
            <div className="space-y-3">
              {data.groups.map((g, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] text-text-primary">{g.name}</span>
                    <span className="text-[12px] text-text-muted">{g.count}</span>
                  </div>
                  <div className="h-2 bg-[#f3f4f6] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#2B7FFF] to-[#06b6d4] transition-all duration-500"
                      style={{ width: `${(g.count / maxGroupCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent campaigns */}
        <div className="bg-surface-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[14px] font-semibold text-text-primary">{t("dashboard.recent_campaigns")}</h2>
            <Link href="/history" className="text-[12px] text-brand hover:text-brand-dark font-medium transition-colors">
              {t("nav.history")} &rarr;
            </Link>
          </div>
          {data.recentCampaigns.length === 0 ? (
            <p className="text-[13px] text-text-muted py-4">{t("dashboard.no_campaigns")}</p>
          ) : (
            <div className="space-y-3">
              {data.recentCampaigns.map((c, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border-light last:border-0">
                  <div className="min-w-0 flex-1 mr-3">
                    <p className="text-[13px] text-text-primary truncate">{c.subject}</p>
                    <p className="text-[11px] text-text-muted">{new Date(c.sent_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[12px] text-text-secondary">{c.recipient_count}</span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      c.status === "sent" ? "bg-[#00C950]/10 text-[#00C950]"
                        : c.status === "failed" ? "bg-[#ef4444]/10 text-[#ef4444]"
                          : "bg-[#f59e0b]/10 text-[#f59e0b]"
                    }`}>
                      {c.status === "sent" ? t("scheduled.status.sent") : c.status === "failed" ? t("scheduled.status.failed") : c.status === "partial" ? t("ux.partial") : c.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>


    </div>
  );
}

function StatCard({ label, value, color, href }: { label: string; value: number; color: string; href?: string }) {
  const inner = (
    <div className="bg-surface-card border border-border rounded-xl p-4 hover:border-border/80 transition-all">
      <p className="text-[11px] text-text-muted font-medium mb-1.5">{label}</p>
      <p className="text-[24px] font-bold tracking-tight" style={{ color }}>{value.toLocaleString()}</p>
    </div>
  );
  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}

function RateCard({ label, rate, color }: { label: string; rate: number; color: string }) {
  return (
    <div className="bg-surface-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[12px] text-text-muted font-medium">{label}</p>
        <p className="text-[20px] font-bold tracking-tight" style={{ color }}>{rate.toFixed(1)}%</p>
      </div>
      <div className="h-2.5 bg-[#f3f4f6] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(rate, 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
