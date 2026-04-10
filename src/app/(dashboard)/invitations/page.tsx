"use client";

import { useState, useEffect } from "react";
import { useLocale } from "@/components/locale-provider";

interface Invitation {
  id: number;
  email: string;
  code: string;
  used: number;
  created_at: string;
}

export default function InvitationsPage() {
  const { t } = useLocale();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const fetchInvitations = async () => {
    const res = await fetch("/api/invitations");
    if (res.ok) setInvitations(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchInvitations(); }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError("");
    const res = await fetch("/api/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    const data = await res.json();
    if (data.error) {
      setError(data.error);
    } else {
      setEmail("");
      fetchInvitations();
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t("invitations.delete_confirm"))) return;
    await fetch(`/api/invitations/${id}`, { method: "DELETE" });
    fetchInvitations();
  };

  const handleCopy = (inv: Invitation) => {
    const url = `${window.location.origin}/signup?code=${inv.code}&email=${encodeURIComponent(inv.email)}`;
    navigator.clipboard.writeText(url);
    setCopiedId(inv.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-[22px] font-semibold text-text-primary tracking-tight">
        {t("invitations.title")}
      </h1>
      <p className="text-[14px] text-text-secondary mt-1 mb-6">
        {t("invitations.description")}
      </p>

      {/* Invite form */}
      <div className="bg-surface-card border border-border rounded-xl p-5 mb-4">
        <form onSubmit={handleInvite} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
              {t("invitations.email")}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full border border-border rounded-lg px-3 h-[38px] text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all placeholder:text-text-muted"
              required
            />
          </div>
          <button
            type="submit"
            className="bg-brand text-white px-5 h-[38px] rounded-lg text-[13px] font-medium hover:bg-brand-dark transition-colors"
          >
            {t("invitations.send")}
          </button>
        </form>
        {error && (
          <p className="text-[12px] text-danger font-medium mt-2">{error}</p>
        )}
      </div>

      {/* Invitations list */}
      <div className="bg-surface-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border-light bg-surface">
              <th className="text-left px-5 py-3 font-medium text-text-secondary text-[12px]">Email</th>
              <th className="text-left px-5 py-3 font-medium text-text-secondary text-[12px]">{t("invitations.status")}</th>
              <th className="text-left px-5 py-3 font-medium text-text-secondary text-[12px]">{t("history.date")}</th>
              <th className="text-right px-5 py-3 font-medium text-text-secondary text-[12px]">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="text-center py-12 text-text-muted">{t("loading")}</td></tr>
            ) : invitations.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-12 text-text-muted">{t("invitations.no_invitations")}</td></tr>
            ) : (
              invitations.map((inv) => (
                <tr key={inv.id} className="border-b border-border-light last:border-0 hover:bg-surface/50 transition-colors">
                  <td className="px-5 py-3 text-text-primary">{inv.email}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
                      inv.used ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                    }`}>
                      {inv.used ? t("invitations.status.used") : t("invitations.status.pending")}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-text-muted">
                    {new Date(inv.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {!inv.used && (
                        <button
                          onClick={() => handleCopy(inv)}
                          className="text-brand hover:text-brand-dark text-[12px] font-medium transition-colors"
                        >
                          {copiedId === inv.id ? t("invitations.copied") : t("invitations.copy")}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(inv.id)}
                        className="text-danger hover:text-danger/80 text-[12px] font-medium transition-colors"
                      >
                        {t("delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
