"use client";

import { GroupManager } from "@/components/group-manager";
import { useLocale } from "@/components/locale-provider";

export default function GroupsPage() {
  const { t } = useLocale();
  return (
    <div className="max-w-4xl">
      <h1 className="text-[22px] font-semibold text-text-primary tracking-tight">
        {t("groups.title")}
      </h1>
      <p className="text-[14px] text-text-secondary mt-1 mb-6">
        {t("groups.description")}
      </p>
      <GroupManager />
    </div>
  );
}
