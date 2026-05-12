"use client";

import { useState, useEffect, useRef } from "react";
import type { Subscriber, Group } from "@/lib/types";
import { useLocale } from "./locale-provider";

export function SubscriberTable() {
  const { t } = useLocale();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [search, setSearch] = useState("");
  const [filterGroupId, setFilterGroupId] = useState<string>("");
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newGroupIds, setNewGroupIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [openGroupPickerForId, setOpenGroupPickerForId] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const groupPickerRef = useRef<HTMLDivElement>(null);

  const fetchGroups = async () => {
    const res = await fetch("/api/groups");
    setGroups(await res.json());
  };

  const fetchSubscribers = async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (filterGroupId) params.set("groupId", filterGroupId);
    const qs = params.toString();
    const res = await fetch(`/api/subscribers${qs ? `?${qs}` : ""}`);
    setSubscribers(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchGroups(); }, []);
  useEffect(() => { fetchSubscribers(); }, [search, filterGroupId]);

  // Close popover when clicking outside
  useEffect(() => {
    if (openGroupPickerForId === null) return;
    const handler = (e: MouseEvent) => {
      if (groupPickerRef.current && !groupPickerRef.current.contains(e.target as Node)) {
        setOpenGroupPickerForId(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openGroupPickerForId]);

  const toggleNewGroupId = (id: number) => {
    setNewGroupIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;
    await fetch("/api/subscribers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: newEmail,
        name: newName || undefined,
        groupIds: newGroupIds,
      }),
    });
    setNewEmail("");
    setNewName("");
    setNewGroupIds([]);
    fetchSubscribers();
    fetchGroups();
  };

  const handleRemove = async (id: number) => {
    await fetch(`/api/subscribers/${id}`, { method: "DELETE" });
    fetchSubscribers();
    fetchGroups();
  };

  const handleGroupToggle = async (subscriberId: number, groupId: number) => {
    const sub = subscribers.find((s) => s.id === subscriberId);
    if (!sub) return;
    const currentIds = sub.groups.map((g) => g.id);
    const nextIds = currentIds.includes(groupId)
      ? currentIds.filter((id) => id !== groupId)
      : [...currentIds, groupId];
    await fetch("/api/subscribers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: subscriberId, groupIds: nextIds }),
    });
    fetchSubscribers();
    fetchGroups();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    if (newGroupIds.length > 0) formData.append("groupIds", newGroupIds.join(","));
    const res = await fetch("/api/subscribers/import", { method: "POST", body: formData });
    const result = await res.json();
    setImportResult(t("subscribers.imported", { imported: result.imported, skipped: result.skipped }));
    fetchSubscribers();
    fetchGroups();
    if (fileRef.current) fileRef.current.value = "";
    setTimeout(() => setImportResult(null), 3000);
  };

  const handleDownloadTemplate = () => {
    const csv = `email,name,groups
user@example.com,John Doe,VIP;Newsletter
another@example.com,Jane,Newsletter
plain@example.com,,
`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subscribers_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const inputClass = "border border-border rounded-lg px-3 h-[38px] text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all placeholder:text-text-muted";
  const selectClass = "border border-border rounded-lg px-3 h-[38px] text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all";

  return (
    <div className="space-y-4">
      {/* Add subscriber */}
      <div className="bg-surface-card border border-border rounded-xl p-5">
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
                {t("subscribers.email")}
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="user@example.com"
                className={`${inputClass} w-full`}
                required
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
                {t("subscribers.name")}
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t("subscribers.name.placeholder")}
                className={`${inputClass} w-full`}
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
                {t("subscribers.groups")}
              </label>
              {groups.length === 0 ? (
                <div className={`${selectClass} w-full flex items-center text-text-muted`}>
                  {t("groups.no_groups")}
                </div>
              ) : (
                <div className="border border-border rounded-lg bg-white p-1.5 flex flex-wrap gap-1 min-h-[38px]">
                  {groups.map((g) => {
                    const checked = newGroupIds.includes(g.id);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => toggleNewGroupId(g.id)}
                        className={`text-[11px] px-2 py-1 rounded-md font-medium transition-colors ${
                          checked
                            ? "bg-brand text-white"
                            : "bg-surface text-text-secondary hover:bg-border-light"
                        }`}
                      >
                        {g.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="bg-brand text-white px-5 py-2 rounded-lg text-[13px] font-medium hover:bg-brand-dark transition-colors"
            >
              {t("add")}
            </button>
            <div className="h-5 w-px bg-border mx-1" />
            <input ref={fileRef} type="file" accept=".csv" onChange={handleImport} className="hidden" />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="border border-border text-text-secondary px-4 py-2 rounded-lg text-[13px] font-medium hover:bg-surface hover:text-text-primary transition-colors"
            >
              {t("subscribers.import")}
            </button>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="text-text-muted hover:text-brand text-[12px] font-medium transition-colors flex items-center gap-1"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {t("subscribers.download_template")}
            </button>
          </div>
        </form>
      </div>

      {importResult && (
        <div className="bg-success/10 text-success px-4 py-2.5 rounded-lg text-[13px] font-medium">
          {importResult}
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("subscribers.search")}
            className={`${inputClass} w-full pl-9`}
          />
        </div>
        <select
          value={filterGroupId}
          onChange={(e) => setFilterGroupId(e.target.value)}
          className={selectClass}
        >
          <option value="">{t("subscribers.all_groups")}</option>
          <option value="0">{t("subscribers.no_group")}</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-surface-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border-light bg-surface">
              <th className="text-left px-5 py-3 font-medium text-text-secondary text-[12px]">{t("subscribers.email")}</th>
              <th className="text-left px-5 py-3 font-medium text-text-secondary text-[12px]">{t("subscribers.name")}</th>
              <th className="text-left px-5 py-3 font-medium text-text-secondary text-[12px]">{t("subscribers.groups")}</th>
              <th className="text-left px-5 py-3 font-medium text-text-secondary text-[12px]">{t("subscribers.added")}</th>
              <th className="text-right px-5 py-3 font-medium text-text-secondary text-[12px]">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-text-muted text-[13px]">{t("loading")}</td>
              </tr>
            ) : subscribers.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12 text-text-muted text-[13px]">{t("subscribers.no_subscribers")}</td>
              </tr>
            ) : (
              subscribers.map((sub) => (
                <tr key={sub.id} className="border-b border-border-light last:border-0 hover:bg-surface/50 transition-colors">
                  <td className="px-5 py-3 text-text-primary">{sub.email}</td>
                  <td className="px-5 py-3 text-text-secondary">{sub.name || "-"}</td>
                  <td className="px-5 py-3 relative">
                    <button
                      type="button"
                      onClick={() => setOpenGroupPickerForId(openGroupPickerForId === sub.id ? null : sub.id)}
                      className="flex flex-wrap gap-1 max-w-[280px] items-center hover:bg-surface px-1 -mx-1 rounded transition-colors min-h-[24px]"
                    >
                      {sub.groups.length === 0 ? (
                        <span className="text-[11px] text-text-muted italic">{t("subscribers.click_to_assign")}</span>
                      ) : (
                        sub.groups.map((g) => (
                          <span
                            key={g.id}
                            className="inline-flex items-center text-[11px] px-2 py-0.5 rounded-md bg-brand/10 text-brand font-medium"
                          >
                            {g.name}
                          </span>
                        ))
                      )}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted ml-0.5">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                    {openGroupPickerForId === sub.id && (
                      <div
                        ref={groupPickerRef}
                        className="absolute z-10 top-full left-5 mt-1 bg-white border border-border rounded-lg shadow-lg py-1.5 min-w-[180px] max-h-[240px] overflow-y-auto"
                      >
                        {groups.length === 0 ? (
                          <div className="px-3 py-2 text-[12px] text-text-muted">{t("groups.no_groups")}</div>
                        ) : (
                          groups.map((g) => {
                            const checked = sub.groups.some((sg) => sg.id === g.id);
                            return (
                              <button
                                key={g.id}
                                type="button"
                                onClick={() => handleGroupToggle(sub.id, g.id)}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-[12px] text-text-primary hover:bg-surface transition-colors text-left"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  readOnly
                                  className="w-3.5 h-3.5 rounded border-border text-brand pointer-events-none"
                                />
                                {g.name}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-text-muted">
                    {new Date(sub.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => handleRemove(sub.id)}
                      className="text-danger hover:text-danger/80 text-[12px] font-medium transition-colors"
                    >
                      {t("remove")}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[12px] text-text-muted">
        {t("subscribers.count", { count: subscribers.length })}
      </p>
    </div>
  );
}
