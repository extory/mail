"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "./locale-provider";

export function ComposeFab() {
  const pathname = usePathname();
  const { t } = useLocale();
  // Hide on the compose page itself — it would be redundant there
  if (pathname.startsWith("/compose")) return null;

  return (
    <Link
      href="/compose"
      aria-label={t("nav.compose")}
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2 bg-gradient-to-r from-brand-light to-accent text-white px-5 h-12 rounded-full shadow-lg shadow-brand/30 hover:opacity-95 hover:shadow-xl transition-all"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
      <span className="text-[13px] font-semibold tracking-tight">
        {t("compose.new")}
      </span>
    </Link>
  );
}
