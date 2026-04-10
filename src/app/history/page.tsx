"use client";

import { HistoryTable } from "@/components/history-table";
import { useLocale } from "@/components/locale-provider";

export default function HistoryPage() {
  const { t } = useLocale();
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">{t("history.title")}</h1>
      <HistoryTable />
    </div>
  );
}
