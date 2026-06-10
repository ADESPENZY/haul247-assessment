'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Loader2, Brain, ChevronRight, Sparkles, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import Modal from '@/components/ui/Modal';
import shipmentService, {
  Shipment,
  ShipmentStatus,
  ShipmentAnalysis,
  TruckRecommendation,
} from '@/services/shipmentService';
import truckService, { Truck } from '@/services/truckService';

// ── Status badge config ──────────────────────────────────────────────────────

const STATUS: Record<ShipmentStatus, { label: string; cls: string }> = {
  pending:      { label: 'Pending',    cls: 'bg-amber-500/15 text-amber-400 ring-amber-500/20' },
  paid:         { label: 'Paid',       cls: 'bg-blue-500/15 text-blue-400 ring-blue-500/20' },
  assigned:     { label: 'Assigned',   cls: 'bg-purple-500/15 text-purple-400 ring-purple-500/20' },
  'in-transit': { label: 'In Transit', cls: 'bg-orange-500/15 text-orange-400 ring-orange-500/20' },
  delivered:    { label: 'Delivered',  cls: 'bg-emerald-500/15 text-emerald-400 ring-emerald-500/20' },
};

// ── Status advancement map ───────────────────────────────────────────────────
// pending / paid: no operator button — truck must accept via the Job Board.
// assigned → in-transit → delivered: operator-controlled after truck accepts.

const NEXT_STATUS: Partial<Record<ShipmentStatus, { label: string; next: ShipmentStatus }>> = {
  assigned:     { label: 'Start Transit', next: 'in-transit' },
  'in-transit': { label: 'Mark Delivered', next: 'delivered' },
};

// ── AI risk-level config ─────────────────────────────────────────────────────

type RiskLevel = ShipmentAnalysis['risk_level'];

const RISK: Record<RiskLevel, { label: string; badge: string; glow: string; bar: string }> = {
  Low:    {
    label: 'Low Risk',
    badge: 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/40',
    glow:  'shadow-emerald-500/20',
    bar:   'bg-emerald-500',
  },
  Medium: {
    label: 'Medium Risk',
    badge: 'bg-amber-500/20 text-amber-300 ring-amber-500/40',
    glow:  'shadow-amber-500/20',
    bar:   'bg-amber-500',
  },
  High:   {
    label: 'High Risk',
    badge: 'bg-red-500/20 text-red-400 ring-red-500/40',
    glow:  'shadow-red-500/20',
    bar:   'bg-red-500',
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const input =
  'w-full rounded-lg border border-surface-200 bg-slate-950 px-4 py-2.5 text-slate-50 placeholder-slate-500 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ShipmentsPage() {
  // Table
  const [shipments, setShipments]   = useState<Shipment[]>([]);
  const [trucks, setTrucks]         = useState<Truck[]>([]);
  const [loading, setLoading]       = useState(true);

  // Booking modal
  const [modalOpen, setModalOpen]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [origin, setOrigin]         = useState('');
  const [destination, setDest]      = useState('');
  const [weightKg, setWeight]       = useState('');
  const [truckId, setTruckId]       = useState('');

  // AI truck suggestion
  const [suggesting, setSuggesting]       = useState(false);
  const [aiRec, setAiRec]                 = useState<TruckRecommendation | null>(null);

  // Payment
  const [payingId, setPayingId]     = useState<number | null>(null);

  // AI analysis modal
  const [aiOpen, setAiOpen]         = useState(false);
  const [aiShipment, setAiShipment] = useState<Shipment | null>(null);
  const [aiLoading, setAiLoading]   = useState(false);
  const [aiReport, setAiReport]     = useState<ShipmentAnalysis | null>(null);

  // ── Derived: only available trucks in dropdown ─────────────────────────────

  const availableTrucks = trucks.filter((t) => t.status === 'available');

  // ── Derived: capacity guard ────────────────────────────────────────────────

  const selectedTruck = truckId ? trucks.find((t) => t.id === Number(truckId)) : null;
  const capacityError =
    selectedTruck && weightKg && Number(weightKg) > selectedTruck.capacity_kg
      ? `Exceeds truck capacity (max ${selectedTruck.capacity_kg.toLocaleString()} kg)`
      : null;

  // ── Data fetching ──────────────────────────────────────────────────────────

  const loadShipments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await shipmentService.getAll();
      setShipments(res.data.data);
    } catch {
      toast.error('Failed to load shipments.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTrucks = useCallback(() => {
    truckService.getAll().then((r) => setTrucks(r.data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    loadShipments();
    loadTrucks();
  }, [loadShipments, loadTrucks]);

  // ── Booking handlers ───────────────────────────────────────────────────────

  const resetForm = () => {
    setOrigin('');
    setDest('');
    setWeight('');
    setTruckId('');
    setAiRec(null);
  };

  const closeModal = () => {
    setModalOpen(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (capacityError) return;
    setSubmitting(true);
    try {
      await shipmentService.create({
        origin,
        destination,
        weight_kg: Number(weightKg),
        truck_id: truckId ? Number(truckId) : null,
      });
      toast.success('Shipment booked successfully! Tracking number assigned.');
      closeModal();
      loadShipments();
      loadTrucks();
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.message ?? 'Booking failed. Please try again.')
        : 'An unexpected error occurred.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── AI truck suggestion ────────────────────────────────────────────────────

  const handleSuggest = async () => {
    setSuggesting(true);
    setAiRec(null);
    try {
      const { data } = await shipmentService.recommendTruck({
        origin,
        destination,
        weight_kg: Number(weightKg),
      });
      setTruckId(String(data.truck_id));
      setAiRec(data);
      toast.success('AI selected the best available truck.');
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.message ?? 'AI suggestion failed.')
        : 'Unable to reach the AI service.';
      toast.error(msg);
    } finally {
      setSuggesting(false);
    }
  };

  // ── Payment handler ────────────────────────────────────────────────────────

  const handlePay = async (shipment: Shipment) => {
    setPayingId(shipment.id);
    try {
      const { data } = await shipmentService.initiatePayment(shipment.id);
      toast.success('Redirecting to Paystack…');
      window.open(data.data.authorization_url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.message ?? 'Payment initiation failed.')
        : 'Unable to reach payment gateway.';
      toast.error(msg);
    } finally {
      setPayingId(null);
    }
  };

  // ── Status advance handler ─────────────────────────────────────────────────

  const advanceStatus = async (shipment: Shipment) => {
    const transition = NEXT_STATUS[shipment.status];
    if (!transition) return;
    try {
      const { data } = await shipmentService.update(shipment.id, { status: transition.next });
      setShipments((prev) => prev.map((s) => (s.id === data.id ? data : s)));
      toast.success(`${data.tracking_number} → ${STATUS[transition.next].label}`);
    } catch {
      toast.error('Failed to update shipment status.');
    }
  };

  // ── AI analysis handlers ───────────────────────────────────────────────────

  const openAiAnalysis = async (shipment: Shipment) => {
    setAiShipment(shipment);
    setAiReport(null);
    setAiLoading(true);
    setAiOpen(true);

    try {
      const { data } = await shipmentService.analyze(shipment.id);
      setAiReport(data);
    } catch (err) {
      const msg = axios.isAxiosError(err)
        ? (err.response?.data?.message ?? 'AI analysis failed. Please try again.')
        : 'Unable to reach the AI service.';
      toast.error(msg);
      setAiOpen(false);
    } finally {
      setAiLoading(false);
    }
  };

  const closeAiModal = () => {
    setAiOpen(false);
    setAiShipment(null);
    setAiReport(null);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-50">Shipments</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Book Freight
        </button>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-surface-200">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-surface-200 bg-surface-100">
            <tr>
              {['Tracking #', 'Origin', 'Destination', 'Weight', 'Status', 'Created', 'Actions'].map((h) => (
                <th key={h} className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-200">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-20 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-brand-400" />
                </td>
              </tr>
            ) : shipments.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-20 text-center text-slate-400">
                  No shipments yet.{' '}
                  <button
                    onClick={() => setModalOpen(true)}
                    className="text-brand-400 underline-offset-4 hover:underline"
                  >
                    Book your first freight.
                  </button>
                </td>
              </tr>
            ) : (
              shipments.map((s) => (
                <tr key={s.id} className="bg-slate-950 transition hover:bg-surface-100/40">
                  <td className="px-5 py-4 font-mono text-xs font-medium text-brand-400">
                    {s.tracking_number}
                  </td>
                  <td className="px-5 py-4 text-slate-300">{s.origin}</td>
                  <td className="px-5 py-4 text-slate-300">{s.destination}</td>
                  <td className="px-5 py-4 text-slate-400">{s.weight_kg.toLocaleString()} kg</td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS[s.status].cls}`}
                    >
                      {STATUS[s.status].label}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-400">{fmtDate(s.created_at)}</td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-1.5">
                      {/* Pay Now button — only for pending shipments */}
                      {s.status === 'pending' && (
                        <button
                          onClick={() => handlePay(s)}
                          disabled={payingId === s.id}
                          className="flex items-center gap-1.5 rounded-lg border border-emerald-700/50 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {payingId === s.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <CreditCard className="h-3.5 w-3.5" />}
                          {payingId === s.id ? 'Redirecting…' : 'Pay Now'}
                        </button>
                      )}
                      {/* Status advance button — assigned / in-transit */}
                      {NEXT_STATUS[s.status] && (
                        <button
                          onClick={() => advanceStatus(s)}
                          className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:border-violet-500 hover:text-violet-400"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                          {NEXT_STATUS[s.status]!.label}
                        </button>
                      )}
                      {/* AI Analysis button */}
                      <button
                        onClick={() => openAiAnalysis(s)}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:border-sky-500 hover:text-sky-400"
                      >
                        <Brain className="h-3.5 w-3.5" />
                        AI Analysis
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Booking Modal ──────────────────────────────────────────────────── */}
      <Modal isOpen={modalOpen} onClose={closeModal} title="Book New Freight">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-300">Origin</label>
              <input
                required
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="e.g. Lagos"
                className={input}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-slate-300">Destination</label>
              <input
                required
                value={destination}
                onChange={(e) => setDest(e.target.value)}
                placeholder="e.g. Abuja"
                className={input}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-300">
              Weight <span className="text-slate-500">(kg)</span>
            </label>
            <input
              type="number"
              required
              min={1}
              value={weightKg}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="e.g. 500"
              className={`${input} ${capacityError ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
            />
            {capacityError && (
              <p className="text-xs font-medium text-red-400">{capacityError}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            {/* Label row + AI suggest button */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-300">
                Assign Truck{' '}
                <span className="text-slate-500 font-normal">(optional — available only)</span>
              </label>
              <button
                type="button"
                disabled={suggesting || !origin.trim() || !destination.trim() || !weightKg || availableTrucks.length === 0}
                onClick={handleSuggest}
                className="flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-400 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {suggesting
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <Sparkles className="h-3 w-3" />}
                {suggesting ? 'Thinking…' : 'Suggest Best Truck'}
              </button>
            </div>

            <select
              value={truckId}
              onChange={(e) => { setTruckId(e.target.value); setAiRec(null); }}
              className={input}
            >
              <option value="">— No truck assigned —</option>
              {availableTrucks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.license_plate} · {t.capacity_kg.toLocaleString()} kg · Available (Location: {t.current_location})
                </option>
              ))}
            </select>

            {/* AI reasoning pill */}
            {aiRec && (
              <div className="flex items-start gap-2 rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2.5">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-400" />
                <p className="text-xs leading-relaxed text-violet-300">{aiRec.justification}</p>
              </div>
            )}

            {availableTrucks.length === 0 && (
              <p className="text-xs text-slate-500">No trucks are currently available.</p>
            )}
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
              disabled={submitting || !!capacityError}
              className="flex items-center gap-2 rounded-lg bg-brand-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? 'Booking…' : 'Confirm Booking'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── AI Analysis Modal ──────────────────────────────────────────────── */}
      <Modal
        isOpen={aiOpen}
        onClose={closeAiModal}
        title={`AI Risk Assessment — ${aiShipment?.tracking_number ?? '…'}`}
      >
        {aiLoading ? (
          /* Loading state */
          <div className="flex flex-col items-center gap-5 py-8">
            <div className="relative flex h-16 w-16 items-center justify-center">
              {/* Outer pulse ring */}
              <span className="absolute inset-0 animate-ping rounded-full bg-sky-500/20" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-sky-500/30 bg-sky-500/10">
                <Brain className="h-7 w-7 text-sky-400" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-200">Haul247 AI is scanning transit logs</p>
              <p className="mt-1 text-xs text-slate-500">Detecting anomalies and computing risk score…</p>
            </div>
            {/* Animated skeleton bars */}
            <div className="w-full space-y-2 pt-2">
              {[90, 72, 55].map((w) => (
                <div
                  key={w}
                  className="h-2.5 animate-pulse rounded-full bg-surface-200"
                  style={{ width: `${w}%` }}
                />
              ))}
            </div>
          </div>
        ) : aiReport ? (
          /* Report state */
          <div className="flex flex-col gap-5">
            {/* Risk badge */}
            <div className="flex items-center gap-4">
              <span
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-base font-bold ring-1 ring-inset shadow-lg ${RISK[aiReport.risk_level].badge} ${RISK[aiReport.risk_level].glow}`}
              >
                <Brain className="h-5 w-5" />
                {RISK[aiReport.risk_level].label}
              </span>
              {/* Risk bar */}
              <div className="flex flex-1 flex-col gap-1">
                <span className="text-xs text-slate-500">Risk intensity</span>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-200">
                  <div
                    className={`h-full rounded-full transition-all ${RISK[aiReport.risk_level].bar}`}
                    style={{
                      width: aiReport.risk_level === 'Low'
                        ? '25%'
                        : aiReport.risk_level === 'Medium'
                        ? '60%'
                        : '90%',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Shipment meta */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { label: 'Tracking', value: aiReport.tracking_number },
                { label: 'Shipment ID', value: `#${aiReport.shipment_id}` },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg border border-surface-200 bg-surface-200/30 px-3 py-2">
                  <p className="text-slate-500">{label}</p>
                  <p className="mt-0.5 font-mono font-semibold text-slate-200">{value}</p>
                </div>
              ))}
            </div>

            {/* Assessment text */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="h-px flex-1 bg-surface-200" />
                <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Automated System Report
                </span>
                <span className="h-px flex-1 bg-surface-200" />
              </div>
              <div className="rounded-xl border border-surface-200 bg-surface-200/50 px-4 py-4">
                <p className="text-sm leading-relaxed text-slate-300">{aiReport.assessment}</p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-surface-200 pt-3">
              <p className="text-xs text-slate-600">
                Powered by Haul247 AI · GPT-4o
              </p>
              <button
                onClick={closeAiModal}
                className="rounded-lg border border-surface-200 px-4 py-1.5 text-xs font-medium text-slate-400 transition hover:border-slate-500 hover:text-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
