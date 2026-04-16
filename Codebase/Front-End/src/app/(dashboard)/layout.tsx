import { DashboardGuard } from "@/components/providers/DashboardGuard";
import { Sidebar } from "@/components/organisms/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardGuard>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </DashboardGuard>
  );
}
