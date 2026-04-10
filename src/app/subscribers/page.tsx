"use client";

import { SubscriberTable } from "@/components/subscriber-table";
import { useLocale } from "@/components/locale-provider";

export default function SubscribersPage() {
  const { t } = useLocale();
  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">{t("subscribers.title")}</h1>
      <SubscriberTable />
    </div>
  );
}
