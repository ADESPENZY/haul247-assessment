import api from '@/lib/api';
import { Shipment } from './shipmentService';

export interface Truck {
  id: number;
  license_plate: string;
  capacity_kg: number;
  status: 'available' | 'assigned' | 'in-transit' | 'maintenance';
  current_location: string;
  created_at: string;
  updated_at: string;
}

export interface TruckPayload {
  license_plate: string;
  capacity_kg: number;
  status?: Truck['status'];
  current_location?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

const truckService = {
  getAll: (page = 1) =>
    api.get<PaginatedResponse<Truck>>('/trucks', { params: { page } }),

  getById: (id: number) =>
    api.get<Truck>(`/trucks/${id}`),

  create: (payload: TruckPayload) =>
    api.post<Truck>('/trucks', payload),

  update: (id: number, payload: Partial<TruckPayload>) =>
    api.put<Truck>(`/trucks/${id}`, payload),

  destroy: (id: number) =>
    api.delete<void>(`/trucks/${id}`),

  acceptShipment: (truckId: number, shipmentId: number) =>
    api.post<Shipment>(`/trucks/${truckId}/accept/${shipmentId}`),
};

export default truckService;
