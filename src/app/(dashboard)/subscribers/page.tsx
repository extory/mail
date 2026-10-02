"use client";

import { SubscriberTable } from "@/components/subscriber-table";
import { useLocale } from "@/components/locale-provider";

export default function SubscribersPage() {
  const { t } = useLocale();
  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-[22px] font-semibold text-text-primary tracking-tight">
        {t("subscribers.title")}
      </h1>
      <p className="text-sm text-text-secondary mt-1 mb-6">{t("ux.subscribers_help")}</p>
      <SubscriberTable />
    </div>
  );
}
