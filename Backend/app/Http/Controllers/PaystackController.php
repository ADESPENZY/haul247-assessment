<?php

namespace App\Http\Controllers;

use App\Enums\ShipmentStatus;
use App\Models\Shipment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class PaystackController extends Controller
{
    public function initiate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'shipment_id' => ['required', 'integer', 'exists:shipments,id'],
        ]);

        $shipment = Shipment::findOrFail($validated['shipment_id']);

        if ((int) $shipment->user_id !== (int) auth('api')->id()) {
            return response()->json(['message' => 'This shipment does not belong to you.'], 403);
        }

        if ($shipment->status !== ShipmentStatus::Pending) {
            return response()->json(['message' => 'Only pending shipments can be paid for.'], 422);
        }

        // ── Idempotency ───────────────────────────────────────────────────────
        // If the client sends an Idempotency-Key header, return the cached
        // response for any duplicate request within 24 hours — prevents double
        // payment initiations caused by network retries.
        // Falls back to a per-shipment natural key (1-hour window) when no
        // explicit key is provided.
        $userId         = auth('api')->id();
        $idempotencyKey = $request->header('Idempotency-Key')
            ?? 'shipment-' . $shipment->id;

        $cacheKey = "paystack:initiate:{$userId}:{$idempotencyKey}";
        $ttl      = $request->hasHeader('Idempotency-Key') ? 86400 : 3600;

        $cached = Cache::get($cacheKey);

        if ($cached) {
            return response()->json($cached)
                ->header('X-Idempotent-Replayed', 'true');
        }

        $reference = strtoupper('PAY-' . $shipment->tracking_number . '-' . Str::random(8));

        $payload = [
            'status'  => true,
            'message' => 'Authorization URL created',
            'data'    => [
                'authorization_url' => 'https://checkout.paystack.com/' . $reference,
                'access_code'       => $reference,
                'reference'         => $reference,
                'shipment_id'       => $shipment->id,
            ],
        ];

        Cache::put($cacheKey, $payload, $ttl);

        return response()->json($payload);
    }

    public function webhook(Request $request): JsonResponse
    {
        $payload = $request->json()->all();

        if (($payload['event'] ?? null) !== 'charge.success') {
            return response()->json(['status' => 'ignored'], 200);
        }

        $data       = $payload['data'] ?? [];
        $shipmentId = $data['metadata']['shipment_id'] ?? null;

        if (! $shipmentId) {
            return response()->json(['status' => 'no_shipment_id'], 200);
        }

        $shipment = Shipment::find($shipmentId);

        if (! $shipment || $shipment->status !== ShipmentStatus::Pending) {
            return response()->json(['status' => 'ok'], 200);
        }

        $shipment->update(['status' => ShipmentStatus::Paid]);

        return response()->json(['status' => 'ok'], 200);
    }
}
