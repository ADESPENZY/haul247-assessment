<?php

namespace App\Http\Controllers;

use App\Enums\ShipmentStatus;
use App\Models\Shipment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Enum;

class ShipmentController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Shipment::with(['user', 'truck'])->paginate(15));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'origin'      => ['required', 'string', 'max:255'],
            'destination' => ['required', 'string', 'max:255'],
            'weight_kg'   => ['required', 'integer', 'min:1'],
            'truck_id'    => ['nullable', 'integer', 'exists:trucks,id'],
        ]);

        $validated['user_id']         = auth('api')->id();
        $validated['tracking_number'] = strtoupper('SHP-' . Str::random(10));
        // Status is always pending at creation regardless of what the client sends.
        // It only advances after a driver explicitly accepts via POST /trucks/{truck}/accept/{shipment}.
        $validated['status']          = ShipmentStatus::Pending;

        $shipment = Shipment::create($validated);

        return response()->json($shipment->load(['user', 'truck']), 201);
    }

    public function show(Shipment $shipment): JsonResponse
    {
        return response()->json($shipment->load(['user', 'truck']));
    }

    public function update(Request $request, Shipment $shipment): JsonResponse
    {
        $validated = $request->validate([
            'origin'      => ['sometimes', 'string', 'max:255'],
            'destination' => ['sometimes', 'string', 'max:255'],
            'weight_kg'   => ['sometimes', 'integer', 'min:1'],
            'truck_id'    => ['nullable', 'integer', 'exists:trucks,id'],
            'status'      => ['sometimes', new Enum(ShipmentStatus::class)],
        ]);

        $shipment->update($validated);

        return response()->json($shipment->load(['user', 'truck']));
    }

    public function destroy(Shipment $shipment): JsonResponse
    {
        $shipment->delete();

        return response()->json(null, 204);
    }
}
