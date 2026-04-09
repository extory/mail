import { HistoryTable } from "@/components/history-table";

export default function HistoryPage() {
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Send History</h1>
      <HistoryTable />
    </div>
  );
}
