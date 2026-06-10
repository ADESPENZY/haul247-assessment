'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { toast } from 'sonner';
import { LayoutDashboard, Package, Truck, LogOut } from 'lucide-react';
import authService from '@/services/authService';

const navLinks = [
  { href: '/dashboard',           label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/shipments', label: 'Shipments', icon: Package },
  { href: '/dashboard/trucks',    label: 'Trucks',    icon: Truck },
];

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch {
      // Non-fatal — clear the cookie regardless
    }
    Cookies.remove('token');
    toast.success('Logged out. See you soon!');
    router.push('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      {/* Sidebar */}
      <aside className="flex w-60 flex-shrink-0 flex-col border-r border-surface-200 bg-surface-100">
        <div className="flex h-16 flex-shrink-0 items-center border-b border-surface-200 px-6">
          <span className="text-xl font-bold tracking-tight text-slate-50">
            <span className="text-brand-400">Haul</span>247
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === '/dashboard' ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-brand-500/10 text-brand-400'
                    : 'text-slate-400 hover:bg-surface-200 hover:text-slate-50'
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex-shrink-0 border-t border-surface-200 p-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-surface-200 bg-surface-100 px-6">
          <p className="text-sm font-medium text-slate-400">Freight Management Platform</p>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg border border-surface-200 px-3 py-1.5 text-sm font-medium text-slate-400 transition hover:border-red-500/40 hover:text-red-400"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </header>

        <main className="flex-1 overflow-auto bg-slate-950 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
