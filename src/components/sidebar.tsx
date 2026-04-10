"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "./locale-provider";
import { getLocales, type Locale } from "@/lib/i18n";
import type { TranslationKey } from "@/lib/i18n";

const navItems: { href: string; labelKey: TranslationKey; icon: string }[] = [
  { href: "/", labelKey: "nav.dashboard", icon: "📊" },
  { href: "/subscribers", labelKey: "nav.subscribers", icon: "👥" },
  { href: "/groups", labelKey: "nav.groups", icon: "📁" },
  { href: "/compose", labelKey: "nav.compose", icon: "✍️" },
  { href: "/history", labelKey: "nav.history", icon: "📋" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { locale, setLocale, t } = useLocale();
  const locales = getLocales();

  return (
    <aside className="w-60 bg-gray-900 text-white min-h-screen p-4 flex flex-col">
      <h1 className="text-xl font-bold mb-8 px-3">{t("app.title")}</h1>
      <nav className="flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-gray-700 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              <span>{item.icon}</span>
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto pt-4 border-t border-gray-700">
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
          className="w-full bg-gray-800 text-gray-300 text-sm rounded-lg px-3 py-2 border border-gray-700"
        >
          {locales.map((l) => (
            <option key={l.code} value={l.code}>
              {l.label}
            </option>
          ))}
        </select>
      </div>
    </aside>
  );
}
