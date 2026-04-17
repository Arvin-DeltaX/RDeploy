"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Shield, User, LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { useAuthStore } from "@/store/auth.store";
import { useLogout } from "@/hooks/useAuth";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  {
    label: "Dashboard",
    href: ROUTES.DASHBOARD,
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    label: "Teams",
    href: ROUTES.TEAMS,
    icon: <Users className="h-4 w-4" />,
  },
  {
    label: "Admin",
    href: ROUTES.ADMIN,
    icon: <Shield className="h-4 w-4" />,
    adminOnly: true,
  },
  {
    label: "Profile",
    href: ROUTES.PROFILE,
    icon: <User className="h-4 w-4" />,
  },
];

function SidebarContent({
  onNavClick,
}: {
  onNavClick?: () => void;
}) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const logout = useLogout();

  const isAdmin = user?.platformRole === "owner" || user?.platformRole === "admin";
  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <>
      <div className="flex h-14 items-center px-4 border-b border-border">
        <span className="text-lg font-bold text-foreground">RDeploy</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {visibleItems.map((item) => {
          const active =
            item.href === ROUTES.DASHBOARD
              ? pathname === item.href
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-2">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="flex h-14 items-center justify-between px-4 border-b border-border bg-card md:hidden fixed top-0 left-0 right-0 z-40">
        <span className="text-lg font-bold text-foreground">RDeploy</span>
        <button
          onClick={() => setMobileOpen(true)}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 flex h-screen w-56 flex-col border-r border-border bg-card transition-transform duration-200 md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" />
        </button>
        <SidebarContent onNavClick={() => setMobileOpen(false)} />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex h-screen w-56 flex-col border-r border-border bg-card">
        <SidebarContent />
      </aside>
    </>
  );
}
