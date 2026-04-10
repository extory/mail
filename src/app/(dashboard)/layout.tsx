import { Sidebar } from "@/components/sidebar";
import { LocaleProvider } from "@/components/locale-provider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LocaleProvider>
      <div className="flex min-h-screen bg-surface text-text-primary">
        <Sidebar />
        <main className="flex-1 p-10 overflow-auto">{children}</main>
      </div>
    </LocaleProvider>
  );
}
