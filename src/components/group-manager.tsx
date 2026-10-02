"use client";

import { useState, useEffect, useRef } from "react";
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
  const [addEmails, setAddEmails] = useState("");
  const [adding, setAdding] = useState(false);
  const [addResult, setAddResult] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editName, setEditName] = useState("");
  const [savingMember, setSavingMember] = useState(false);
  const [editError, setEditError] = useState<"duplicate" | "save" | null>(null);
  const savingMemberRef = useRef(false);

  const handleSaveMember = async (event: React.FormEvent) => {
    event.preventDefault();
    if (editingId === null || savingMemberRef.current) return;
    savingMemberRef.current = true;
    setSavingMember(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/subscribers/${editingId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: editEmail.trim(), name: editName.trim() }),
      });
      if (res.status === 409) { setEditError("duplicate"); return; }
      if (!res.ok) throw new Error("Failed to save subscriber");
      const updated: Subscriber = await res.json();
      setMembers(prev => prev.map(member => member.id === updated.id ? updated : member));
      setEditingId(null);
    } catch { setEditError("save"); }
    finally { savingMemberRef.current = false; setSavingMember(false); }
  };

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [removing, setRemoving] = useState(false);
  const [memberError, setMemberError] = useState<"load" | "remove" | null>(null);
  const memberRequest = useRef(0);
  const removingRef = useRef(false);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const allSelected = members.length > 0 && selectedIds.size === members.length;

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = selectedIds.size > 0 && !allSelected;
  }, [selectedIds, allSelected, membersLoading]);

  const fetchGroups = async () => {
    const res = await fetch("/api/groups");
    setGroups(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchGroups(); }, []);

  const handleToggle = async (groupId: number) => {
    if (adding || removingRef.current || savingMemberRef.current) return;
    setEditingId(null);
    setEditError(null);
    const requestId = ++memberRequest.current;
    setSelectedIds(new Set());
    setMemberError(null);
    setMembers([]);
    if (expandedId === groupId) {
      setExpandedId(null);
      setMembers([]);
      setAddEmails("");
      setAddResult(null);
      return;
    }
    setExpandedId(groupId);
    setAddEmails("");
    setAddResult(null);
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/subscribers?groupId=${groupId}`);
      if (!res.ok) throw new Error("Failed to load members");
      const data = await res.json();
      if (requestId === memberRequest.current) setMembers(data);
    } catch {
      if (requestId === memberRequest.current) setMemberError("load");
    } finally {
      if (requestId === memberRequest.current) setMembersLoading(false);
    }
  };

  const handleRemoveMembers = async (groupId: number) => {
    if (removingRef.current || adding || editingId !== null || selectedIds.size === 0) return;
    const ids = [...selectedIds];
    if (!confirm(t("groups.remove_confirm", { count: ids.length }))) return;
    removingRef.current = true;
    setRemoving(true);
    setMemberError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/members`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("Failed to remove members");
      const { removed } = await res.json();
      const deleted = new Set(ids);
      setMembers(prev => prev.filter(member => !deleted.has(member.id)));
      setSelectedIds(new Set());
      setGroups(prev => prev.map(group => group.id === groupId
        ? { ...group, subscriber_count: Math.max(0, (group.subscriber_count || 0) - removed) } : group));
    } catch {
      setMemberError("remove");
    } finally {
      removingRef.current = false;
      setRemoving(false);
    }
  };

  const handleAddToGroup = async (groupId: number) => {
    const raw = addEmails.trim();
    if (!raw || adding || removingRef.current || editingId !== null || membersLoading) return;
    // Split on commas, newlines, semicolons, or whitespace
    const emails = raw
      .split(/[\s,;\n]+/)
      .map((e) => e.trim())
      .filter((e) => e.includes("@"));
    if (emails.length === 0) {
      setAddResult(t("groups.no_valid_emails"));
      return;
    }

    setAdding(true);
    setAddResult(null);
    let added = 0;
    let failed = 0;

    for (const email of emails) {
      try {
        const res = await fetch("/api/subscribers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, groupIds: [groupId] }),
        });
        if (res.ok) added++;
        else failed++;
      } catch {
        failed++;
      }
    }

    setAddResult(t("groups.added_result", { added, failed }));
    setAddEmails("");

    // Refresh members and group counts
    try {
      const res = await fetch(`/api/subscribers?groupId=${groupId}`);
      if (!res.ok) throw new Error("Failed to load members");
      setMembers(await res.json());
      setSelectedIds(new Set());
      setMemberError(null);
      await fetchGroups();
    } catch {
      setMemberError("load");
    } finally {
      setAdding(false);
    }
    setTimeout(() => setAddResult(null), 4000);
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
    if (adding || removingRef.current || savingMemberRef.current) return;
    if (!confirm(t("groups.delete_confirm"))) return;
    await fetch(`/api/groups/${id}`, { method: "DELETE" });
    if (expandedId === id) {
      ++memberRequest.current;
      setExpandedId(null);
      setMembers([]);
      setSelectedIds(new Set());
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
                      disabled={adding || removing || editingId !== null}
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
                    {/* Add subscribers to this group */}
                    <div className="p-5 bg-surface/50 border-b border-border-light" onClick={(e) => e.stopPropagation()}>
                      <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
                        {t("groups.add_subscribers")}
                      </label>
                      <div className="flex gap-2 items-start">
                        <textarea
                          value={addEmails}
                          onChange={(e) => setAddEmails(e.target.value)}
                          placeholder={t("groups.add_subscribers_placeholder")}
                          rows={2}
                          disabled={adding || removing || editingId !== null}
                          className="flex-1 border border-border rounded-lg px-3 py-2 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all placeholder:text-text-muted resize-y"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddToGroup(group.id)}
                          disabled={adding || removing || editingId !== null || membersLoading || !addEmails.trim()}
                          className="bg-brand text-white px-4 py-2 rounded-lg text-[13px] font-medium hover:bg-brand-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                        >
                          {adding ? "..." : t("add")}
                        </button>
                      </div>
                      <p className="text-[11px] text-text-muted mt-1.5">{t("groups.add_subscribers_hint")}</p>
                      {addResult && (
                        <p className="text-[12px] text-success font-medium mt-2">{addResult}</p>
                      )}
                    </div>

                    {editingId !== null && (
                      <form onSubmit={handleSaveMember} className="m-5 rounded-lg border border-brand/20 bg-surface/50 p-4 space-y-3">
                        <h4 className="text-[13px] font-medium">{t("groups.edit_member")}</h4>
                        <p className="text-[12px] text-text-secondary">{t("groups.edit_hint")}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <label className="text-[12px] min-w-0">{t("subscribers.email")}
                            <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} required maxLength={254} disabled={savingMember}
                              className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-[13px]" />
                          </label>
                          <label className="text-[12px] min-w-0">{t("subscribers.name")}
                            <input type="text" value={editName} onChange={e => setEditName(e.target.value)} maxLength={200} disabled={savingMember}
                              className="mt-1 w-full rounded-lg border border-border bg-white px-3 py-2 text-[13px]" />
                          </label>
                        </div>
                        {editError && <p role="alert" className="text-[12px] text-danger">{t(editError === "duplicate" ? "groups.duplicate_email" : "groups.edit_error")}</p>}
                        <div className="flex gap-3">
                          <button type="submit" disabled={savingMember || !editEmail.trim()} className="rounded-lg bg-brand text-white px-4 py-2 text-[12px] disabled:opacity-40">{savingMember ? t("loading") : t("save")}</button>
                          <button type="button" disabled={savingMember} onClick={() => { setEditingId(null); setEditError(null); }} className="px-3 py-2 text-[12px]">{t("cancel")}</button>
                        </div>
                      </form>
                    )}

                    {memberError && <p role="alert" className="px-5 py-3 text-[13px] text-danger">{t(memberError === "load" ? "groups.load_error" : "groups.remove_error")}</p>}
                    {membersLoading ? (
                      <p className="text-text-muted text-[13px] p-5">{t("loading")}</p>
                    ) : memberError === "load" ? null : members.length === 0 ? (
                      <p className="text-text-muted text-[13px] p-5">{t("subscribers.no_subscribers")}</p>
                    ) : (
                      <>
                      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                        <span role="status" className="text-[13px] text-text-secondary">{t("groups.selected_count", { count: selectedIds.size })}</span>
                        <button type="button" onClick={() => handleRemoveMembers(group.id)} disabled={adding || removing || editingId !== null || selectedIds.size === 0}
                          className="rounded-lg border border-danger/30 px-3 py-2 text-[12px] text-danger disabled:opacity-40 disabled:cursor-not-allowed">
                          {removing ? t("loading") : t("groups.remove_selected")}
                        </button>
                      </div>
                      <div className="overflow-x-auto">
                      <table className="w-full text-[13px]">
                        <thead>
                          <tr className="bg-surface">
                            <th className="w-12 px-4 py-2.5">
                              <input ref={selectAllRef} type="checkbox" aria-label={t("groups.select_all")} checked={allSelected} disabled={adding || removing || editingId !== null}
                                onChange={e => setSelectedIds(e.target.checked ? new Set(members.map(member => member.id)) : new Set())}
                                className="h-4 w-4 accent-brand" />
                            </th>
                            <th className="text-left px-5 py-2.5 font-medium text-text-secondary text-[12px]">{t("subscribers.email")}</th>
                            <th className="text-left px-5 py-2.5 font-medium text-text-secondary text-[12px]">{t("subscribers.name")}</th>
                            <th className="text-left px-5 py-2.5 font-medium text-text-secondary text-[12px]">{t("subscribers.added")}</th>
                            <th className="px-5 py-2.5 text-[12px] font-medium text-text-secondary">{t("actions")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {members.map((sub) => (
                            <tr key={sub.id} className="border-t border-border-light">
                              <td className="px-4 py-2.5">
                                <input type="checkbox" aria-label={t("groups.select_member", { email: sub.email })} checked={selectedIds.has(sub.id)} disabled={adding || removing || editingId !== null}
                                  onChange={e => {
                                    const checked = e.target.checked;
                                    setSelectedIds(prev => { const next = new Set(prev); if (checked) next.add(sub.id); else next.delete(sub.id); return next; });
                                  }} className="h-4 w-4 accent-brand" />
                              </td>
                              <td className="px-5 py-2.5 text-text-primary">{sub.email}</td>
                              <td className="px-5 py-2.5 text-text-secondary">{sub.name || "-"}</td>
                              <td className="px-5 py-2.5 text-text-muted">{new Date(sub.created_at).toLocaleDateString()}</td>
                              <td className="px-5 py-2.5">
                                <button type="button" disabled={adding || removing || editingId !== null}
                                  onClick={() => { setEditingId(sub.id); setEditEmail(sub.email); setEditName(sub.name || ""); setEditError(null); }}
                                  className="text-brand text-[12px] whitespace-nowrap disabled:opacity-40">{t("edit")}</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      </div>
                      </>
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
