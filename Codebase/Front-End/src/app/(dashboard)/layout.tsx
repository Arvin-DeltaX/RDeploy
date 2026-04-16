import { DashboardGuard } from "@/components/providers/DashboardGuard";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardGuard>
      <div className="min-h-screen bg-background">
        <main className="p-6">{children}</main>
      </div>
    </DashboardGuard>
  );
}
