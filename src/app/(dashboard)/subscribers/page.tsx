"use client";

import { SubscriberTable } from "@/components/subscriber-table";
import { useLocale } from "@/components/locale-provider";

export default function SubscribersPage() {
  const { t } = useLocale();
  return (
    <div className="max-w-5xl">
      <h1 className="text-[22px] font-semibold text-text-primary tracking-tight mb-6">
        {t("subscribers.title")}
      </h1>
      <SubscriberTable />
    </div>
  );
}
