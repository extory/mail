"use client";

import { useState } from "react";
import { useLocale } from "@/components/locale-provider";

export default function SettingsPage() {
  const { t } = useLocale();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);

    if (newPassword !== confirmPassword) {
      setResult({ type: "error", message: t("settings.password_mismatch") });
      return;
    }
    if (newPassword.length < 6) {
      setResult({ type: "error", message: t("settings.password_too_short") });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (data.error) {
        setResult({ type: "error", message: data.error });
      } else {
        setResult({ type: "success", message: t("settings.password_changed") });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch {
      setResult({ type: "error", message: "Something went wrong" });
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "border border-border rounded-lg px-3 h-[38px] text-[13px] bg-white w-full focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all placeholder:text-text-muted";

  return (
    <div className="max-w-lg">
      <h1 className="text-[22px] font-semibold text-text-primary tracking-tight">
        {t("settings.title")}
      </h1>
      <p className="text-[14px] text-text-secondary mt-1 mb-6">
        {t("settings.description")}
      </p>

      <div className="bg-surface-card border border-border rounded-xl p-5">
        <h2 className="text-[15px] font-semibold text-text-primary mb-4">
          {t("settings.change_password")}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
              {t("settings.current_password")}
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
              {t("settings.new_password")}
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t("settings.password_placeholder")}
              className={inputClass}
              required
              minLength={8}
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
              {t("settings.confirm_password")}
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
              required
              minLength={8}
            />
          </div>

          {result && (
            <p className={`text-[12px] font-medium ${result.type === "error" ? "text-danger" : "text-success"}`}>
              {result.message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-brand text-white px-5 py-2 rounded-lg text-[13px] font-medium hover:bg-brand-dark disabled:opacity-50 transition-colors"
          >
            {loading ? "..." : t("settings.save_password")}
          </button>
        </form>
      </div>
    </div>
  );
}
