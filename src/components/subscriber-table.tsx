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
  const [newGroupId, setNewGroupId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [importResult, setImportResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    fetchSubscribers();
  }, [search, filterGroupId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;
    await fetch("/api/subscribers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: newEmail,
        name: newName || undefined,
        groupId: newGroupId ? Number(newGroupId) : undefined,
      }),
    });
    setNewEmail("");
    setNewName("");
    fetchSubscribers();
  };

  const handleRemove = async (id: number) => {
    await fetch(`/api/subscribers/${id}`, { method: "DELETE" });
    fetchSubscribers();
  };

  const handleGroupChange = async (subscriberId: number, groupId: string) => {
    await fetch("/api/subscribers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: subscriberId,
        groupId: groupId ? Number(groupId) : null,
      }),
    });
    fetchSubscribers();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    if (newGroupId) formData.append("groupId", newGroupId);
    const res = await fetch("/api/subscribers/import", {
      method: "POST",
      body: formData,
    });
    const result = await res.json();
    setImportResult(t("subscribers.imported", { imported: result.imported, skipped: result.skipped }));
    fetchSubscribers();
    if (fileRef.current) fileRef.current.value = "";
    setTimeout(() => setImportResult(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Add subscriber form */}
      <form onSubmit={handleAdd} className="flex gap-3 items-end flex-wrap">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("subscribers.email")}
          </label>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="user@example.com"
            className="border rounded-lg px-3 py-2 text-sm w-64"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("subscribers.name")}
          </label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("subscribers.name.placeholder")}
            className="border rounded-lg px-3 py-2 text-sm w-40"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("subscribers.group")}
          </label>
          <select
            value={newGroupId}
            onChange={(e) => setNewGroupId(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm w-40"
          >
            <option value="">-</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
        >
          {t("add")}
        </button>
        <div className="ml-auto flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleImport}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-200 border"
          >
            {t("subscribers.import")}
          </button>
        </div>
      </form>

      {importResult && (
        <div className="bg-green-50 text-green-700 px-4 py-2 rounded-lg text-sm">
          {importResult}
        </div>
      )}

      {/* Search + Filter */}
      <div className="flex gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("subscribers.search")}
          className="border rounded-lg px-3 py-2 text-sm w-full max-w-sm"
        />
        <select
          value={filterGroupId}
          onChange={(e) => setFilterGroupId(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">{t("subscribers.all_groups")}</option>
          <option value="0">{t("subscribers.no_group")}</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">{t("subscribers.email")}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">{t("subscribers.name")}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">{t("subscribers.group")}</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">{t("subscribers.added")}</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-500">{t("loading")}</td>
              </tr>
            ) : subscribers.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-500">{t("subscribers.no_subscribers")}</td>
              </tr>
            ) : (
              subscribers.map((sub) => (
                <tr key={sub.id} className="border-b last:border-0">
                  <td className="px-4 py-3">{sub.email}</td>
                  <td className="px-4 py-3 text-gray-600">{sub.name || "-"}</td>
                  <td className="px-4 py-3">
                    <select
                      value={sub.group_id ?? ""}
                      onChange={(e) => handleGroupChange(sub.id, e.target.value)}
                      className="border rounded px-2 py-1 text-xs"
                    >
                      <option value="">-</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(sub.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleRemove(sub.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
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

      <p className="text-sm text-gray-500">
        {t("subscribers.count", { count: subscribers.length })}
      </p>
    </div>
  );
}
