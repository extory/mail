"use client";

import { useState, useEffect } from "react";
import type { Group, Subscriber } from "@/lib/types";
import { useLocale } from "./locale-provider";

export function GroupManager() {
  const { t } = useLocale();
  const [groups, setGroups] = useState<Group[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [members, setMembers] = useState<Subscriber[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const fetchGroups = async () => {
    const res = await fetch("/api/groups");
    setGroups(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchGroups(); }, []);

  const handleToggle = async (groupId: number) => {
    if (expandedId === groupId) {
      setExpandedId(null);
      setMembers([]);
      return;
    }
    setExpandedId(groupId);
    setMembersLoading(true);
    const res = await fetch(`/api/subscribers?groupId=${groupId}`);
    setMembers(await res.json());
    setMembersLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setError(null);
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error);
      return;
    }
    setNewName("");
    fetchGroups();
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t("groups.delete_confirm"))) return;
    await fetch(`/api/groups/${id}`, { method: "DELETE" });
    if (expandedId === id) {
      setExpandedId(null);
      setMembers([]);
    }
    fetchGroups();
  };

  const gradients = [
    "from-[#2B7FFF] to-[#06b6d4]",
    "from-[#34d399] to-[#22c55e]",
    "from-[#FDC700] to-[#FF6900]",
    "from-[#a78bfa] to-[#7c3aed]",
    "from-[#f472b6] to-[#ec4899]",
    "from-[#fb923c] to-[#f97316]",
  ];

  return (
    <div className="space-y-5">
      {/* Create group form */}
      <div className="bg-surface-card border border-border rounded-xl p-5">
        <form onSubmit={handleCreate} className="flex gap-3 items-end">
          <div className="flex-1 max-w-xs">
            <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
              {t("groups.name")}
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("groups.name.placeholder")}
              className="border border-border rounded-lg px-3 py-2 text-[13px] bg-white w-full focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all placeholder:text-text-muted"
              required
            />
          </div>
          <button
            type="submit"
            className="bg-brand text-white px-5 py-2 rounded-lg text-[13px] font-medium hover:bg-brand-dark transition-colors"
          >
            {t("groups.create")}
          </button>
        </form>
      </div>

      {error && (
        <div className="bg-danger/10 text-danger px-4 py-2.5 rounded-lg text-[13px] font-medium">
          {error}
        </div>
      )}

      {/* Groups grid */}
      {loading ? (
        <p className="text-text-muted text-[13px]">{t("loading")}</p>
      ) : groups.length === 0 ? (
        <div className="bg-surface-card border border-border rounded-xl p-12 text-center">
          <p className="text-text-muted text-[13px]">{t("groups.no_groups")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group, i) => {
            const isExpanded = expandedId === group.id;
            return (
              <div
                key={group.id}
                className={`bg-surface-card border rounded-xl transition-all ${
                  isExpanded ? "border-brand/30 shadow-[0_4px_24px_rgba(21,93,252,0.08)] col-span-full" : "border-border hover:border-brand/20 cursor-pointer"
                }`}
              >
                {/* Card header */}
                <div
                  className="p-5 flex justify-between items-start cursor-pointer"
                  onClick={() => handleToggle(group.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${gradients[i % gradients.length]} flex items-center justify-center`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-[14px] font-semibold text-text-primary">{group.name}</h3>
                      <p className="text-[12px] text-text-secondary">
                        {t("groups.count", { count: group.subscriber_count })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleDelete(group.id, e)}
                      className="text-text-muted hover:text-danger text-[12px] transition-colors"
                    >
                      {t("delete")}
                    </button>
                    <svg
                      width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      className={`text-text-muted transition-transform ${isExpanded ? "rotate-180" : ""}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>

                {/* Expanded member list */}
                {isExpanded && (
                  <div className="border-t border-border-light">
                    {membersLoading ? (
                      <p className="text-text-muted text-[13px] p-5">{t("loading")}</p>
                    ) : members.length === 0 ? (
                      <p className="text-text-muted text-[13px] p-5">{t("subscribers.no_subscribers")}</p>
                    ) : (
                      <table className="w-full text-[13px]">
                        <thead>
                          <tr className="bg-surface">
                            <th className="text-left px-5 py-2.5 font-medium text-text-secondary text-[12px]">{t("subscribers.email")}</th>
                            <th className="text-left px-5 py-2.5 font-medium text-text-secondary text-[12px]">{t("subscribers.name")}</th>
                            <th className="text-left px-5 py-2.5 font-medium text-text-secondary text-[12px]">{t("subscribers.added")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {members.map((sub) => (
                            <tr key={sub.id} className="border-t border-border-light">
                              <td className="px-5 py-2.5 text-text-primary">{sub.email}</td>
                              <td className="px-5 py-2.5 text-text-secondary">{sub.name || "-"}</td>
                              <td className="px-5 py-2.5 text-text-muted">{new Date(sub.created_at).toLocaleDateString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
