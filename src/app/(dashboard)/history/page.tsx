"use client";

import { HistoryTable } from "@/components/history-table";
import { useLocale } from "@/components/locale-provider";

export default function HistoryPage() {
  const { t } = useLocale();
  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-[22px] font-semibold text-text-primary tracking-tight">
        {t("history.title")}
      </h1>
      <p className="text-sm text-text-secondary mt-1 mb-6">{t("ux.history_help")}</p>
      <HistoryTable />
    </div>
  );
}
