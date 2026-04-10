"use client";

import Link from "next/link";
import { useLocale } from "@/components/locale-provider";

export default function Home() {
  const { t } = useLocale();

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-2">{t("app.title")}</h1>
      <p className="text-gray-600 mb-8">{t("app.description")}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link
          href="/subscribers"
          className="block bg-white rounded-xl p-6 border hover:shadow-md transition-shadow"
        >
          <div className="text-3xl mb-3">👥</div>
          <h2 className="font-semibold mb-1">{t("dashboard.subscribers.title")}</h2>
          <p className="text-sm text-gray-500">{t("dashboard.subscribers.desc")}</p>
        </Link>

        <Link
          href="/groups"
          className="block bg-white rounded-xl p-6 border hover:shadow-md transition-shadow"
        >
          <div className="text-3xl mb-3">📁</div>
          <h2 className="font-semibold mb-1">{t("dashboard.groups.title")}</h2>
          <p className="text-sm text-gray-500">{t("dashboard.groups.desc")}</p>
        </Link>

        <Link
          href="/compose"
          className="block bg-white rounded-xl p-6 border hover:shadow-md transition-shadow"
        >
          <div className="text-3xl mb-3">✍️</div>
          <h2 className="font-semibold mb-1">{t("dashboard.compose.title")}</h2>
          <p className="text-sm text-gray-500">{t("dashboard.compose.desc")}</p>
        </Link>

        <Link
          href="/history"
          className="block bg-white rounded-xl p-6 border hover:shadow-md transition-shadow"
        >
          <div className="text-3xl mb-3">📋</div>
          <h2 className="font-semibold mb-1">{t("dashboard.history.title")}</h2>
          <p className="text-sm text-gray-500">{t("dashboard.history.desc")}</p>
        </Link>
      </div>
    </div>
  );
}
