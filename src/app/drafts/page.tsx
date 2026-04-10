"use client";

import { DraftsList } from "@/components/drafts-list";
import { useLocale } from "@/components/locale-provider";

export default function DraftsPage() {
  const { t } = useLocale();
  return (
    <div className="max-w-4xl">
      <h1 className="text-[22px] font-semibold text-text-primary tracking-tight">
        {t("drafts.title")}
      </h1>
      <p className="text-[14px] text-text-secondary mt-1 mb-6">
        {t("drafts.description")}
      </p>
      <DraftsList />
    </div>
  );
}
