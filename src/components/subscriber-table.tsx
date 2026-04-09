"use client";

import { useState, useEffect, useRef } from "react";
import type { Subscriber } from "@/lib/types";

export function SubscriberTable() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [search, setSearch] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [importResult, setImportResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchSubscribers = async () => {
    const params = search ? `?search=${encodeURIComponent(search)}` : "";
    const res = await fetch(`/api/subscribers${params}`);
    const data = await res.json();
    setSubscribers(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchSubscribers();
  }, [search]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;
    await fetch("/api/subscribers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail, name: newName || undefined }),
    });
    setNewEmail("");
    setNewName("");
    fetchSubscribers();
  };

  const handleRemove = async (id: number) => {
    await fetch(`/api/subscribers/${id}`, { method: "DELETE" });
    fetchSubscribers();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/subscribers/import", {
      method: "POST",
      body: formData,
    });
    const result = await res.json();
    setImportResult(
      `Imported: ${result.imported}, Skipped: ${result.skipped}`
    );
    fetchSubscribers();
    if (fileRef.current) fileRef.current.value = "";
    setTimeout(() => setImportResult(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Add subscriber form */}
      <form onSubmit={handleAdd} className="flex gap-3 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
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
            Name
          </label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Optional"
            className="border rounded-lg px-3 py-2 text-sm w-48"
          />
        </div>
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
        >
          Add
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
            Import CSV
          </button>
        </div>
      </form>

      {importResult && (
        <div className="bg-green-50 text-green-700 px-4 py-2 rounded-lg text-sm">
          {importResult}
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search subscribers..."
        className="border rounded-lg px-3 py-2 text-sm w-full max-w-sm"
      />

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Email
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Name
              </th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">
                Added
              </th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="text-center py-8 text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : subscribers.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-8 text-gray-500">
                  No subscribers yet
                </td>
              </tr>
            ) : (
              subscribers.map((sub) => (
                <tr key={sub.id} className="border-b last:border-0">
                  <td className="px-4 py-3">{sub.email}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {sub.name || "-"}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(sub.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleRemove(sub.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-gray-500">
        {subscribers.length} active subscriber{subscribers.length !== 1 && "s"}
      </p>
    </div>
  );
}
