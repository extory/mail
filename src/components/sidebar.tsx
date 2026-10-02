"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "./locale-provider";
import { getLocales, type Locale } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n";

const navItems: { href: string; labelKey: TranslationKey; icon: React.ReactNode }[] = [
  {
    href: "/dashboard",
    labelKey: "nav.dashboard",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: "/subscribers",
    labelKey: "nav.subscribers",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: "/groups",
    labelKey: "nav.groups",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    href: "/drafts",
    labelKey: "nav.drafts",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    ),
  },
  {
    href: "/compose",
    labelKey: "nav.compose",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
  },
  {
    href: "/scheduled",
    labelKey: "nav.scheduled",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <polyline points="12 14 12 17 14 17" />
      </svg>
    ),
  },
  {
    href: "/history",
    labelKey: "nav.history",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    href: "/statistics",
    labelKey: "nav.statistics",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { locale, setLocale, t } = useLocale();
  const locales = getLocales();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setIsAdmin(d.user?.role === "admin"))
      .catch(() => {});
  }, []);

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPath, setMenuPath] = useState(pathname);
  const expanded = menuOpen && menuPath === pathname;
  const current = navItems.find(item => item.href === pathname);
  const sections = [
    { label: "ux.overview", paths: ["/dashboard", "/statistics"] },
    { label: "ux.mail", paths: ["/drafts", "/scheduled", "/history"] },
    { label: "ux.audience", paths: ["/subscribers", "/groups"] },
  ] as const;
  const linkClass = (active: boolean) => `flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${active ? "bg-brand/10 text-brand" : "text-text-secondary hover:bg-surface hover:text-text-primary"}`;

  return (
    <aside className="w-full md:w-[224px] shrink-0 bg-white border-b md:border-b-0 md:border-r border-border md:sticky md:top-0 md:h-dvh md:overflow-y-auto flex flex-col">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:p-3 focus:text-brand">{t("ux.skip")}</a>
      <div className="flex items-center justify-between gap-3 p-4 md:px-5 md:py-6">
        <Link href="/dashboard" className="font-semibold text-base tracking-tight text-brand">{t("app.title")}</Link>
        <button type="button" aria-expanded={expanded} aria-controls="main-navigation" onClick={() => { setMenuPath(pathname); setMenuOpen(!expanded); }} className="md:hidden rounded-lg border border-border px-3 min-h-11 text-sm">
          {expanded ? t("close") : t("ux.menu")}
        </button>
      </div>
      <div className="px-4 pb-3 md:hidden text-xs text-text-secondary">{current ? t(current.labelKey) : t("app.title")}</div>
      <div id="main-navigation" className={`${expanded ? "flex" : "hidden"} md:flex flex-col flex-1 px-3 pb-4 gap-5`} onKeyDown={e => { if (e.key === "Escape") setMenuOpen(false); }}>
        <Link href="/compose" onClick={() => setMenuOpen(false)} aria-current={pathname === "/compose" ? "page" : undefined} className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-dark">+ {t("compose.new")}</Link>
        <nav aria-label={t("ux.menu")} className="space-y-5 flex-1">
          {sections.map(section => (
            <div key={section.label}>
              <p className="px-3 mb-1 text-xs font-medium text-text-secondary">{t(section.label)}</p>
              {section.paths.map(path => {
                const item = navItems.find(item => item.href === path)!;
                const active = pathname === path;
                return <Link key={path} href={path} onClick={() => setMenuOpen(false)} aria-current={active ? "page" : undefined} className={linkClass(active)}>{item.icon}{t(item.labelKey)}</Link>;
              })}
            </div>
          ))}
        </nav>
        <div className="border-t border-border pt-3 space-y-2">
          {isAdmin && <Link href="/invitations" onClick={() => setMenuOpen(false)} className={linkClass(pathname === "/invitations")}>{t("nav.invitations")}</Link>}
          <Link href="/settings" onClick={() => setMenuOpen(false)} className={linkClass(pathname === "/settings")}>{t("nav.settings")}</Link>
          <label className="block px-3 text-xs text-text-secondary">{t("ux.language")}
            <select value={locale} onChange={e => setLocale(e.target.value as Locale)} className="mt-1 w-full min-h-11 border border-border rounded-lg px-2 bg-white text-sm">
              {locales.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </label>
          <button onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/"; }} className="w-full min-h-11 px-3 text-left text-sm text-text-secondary hover:text-danger">{t("ux.logout")}</button>
        </div>
      </div>
    </aside>
  );
}
