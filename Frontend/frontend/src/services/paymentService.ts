import api from '@/lib/api';

export interface InitiatePaymentResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
    shipment_id: number;
  };
}

const paymentService = {
  initiate: (shipmentId: number) =>
    api.post<InitiatePaymentResponse>('/paystack/initiate', {
      shipment_id: shipmentId,
    }),
};

export default paymentService;
