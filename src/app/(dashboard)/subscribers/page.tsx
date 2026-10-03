"use client";

import { useState } from "react";
import { UnsubscribeList } from "@/components/unsubscribe-list";
import { SubscriberTable } from "@/components/subscriber-table";
import { useLocale } from "@/components/locale-provider";

export default function SubscribersPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const { t } = useLocale();
  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-[22px] font-semibold text-text-primary tracking-tight">
        {t("subscribers.title")}
      </h1>
      <p className="text-sm text-text-secondary mt-1 mb-6">{t("ux.subscribers_help")}</p>
      <UnsubscribeList onAdded={() => setRefreshKey(value => value + 1)} />
      <SubscriberTable refreshKey={refreshKey} />
    </div>
  );
}
