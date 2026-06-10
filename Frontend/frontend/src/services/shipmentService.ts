import api from '@/lib/api';
import { PaginatedResponse } from './truckService';

export type ShipmentStatus =
  | 'pending'
  | 'paid'
  | 'assigned'
  | 'in-transit'
  | 'delivered';

export interface Shipment {
  id: number;
  tracking_number: string;
  origin: string;
  destination: string;
  weight_kg: number;
  status: ShipmentStatus;
  user_id: number;
  truck_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface ShipmentPayload {
  origin: string;
  destination: string;
  weight_kg: number;
  truck_id?: number | null;
}

export interface ShipmentAnalysis {
  shipment_id: number;
  tracking_number: string;
  risk_level: 'Low' | 'Medium' | 'High';
  assessment: string;
}

export interface TruckRecommendation {
  truck_id: number;
  justification: string;
  truck: {
    license_plate: string;
    capacity_kg: number;
    current_location: string;
  };
}

const shipmentService = {
  getAll: (page = 1) =>
    api.get<PaginatedResponse<Shipment>>('/shipments', { params: { page } }),

  getById: (id: number) =>
    api.get<Shipment>(`/shipments/${id}`),

  create: (payload: ShipmentPayload) =>
    api.post<Shipment>('/shipments', payload),

  update: (id: number, payload: Partial<ShipmentPayload & { status: ShipmentStatus }>) =>
    api.put<Shipment>(`/shipments/${id}`, payload),

  analyze: (id: number) =>
    api.get<ShipmentAnalysis>(`/shipments/${id}/analyze`),

  recommendTruck: (payload: { origin: string; destination: string; weight_kg: number }) =>
    api.post<TruckRecommendation>('/shipments/recommend-truck', payload),

  initiatePayment: (shipmentId: number) =>
    api.post<{
      status: boolean;
      message: string;
      data: { authorization_url: string; access_code: string; reference: string; shipment_id: number };
    }>('/paystack/initiate', { shipment_id: shipmentId }),
};

export default shipmentService;
