import { SubscriberTable } from "@/components/subscriber-table";

export default function SubscribersPage() {
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Subscribers</h1>
      <SubscriberTable />
    </div>
  );
}
