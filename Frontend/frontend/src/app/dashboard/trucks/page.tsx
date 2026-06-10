'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Loader2, MapPin, ChevronDown, ChevronUp, CircleCheck, Truck as TruckIcon } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import Modal from '@/components/ui/Modal';
import truckService, { Truck } from '@/services/truckService';
import shipmentService, { Shipment } from '@/services/shipmentService';

type TruckStatus = Truck['status'];

const STATUS: Record<TruckStatus, { label: string; cls: string }> = {
  available:    { label: 'Available',   cls: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/20' },
  assigned:     { label: 'Assigned',    cls: 'bg-violet-500/15  text-violet-400  ring-violet-500/20'  },
  'in-transit': { label: 'In Transit',  cls: 'bg-amber-500/15   text-amber-400   ring-amber-500/20'   },
  maintenance:  { label: 'Maintenance', cls: 'bg-rose-500/15    text-rose-400    ring-rose-500/20'     },
};

const ALL_STATUSES: TruckStatus[] = ['available', 'assigned', 'in-transit', 'maintenance'];

const input =
  'w-full rounded-lg border border-surface-200 bg-slate-950 px-4 py-2.5 text-slate-50 placeholder-slate-500 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

export default function TrucksPage() {
  const [trucks, setTrucks]               = useState<Truck[]>([]);
  const [pendingShipments, setPending]    = useState<Shipment[]>([]);
  const [loading, setLoading]             = useState(true);
  const [modalOpen, setModalOpen]         = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [updatingId, setUpdatingId]       = useState<number | null>(null);
  const [expandedTruckId, setExpanded]    = useState<number | null>(null);
  const [acceptingId, setAcceptingId]     = useState<string | null>(null);

  // Inline location edit
  const [locationEditing, setLocEditing]  = useState<number | null>(null);
  const [locationValue, setLocValue]      = useState('');

  // Registration form
  const [plate, setPlate]                 = useState('');
  const [capacity, setCapacity]           = useState('');
  const [location, setLocation]           = useState('Lagos');
  const [formStatus, setFormStatus]       = useState<TruckStatus>('available');

  // ── Data loaders ──────────────────────────────────────────────────────────

  const loadTrucks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await truckService.getAll();
      setTrucks(res.data.data);
    } catch {
      toast.error('Failed to load fleet data.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPendingShipments = useCallback(() => {
    shipmentService.getAll()
      .then((r) => setPending(r.data.data.filter((s) => s.status === 'pending' || s.status === 'paid')))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadTrucks();
    loadPendingShipments();
  }, [loadTrucks, loadPendingShipments]);

  // ── Registration form ──────────────────────────────────────────────────────

  const resetForm = () => {
    setPlate('');
    setCapacity('');
    setLocation('Lagos');
    setFormStatus('available');
  };

  const closeModal = () => {
    setModalOpen(false);
    resetForm();
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await truckService.create({
        license_plate:    plate.trim().toUpperCase(),
        capacity_kg:      Number(capacity),
        status:           formStatus,
        current_location: location.trim() || 'Lagos',
      });
      toast.success('Truck registered and added to the fleet.');
      closeModal();
      loadTrucks();
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.message ?? 'Registration failed. Please try again.')
        : 'An unexpected error occurred.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Quick status update (optimistic) ──────────────────────────────────────

  const handleStatusChange = async (truck: Truck, next: TruckStatus) => {
    if (next === truck.status) return;
    setUpdatingId(truck.id);
    setTrucks((prev) =>
      prev.map((t) => (t.id === truck.id ? { ...t, status: next } : t))
    );
    try {
      await truckService.update(truck.id, { status: next });
      toast.success(`${truck.license_plate} → ${STATUS[next].label}.`);
    } catch (err) {
      setTrucks((prev) =>
        prev.map((t) => (t.id === truck.id ? { ...t, status: truck.status } : t))
      );
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.message ?? 'Status update failed.')
        : 'An unexpected error occurred.';
      toast.error(msg);
    } finally {
      setUpdatingId(null);
    }
  };

  // ── Inline location edit ───────────────────────────────────────────────────

  const handleLocationSave = async (truck: Truck) => {
    const next = locationValue.trim();
    setLocEditing(null);
    if (next === truck.current_location || !next) return;
    setTrucks((prev) =>
      prev.map((t) => (t.id === truck.id ? { ...t, current_location: next } : t))
    );
    try {
      await truckService.update(truck.id, { current_location: next });
    } catch {
      setTrucks((prev) =>
        prev.map((t) => (t.id === truck.id ? { ...t, current_location: truck.current_location } : t))
      );
      toast.error('Failed to save location.');
    }
  };

  // ── Accept shipment offer ──────────────────────────────────────────────────

  const handleAcceptShipment = async (truck: Truck, shipment: Shipment) => {
    const key = `${truck.id}-${shipment.id}`;
    setAcceptingId(key);
    try {
      await truckService.acceptShipment(truck.id, shipment.id);
      toast.success(`${truck.license_plate} accepted ${shipment.tracking_number}.`);
      setExpanded(null);
      await Promise.all([loadTrucks(), loadPendingShipments()]);
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.message ?? 'Failed to accept shipment.')
        : 'An unexpected error occurred.';
      toast.error(msg);
    } finally {
      setAcceptingId(null);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const COL_COUNT = 7;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-50">Fleet Management</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Register Truck
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-surface-200">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-surface-200 bg-surface-100">
            <tr>
              {['License Plate', 'Capacity', 'Location', 'Status', 'Quick Update', 'Registered', 'Jobs'].map((h) => (
                <th key={h} className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-200">
            {loading ? (
              <tr>
                <td colSpan={COL_COUNT} className="py-20 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-brand-400" />
                </td>
              </tr>
            ) : trucks.length === 0 ? (
              <tr>
                <td colSpan={COL_COUNT} className="py-20 text-center text-slate-400">
                  No trucks in the fleet yet.{' '}
                  <button
                    onClick={() => setModalOpen(true)}
                    className="text-brand-400 underline-offset-4 hover:underline"
                  >
                    Register your first truck.
                  </button>
                </td>
              </tr>
            ) : (
              trucks.map((truck) => {
                // Shipments visible to THIS truck:
                //   • truck_id is null  → open-market (anyone can take it)
                //   • truck_id === truck.id → directly targeted at this truck
                const visibleShipments = pendingShipments.filter(
                  (s) => s.truck_id === null || s.truck_id === truck.id
                );
                const compatibleOffers = visibleShipments.filter(
                  (s) => s.weight_kg <= truck.capacity_kg
                );
                return (
                <React.Fragment key={truck.id}>
                  {/* Main truck row */}
                  <tr key={truck.id} className="bg-slate-950 transition hover:bg-surface-100/40">
                    <td className="px-5 py-4 font-mono text-sm font-semibold text-slate-50">
                      {truck.license_plate}
                    </td>
                    <td className="px-5 py-4 text-slate-300">
                      {truck.capacity_kg.toLocaleString()} kg
                    </td>

                    {/* Inline-editable location */}
                    <td className="px-5 py-4">
                      {locationEditing === truck.id ? (
                        <input
                          autoFocus
                          value={locationValue}
                          onChange={(e) => setLocValue(e.target.value)}
                          onBlur={() => handleLocationSave(truck)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleLocationSave(truck);
                            if (e.key === 'Escape') setLocEditing(null);
                          }}
                          className="w-28 rounded border border-brand-500 bg-slate-900 px-2 py-1 text-xs text-slate-50 outline-none"
                        />
                      ) : (
                        <button
                          title="Click to edit location"
                          onClick={() => { setLocEditing(truck.id); setLocValue(truck.current_location); }}
                          className="flex items-center gap-1.5 text-slate-400 transition hover:text-slate-200"
                        >
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                          <span className="text-xs">{truck.current_location || '—'}</span>
                        </button>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS[truck.status].cls}`}>
                        {STATUS[truck.status].label}
                      </span>
                    </td>

                    {/* Quick status dropdown */}
                    <td className="px-5 py-4">
                      <div className="relative inline-flex items-center gap-1.5">
                        <select
                          value={truck.status}
                          disabled={updatingId === truck.id}
                          onChange={(e) => handleStatusChange(truck, e.target.value as TruckStatus)}
                          className="appearance-none rounded-lg border border-surface-200 bg-surface-100 py-1.5 pl-3 pr-7 text-xs font-medium text-slate-300 outline-none transition hover:border-brand-500 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50"
                        >
                          {ALL_STATUSES.map((s) => (
                            <option key={s} value={s}>{STATUS[s].label}</option>
                          ))}
                        </select>
                        {updatingId === truck.id && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-400" />
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-4 text-slate-400">{fmtDate(truck.created_at)}</td>

                    {/* Job board toggle — only for available trucks */}
                    <td className="px-5 py-4">
                      {truck.status === 'available' ? (
                        <button
                          onClick={() => setExpanded(expandedTruckId === truck.id ? null : truck.id)}
                          className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:border-violet-500 hover:text-violet-400"
                        >
                          {expandedTruckId === truck.id
                            ? <ChevronUp className="h-3.5 w-3.5" />
                            : <ChevronDown className="h-3.5 w-3.5" />}
                          {compatibleOffers.length > 0
                            ? `${compatibleOffers.length} Offer${compatibleOffers.length !== 1 ? 's' : ''}`
                            : 'No Offers'}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                  </tr>

                  {/* Expandable job board row */}
                  {expandedTruckId === truck.id && (
                    <tr key={`${truck.id}-jobs`}>
                      <td colSpan={COL_COUNT} className="border-b border-surface-200 bg-slate-900/60 px-5 py-4">
                        <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                          {/* Job board header */}
                          <div className="mb-3 flex items-center gap-2">
                            <TruckIcon className="h-4 w-4 text-violet-400" />
                            <span className="text-sm font-semibold text-slate-200">
                              Available Shipment Offers
                            </span>
                            <span className="ml-auto text-xs text-slate-500">
                              {truck.license_plate} · {truck.capacity_kg.toLocaleString()} kg capacity · {truck.current_location}
                            </span>
                          </div>

                          {visibleShipments.length === 0 ? (
                            <p className="py-3 text-center text-sm text-slate-500">
                              No shipments are addressed to this truck.
                            </p>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {visibleShipments.map((shipment) => {
                                const overCapacity = shipment.weight_kg > truck.capacity_kg;
                                const isTargeted  = shipment.truck_id === truck.id;
                                const key = `${truck.id}-${shipment.id}`;
                                const loading = acceptingId === key;
                                return (
                                  <div
                                    key={shipment.id}
                                    className={`flex items-center justify-between rounded-lg border px-4 py-3 transition ${overCapacity ? 'border-red-500/20 bg-red-500/5' : isTargeted ? 'border-violet-500/30 bg-violet-500/5' : 'border-surface-200 bg-slate-950'}`}
                                  >
                                    <div className="flex flex-wrap items-center gap-4 text-sm">
                                      <span className="font-mono text-xs font-medium text-brand-400">
                                        {shipment.tracking_number}
                                      </span>
                                      {isTargeted && (
                                        <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-400 ring-1 ring-violet-500/30">
                                          Targeted
                                        </span>
                                      )}
                                      <span className="text-slate-300">
                                        {shipment.origin} → {shipment.destination}
                                      </span>
                                      <span className={`text-xs font-medium ${overCapacity ? 'text-red-400' : 'text-slate-400'}`}>
                                        {shipment.weight_kg.toLocaleString()} kg
                                        {overCapacity && ' · exceeds capacity'}
                                      </span>
                                    </div>
                                    <button
                                      disabled={!!acceptingId || overCapacity}
                                      onClick={() => handleAcceptShipment(truck, shipment)}
                                      className="ml-4 flex shrink-0 items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      {loading
                                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        : <CircleCheck className="h-3.5 w-3.5" />}
                                      {overCapacity ? 'Over Capacity' : 'Accept Offer'}
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Registration Modal */}
      <Modal isOpen={modalOpen} onClose={closeModal} title="Register New Truck">
        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-300">License Plate</label>
            <input
              required
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              placeholder="e.g. ABC-123-XY"
              className={input}
              spellCheck={false}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-300">
                Capacity <span className="font-normal text-slate-500">(kg)</span>
              </label>
              <input
                type="number"
                required
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="e.g. 5000"
                className={input}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-300">Starting Location</label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Lagos"
                className={input}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-300">Initial Status</label>
            <select
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value as TruckStatus)}
              className={input}
            >
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS[s].label}</option>
              ))}
            </select>
          </div>

          <div className="mt-2 flex justify-end gap-3 border-t border-surface-200 pt-4">
            <button
              type="button"
              onClick={closeModal}
              className="rounded-lg border border-surface-200 px-4 py-2 text-sm font-medium text-slate-400 transition hover:border-slate-500 hover:text-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Registering…' : 'Register Truck'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
