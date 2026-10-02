import { Sidebar } from "@/components/sidebar";
import { LocaleProvider } from "@/components/locale-provider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LocaleProvider>
      <div className="flex flex-col md:flex-row min-h-screen bg-surface text-text-primary">
        <Sidebar />
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 p-4 sm:p-6 xl:p-8">{children}</main>
      </div>
    </LocaleProvider>
  );
}
