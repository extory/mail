"use client";

import { EmailComposer } from "@/components/email-composer";
import { useLocale } from "@/components/locale-provider";

export default function ComposePage() {
  const { t } = useLocale();
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-2">{t("compose.title")}</h1>
      <p className="text-gray-600 mb-6">{t("compose.description")}</p>
      <EmailComposer />
    </div>
  );
}
