"use client";

import { Suspense } from "react";
import { EmailComposer } from "@/components/email-composer";
import { useLocale } from "@/components/locale-provider";

export default function ComposePage() {
  const { t } = useLocale();
  return (
    <div className="max-w-4xl">
      <h1 className="text-[22px] font-semibold text-text-primary tracking-tight">
        {t("compose.title")}
      </h1>
      <p className="text-[14px] text-text-secondary mt-1 mb-6">
        {t("compose.description")}
      </p>
      <Suspense>
        <EmailComposer />
      </Suspense>
    </div>
  );
}
