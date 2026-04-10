"use client";

import { GroupManager } from "@/components/group-manager";
import { useLocale } from "@/components/locale-provider";

export default function GroupsPage() {
  const { t } = useLocale();
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-2">{t("groups.title")}</h1>
      <p className="text-gray-600 mb-6">{t("groups.description")}</p>
      <GroupManager />
    </div>
  );
}
