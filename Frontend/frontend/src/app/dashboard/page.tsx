'use client';

import { useEffect, useState } from 'react';
import {
  Package,
  Truck as TruckIcon,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Activity,
} from 'lucide-react';
import shipmentService, { Shipment, ShipmentStatus } from '@/services/shipmentService';
import truckService, { Truck } from '@/services/truckService';

function SkeletonBlock({ w = 'w-16' }: { w?: string }) {
  return <span className={`inline-block h-8 ${w} animate-pulse rounded-md bg-surface-200`} />;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  loading,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  sub?: string;
  accent: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-xl border border-surface-200 bg-surface-100 p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-400">{label}</span>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${accent}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-3xl font-bold text-slate-50">
        {loading ? <SkeletonBlock /> : value}
      </p>
      {sub && (
        <p className="mt-1 text-xs text-slate-500">{sub}</p>
      )}
    </div>
  );
}

const SHIPMENT_STATUS_STYLE: Record<ShipmentStatus, string> = {
  pending:    'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/25',
  paid:       'bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/25',
  assigned:   'bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/25',
  'in-transit': 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/25',
  delivered:  'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25',
};

const TRUCK_STATUS_STYLE: Record<string, string> = {
  available:    'bg-emerald-500/15 text-emerald-400',
  assigned:     'bg-violet-500/15 text-violet-400',
  'in-transit': 'bg-blue-500/15 text-blue-400',
  maintenance:  'bg-orange-500/15 text-orange-400',
};

export default function DashboardPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [trucks, setTrucks]       = useState<Truck[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    async function fetch() {
      try {
        const [sRes, tRes] = await Promise.all([
          shipmentService.getAll(),
          truckService.getAll(),
        ]);
        setShipments(sRes.data.data);
        setTrucks(tRes.data.data);
      } catch {
        // keep empty on error
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, []);

  const totalShipments  = shipments.length;
  const totalTrucks     = trucks.length;
  const availableTrucks = trucks.filter(t => t.status === 'available').length;
  const activeTrucks    = trucks.filter(t => t.status === 'assigned' || t.status === 'in-transit').length;
  const pendingCount    = shipments.filter(s => s.status === 'pending').length;
  const inTransitCount  = shipments.filter(s => s.status === 'in-transit').length;

  const recentShipments = [...shipments]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const metrics = [
    {
      icon: Package,
      label: 'Total Shipments',
      value: totalShipments,
      sub: `${pendingCount} pending · ${inTransitCount} in transit`,
      accent: 'bg-brand-500/15 text-brand-400',
    },
    {
      icon: TruckIcon,
      label: 'Total Fleet',
      value: totalTrucks,
      sub: `${availableTrucks} available`,
      accent: 'bg-emerald-500/15 text-emerald-400',
    },
    {
      icon: Activity,
      label: 'Active Trucks',
      value: activeTrucks,
      sub: 'assigned + in-transit',
      accent: 'bg-violet-500/15 text-violet-400',
    },
    {
      icon: Clock,
      label: 'Pending Deliveries',
      value: pendingCount,
      sub: pendingCount > 0 ? 'awaiting driver acceptance' : 'all caught up',
      accent: 'bg-amber-500/15 text-amber-400',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-50">Dashboard Overview</h1>
        <p className="mt-1 text-sm text-slate-400">
          Welcome back. Here&apos;s a live snapshot of your fleet.
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {metrics.map(m => (
          <MetricCard key={m.label} loading={loading} {...m} />
        ))}
      </div>

      {/* Two-column section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">

        {/* Recent Shipments — wider */}
        <div className="lg:col-span-3 rounded-xl border border-surface-200 bg-surface-100">
          <div className="flex items-center gap-2 border-b border-surface-200 px-5 py-4">
            <Package className="h-4 w-4 text-brand-400" />
            <h2 className="text-sm font-semibold text-slate-200">Recent Shipments</h2>
          </div>

          {loading ? (
            <div className="space-y-3 p-5">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-surface-200" />
              ))}
            </div>
          ) : recentShipments.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-500">
              <AlertCircle className="h-8 w-8 opacity-40" />
              <p className="text-sm">No shipments yet</p>
            </div>
          ) : (
            <div className="divide-y divide-surface-200">
              {recentShipments.map(s => (
                <div key={s.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-200">
                      {s.tracking_number}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                      <MapPin className="h-3 w-3 flex-shrink-0" />
                      {s.origin} → {s.destination}
                    </p>
                  </div>
                  <div className="ml-4 flex flex-shrink-0 items-center gap-3">
                    <span className="text-xs text-slate-500">{s.weight_kg.toLocaleString()} kg</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${SHIPMENT_STATUS_STYLE[s.status]}`}>
                      {s.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fleet Overview — narrower */}
        <div className="lg:col-span-2 rounded-xl border border-surface-200 bg-surface-100">
          <div className="flex items-center gap-2 border-b border-surface-200 px-5 py-4">
            <TruckIcon className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-slate-200">Fleet Overview</h2>
          </div>

          {loading ? (
            <div className="space-y-3 p-5">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-surface-200" />
              ))}
            </div>
          ) : trucks.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-slate-500">
              <TruckIcon className="h-8 w-8 opacity-40" />
              <p className="text-sm">No trucks registered</p>
            </div>
          ) : (
            <div className="divide-y divide-surface-200">
              {trucks.slice(0, 6).map(t => (
                <div key={t.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-200">{t.license_plate}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                      <MapPin className="h-3 w-3 flex-shrink-0" />
                      {t.current_location ?? 'Lagos'}
                    </p>
                  </div>
                  <div className="ml-3 flex flex-shrink-0 flex-col items-end gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${TRUCK_STATUS_STYLE[t.status] ?? ''}`}>
                      {t.status}
                    </span>
                    <span className="text-xs text-slate-500">{t.capacity_kg.toLocaleString()} kg</span>
                  </div>
                </div>
              ))}
              {trucks.length > 6 && (
                <p className="px-5 py-3 text-xs text-slate-500">+{trucks.length - 6} more trucks</p>
              )}
            </div>
          )}

          {/* Status summary pills */}
          {!loading && trucks.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-surface-200 px-5 py-4">
              {[
                { label: 'Available', count: availableTrucks, cls: 'bg-emerald-500/10 text-emerald-400' },
                { label: 'Active', count: activeTrucks, cls: 'bg-violet-500/10 text-violet-400' },
                { label: 'Maintenance', count: trucks.filter(t => t.status === 'maintenance').length, cls: 'bg-orange-500/10 text-orange-400' },
              ].map(p => (
                <span key={p.label} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${p.cls}`}>
                  <CheckCircle2 className="h-3 w-3" />
                  {p.count} {p.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
