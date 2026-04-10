"use client";

import { useState, useEffect } from "react";
import type { Group } from "@/lib/types";
import { useLocale } from "./locale-provider";

export function GroupManager() {
  const { t } = useLocale();
  const [groups, setGroups] = useState<Group[]>([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = async () => {
    const res = await fetch("/api/groups");
    setGroups(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    fetchGroups();
  }, []);

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

  const handleDelete = async (id: number) => {
    if (!confirm(t("groups.delete_confirm"))) return;
    await fetch(`/api/groups/${id}`, { method: "DELETE" });
    fetchGroups();
  };

  return (
    <div className="space-y-6">
      {/* Create group form */}
      <form onSubmit={handleCreate} className="flex gap-3 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t("groups.name")}
          </label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("groups.name.placeholder")}
            className="border rounded-lg px-3 py-2 text-sm w-64"
            required
          />
        </div>
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
        >
          {t("groups.create")}
        </button>
      </form>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Groups list */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <p className="text-gray-500 text-sm">{t("loading")}</p>
        ) : groups.length === 0 ? (
          <p className="text-gray-500 text-sm">{t("groups.no_groups")}</p>
        ) : (
          groups.map((group) => (
            <div
              key={group.id}
              className="bg-white border rounded-lg p-4 flex flex-col gap-2"
            >
              <div className="flex justify-between items-start">
                <h3 className="font-medium">{group.name}</h3>
                <button
                  onClick={() => handleDelete(group.id)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  {t("delete")}
                </button>
              </div>
              <p className="text-sm text-gray-500">
                {t("groups.count", { count: group.subscriber_count })}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
