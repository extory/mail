import { Sidebar } from "@/components/sidebar";
import { LocaleProvider } from "@/components/locale-provider";
import { ComposeFab } from "@/components/compose-fab";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LocaleProvider>
      <div className="flex flex-col md:flex-row min-h-screen bg-surface text-text-primary">
        <Sidebar />
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-10 overflow-auto">{children}</main>
        <ComposeFab />
      </div>
    </LocaleProvider>
  );
}
