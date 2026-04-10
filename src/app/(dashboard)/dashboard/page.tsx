"use client";

import Link from "next/link";
import { useLocale } from "@/components/locale-provider";

const cards: {
  href: string;
  titleKey: "dashboard.subscribers.title" | "dashboard.groups.title" | "dashboard.drafts.title" | "dashboard.compose.title" | "dashboard.history.title";
  descKey: "dashboard.subscribers.desc" | "dashboard.groups.desc" | "dashboard.drafts.desc" | "dashboard.compose.desc" | "dashboard.history.desc";
  gradient: string;
  icon: React.ReactNode;
}[] = [
  {
    href: "/subscribers",
    titleKey: "dashboard.subscribers.title",
    descKey: "dashboard.subscribers.desc",
    gradient: "from-[#2B7FFF] to-[#06b6d4]",
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  },
  {
    href: "/groups",
    titleKey: "dashboard.groups.title",
    descKey: "dashboard.groups.desc",
    gradient: "from-[#34d399] to-[#22c55e]",
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>,
  },
  {
    href: "/drafts",
    titleKey: "dashboard.drafts.title",
    descKey: "dashboard.drafts.desc",
    gradient: "from-[#f472b6] to-[#ec4899]",
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>,
  },
  {
    href: "/compose",
    titleKey: "dashboard.compose.title",
    descKey: "dashboard.compose.desc",
    gradient: "from-[#FDC700] to-[#FF6900]",
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>,
  },
  {
    href: "/history",
    titleKey: "dashboard.history.title",
    descKey: "dashboard.history.desc",
    gradient: "from-[#a78bfa] to-[#7c3aed]",
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  },
];

export default function DashboardPage() {
  const { t } = useLocale();

  return (
    <div className="max-w-4xl">
      <h1 className="text-[22px] font-semibold text-text-primary tracking-tight">{t("app.title")}</h1>
      <p className="text-[14px] text-text-secondary mt-1 mb-8">{t("app.description")}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group bg-surface-card rounded-xl p-5 border border-border hover:border-brand/30 hover:shadow-[0_4px_24px_rgba(21,93,252,0.08)] transition-all duration-200"
          >
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${card.gradient} flex items-center justify-center mb-4`}>
              {card.icon}
            </div>
            <h2 className="text-[14px] font-semibold text-text-primary mb-1">{t(card.titleKey)}</h2>
            <p className="text-[12px] text-text-secondary leading-relaxed">{t(card.descKey)}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
